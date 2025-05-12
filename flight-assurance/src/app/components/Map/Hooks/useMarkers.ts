// src/app/hooks/useMarkers.ts
"use client";
import { useRef, useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMarkersContext, MarkerType, Marker } from '../../../context/MarkerContext';
import { LocationData } from '../../../types/LocationData';
import { createMarkerPopup } from '../Utils/markerPopup';
import { layerManager, MAP_LAYERS } from '../../../services/LayerManager';
import { trackEventWithForm as trackEvent } from '../../tracking/tracking';

interface UseMarkersProps {
  map: mapboxgl.Map | null;
  terrainLoaded: boolean;
}

// Interface for tracking marker references
interface MarkerRef {
  id: string;
  marker: mapboxgl.Marker;
  type: MarkerType;
}

export function useMarkers({ map, terrainLoaded }: UseMarkersProps) {
  // Store all marker references in a single collection
  const markerRefs = useRef<MarkerRef[]>([]);
  
  const {
    markers,
    addMarker,
    updateMarker,
    removeMarker,
    defaultElevationOffsets
  } = useMarkersContext();

  // Helper for querying terrain elevation
  const queryTerrainElevation = useCallback(
    async (coordinates: [number, number], retryCount = 3): Promise<number> => {
      if (!map) {
        throw new Error("Map not initialized");
      }

      try {
        const elevation = map.queryTerrainElevation(coordinates);
        if (elevation !== null && elevation !== undefined) {
          return elevation;
        }
        throw new Error("Invalid elevation value");
      } catch (error) {
        console.warn("Primary terrain query failed, trying fallback:", error);
        if (retryCount > 0) {
          try {
            const fallbackElevation = await fetchTerrainElevation(
              coordinates[0],
              coordinates[1]
            );
            return fallbackElevation;
          } catch (fallbackError) {
            if (retryCount > 1) {
              console.warn("Fallback failed, retrying:", fallbackError);
              return queryTerrainElevation(coordinates, retryCount - 1);
            }
            throw fallbackError;
          }
        }
        throw error;
      }
    },
    [map]
  );

  // Fallback function for elevation queries
  const fetchTerrainElevation = async (
    lng: number,
    lat: number
  ): Promise<number> => {
    try {
      const tileSize = 512;
      const zoom = 15;
      const scale = Math.pow(2, zoom);
      const latRad = (lat * Math.PI) / 180;
      const tileX = Math.floor(((lng + 180) / 360) * scale);
      const tileY = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
      );
      const pixelX = Math.floor((((lng + 180) / 360) * scale - tileX) * tileSize);
      const pixelY = Math.floor(
        ((((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
          scale -
          tileY) *
          tileSize)
      );
      const tileURL = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
      const response = await fetch(tileURL);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Failed to create canvas context");
      context.drawImage(imageBitmap, 0, 0);
      const imageData = context.getImageData(0, 0, tileSize, tileSize);
      const idx = (pixelY * tileSize + pixelX) * 4;
      const [r, g, b] = [
        imageData.data[idx],
        imageData.data[idx + 1],
        imageData.data[idx + 2],
      ];
      return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
    } catch (error) {
      console.error("RGB elevation error:", error);
      return 0;
    }
  };

  // Helper to create a marker label element
  const createMarkerLabel = useCallback((index: number, markerType: MarkerType): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'marker-label';
    el.textContent = `${index + 1}`;
    
    // Style the label based on marker type
    el.style.cssText = `
      position: absolute;
      bottom: 0;
      right: -5px;
      width: 16px;
      height: 16px;
      background-color: white;
      color: black;
      border-radius: 50%;
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      line-height: 16px;
      border: 1px solid ${markerType === 'gcs' ? 'blue' : markerType === 'observer' ? 'green' : 'red'};
    `;
    
    return el;
  }, []);

  // Generic function to create a marker of any type
  const createMarker = useCallback(
    async (type: MarkerType): Promise<LocationData | undefined> => {
      if (!map || !terrainLoaded) return;
      
      const center = map.getCenter();
      try {
        const elevation = await queryTerrainElevation([center.lng, center.lat]);
        const initialLocation: LocationData = {
          lng: center.lng,
          lat: center.lat,
          elevation: elevation,
        };
        
        console.log(`${type.toUpperCase()} Initial Location:`, initialLocation);
        
        // Add marker to context and get ID
        const markerId = addMarker(type, initialLocation);
        
        // Define colors for different marker types
        const markerColors: Record<MarkerType, string> = {
          gcs: "blue",
          observer: "green",
          repeater: "red"
        };
        
        // Get markers of this type to determine index
        const sameTypeMarkers = markers.filter(m => m.type === type);
        const markerIndex = sameTypeMarkers.length; // This will be the index of the new marker
        const hasMultiple = sameTypeMarkers.length > 0; // Will be true if there are already others
        
        // Create the default marker first with the appropriate color
        const newMarker = new mapboxgl.Marker({ 
          color: markerColors[type], 
          draggable: true 
        }).setLngLat(center).addTo(map);
        
        // Only add label if we have multiple markers of this type
        if (hasMultiple || markerIndex > 0) {
          // Create the label
          const label = createMarkerLabel(markerIndex, type);
          
          // Get the marker element and append the label to it
          const markerElement = newMarker.getElement();
          markerElement.appendChild(label);
        }
        
        // Store reference to marker
        markerRefs.current.push({
          id: markerId,
          marker: newMarker,
          type
        });
        
        // Create and set popup
        const popup = createMarkerPopup(
          type,
          elevation,
          defaultElevationOffsets[type],
          () => {
            // Delete marker callback
            newMarker.remove();
            removeMarker(markerId);
            markerRefs.current = markerRefs.current.filter(ref => ref.id !== markerId);
          },
          markerId,
          markerIndex,
          hasMultiple
        );
        
        newMarker.setPopup(popup).togglePopup();
        
        // Handle marker drag events
        newMarker.on("dragend", async () => {
          const lngLat = newMarker.getLngLat();
          try {
            const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
            const location: LocationData = {
              lng: lngLat.lng,
              lat: lngLat.lat,
              elevation: newElevation,
            };
            
            // Update marker in context
            updateMarker(markerId, { location });
            
            // Clean up outdated analysis layers
            const layerPrefix = type === 'gcs' 
              ? MAP_LAYERS.GCS_GRID 
              : type === 'observer' 
                ? MAP_LAYERS.OBSERVER_GRID 
                : MAP_LAYERS.REPEATER_GRID;
                
            layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
            layerManager.removeLayer(`${layerPrefix}-${markerId}`);
            
            // Get current markers of same type for indexing
            const currentSameTypeMarkers = markers.filter(m => m.type === type);
            const currentMarkerIndex = currentSameTypeMarkers.findIndex(m => m.id === markerId);
            const hasMultipleNow = currentSameTypeMarkers.length > 1;
            
            // Recreate popup with updated elevation
            const newPopup = createMarkerPopup(
              type,
              newElevation,
              defaultElevationOffsets[type],
              () => {
                newMarker.remove();
                removeMarker(markerId);
                markerRefs.current = markerRefs.current.filter(ref => ref.id !== markerId);
              },
              markerId,
              currentMarkerIndex,
              hasMultipleNow
            );
            
            newMarker.setPopup(newPopup).togglePopup();
          } catch (error) {
            console.error(`Error updating ${type.toUpperCase()} elevation:`, error);
          }
        });
        
        return initialLocation;
      } catch (error) {
        console.error(`Error initializing ${type.toUpperCase()}:`, error);
      }
    },
    [map, terrainLoaded, queryTerrainElevation, addMarker, updateMarker, removeMarker, defaultElevationOffsets, markers, createMarkerLabel]
  );

  // Type-specific marker creation functions
  const addGroundStation = useCallback(async (): Promise<LocationData | undefined> => {
    trackEvent("add_ground_station_click", { panel: "map.tsx" });
    return createMarker('gcs');
  }, [createMarker]);

  const addObserver = useCallback(async (): Promise<LocationData | undefined> => {
    trackEvent("add_observer_click", { panel: "map.tsx" });
    return createMarker('observer');
  }, [createMarker]);

  const addRepeater = useCallback(async (): Promise<LocationData | undefined> => {
    trackEvent("add_repeater_click", { panel: "map.tsx" });
    return createMarker('repeater');
  }, [createMarker]);

  // Update marker popups when elevation offsets change
  const updateMarkerPopups = useCallback(() => {
    markerRefs.current.forEach(ref => {
      // Find marker data in context
      const markerData = markers.find(m => m.id === ref.id);
      
      if (markerData && markerData.location.elevation !== null) {
        // Get markers of same type to determine index
        const sameTypeMarkers = markers.filter(m => m.type === markerData.type);
        const markerIndex = sameTypeMarkers.findIndex(m => m.id === markerData.id);
        const hasMultiple = sameTypeMarkers.length > 1;
        
        const updatedPopup = createMarkerPopup(
          markerData.type,
          markerData.location.elevation,
          markerData.elevationOffset,
          () => {
            ref.marker.remove();
            removeMarker(ref.id);
            markerRefs.current = markerRefs.current.filter(item => item.id !== ref.id);
          },
          markerData.id,
          markerIndex,
          hasMultiple
        );
        
        ref.marker.setPopup(updatedPopup);
        if (ref.marker.getPopup()?.isOpen()) {
          ref.marker.getPopup()?.setDOMContent(updatedPopup.getElement());
        }
      }
    });
  }, [markers, removeMarker]);

  // Remove all the analysis layers
const removeAllAnalysisLayers = useCallback(() => {
  layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
  layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
  layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
  layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
  layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
  layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
  layerManager.removeLayer(MAP_LAYERS.AOTERRAIN_GRID);
  
  // Also remove any marker-specific layers using marker IDs
  markers.forEach(marker => {
    const layerPrefix = marker.type === 'gcs' 
      ? MAP_LAYERS.GCS_GRID 
      : marker.type === 'observer' 
        ? MAP_LAYERS.OBSERVER_GRID 
        : MAP_LAYERS.REPEATER_GRID;
    
    layerManager.removeLayer(`${layerPrefix}-${marker.id}`);
  });
}, [markers]);

  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markerRefs.current.forEach(ref => {
        ref.marker.remove();
      });
    };
  }, []);

  return {
    markers, // Provide access to all markers
    addGroundStation,
    addObserver,
    addRepeater,
    updateMarkerPopups,
    removeAllAnalysisLayers
  };
}