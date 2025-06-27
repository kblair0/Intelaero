/**
 * MeshblockService.ts - FIXED VERSION
 * 
 * Key Changes:
 * 1. Modified fetchMeshblockLayers to return both success and data
 * 2. Exported necessary cache functions for context access
 * 3. Added proper return type interface
 * Removed excessive console logs, keeping only essential error/warning messages
 */

import mapboxgl from 'mapbox-gl';
import { layerManager, MAP_LAYERS } from '../../services/LayerManager';
import * as turf from '@turf/turf';
import {
  MeshblockCollection,
  MeshblockFeature,
  ABSMeshblockAPIResponse,
  MeshblockCache,
  MeshblockError,
  MeshblockErrorType,
  LandUseCategory,
  DWELLING_ESTIMATES,
  MeshblockServiceConfig,
  PopulationCalculationOptions,
  MeshblockViewMode
} from './types';
import { createLandUseColorExpression, createPopulationDensityColorExpression } from './utils/meshblockColors';

// Service configuration
const MESHBLOCK_SERVICE_CONFIG: MeshblockServiceConfig = {
  apiUrl: 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/MB/MapServer/0',
  maxRecordsPerRequest: 2000,
  cacheExpiryMinutes: 60,
  maxCacheSize: 50,
  retryAttempts: 3,
  retryDelayMs: 1000
};

// Required fields from ABS API
const REQUIRED_FIELDS = [
  'mb_code_2021',  
  'mb_category_2021',      
  'area_albers_sqkm',    
  'sa2_name_2021', 
  'state_name_2021'
];

// In-memory cache for meshblock data
const meshblockCache = new Map<string, MeshblockCache>();

// Population calculation defaults
const DEFAULT_POPULATION_OPTIONS: PopulationCalculationOptions = {
  useConservativeEstimates: false,
  averageOccupancyRate: 2.4,
  includeInstitutionalPopulation: true
};

// Track attached event listeners to prevent duplicates
const attachedEventListeners = new WeakMap<mapboxgl.Map, boolean>();

// Return type for fetchMeshblockLayers
export interface FetchMeshblockLayersResult {
  success: boolean;
  data?: MeshblockCollection;
  error?: string;
}

/**
 * Generates a cache key from bounding box and zoom level
 */
export function generateCacheKey(bbox: number[], zoom: number): string {
  const roundedBbox = bbox.map(coord => Math.round(coord * 10000) / 10000);
  return `${roundedBbox.join(',')}-z${zoom}`;
}

/**
 * Maps ABS land use category string to our enum
 */
function mapLandUseCategory(absCategory: string): LandUseCategory {
  const categoryMap: Record<string, LandUseCategory> = {
    'Residential': LandUseCategory.RESIDENTIAL,
    'Commercial': LandUseCategory.COMMERCIAL, 
    'Industrial': LandUseCategory.INDUSTRIAL,
    'Parkland': LandUseCategory.PARKLAND,
    'Education': LandUseCategory.EDUCATION,
    'Hospital/Medical': LandUseCategory.HOSPITAL_MEDICAL,
    'Transport': LandUseCategory.TRANSPORT,
    'Primary Production': LandUseCategory.PRIMARY_PRODUCTION,
    'Water': LandUseCategory.WATER,
    'Other': LandUseCategory.OTHER
  };

  return categoryMap[absCategory] || LandUseCategory.OTHER;
}

/**
 * Calculates estimated dwellings and population for a meshblock
 */
