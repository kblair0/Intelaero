/**
 * CadastreService.ts
 * 
 * Purpose:
 * Service layer for fetching and processing NSW Cadastre property boundaries 
 * and survey marks. Handles API calls, caching, error handling, and data 
 * transformation following the established meshblock service pattern.
 * 
 * Key Features:
 * - Fetches property boundaries from NSW Cadastre API
 * - Fetches survey marks from NSW Survey Mark API  
 * - Implements caching to reduce API calls and costs
 * - Handles coordinate transformations and data processing
 * - Manages map layer creation and styling
 * - Provides click handling for property selection
 * 
 * Related Files:
 * - types.ts - Type definitions used throughout this service
 * - CadastreContext.tsx - Consumes this service for state management
 * - CadastreDisplay.tsx - Uses layer management functions
 * - LayerManager.ts - Handles actual map layer operations
 */

import mapboxgl from 'mapbox-gl';
import { layerManager, MAP_LAYERS } from '../../services/LayerManager';
import * as turf from '@turf/turf';
import {
  PropertyCollection,
  SurveyMarkCollection,
  PropertyFeature,
  SurveyMarkFeature,
  NSWCadastreAPIResponse,
  NSWSurveyMarkAPIResponse,
  CadastreCache,
  CadastreError,
  CadastreErrorType,
  CadastreServiceConfig,
  CadastreAPIParams,
  CadastreServiceResponse,
  CadastreViewMode,
  PropertyType,
  SurveyMarkType,
  DEFAULT_CADASTRE_CONFIG,
  REQUIRED_PROPERTY_FIELDS,
  REQUIRED_SURVEY_MARK_FIELDS,
  PROPERTY_TYPE_COLORS,
  SURVEY_MARK_COLORS
} from './cadastre-types';

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

const CADASTRE_SERVICE_CONFIG: CadastreServiceConfig = DEFAULT_CADASTRE_CONFIG;

// In-memory cache for cadastre data
const cadastreCache = new Map<string, CadastreCache>();

// Track attached event listeners to prevent duplicates
const attachedEventListeners = new WeakMap<mapboxgl.Map, boolean>();

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Generates a cache key from bounding box and data type
 */
export function generateCacheKey(bbox: number[], dataType: 'properties' | 'surveymarks'): string {
  const roundedBbox = bbox.map(coord => Math.round(coord * 10000) / 10000);
  return `${dataType}-${roundedBbox.join(',')}-z15`;
}

/**
 * Retrieves cached data if available and not expired
 */
export function getCachedData(cacheKey: string): CadastreCache | null {
  const cached = cadastreCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  if (Date.now() > cached.expiresAt) {
    cadastreCache.delete(cacheKey);
    return null;
  }
  
  return cached;
}

/**
 * Stores data in cache with expiry
 */
function cacheData(cacheKey: string, data: Partial<CadastreCache>): void {
  if (cadastreCache.size >= CADASTRE_SERVICE_CONFIG.maxCacheSize) {
    const oldestKey = cadastreCache.keys().next().value;
    if (oldestKey) {
      cadastreCache.delete(oldestKey);
    }
  }
  
  const expiresAt = Date.now() + (CADASTRE_SERVICE_CONFIG.cacheExpiryMinutes * 60 * 1000);
  
  const cacheEntry: CadastreCache = {
    key: cacheKey,
    properties: data.properties,
    surveyMarks: data.surveyMarks,
    expiresAt,
    size: (data.properties?.features.length || 0) + (data.surveyMarks?.features.length || 0)
  };
  
  cadastreCache.set(cacheKey, cacheEntry);
}

/**
 * Clears the cadastre cache
 */
export function clearCadastreCache(): void {
  cadastreCache.clear();
}

/**
 * Gets current cache statistics
 */
