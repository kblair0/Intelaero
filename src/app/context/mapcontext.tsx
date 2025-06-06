// src/app/context/MapContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import { layerManager, MAP_LAYERS, LayerVisibilityMap, LayerEventType } from '../services/LayerManager';
import { ElevationService } from '../services/ElevationService';

/**
 * Defines the properties available in the MapContext.
 */
interface MapContextProps {
  map: mapboxgl.Map | null;
  terrainLoaded: boolean;
  elevationService: ElevationService | null;
  layerVisibility: LayerVisibilityMap;
  setMap: (map: mapboxgl.Map | null, terrainLoaded: boolean) => void;
  toggleLayer: (layerId: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  resetLayers: () => void;
}

const initialLayerState = Object.values(MAP_LAYERS).reduce(
  (acc, layerId) => ({
    ...acc,
    [layerId]: false,
  }),
  {}
) as LayerVisibilityMap;

const MapContext = createContext<MapContextProps | null>(null);

/**
 * Provides map-related state and services to the application.
 * @param children - React components to render within the provider.
 */
export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [map, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [terrainLoaded, setTerrainLoaded] = useState(false);
  const [elevationService, setElevationService] = useState<ElevationService | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityMap>(initialLayerState);

  /**
   * Sets the map instance and initializes related services.
   * @param mapInstance - The Mapbox map instance or null.
   * @param newTerrainLoaded - Indicates if the terrain source is loaded.
   */
  const setMap = (mapInstance: mapboxgl.Map | null, newTerrainLoaded: boolean) => {

    if (mapInstance === map && newTerrainLoaded === terrainLoaded) return;

    if (mapInstance) {
      layerManager.setMap(mapInstance);
      layerManager.registerKnownLayers();
      const layerState = layerManager.getLayerState();
      setLayerVisibility(layerState);
      const elevService = new ElevationService(mapInstance);
      setElevationService(elevService);
    } else {
      setElevationService(null);

    }

    setMapInstance(mapInstance);
    setTerrainLoaded(newTerrainLoaded);
  };

  useEffect(() => {
    if (!map) return undefined; // Explicitly return undefined for cleanup

    const cleanup = layerManager.addEventListener(
      (event: LayerEventType, layerId: string, visible?: boolean) => {
        if (event === 'visibilityChange' && visible !== undefined) {
          setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }));
        } else if (event === 'layerRemoved') {
          setLayerVisibility((prev) => ({ ...prev, [layerId]: false }));
        }
      }
    );

    return cleanup; // Return the cleanup function
  }, [map]);

  const toggleLayer = (layerId: string) => {
    if (map) {
      layerManager.toggleLayerVisibility(layerId);
    }
  };

  const setLayerVisibilityValue = (layerId: string, visible: boolean) => {
    if (map) {
      layerManager.setLayerVisibility(layerId, visible);
    }
  };

  const resetLayers = () => {
    if (map) {
      layerManager.resetLayers();
    }
  };

  const value = {
    map,
    terrainLoaded,
    elevationService,
    layerVisibility,
    setMap,
    toggleLayer,
    setLayerVisibility: setLayerVisibilityValue,
    resetLayers,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

/**
 * Hook to access the MapContext.
 * @returns The MapContext properties.
 * @throws Error if used outside of MapProvider.
 */
export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMapContext must be used within a MapProvider');
  return context;
};
