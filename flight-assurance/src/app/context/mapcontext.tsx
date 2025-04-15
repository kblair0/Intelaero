"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import { layerManager, MAP_LAYERS, LayerVisibilityMap, LayerEventType } from '../services/LayerManager';

interface MapContextProps {
  map: mapboxgl.Map | null;
  layerVisibility: LayerVisibilityMap;
  isMapReady: boolean;
  setMap: (map: mapboxgl.Map | null) => void;
  toggleLayer: (layerId: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  resetLayers: () => void;
}

const initialLayerState = Object.values(MAP_LAYERS).reduce(
  (acc, layerId) => ({
    ...acc,
    [layerId]: false
  }),
  {}
) as LayerVisibilityMap;

const MapContext = createContext<MapContextProps | null>(null);

export const MapProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [map, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityMap>(initialLayerState);

  // Set map instance and initialize layer manager
  const setMap = (mapInstance: mapboxgl.Map | null) => {
    if (mapInstance) {
      layerManager.setMap(mapInstance);
      layerManager.registerKnownLayers();
    }
    setMapInstance(mapInstance);
  };

  // Sync with layer manager when map changes
  useEffect(() => {
    if (!map) return;

    // Map is ready once it has loaded
    const handleMapLoad = () => {
      console.log("Map is fully loaded and ready in context");
      setIsMapReady(true);
      
      // Initial sync with layer states
      const layerState = layerManager.getLayerState();
      setLayerVisibility(layerState);
    };

    if (map.loaded()) {
      handleMapLoad();
    } else {
      map.once('load', handleMapLoad);
    }

    // Listen for layer changes
    const cleanup = layerManager.addEventListener(
      (event: LayerEventType, layerId: string, visible?: boolean) => {
        if (event === 'visibilityChange' && visible !== undefined) {
          setLayerVisibility(prev => ({
            ...prev,
            [layerId]: visible
          }));
        } else if (event === 'layerRemoved') {
          setLayerVisibility(prev => ({
            ...prev,
            [layerId]: false
          }));
        }
      }
    );

    return () => {
      map.off('load', handleMapLoad);
      cleanup();
    };
  }, [map]);

  // Toggle a layer's visibility
  const toggleLayer = (layerId: string) => {
    if (map) {
      layerManager.toggleLayerVisibility(layerId);
    }
  };

  // Set a layer's visibility directly
  const setLayerVisibilityValue = (layerId: string, visible: boolean) => {
    if (map) {
      layerManager.setLayerVisibility(layerId, visible);
    }
  };

  // Reset all layers
  const resetLayers = () => {
    if (map) {
      layerManager.resetLayers();
    }
  };

  const value = {
    map,
    layerVisibility,
    isMapReady,
    setMap,
    toggleLayer,
    setLayerVisibility: setLayerVisibilityValue,
    resetLayers
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

// Hook for accessing map context
export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};