export function getCadastreCacheStats() {
  const entries = Array.from(cadastreCache.values());
  const totalFeatures = entries.reduce((sum, entry) => sum + entry.size, 0);
  const validEntries = entries.filter(entry => Date.now() <= entry.expiresAt);
  
  return {
    totalEntries: cadastreCache.size,
    validEntries: validEntries.length,
    totalFeaturesCached: totalFeatures,
    memoryEstimateMB: Math.round((totalFeatures * 512) / (1024 * 1024) * 100) / 100
  };
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Creates a structured error object
 */
function createCadastreError(
  type: CadastreErrorType,
  message: string,
  details?: any,
  retryable: boolean = false
): CadastreError {
  return {
    type,
    message,
    details,
    retryable,
    timestamp: new Date().toISOString()
  };
}

// =============================================================================
// DATA PROCESSING
// =============================================================================

/**
 * Determines property type from plan and lot characteristics
 */
function determinePropertyType(feature: any): PropertyType {
  const { planlabel, lotnumber, planlotarea, sectionnumber, shape_Area } = feature.properties;
  
  // Use shape_Area if planlotarea is null
  const lotArea = planlotarea || shape_Area || 0;
  
  // Check for road reserves (typically have section numbers and specific patterns)
  if (sectionnumber && (
    lotnumber?.toLowerCase().includes('road') || 
    lotnumber?.toLowerCase().includes('reserve') ||
    lotnumber?.toLowerCase().includes('easement')
  )) {
    return PropertyType.ROAD_RESERVE;
  }
  
  // Check for strata/community title
  if (planlabel?.includes('SP') || planlabel?.includes('PS') || planlabel?.includes('BU')) {
    return PropertyType.STRATA_UNIT;
  }
  
  // Check for very large properties (likely rural)
  if (lotArea > 100000) { // > 10 hectares
    return PropertyType.RURAL_LOT;
  }
  
  // Check for medium-large properties (could be rural or industrial)
  if (lotArea > 40000) { // > 4 hectares
    // Could be rural or industrial based on plan type
    if (planlabel?.includes('DP') && parseInt(lotnumber) < 50) {
      return PropertyType.RURAL_LOT;
    }
    return PropertyType.COMMERCIAL_LOT;
  }
  
  // Check for crown land indicators
  if (planlabel?.includes('R') || lotnumber?.toLowerCase().includes('crown')) {
    return PropertyType.CROWN_LAND;
  }
  
  // Default to residential for smaller lots
  if (lotArea < 5000) { // < 0.5 hectares
    return PropertyType.RESIDENTIAL_LOT;
  }
  
  // Medium-sized lots
  return PropertyType.OTHER;
}

/**
 * Determines survey mark type from mark characteristics
 */
function determineSurveyMarkType(marktype: string, trigtype: string): SurveyMarkType {
  const type = marktype?.toLowerCase() || '';
  const trig = trigtype?.toLowerCase() || '';
  
  if (trig === 't' || type.includes('trig')) {
    return SurveyMarkType.TRIGONOMETRIC;
  }
  
  if (type.includes('traverse')) {
    return SurveyMarkType.TRAVERSE;
  }
  
  if (type.includes('bench') || type.includes('bm')) {
    return SurveyMarkType.BENCHMARK;
  }
  
  if (type.includes('boundary') || type.includes('corner')) {
    return SurveyMarkType.BOUNDARY;
  }
  
  if (type.includes('reference') || type.includes('ref')) {
    return SurveyMarkType.REFERENCE;
  }
  
  if (type.includes('control')) {
    return SurveyMarkType.CONTROL;
  }
  
  return SurveyMarkType.OTHER;
}

/**
 * Processes raw NSW Cadastre API response into enhanced property collection
 */
function processPropertyResponse(
  response: NSWCadastreAPIResponse,
  requestBounds: number[]
): PropertyCollection {
  const enhancedFeatures: PropertyFeature[] = response.features.map(feature => {
    const lotArea = feature.properties.planlotarea || feature.properties.shape_Area || 0;
    const areaHectares = lotArea / 10000;
    const areaDisplay = areaHectares > 1 
      ? `${areaHectares.toFixed(2)} ha`
      : `${lotArea.toLocaleString()} m²`;
    
    const lotPlanId = feature.properties.lotidstring || `Lot ${feature.properties.lotnumber} ${feature.properties.planlabel}`;
    const propertyType = determinePropertyType(feature);
    
    const propertyFeature: PropertyFeature = {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        hasstratum: feature.properties.hasstratum === 2,
        areaHectares,
        areaDisplay,
        lotPlanId,
        propertyType,
        isSelected: false,
        isHighlighted: false,
        processedAt: new Date().toISOString(),
        dataSource: 'nsw-cadastre' as const
      }
    };
    
    return propertyFeature;
  });

  return {
    type: 'FeatureCollection',
    features: enhancedFeatures,
    properties: {
      totalFeatures: enhancedFeatures.length,
      requestBounds,
      requestZoom: 15,
      fetchedAt: new Date().toISOString(),
      source: 'nsw-cadastre'
    }
  };
}

