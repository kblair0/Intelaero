// src/hooks/useLayers.ts
import { useCallback } from 'react';
import { useMapContext } from '../context/MapContext';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';
import type { GeoJSON } from 'geojson';

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
      return layerManager.addLayer(
        MAP_LAYERS.FLIGHT_PATH,
        source,
        layerConfig,
        undefined,
        true // Make visible initially
      );
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