import { useCallback } from 'react';
import { useMapContext } from '../context/mapcontext';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';
import { useAreaOfOpsContext } from '../context/AreaOfOpsContext';
import { useAreaOpsProcessor } from '../components/AO/Hooks/useAreaOpsProcessor';
import { fetchBYDALayers } from '../services/BYDAService';
import { displayMobileTowers, filterMobileTowers } from '../services/MobileTowerService';
import { MobileTowerFilters } from '../types/mobileTowers';
import type { GeoJSON } from 'geojson';
import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { fetchMeshblockLayers } from '../sandbox/meshblox/MeshblockService';
import { useMeshblockContext } from '../sandbox/meshblox/MeshblockContext';

export function useLayers() {
  const { map, toggleLayer, setLayerVisibility } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { showAreaOfOperations } = useAreaOpsProcessor();
  const { selectMeshblock } = useMeshblockContext();

  /**
   * Add a flight plan to the map
   */
  const addFlightPath = useCallback(
    (geojson: GeoJSON.FeatureCollection) => {
      console.log('addFlightPath: entry', {
        timestamp: new Date().toISOString(),
        hasMap: !!map,
        geojsonFeatureCount: geojson.features?.length || 0,
        message: 'Starting flight path addition'
      });

      if (!map) {
        console.log('addFlightPath: no map', {
          timestamp: new Date().toISOString(),
          message: 'Map not available, exiting'
        });
        return false;
      }

      // Create source data
      const source = {
        type: 'geojson' as const,
        data: geojson,
        lineMetrics: true,
      };
      console.log('addFlightPath: source created', {
        timestamp: new Date().toISOString(),
        sourceType: source.type,
        featureCount: (source.data as GeoJSON.FeatureCollection).features.length,
        message: 'GeoJSON source prepared'
      });

      // Create layer config
      const layerConfig = {
        id: MAP_LAYERS.FLIGHT_PATH,
        type: 'line' as const,
        source: MAP_LAYERS.FLIGHT_PATH,
        layout: {
          'line-join': 'round' as 'round',
          'line-cap': 'round' as 'round',
        },
        paint: {
          'line-width': 2,
          'line-color': '#FFFF00',
          'line-opacity': 1,
        },
      };
      console.log('addFlightPath: layer config', {
        timestamp: new Date().toISOString(),
        layerId: layerConfig.id,
        layerType: layerConfig.type,
        message: 'Layer configuration prepared'
      });

      // Add the layer using the layer manager
      let success = false;
      try {
        success = layerManager.addLayer(
          MAP_LAYERS.FLIGHT_PATH,
          source,
          layerConfig,
          undefined,
          true // Make visible initially
        );
        console.log('addFlightPath: layerManager.addLayer', {
          timestamp: new Date().toISOString(),
          layerId: MAP_LAYERS.FLIGHT_PATH,
          success,
          message: success ? 'Layer added successfully' : 'Failed to add layer'
        });
      } catch (error) {
        console.error('addFlightPath: layerManager error', {
          timestamp: new Date().toISOString(),
          layerId: MAP_LAYERS.FLIGHT_PATH,
          error: error instanceof Error ? error.message : String(error),
          message: 'Error adding layer via layerManager'
        });
        return false;
      }

      if (success) {
        // Check geometry type before accessing coordinates
        const feature = geojson.features[0];
        const geometryType = feature?.geometry?.type;
        console.log('addFlightPath: geometry check', {
          timestamp: new Date().toISOString(),
          geometryType,
          hasFeature: !!feature,
          message: 'Checking feature geometry type'
        });

        if (geometryType !== 'LineString' && geometryType !== 'MultiLineString') {
          console.error('addFlightPath: invalid geometry', {
            timestamp: new Date().toISOString(),
            geometryType,
            message: 'Expected LineString or MultiLineString, cannot calculate bounds'
          });
          return true; // Layer was added, but bounds calculation is skipped
        }

        const coordinates = (feature.geometry as GeoJSON.LineString).coordinates;
        console.log('addFlightPath: coordinates', {
          timestamp: new Date().toISOString(),
          coordinateCount: coordinates.length,
          firstCoord: coordinates[0] ? `[${coordinates[0][0]},${coordinates[0][1]}]` : null,
          message: 'Extracted coordinates for bounds calculation'
        });

        // Calculate bounds
        const bounds = coordinates.reduce(
          (acc, coord) => {
            const [lng, lat] = coord;
            acc[0] = Math.min(acc[0], lng);
            acc[1] = Math.min(acc[1], lat);
            acc[2] = Math.max(acc[2], lng);
            acc[3] = Math.max(acc[3], lat);
            return acc;
          },
          [Infinity, Infinity, -Infinity, -Infinity] as number[]
        );
        console.log('addFlightPath: bounds calculated', {
          timestamp: new Date().toISOString(),
          bounds,
          isValid: bounds.every(b => isFinite(b)),
          message: 'Bounds calculated from coordinates'
        });

        // Fit map to bounds with animation
        try {
          map.fitBounds(
            bounds as [number, number, number, number],
            {
              padding: 50,
              duration: 500,
              pitch: 70,
              zoom: 10.5,
            }
          );
          console.log('addFlightPath: map.fitBounds', {
            timestamp: new Date().toISOString(),
            bounds,
            options: { padding: 50, duration: 500, pitch: 70, zoom: 10.5 },
            message: 'Map view adjusted to fit bounds'
          });
        } catch (error) {
          console.error('addFlightPath: fitBounds error', {
            timestamp: new Date().toISOString(),
            bounds,
            error: error instanceof Error ? error.message : String(error),
            message: 'Error adjusting map bounds'
          });
        }
      }

      console.log('addFlightPath: complete', {
        timestamp: new Date().toISOString(),
        success,
        message: 'Flight path addition completed'
      });
      return success;
    },
    [map]
  );

  /**
   * Toggle high-voltage powerlines layer
   * @returns {boolean} Success status
   */
  const togglePowerlines = useCallback(() => {
    toggleLayer(MAP_LAYERS.POWERLINES);
    toggleLayer(MAP_LAYERS.POWERLINES_HITBOX);
    console.log('togglePowerlines: toggled', {
      timestamp: new Date().toISOString(),
      layers: [MAP_LAYERS.POWERLINES, MAP_LAYERS.POWERLINES_HITBOX],
      message: 'HV powerlines layers toggled'
    });
    return true;
  }, [toggleLayer]);

  /**
   * Toggle DBYD (Dial Before You Dig) powerlines layers
   * @returns {Promise<boolean>} Success status
   */
  const toggleDBYDPowerlines = useCallback(async () => {
    if (!map) {
      console.warn('toggleDBYDPowerlines: Map not available', {
        timestamp: new Date().toISOString(),
        message: 'Cannot toggle DBYD powerlines'
      });
      return false;
    }
    if (!aoGeometry) {
      console.warn('toggleDBYDPowerlines: AO geometry not available', {
        timestamp: new Date().toISOString(),
        message: 'Cannot fetch DBYD powerlines without AO'
      });
      return false;
    }

    try {
      // Ensure AO is visible
      showAreaOfOperations();

      // Fetch and update DBYD layers
      const success = await fetchBYDALayers(map, aoGeometry, setLayerVisibility);

      if (success) {
        console.log('toggleDBYDPowerlines: success', {
          timestamp: new Date().toISOString(),
          layers: [
            MAP_LAYERS.BYDA_HV,
            MAP_LAYERS.BYDA_LV,
            MAP_LAYERS.BYDA_SWER,
            MAP_LAYERS.BYDA_OTHER,
            MAP_LAYERS.BYDA_DEVICE,
          ],
          message: 'DBYD powerlines layers toggled'
        });
      } else {
        console.error('toggleDBYDPowerlines: failed to fetch layers', {
          timestamp: new Date().toISOString(),
          message: 'Failed to fetch DBYD powerlines data'
        });
      }

      return success;
    } catch (error) {
      console.error('toggleDBYDPowerlines: error', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        message: 'Error toggling DBYD powerlines'
      });
      return false;
    }
  }, [map, aoGeometry, showAreaOfOperations, setLayerVisibility]);

  /**
   * Toggle airspace layers
   * @returns {boolean} Success status
   */
  const toggleAirspace = useCallback(() => {
    if (!map) {
      console.warn('toggleAirspace: Map not available', {
        timestamp: new Date().toISOString(),
        message: 'Cannot toggle airspace layers'
      });
      return false;
    }

    try {
      toggleLayer(MAP_LAYERS.AIRFIELDS);
      toggleLayer(MAP_LAYERS.AIRFIELDS_LABELS);
      console.log('toggleAirspace: toggled', {
        timestamp: new Date().toISOString(),
        layers: [MAP_LAYERS.AIRFIELDS, MAP_LAYERS.AIRFIELDS_LABELS],
        message: 'Airspace layers toggled'
      });
      return true;
    } catch (error) {
      console.error('toggleAirspace: error', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        message: 'Error toggling airspace layers'
      });
      return false;
    }
  }, [map, toggleLayer]);

  /**
   * Toggle mobile towers layer
   * @returns {Promise<boolean>} Success status
   */
  const toggleMobileTowers = useCallback(async () => {
    if (!map) {
      console.warn('toggleMobileTowers: Map not available');
      return false;
    }
    if (!aoGeometry) {
      console.warn('toggleMobileTowers: AO geometry not available');
      return false;
    }

    try {
      // Ensure AO is visible
      showAreaOfOperations();

      // Check if layers already exist
      const towerLayerExists = !!map.getLayer('mobile-towers-unclustered-point');
      
      if (towerLayerExists) {
        // Just toggle visibility if already loaded
        const isVisible = map.getLayoutProperty('mobile-towers-unclustered-point', 'visibility') === 'visible';
        
        if (isVisible) {
          map.setLayoutProperty('mobile-towers-unclustered-point', 'visibility', 'none');
          if (map.getLayer('mobile-towers-labels')) {
            map.setLayoutProperty('mobile-towers-labels', 'visibility', 'none');
          }
        } else {
          map.setLayoutProperty('mobile-towers-unclustered-point', 'visibility', 'visible');
          // Labels depend on zoom level, so we don't need to set them visible here
        }
        
        return true;
      } else {
        // Display towers with the new implementation
        const success = await displayMobileTowers(map, aoGeometry, setLayerVisibility);
        return success;
      }
    } catch (error) {
      console.error('toggleMobileTowers: error', error);
      return false;
    }
  }, [map, aoGeometry, showAreaOfOperations, setLayerVisibility]);

  /**
   * Filter mobile towers by carrier, technology, and frequency band
   * @param {MobileTowerFilters} filters Filter criteria
   * @returns {boolean} Success status
   */
  const filterMobileTowersLayer = useCallback((filters: MobileTowerFilters) => {
    if (!map || !map.getLayer('mobile-towers-unclustered-point')) {
      return false;
    }
    
    return filterMobileTowers(map, filters);
  }, [map]);

  /**
   * Toggle tree height raw data visualization
   * Calls the custom toggle function exposed by MapboxLayerHandler
   */
  const toggleTreeHeights = useCallback(() => {
    if (!map) {
      console.warn('toggleTreeHeights: Map not available');
      return;
    }
    
    // Call the custom toggle function we exposed from MapboxLayerHandler
    if ((map as any).toggleTreeHeights) {
      (map as any).toggleTreeHeights();
      console.log('toggleTreeHeights: Raw data visualization toggled');
    } else {
      console.warn('toggleTreeHeights: Tree height system not initialized');
    }
  }, [map]);

  /**
   * Reset all layers
   */
  const resetLayers = useCallback(() => {
    // Reset analysis layers
    layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
    layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
    layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
    layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
    layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
    layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
    return true;
  }, []);