/**
 * Processes raw NSW Survey Mark API response into enhanced survey mark collection
 */
function processSurveyMarkResponse(
  response: NSWSurveyMarkAPIResponse,
  requestBounds: number[]
): SurveyMarkCollection {
  const enhancedFeatures: SurveyMarkFeature[] = response.features.map(feature => {
    const markType = determineSurveyMarkType(feature.properties.marktype, feature.properties.trigtype);
    const coordinateDisplay = `${feature.properties.mgaeasting.toFixed(2)}, ${feature.properties.mganorthing.toFixed(2)}`;
    const elevationDisplay = feature.properties.ahdheight 
      ? `${feature.properties.ahdheight.toFixed(2)} m AHD`
      : 'No elevation data';
    // Handle null trigname
    const displayName = feature.properties.trigname || `Mark ${feature.properties.marknumber}`;
    
    const surveyMarkFeature: SurveyMarkFeature = {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        
        displayName: feature.properties.trigname || `Mark ${feature.properties.marknumber}`,
        coordinateDisplay,
        elevationDisplay,
        isSelected: false,
        processedAt: new Date().toISOString(),
        dataSource: 'nsw-survey-marks' as const
      }
    };
    
    return surveyMarkFeature;
  });

  return {
    type: 'FeatureCollection',
    features: enhancedFeatures,
    properties: {
      totalFeatures: enhancedFeatures.length,
      requestBounds,
      requestZoom: 15,
      fetchedAt: new Date().toISOString(),
      source: 'nsw-survey-marks'
    }
  };
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetches property data from NSW Cadastre API with retry logic
 */
async function fetchPropertiesFromAPI(bbox: number[]): Promise<PropertyCollection> {
  const queryParams = new URLSearchParams({
    where: '1=1',
    outFields: REQUIRED_PROPERTY_FIELDS.join(','),
    geometry: bbox.join(','),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    returnGeometry: 'true',
    resultRecordCount: CADASTRE_SERVICE_CONFIG.maxRecordsPerRequest.toString(),
    f: 'geojson'
  });

  const queryUrl = `${CADASTRE_SERVICE_CONFIG.cadastreApiUrl}/query?${queryParams.toString()}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= CADASTRE_SERVICE_CONFIG.retryAttempts; attempt++) {
    try {
      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/geo+json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw createCadastreError(
          CadastreErrorType.API_ERROR,
          `NSW Cadastre API returned ${response.status}: ${response.statusText}`,
          { status: response.status, responseText: errorText },
          response.status >= 500
        );
      }
      
      const data: NSWCadastreAPIResponse = await response.json();
      
      if (!data.features || !Array.isArray(data.features)) {
        throw createCadastreError(
          CadastreErrorType.PARSING_ERROR,
          'Invalid response format from NSW Cadastre API',
          { response: data },
          false
        );
      }
      
      if (data.features.length >= CADASTRE_SERVICE_CONFIG.maxRecordsPerRequest) {
        console.warn(`[CadastreService] Hit maximum record limit for properties. Some properties may not be displayed.`);
      }
      
      return processPropertyResponse(data, bbox);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof Error && 'retryable' in error && !error.retryable) {
        break;
      }
      
      if (attempt < CADASTRE_SERVICE_CONFIG.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, CADASTRE_SERVICE_CONFIG.retryDelayMs * attempt));
      }
    }
  }
  
  throw lastError || createCadastreError(
    CadastreErrorType.NETWORK_ERROR,
    'Failed to fetch property data after all retry attempts',
    null,
    false
  );
}

/**
 * Fetches survey mark data from NSW Survey Mark API with retry logic
 */
async function fetchSurveyMarksFromAPI(bbox: number[]): Promise<SurveyMarkCollection> {
  const queryParams = new URLSearchParams({
    where: '1=1',
    outFields: REQUIRED_SURVEY_MARK_FIELDS.join(','),
    geometry: bbox.join(','),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    returnGeometry: 'true',
    resultRecordCount: CADASTRE_SERVICE_CONFIG.maxRecordsPerRequest.toString(),
    f: 'geojson'
  });

  const queryUrl = `${CADASTRE_SERVICE_CONFIG.surveyMarkApiUrl}/query?${queryParams.toString()}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= CADASTRE_SERVICE_CONFIG.retryAttempts; attempt++) {
    try {
      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/geo+json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw createCadastreError(
          CadastreErrorType.API_ERROR,
          `NSW Survey Mark API returned ${response.status}: ${response.statusText}`,
          { status: response.status, responseText: errorText },
          response.status >= 500
        );
      }
      
      const data: NSWSurveyMarkAPIResponse = await response.json();
      
      if (!data.features || !Array.isArray(data.features)) {
        throw createCadastreError(
          CadastreErrorType.PARSING_ERROR,
          'Invalid response format from NSW Survey Mark API',
          { response: data },
          false
        );
      }
      
      if (data.features.length >= CADASTRE_SERVICE_CONFIG.maxRecordsPerRequest) {
        console.warn(`[CadastreService] Hit maximum record limit for survey marks. Some marks may not be displayed.`);
      }
      
      return processSurveyMarkResponse(data, bbox);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof Error && 'retryable' in error && !error.retryable) {
        break;
      }
      
      if (attempt < CADASTRE_SERVICE_CONFIG.retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, CADASTRE_SERVICE_CONFIG.retryDelayMs * attempt));
      }
    }
  }
  
  throw lastError || createCadastreError(
    CadastreErrorType.NETWORK_ERROR,
    'Failed to fetch survey mark data after all retry attempts',
    null,
    false
  );
}