function calculatePopulationEstimates(
  feature: MeshblockFeature, 
  options: PopulationCalculationOptions = DEFAULT_POPULATION_OPTIONS
): MeshblockFeature {
  const landUseCategory = mapLandUseCategory(feature.properties.mb_category_2021);
  const estimates = DWELLING_ESTIMATES[landUseCategory];
  
  const dwellingCount = options.useConservativeEstimates 
    ? estimates.min 
    : estimates.typical;
  
  let populationEstimate = dwellingCount * options.averageOccupancyRate;
  
  if (options.includeInstitutionalPopulation) {
    if (landUseCategory === LandUseCategory.EDUCATION) {
      populationEstimate += dwellingCount * 5;
    } else if (landUseCategory === LandUseCategory.HOSPITAL_MEDICAL) {
      populationEstimate += dwellingCount * 10;
    }
  }
  
  const populationDensity = feature.properties.area_albers_sqkm > 0 
    ? populationEstimate / feature.properties.area_albers_sqkm 
    : 0;

  return {
    ...feature,
    properties: {
      ...feature.properties,
      landUseCategory,
      estimatedDwellings: Math.round(dwellingCount),
      estimatedPopulation: Math.round(populationEstimate),
      populationDensity: Math.round(populationDensity * 100) / 100,
      processedAt: new Date().toISOString(),
      analysisVersion: '1.0'
    }
  };
}

/**
 * Processes raw ABS API response into enhanced meshblock collection
 */
function processABSResponse(
  response: ABSMeshblockAPIResponse,
  requestBounds: number[],
  requestZoom: number
): MeshblockCollection {
  const enhancedFeatures = response.features.map(feature => {
    const meshblockFeature: MeshblockFeature = {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        mb_code_2021: feature.properties.mb_code_2021,           
        mb_category_2021: feature.properties.mb_category_2021,   
        area_albers_sqkm: feature.properties.area_albers_sqkm,   
        sa2_name_2021: feature.properties.sa2_name_2021,         
        state_name_2021: feature.properties.state_name_2021,     
        intersectsFlightPath: false
      }
    };
    
    return calculatePopulationEstimates(meshblockFeature);
  });

  return {
    type: 'FeatureCollection',
    features: enhancedFeatures,
    properties: {
      totalFeatures: enhancedFeatures.length,
      requestBounds,
      requestZoom,
      fetchedAt: new Date().toISOString(),
      source: 'abs-api'
    }
  };
}

/**
 * Retrieves meshblock data from cache if available and not expired
 */
export function getCachedMeshblocks(cacheKey: string): MeshblockCollection | null {
  const cached = meshblockCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  if (Date.now() > cached.expiresAt) {
    meshblockCache.delete(cacheKey);
    return null;
  }
  
  return cached.data;
}

/**
 * Stores meshblock data in cache with expiry
 */
function cacheMeshblocks(cacheKey: string, data: MeshblockCollection): void {
  if (meshblockCache.size >= MESHBLOCK_SERVICE_CONFIG.maxCacheSize) {
    const oldestKey = meshblockCache.keys().next().value;
    if (oldestKey) {
      meshblockCache.delete(oldestKey);
    }
  }
  
  const expiresAt = Date.now() + (MESHBLOCK_SERVICE_CONFIG.cacheExpiryMinutes * 60 * 1000);
  
  const cacheEntry: MeshblockCache = {
    key: cacheKey,
    data,
    expiresAt,
    size: data.features.length
  };
  
  meshblockCache.set(cacheKey, cacheEntry);
}

/**
 * Creates a structured error object
 */
function createMeshblockError(
  type: MeshblockErrorType,
  message: string,
  details?: any,
  retryable: boolean = false
): MeshblockError {
  return {
    type,
    message,
    details,
    retryable,
    timestamp: new Date().toISOString()
  };
}

/**
 * Fetches meshblock data from ABS API with retry logic
 */
