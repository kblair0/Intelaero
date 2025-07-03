/**
 * BYDAService.ts - Enhanced Version
 * 
 * Purpose:
 * Complete DBYD layer management through LayerManager system.
 * Handles layer creation, data fetching, and proper registration for toggling.
 * 
 * Key Changes:
 * - Creates layers using LayerManager for proper registration
 * - Handles both initial creation and data updates  
 * - Proper cleanup and toggle support

 * 
 * Dependencies:
 * - mapbox-gl: For map instance and GeoJSON sources
 * - @turf/turf: For bounding box calculations
 * - LayerManager: For consistent layer management
 * 
 * Usage:
 * Called from useLayers.ts toggleDBYDPowerlines function
 */

import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';

// Service configuration
const services = [
  'LUAL_Network_HV_Feature_Public',
  'LUAL_Network_LV_Feature_Public', 
  'LUAL_Network_SWER_Feature_Public',
  'LUAL_Network_Other_Feature_Public',
  'LUAL_Network_Device_Feature_View',
];

const serviceLayerMapping: Record<string, { 
  sourceId: string; 
  layerId: string; 
  color: string;
  layerManagerId: string; // Maps to MAP_LAYERS constants
}> = {
  LUAL_Network_HV_Feature_Public: {
    sourceId: 'byda-hv-source',
    layerId: 'byda-hv-layer', 
    color: '#ff0000',
    layerManagerId: MAP_LAYERS.BYDA_HV
  },
  LUAL_Network_LV_Feature_Public: {
    sourceId: 'byda-lv-source',
    layerId: 'byda-lv-layer',
    color: '#ff0000', 
    layerManagerId: MAP_LAYERS.BYDA_LV
  },
  LUAL_Network_SWER_Feature_Public: {
    sourceId: 'byda-swer-source',
    layerId: 'byda-swer-layer',
    color: '#ff0000',
    layerManagerId: MAP_LAYERS.BYDA_SWER
  },
  LUAL_Network_Other_Feature_Public: {
    sourceId: 'byda-other-source', 
    layerId: 'byda-other-layer',
    color: '#ff0000',
    layerManagerId: MAP_LAYERS.BYDA_OTHER
  },
  LUAL_Network_Device_Feature_View: {
    sourceId: 'byda-device-source',
    layerId: 'byda-device-layer', 
    color: '#ff0000',
    layerManagerId: MAP_LAYERS.BYDA_DEVICE
  },
};

const baseUrl = 'https://services-ap1.arcgis.com/ug6sGLFkytbXYo4f/ArcGIS/rest/services';

const serviceQueryParams: Record<string, { where: string; outFields: string }> = {
  LUAL_Network_HV_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: 'OPERATING_VOLTAGE,OWNER',
  },
  LUAL_Network_LV_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: 'OPERATING_VOLTAGE,OWNER',
  },
  LUAL_Network_SWER_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: 'OWNER,OPERATING_VOLTAGE',
  },
  LUAL_Network_Other_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: 'OWNER,OPERATING_VOLTAGE',
  },
  LUAL_Network_Device_Feature_View: {
    where: '1=1',
    outFields: 'OWNER,ASSET_TYPE',
  },
};

/**
 * Initialize DBYD layers if they don't exist
 * Creates empty layers that can be toggled and populated with data
 * @param map - Mapbox map instance
 * @returns boolean indicating success
 */
export function initializeDBYDLayers(map: mapboxgl.Map): boolean {
  if (!map) {
    console.warn('[BYDAService] Map not available for layer initialization');
    return false;
  }

  try {
    services.forEach((service) => {
      const { sourceId, layerId, color } = serviceLayerMapping[service];

      // Check if layer already exists
      if (map.getLayer(layerId)) {
        console.log(`[BYDAService] Layer ${layerId} already exists, skipping initialization`);
        return;
      }

      // Create empty source
      const emptySource = {
        type: 'geojson' as const,
        data: { type: 'FeatureCollection' as const, features: [] }
      };

      // Create layer configuration  
      const layerConfig = {
        id: layerId,
        type: 'line' as const,
        source: sourceId,
        layout: { 
          visibility: 'none' as const 
        },
        paint: {
          'line-color': color,
          'line-width': 2,
          'line-opacity': 0.8
        }
      };

      // Add layer using LayerManager for proper registration
      const success = layerManager.addLayer(
        layerId,
        emptySource, 
        layerConfig,
        sourceId,
        false // Start hidden
      );

      if (success) {
        console.log(`[BYDAService] ✅ Initialized layer: ${layerId}`);
      } else {
        console.error(`[BYDAService] ❌ Failed to initialize layer: ${layerId}`);
      }
    });

    return true;
  } catch (error) {
    console.error('[BYDAService] Error initializing DBYD layers:', error);
    return false;
  }
}

