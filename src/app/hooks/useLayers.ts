/**
 * useLayers.ts - Clean Version
 * 
 * Purpose:
 * Manages map layers for flight operations EXCEPT tree heights.
 * Tree height functionality is handled directly by TreeHeightService via useTreeHeights hook.
 * 
 * Key Features:
 * - Flight path visualization with bounds fitting
 * - HV powerlines overlay (static layers)
 * - DBYD powerlines (dynamic ArcGIS data)
 * - Airspace visualization
 * - Mobile towers with filtering capabilities
 * - Layer reset functionality
 * 
 * Related Files:
 * - LayerManager.ts: Core layer management service
 * - BYDAService.ts: DBYD powerlines data fetching
 * - MobileTowerService.ts: Mobile tower display and filterin
 * - useTreeHeights.ts: Tree height hook (use this directly for tree heights)
 */

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

export function useLayers() {
  const { map, toggleLayer, setLayerVisibility } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { showAreaOfOperations } = useAreaOpsProcessor();

  /**
   * Add a flight plan to the map with enhanced bounds fitting
   * @param geojson - Flight plan as GeoJSON FeatureCollection
   * @returns boolean indicating success
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

      // Create source data with line metrics for advanced styling
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

      // Create layer config with enhanced styling
      const layerConfig = {
        id: MAP_LAYERS.FLIGHT_PATH,
        type: 'line' as const,
        source: MAP_LAYERS.FLIGHT_PATH,
        layout: {
          'line-join': 'round' as const,
          'line-cap': 'round' as const,
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
        // Enhanced bounds calculation with geometry validation
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

        // Calculate bounds with improved algorithm
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

        // Fit map to bounds with optimized animation settings
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
   * Uses static layers configured in Mapbox Studio
   * @returns boolean indicating success
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
   * Fetches dynamic data from ArcGIS services within AO bounds
   * @returns Promise<boolean> indicating success
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
      // Ensure AO is visible for context
      showAreaOfOperations();

      // Fetch and update DBYD layers using the service
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
   * Uses static layers for airfields and labels
   * @returns boolean indicating success
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
   * Loads data from Mapbox tilesets and manages clustering
   * @returns Promise<boolean> indicating success
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
      // Ensure AO is visible for context
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
        // Display towers with the service implementation
        const success = await displayMobileTowers(map, aoGeometry, setLayerVisibility);
        return success;
      }
    } catch (error) {
      console.error('toggleMobileTowers: error', error);
      return false;
    }
  }, [map, aoGeometry, showAreaOfOperations, setLayerVisibility]);

  /**
 * STEP 6: Update useLayers.ts
 * Add tree height functionality back to useLayers for consistency
 */

const toggleTreeHeights = useCallback(() => {
  console.log('toggleTreeHeights: Called via useLayers');
  toggleLayer(MAP_LAYERS.TREE_HEIGHTS);
  return true;
}, [toggleLayer]);

  /**
   * Filter mobile towers by carrier, technology, and frequency band
   * @param filters - Filter criteria for towers
   * @returns boolean indicating success
   */
  const filterMobileTowersLayer = useCallback((filters: MobileTowerFilters) => {
    if (!map || !map.getLayer('mobile-towers-unclustered-point')) {
      return false;
    }
    
    return filterMobileTowers(map, filters);
  }, [map]);

  /**
   * Reset all analysis layers but preserve base layers
   * NOTE: Tree heights are managed by TreeHeightService - use useTreeHeights hook directly
   */
  const resetLayers = useCallback(() => {
    // Reset analysis layers only
    layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
    layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
    layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
    layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
    layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
    layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
    return true;
  }, []);

  return {
    // Core flight functionality
    addFlightPath,
    resetLayers,
    
    // Layer management
    toggleLayer,
    
    // Infrastructure layers
    togglePowerlines,
    toggleDBYDPowerlines,
    toggleAirspace,
    
    // Mobile infrastructure
    toggleMobileTowers,
    filterMobileTowersLayer,

    toggleTreeHeights,
  };
}