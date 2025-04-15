"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import { layerManager, MAP_LAYERS, LayerVisibilityMap, LayerEventType } from '../services/LayerManager';

interface MapContextProps {
  map: mapboxgl.Map | null;
  terrainLoaded: boolean;
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

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [map, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [terrainLoaded, setTerrainLoaded] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityMap>(initialLayerState);

  const setMap = (mapInstance: mapboxgl.Map | null, newTerrainLoaded: boolean) => {
    if (mapInstance === map && newTerrainLoaded === terrainLoaded) {
      return;
    }

    if (mapInstance) {
      layerManager.setMap(mapInstance);
      layerManager.registerKnownLayers();
      const layerState = layerManager.getLayerState();
      setLayerVisibility(layerState);
    }

    setMapInstance(mapInstance);
    setTerrainLoaded(newTerrainLoaded);
  };

  useEffect(() => {
    if (!map) return;

    const cleanup = layerManager.addEventListener(
      (event: LayerEventType, layerId: string, visible?: boolean) => {
        if (event === 'visibilityChange' && visible !== undefined) {
          setLayerVisibility((prev) => ({
            ...prev,
            [layerId]: visible,
          }));
        } else if (event === 'layerRemoved') {
          setLayerVisibility((prev) => ({
            ...prev,
            [layerId]: false,
          }));
        }
      }
    );

    return () => cleanup();
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
    layerVisibility,
    setMap,
    toggleLayer,
    setLayerVisibility: setLayerVisibilityValue,
    resetLayers,
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};