/**
 * Toggle DBYD layers visibility
 * If layers have data, toggles visibility. If no data, fetches data first.
 * @param map - Mapbox map instance
 * @param aoGeometry - Area of Operations geometry
 * @param setLayerVisibility - Function to set layer visibility
 * @returns Promise<boolean> indicating success
 */
export async function toggleDBYDLayers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection | null,
  setLayerVisibility: (layerId: string, visible: boolean) => void
): Promise<boolean> {
  if (!map) {
    console.warn('[BYDAService] Map not available');
    return false;
  }

  // Initialize layers if they don't exist
  initializeDBYDLayers(map);

  // Check if any layers are currently visible
  const anyLayerVisible = services.some(service => {
    const { layerId } = serviceLayerMapping[service];
    return layerManager.isLayerVisible(layerId);
  });

  if (anyLayerVisible) {
    // Hide all DBYD layers
    console.log('[BYDAService] Hiding DBYD layers');
    services.forEach(service => {
      const { layerId } = serviceLayerMapping[service];
      layerManager.setLayerVisibility(layerId, false);
    });
    return true;
  } else {
    // Show layers and fetch data if needed
    console.log('[BYDAService] Showing DBYD layers and fetching data');
    return await fetchBYDALayers(map, aoGeometry, setLayerVisibility);
  }
}

/**
 * Fetches DBYD powerline data and updates map layers
 * Enhanced version that works with LayerManager system
 * @param map - Mapbox map instance
 * @param aoGeometry - Area of Operations geometry for bounding box
 * @param setLayerVisibility - Function to set layer visibility
 * @returns Promise resolving to true on success, false on failure
 */
export async function fetchBYDALayers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection | null, 
  setLayerVisibility: (layerId: string, visible: boolean) => void
): Promise<boolean> {
  if (!map) {
    console.warn('[BYDAService] Map not available');
    return false;
  }

  if (!aoGeometry) {
    console.warn('[BYDAService] AO geometry not available');
    return false;
  }

  // Initialize layers first
  initializeDBYDLayers(map);

  const geometryType = 'esriGeometryEnvelope';
  const inSR = '4326';
  const spatialRel = 'esriSpatialRelIntersects';
  const f = 'geojson';

  try {
    // Calculate bounding box from AO geometry
    const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
    const geometry = boundingBox.join(',');

    console.log('[BYDAService] Fetching DBYD data for bbox:', boundingBox);

    // Fetch data for each service
    const fetchPromises = services.map(async (service) => {
      const params = serviceQueryParams[service];
      const { sourceId, layerId } = serviceLayerMapping[service];
      
      const queryParams = new URLSearchParams({
        where: params.where,
        geometry,
        geometryType,
        inSR,
        spatialRel,
        outFields: params.outFields,
        returnGeometry: 'true',
        f,
      });
      
      const queryUrl = `${baseUrl}/${service}/FeatureServer/0/query?${queryParams.toString()}`;

      try {
        console.log(`[BYDAService] Fetching ${service}...`);
        const res = await fetch(queryUrl);
        const data = await res.json();

        // Get the existing source
        const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
        if (!existingSource) {
          console.warn(`[BYDAService] Source ${sourceId} not found`);
          return;
        }

        // Update source data
        const hasFeatures = data.features && data.features.length > 0;
        const geoJsonData = hasFeatures ? data : { type: 'FeatureCollection', features: [] };
        
        existingSource.setData(geoJsonData);

        // Make layer visible if it has data
        if (hasFeatures) {
          layerManager.setLayerVisibility(layerId, true);
          console.log(`[BYDAService] ✅ Updated ${layerId} with ${data.features.length} features`);
        } else {
          console.log(`[BYDAService] ⚠️ No features found for ${layerId}`);
        }

      } catch (error) {
        console.error(`[BYDAService] Error fetching ${service}:`, error);
        throw error;
      }
    });

    await Promise.all(fetchPromises);
    console.log('[BYDAService] ✅ All DBYD layers updated successfully');
    return true;

  } catch (error) {
    console.error('[BYDAService] ❌ Failed to fetch DBYD layers:', error);
    return false;
  }
}

/**
 * Clean up DBYD layers 
 * Removes all DBYD layers and sources from the map
 * @param map - Mapbox map instance
 * @returns boolean indicating success
 */
export function cleanupDBYDLayers(map: mapboxgl.Map): boolean {
  if (!map) return false;

  try {
    services.forEach(service => {
      const { layerId } = serviceLayerMapping[service];
      layerManager.removeLayer(layerId);
    });
    
    console.log('[BYDAService] ✅ DBYD layers cleaned up');
    return true;
  } catch (error) {
    console.error('[BYDAService] ❌ Error cleaning up DBYD layers:', error);
    return false;
  }
}