// =============================================================================
// MAP LAYER MANAGEMENT
// =============================================================================

/**
 * Creates property boundary styling
 */
function createPropertyBoundaryStyle() {
  return {
    id: MAP_LAYERS.CADASTRE_PROPERTIES,
    type: 'line' as const,
    source: MAP_LAYERS.CADASTRE_PROPERTIES,
    paint: {
      'line-color': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        '#FF0080', // Bright magenta for selected
        ['boolean', ['get', 'isHighlighted'], false], 
        '#00FFFF', // Bright cyan for highlighted
        '#FFD700'  // Bright gold for normal - excellent on satellite
      ] as any,
      'line-width': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        4,         // Thicker for selected
        ['boolean', ['get', 'isHighlighted'], false],
        3,         // Medium for highlighted
        2          // Thicker default for better visibility
      ] as any,
      'line-opacity': 0.9  // Higher opacity for better visibility
    }
  };
}

/**
 * Creates property fill styling for clickable areas
 */
function createPropertyFillStyle() {
  return {
    id: MAP_LAYERS.CADASTRE_PROPERTIES_FILL,
    type: 'fill' as const,
    source: MAP_LAYERS.CADASTRE_PROPERTIES,
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        '#FF0080', // Bright magenta for selected
        ['boolean', ['get', 'isHighlighted'], false], 
        '#00FFFF', // Bright cyan for highlighted
        '#FFD700'  // Bright gold for normal
      ] as any,
      'fill-opacity': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        0.2,       // More visible when selected
        ['boolean', ['get', 'isHighlighted'], false],
        0.15,      // Slightly visible when highlighted
        0.05       // Nearly transparent for normal (just clickable)
      ] as any
    }
  };
}

/**
 * Creates survey mark styling
 */
function createSurveyMarkStyle() {
  return {
    id: MAP_LAYERS.CADASTRE_SURVEY_MARKS,
    type: 'circle' as const,
    source: MAP_LAYERS.CADASTRE_SURVEY_MARKS,
    paint: {
      'circle-color': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        '#FF0080', // Bright magenta for selected
        '#FF6600'  // Bright orange for normal - great on satellite
      ] as any,
      'circle-radius': [
        'case',
        ['boolean', ['get', 'isSelected'], false],
        10,        // Larger for selected
        7          // Larger default for better visibility
      ] as any,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 3,  // Thicker white border
      'circle-opacity': 0.95     // Very high opacity
    }
  };
}

/**
 * Main function to fetch and display cadastre layers on the map
 */
