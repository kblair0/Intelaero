import { useCallback } from 'react';
import { useMapContext } from '../context/mapcontext';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';
import type { GeoJSON } from 'geojson';
import * as turf from '@turf/turf';

export function useLayers() {
  const { map, toggleLayer } = useMapContext();

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
          'line-join': 'round',
          'line-cap': 'round',
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

  const togglePowerlines = useCallback(() => {
    toggleLayer(MAP_LAYERS.POWERLINES);
    toggleLayer(MAP_LAYERS.POWERLINES_HITBOX);
    return true;
  }, [toggleLayer]);

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

  return {
    addFlightPath,
    resetLayers,
    toggleLayer,
    togglePowerlines,
  };
}