/**
 * Toggle meshblock layers (ABS meshblock data visualization)
 * Only activates at zoom > 13 as per requirements
 * @returns {Promise<boolean>} Success status
 */
const toggleMeshblocks = useCallback(async () => {
  if (!map) {
    console.warn('toggleMeshblocks: Map not available');
    return false;
  }
  if (!aoGeometry) {
    console.warn('toggleMeshblocks: AO geometry not available');
    return false;
  }

  // Validate zoom level - only activate at zoom > 13 as per requirements
  const currentZoom = map.getZoom();
  if (currentZoom <= 13) {
    console.warn(`toggleMeshblocks: Zoom level ${currentZoom.toFixed(1)} too low. Meshblocks require zoom > 13.`);
    return false;
  }

  try {
    // Ensure AO is visible
    showAreaOfOperations();

    // Check if layers already exist
    const meshblockLayerExists = !!map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE);
    
    if (meshblockLayerExists) {
      // Layers exist - toggle their visibility
      const isVisible = map.getLayoutProperty(MAP_LAYERS.MESHBLOCK_LANDUSE, 'visibility') === 'visible';
      
      if (isVisible) {
        // Hide meshblock layers
        console.log('toggleMeshblocks: Hiding meshblock layers');
        
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_LANDUSE, 'visibility', 'none');
        }
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_POPULATION)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_POPULATION, 'visibility', 'none');
        }
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_FLIGHT_INTERSECT)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_FLIGHT_INTERSECT, 'visibility', 'none');
        }
        
        // ✅ REMOVE click handlers when hiding layers
        const { removeMeshblockClickHandlers } = await import('../sandbox/meshblox/MeshblockService');
        removeMeshblockClickHandlers(map);
        
        console.log('toggleMeshblocks: Meshblock layers hidden and click handlers removed');
      } else {
        // Show meshblock layers
        console.log('toggleMeshblocks: Showing meshblock layers');
        
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_LANDUSE, 'visibility', 'visible');
        }
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_POPULATION)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_POPULATION, 'visibility', 'none'); // Hidden by default
        }
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_FLIGHT_INTERSECT)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_FLIGHT_INTERSECT, 'visibility', 'none'); // Hidden by default
        }
        
        // ✅ RE-ATTACH click handlers when showing layers
        console.log('toggleMeshblocks: Re-attaching click handlers with selectMeshblock:', !!selectMeshblock);
        
        const { addMeshblockClickHandlers } = await import('../sandbox/meshblox/MeshblockService');
        addMeshblockClickHandlers(map, selectMeshblock);
        
        console.log('toggleMeshblocks: Meshblock layers shown and click handlers attached');
      }
      
      return true;
      
    } else {
      // Load meshblock data for the first time
      console.log('toggleMeshblocks: Loading meshblock data for first time');
      console.log('toggleMeshblocks: selectMeshblock function available:', !!selectMeshblock);
      
      // ✅ FIXED: Handle the new return type structure
      const result = await fetchMeshblockLayers(map, aoGeometry, setLayerVisibility, selectMeshblock);
      
      if (result.success) {
        console.log('toggleMeshblocks: Meshblock layers loaded successfully with click handlers');
        console.log('toggleMeshblocks: Loaded', result.data?.features.length, 'meshblock features');
        return true;
      } else {
        console.error('toggleMeshblocks: Failed to load meshblock layers:', result.error);
        return false;
      }
    }
  } catch (error) {
    console.error('toggleMeshblocks: Error toggling meshblock layers:', error);
    return false;
  }
}, [map, aoGeometry, showAreaOfOperations, setLayerVisibility, selectMeshblock]);
return {
  addFlightPath,
  resetLayers,
  toggleLayer,
  togglePowerlines,
  toggleDBYDPowerlines,
  toggleAirspace,
  toggleMobileTowers,
  filterMobileTowersLayer,
  toggleTreeHeights,
  toggleMeshblocks,
};
}