export async function fetchCadastreLayers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection,
  setLayerVisibility: (layerId: string, visible: boolean) => void,
  selectProperty?: (feature: PropertyFeature | null) => void,
  selectSurveyMark?: (feature: SurveyMarkFeature | null) => void,
  viewMode: CadastreViewMode = CadastreViewMode.BOTH
): Promise<CadastreServiceResponse<{ properties?: PropertyCollection; surveyMarks?: SurveyMarkCollection }>> {
  try {
    const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
    
    let properties: PropertyCollection | undefined;
    let surveyMarks: SurveyMarkCollection | undefined;
    
    // Check if we need properties
    if (viewMode === CadastreViewMode.PROPERTIES_ONLY || viewMode === CadastreViewMode.BOTH) {
      const propertyCacheKey = generateCacheKey(boundingBox, 'properties');
      const cachedProperties = getCachedData(propertyCacheKey);
      
      if (cachedProperties?.properties) {
        properties = cachedProperties.properties;
      } else {
        properties = await fetchPropertiesFromAPI(boundingBox);
        cacheData(propertyCacheKey, { properties });
      }
    }
    
    // Check if we need survey marks
    if (viewMode === CadastreViewMode.SURVEY_MARKS_ONLY || viewMode === CadastreViewMode.BOTH) {
      const surveyMarkCacheKey = generateCacheKey(boundingBox, 'surveymarks');
      const cachedSurveyMarks = getCachedData(surveyMarkCacheKey);
      
      if (cachedSurveyMarks?.surveyMarks) {
        surveyMarks = cachedSurveyMarks.surveyMarks;
      } else {
        surveyMarks = await fetchSurveyMarksFromAPI(boundingBox);
        cacheData(surveyMarkCacheKey, { surveyMarks });
      }
    }
    
    // Create map layers
    let layersCreated = 0;
    let layersAttempted = 0;
    
    if (properties && properties.features.length > 0) {
      layersAttempted += 2; // Now creating 2 layers (fill + line)
      
      // Add fill layer first (so it appears behind the line)
      const propertyFillSuccess = layerManager.addLayer(
        MAP_LAYERS.CADASTRE_PROPERTIES_FILL,
        {
          type: 'geojson',
          data: properties
        },
        createPropertyFillStyle(),
        undefined,
        viewMode === CadastreViewMode.PROPERTIES_ONLY || viewMode === CadastreViewMode.BOTH
      );
      
      // Add line layer second (so it appears on top)
      const propertyLineSuccess = layerManager.addLayer(
        MAP_LAYERS.CADASTRE_PROPERTIES,
        {
          type: 'geojson',
          data: properties
        },
        createPropertyBoundaryStyle(),
        undefined,
        viewMode === CadastreViewMode.PROPERTIES_ONLY || viewMode === CadastreViewMode.BOTH
      );
      
      if (propertyFillSuccess) {
        layersCreated++;
        setLayerVisibility(MAP_LAYERS.CADASTRE_PROPERTIES_FILL, true);
      }
      
      if (propertyLineSuccess) {
        layersCreated++;
        setLayerVisibility(MAP_LAYERS.CADASTRE_PROPERTIES, true);
      }
    }
    
    if (surveyMarks && surveyMarks.features.length > 0) {
      layersAttempted++;
      const surveyMarkSuccess = layerManager.addLayer(
        MAP_LAYERS.CADASTRE_SURVEY_MARKS,
        {
          type: 'geojson', 
          data: surveyMarks
        },
        createSurveyMarkStyle(),
        undefined,
        viewMode === CadastreViewMode.SURVEY_MARKS_ONLY || viewMode === CadastreViewMode.BOTH
      );
      
      if (surveyMarkSuccess) {
        layersCreated++;
        setLayerVisibility(MAP_LAYERS.CADASTRE_SURVEY_MARKS, true);
      }
    }
    
    // Add click handlers if selection functions provided
    if ((selectProperty || selectSurveyMark) && (properties || surveyMarks)) {
      addCadastreClickHandlers(map, selectProperty, selectSurveyMark);
    }
    
    if (layersCreated === layersAttempted && layersAttempted > 0) {
      return { 
        success: true, 
        data: { properties, surveyMarks },
        cached: false // TODO: Track if data came from cache
      };
    } else {
      return { 
        success: false, 
        error: `Failed to create ${layersAttempted - layersCreated} of ${layersAttempted} cadastre layers`
      };
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[CadastreService] Failed to fetch cadastre layers:', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates existing cadastre layers with new view mode or data
 */
export async function updateCadastreLayers(
  map: mapboxgl.Map,
  properties: PropertyCollection | null,
  surveyMarks: SurveyMarkCollection | null,
  viewMode: CadastreViewMode = CadastreViewMode.BOTH
): Promise<boolean> {
  try {
    if (!map) {
      return false;
    }

    // Update property layer
    const propertySource = map.getSource(MAP_LAYERS.CADASTRE_PROPERTIES) as mapboxgl.GeoJSONSource;
    if (propertySource && properties) {
      propertySource.setData(properties);
    }

    // Update survey mark layer
    const surveyMarkSource = map.getSource(MAP_LAYERS.CADASTRE_SURVEY_MARKS) as mapboxgl.GeoJSONSource;
    if (surveyMarkSource && surveyMarks) {
      surveyMarkSource.setData(surveyMarks);
    }

    // Update visibility based on view mode
    const showProperties = viewMode === CadastreViewMode.PROPERTIES_ONLY || viewMode === CadastreViewMode.BOTH;
    const showSurveyMarks = viewMode === CadastreViewMode.SURVEY_MARKS_ONLY || viewMode === CadastreViewMode.BOTH;

    if (map.getLayer(MAP_LAYERS.CADASTRE_PROPERTIES)) {
      map.setLayoutProperty(MAP_LAYERS.CADASTRE_PROPERTIES, 'visibility', showProperties ? 'visible' : 'none');
    }
    
    if (map.getLayer(MAP_LAYERS.CADASTRE_PROPERTIES_FILL)) {
      map.setLayoutProperty(MAP_LAYERS.CADASTRE_PROPERTIES_FILL, 'visibility', showProperties ? 'visible' : 'none');
    }

    if (map.getLayer(MAP_LAYERS.CADASTRE_SURVEY_MARKS)) {
      map.setLayoutProperty(MAP_LAYERS.CADASTRE_SURVEY_MARKS, 'visibility', showSurveyMarks ? 'visible' : 'none');
    }

    return true;

  } catch (error) {
    console.error('[CadastreService] Error updating cadastre layers:', error);
    return false;
  }
}

/**
 * Adds click event handlers to cadastre layers
 */
export function addCadastreClickHandlers(
  map: mapboxgl.Map, 
  selectProperty?: (feature: PropertyFeature | null) => void,
  selectSurveyMark?: (feature: SurveyMarkFeature | null) => void
): void {
  if (attachedEventListeners.has(map)) {
    removeCadastreClickHandlers(map);
  }
  
  const propertyLayerExists = !!map.getLayer(MAP_LAYERS.CADASTRE_PROPERTIES);
  const surveyMarkLayerExists = !!map.getLayer(MAP_LAYERS.CADASTRE_SURVEY_MARKS);
  
  try {
    // Property click handlers
    // Property click handlers
    const propertyFillLayerExists = !!map.getLayer(MAP_LAYERS.CADASTRE_PROPERTIES_FILL);
    
    if ((propertyLayerExists || propertyFillLayerExists) && selectProperty) {
      const handlePropertyClick = (e: mapboxgl.MapLayerMouseEvent) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          selectProperty(feature as unknown as PropertyFeature);
        }
      };
      
      // Add handlers to both line and fill layers
      if (propertyLayerExists) {
        map.on('click', MAP_LAYERS.CADASTRE_PROPERTIES, handlePropertyClick);
        map.on('mouseenter', MAP_LAYERS.CADASTRE_PROPERTIES, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', MAP_LAYERS.CADASTRE_PROPERTIES, () => {
          map.getCanvas().style.cursor = '';
        });
      }
      
      if (propertyFillLayerExists) {
        map.on('click', MAP_LAYERS.CADASTRE_PROPERTIES_FILL, handlePropertyClick);
        map.on('mouseenter', MAP_LAYERS.CADASTRE_PROPERTIES_FILL, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', MAP_LAYERS.CADASTRE_PROPERTIES_FILL, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    }
    
    // Survey mark click handlers
    if (surveyMarkLayerExists && selectSurveyMark) {
      const handleSurveyMarkClick = (e: mapboxgl.MapLayerMouseEvent) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          selectSurveyMark(feature as unknown as SurveyMarkFeature);
        }
      };
      
      map.on('click', MAP_LAYERS.CADASTRE_SURVEY_MARKS, handleSurveyMarkClick);
      
      map.on('mouseenter', MAP_LAYERS.CADASTRE_SURVEY_MARKS, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', MAP_LAYERS.CADASTRE_SURVEY_MARKS, () => {
        map.getCanvas().style.cursor = '';
      });
    }
    
    attachedEventListeners.set(map, true); 
    
  } catch (error) {
    console.error('[CadastreService] Error attaching click handlers:', error);
  }
}

/**
 * Remove cadastre click handlers
 */
export function removeCadastreClickHandlers(map: mapboxgl.Map): void {
  try {
    attachedEventListeners.delete(map);
    
    if (map.getCanvas()) {
      map.getCanvas().style.cursor = '';
    }
  } catch (error) {
    console.error('[CadastreService] Error removing click handlers:', error);
  }
}