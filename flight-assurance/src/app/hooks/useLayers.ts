// src/hooks/useLayers.ts
import { useCallback } from 'react';
import { useMapContext } from '../context/MapContext';
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
      if (!map) return false;

      // Create source data
      const source = {
        type: 'geojson' as const,
        data: geojson,
        lineMetrics: true,
      };

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

      // Add the layer using the layer manager
      const success = layerManager.addLayer(
        MAP_LAYERS.FLIGHT_PATH,
        source,
        layerConfig,
        undefined,
        true // Make visible initially
      );

      if (success) {
        // Calculate bounds from coordinates and fit map view
        const coordinates = geojson.features[0].geometry.coordinates;
        
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

        // Fit map to bounds with animation
        map.fitBounds(
          bounds as [number, number, number, number],
          {
            padding: 50,
            duration: 1000,
            pitch: 70,
            zoom: 10.5,
          }
        );
      }

      return success;
    },
    [map]
  );

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
    return true;
  }, []);

  return {
    addFlightPath,
    resetLayers,
    toggleLayer,
  };
}