async function fetchMeshblocksFromAPI(bbox: number[], zoom: number): Promise<MeshblockCollection> {
  const queryParams = new URLSearchParams({
    where: '1=1',
    outFields: REQUIRED_FIELDS.join(','),
    geometry: bbox.join(','),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    returnGeometry: 'true',
    resultRecordCount: MESHBLOCK_SERVICE_CONFIG.maxRecordsPerRequest.toString(),
    f: 'geojson'
  });

  const queryUrl = `${MESHBLOCK_SERVICE_CONFIG.apiUrl}/query?${queryParams.toString()}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MESHBLOCK_SERVICE_CONFIG.retryAttempts; attempt++) {
    try {
      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/geo+json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw createMeshblockError(
          MeshblockErrorType.API_ERROR,
          `ABS API returned ${response.status}: ${response.statusText}`,
          { status: response.status, responseText: errorText },
          response.status >= 500
        );
      }
      
      const data: ABSMeshblockAPIResponse = await response.json();
      
      if (!data.features || !Array.isArray(data.features)) {
        throw createMeshblockError(
          MeshblockErrorType.PARSING_ERROR,
          'Invalid response format from ABS API',
          { response: data },
          false
        );
      }
      
      if (data.features.length >= MESHBLOCK_SERVICE_CONFIG.maxRecordsPerRequest) {
        console.warn(`[MeshblockService] Hit maximum record limit. Some meshblocks may not be displayed.`);
      }
      
      return processABSResponse(data, bbox, zoom);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof Error && 'retryable' in error && !error.retryable) {
        break;
      }
      
      if (attempt < MESHBLOCK_SERVICE_CONFIG.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, MESHBLOCK_SERVICE_CONFIG.retryDelayMs * attempt));
      }
    }
  }
  
  throw lastError || createMeshblockError(
    MeshblockErrorType.NETWORK_ERROR,
    'Failed to fetch meshblock data after all retry attempts',
    null,
    false
  );
}

/**
 * Main function to fetch and display meshblock layers on the map
 */
export async function fetchMeshblockLayers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection,
  setLayerVisibility: (layerId: string, visible: boolean) => void,
  selectMeshblock?: (meshblock: MeshblockFeature | null) => void
): Promise<FetchMeshblockLayersResult> {
  try {
   
    const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
    const cacheKey = generateCacheKey(boundingBox, 14); // Use fixed zoom for caching
    
    let meshblockData = getCachedMeshblocks(cacheKey);
    
    if (!meshblockData) {
      meshblockData = await fetchMeshblocksFromAPI(boundingBox, 14);
      cacheMeshblocks(cacheKey, meshblockData);
    }
    
    if (meshblockData.features.length > 0) {
      const landUseSuccess = layerManager.addLayer(
        MAP_LAYERS.MESHBLOCK_LANDUSE,
        {
          type: 'geojson',
          data: meshblockData
        },
        {
          id: MAP_LAYERS.MESHBLOCK_LANDUSE,
          type: 'fill',
          source: MAP_LAYERS.MESHBLOCK_LANDUSE,
          paint: {
            'fill-color': createLandUseColorExpression(0.7) as any,
            'fill-opacity': 0.7,
            'fill-outline-color': '#000000'
          }
        },
        undefined,
        true
      );

      const populationSuccess = layerManager.addLayer(
        MAP_LAYERS.MESHBLOCK_POPULATION,
        {
          type: 'geojson', 
          data: meshblockData
        },
        {
          id: MAP_LAYERS.MESHBLOCK_POPULATION,
          type: 'fill',
          source: MAP_LAYERS.MESHBLOCK_POPULATION,
          paint: {
            'fill-color': createPopulationDensityColorExpression(0.7) as any,
            'fill-opacity': 0.7,
            'fill-outline-color': '#000000'
          }
        },
        undefined,
        false
      );

      if (landUseSuccess && populationSuccess) {
        if (selectMeshblock) {
          addMeshblockClickHandlers(map, selectMeshblock);
        }
        
        setLayerVisibility(MAP_LAYERS.MESHBLOCK_LANDUSE, true);
        setLayerVisibility(MAP_LAYERS.MESHBLOCK_POPULATION, false);
        
        return { success: true, data: meshblockData };
      } else {
        return { success: false, error: 'Failed to create meshblock layers' };
      }
    } else {
      return { success: false, error: 'No meshblock features to display' };
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[MeshblockService] Failed to fetch meshblock layers:', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates existing meshblock layers with filtered data
 */
export async function updateMeshblockLayers(
  map: mapboxgl.Map,
  filteredMeshblocks: MeshblockCollection | null,
  viewMode: MeshblockViewMode = MeshblockViewMode.LAND_USE
): Promise<boolean> {
  try {
    if (!map) {
      return false;
    }

    if (!filteredMeshblocks || filteredMeshblocks.features.length === 0) {
      if (map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE)) {
        map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_LANDUSE, 'visibility', 'none');
      }
      if (map.getLayer(MAP_LAYERS.MESHBLOCK_POPULATION)) {
        map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_POPULATION, 'visibility', 'none');
      }
      return true;
    }

    const landUseSource = map.getSource(MAP_LAYERS.MESHBLOCK_LANDUSE) as mapboxgl.GeoJSONSource;
    const populationSource = map.getSource(MAP_LAYERS.MESHBLOCK_POPULATION) as mapboxgl.GeoJSONSource;

    if (landUseSource) {
      landUseSource.setData(filteredMeshblocks);
    }

    if (populationSource) {
      populationSource.setData(filteredMeshblocks);
    }

    const landUseVisible = viewMode === MeshblockViewMode.LAND_USE;
    const populationVisible = viewMode === MeshblockViewMode.POPULATION_DENSITY;

    if (map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE)) {
      map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_LANDUSE, 'visibility', landUseVisible ? 'visible' : 'none');
    }

    if (map.getLayer(MAP_LAYERS.MESHBLOCK_POPULATION)) {
      map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_POPULATION, 'visibility', populationVisible ? 'visible' : 'none');
    }

    return true;

  } catch (error) {
    console.error('[MeshblockService] Error updating meshblock layers:', error);
    return false;
  }
}

/**
 * Clears the meshblock cache
 */
export function clearMeshblockCache(): void {
  meshblockCache.clear();
}

/**
 * Gets current cache statistics for monitoring
 */
export function getMeshblockCacheStats() {
  const entries = Array.from(meshblockCache.values());
  const totalFeatures = entries.reduce((sum, entry) => sum + entry.size, 0);
  const validEntries = entries.filter(entry => Date.now() <= entry.expiresAt);
  
  return {
    totalEntries: meshblockCache.size,
    validEntries: validEntries.length,
    totalFeaturesCached: totalFeatures,
    memoryEstimateMB: Math.round((totalFeatures * 1024) / (1024 * 1024) * 100) / 100
  };
}

/**
 * Adds click event handlers to meshblock layers
 */
export function addMeshblockClickHandlers(
  map: mapboxgl.Map, 
  selectMeshblock: (meshblock: MeshblockFeature | null) => void
): void {
  if (attachedEventListeners.has(map)) {
    removeMeshblockClickHandlers(map);
  }
  
  const landUseLayerExists = !!map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE);
  const populationLayerExists = !!map.getLayer(MAP_LAYERS.MESHBLOCK_POPULATION);
  
  if (!landUseLayerExists) {
    console.error(`[MeshblockService] Land use layer does not exist!`);
    return;
  }
  
  const handleMeshblockClick = (e: mapboxgl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      const feature = e.features[0];
      selectMeshblock(feature as unknown as MeshblockFeature);
    }
  };
  
  try {
    map.on('click', MAP_LAYERS.MESHBLOCK_LANDUSE, handleMeshblockClick);
    
    if (populationLayerExists) {
      map.on('click', MAP_LAYERS.MESHBLOCK_POPULATION, handleMeshblockClick);
    }
    
    map.on('mouseenter', MAP_LAYERS.MESHBLOCK_LANDUSE, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', MAP_LAYERS.MESHBLOCK_LANDUSE, () => {
      map.getCanvas().style.cursor = '';
    });
    
    if (populationLayerExists) {
      map.on('mouseenter', MAP_LAYERS.MESHBLOCK_POPULATION, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', MAP_LAYERS.MESHBLOCK_POPULATION, () => {
        map.getCanvas().style.cursor = '';
      });
    }
    
    attachedEventListeners.set(map, true);
    
  } catch (error) {
    console.error('[MeshblockService] Error attaching click handlers:', error);
  }
}

/**
 * Remove meshblock click handlers
 */
export function removeMeshblockClickHandlers(map: mapboxgl.Map): void {
  try {
    attachedEventListeners.delete(map);
    
    if (map.getCanvas()) {
      map.getCanvas().style.cursor = '';
    }
  } catch (error) {
    console.error('[MeshblockService] Error removing click handlers:', error);
  }
}