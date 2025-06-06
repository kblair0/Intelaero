// src/app/hooks/useTowerToMarker.ts

/**
 * useTowerToMarker.ts
 * 
 * Purpose:
 * Provides functionality to convert mobile towers into repeater markers
 * with tower-specific metadata preserved. This hook bridges the gap between
 * the tower display system and the marker management system.
 * 
 * Features:
 * - Converts mobile towers to repeater markers
 * - Preserves tower metadata (carrier, technology, frequency)
 * - Uses the same marker management approach as useMarkers
 * - Queries terrain elevation from the map for consistency
 */

import { useCallback, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMarkersContext, TowerMetadata, MarkerType } from '../context/MarkerContext';
import { LocationData } from '../types/LocationData';
import { createMarkerPopup } from '../components/Map/Utils/markerPopup';
import { trackEventWithForm as trackEvent } from '../components/tracking/tracking';

// This needs to match the MarkerRef interface in useMarkers.ts
interface MarkerRef {
  id: string;
  marker: mapboxgl.Marker;
  type: MarkerType;
}

interface TowerData {
  id?: string;
  lng: number;
  lat: number;
  elevation: number;
  height: number;
  carrier?: string;
  technology?: string;
  frequency?: string;
  azimuth?: number;
  tilt?: number;
  eirp?: number;
  eirp_unit?: string;
}

interface UseTowerToMarkerProps {
  map: mapboxgl.Map | null;
  terrainLoaded: boolean;
}

export function useTowerToMarker({ 
  map, 
  terrainLoaded
}: UseTowerToMarkerProps) {
  const {
    markers,
    addMarker,
    updateMarker,
    removeMarker,
    defaultElevationOffsets
  } = useMarkersContext();

  /**
   * Helper to create a marker label element
   */
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

  /**
   * Query terrain elevation - matches the pattern in useMarkers
   * This is crucial for consistency with other markers
   */
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

  /**
   * Fallback function for elevation queries - copied from useMarkers
   */
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

  /**
   * Converts a tower to a repeater marker
   */
  const convertTowerToRepeater = useCallback(async (towerData: TowerData): Promise<boolean> => {
    if (!map || !terrainLoaded) {
      console.error('Map or terrain not initialized');
      return false;
    }
    
    console.log('Converting tower to repeater:', towerData);
    
    try {
      // Query terrain elevation at tower location - this gets the map's ground elevation
      const mapElevation = await queryTerrainElevation([towerData.lng, towerData.lat]);
      console.log('Map terrain elevation at tower location:', mapElevation);
      
      // Create location data from tower using the map's elevation
      const location: LocationData = {
        lng: towerData.lng,
        lat: towerData.lat,
        elevation: mapElevation, // Use map elevation, not tower.elevation
      };
      
      // Create tower metadata
      const towerMetadata: TowerMetadata = {
        originalTowerId: towerData.id,
        carrier: towerData.carrier,
        technology: towerData.technology,
        frequency: towerData.frequency,
        height: towerData.height,
        azimuth: towerData.azimuth,
        tilt: towerData.tilt,
        eirp: towerData.eirp,
        eirp_unit: towerData.eirp_unit
      };
      
      // Add marker to context and check result for premium tier restrictions
      const result = addMarker('repeater', location, towerMetadata);
      
      // If failed due to premium tier restrictions, show error and return
      if (!result.success) {
        console.error(`Failed to add repeater marker:`, result.error);
        return false;
      }
      
      // Get the marker ID
      const markerId = result.markerId as string;
      
      // Get markers of this type to determine index
      const sameTypeMarkers = markers.filter(m => m.type === 'repeater');
      const markerIndex = sameTypeMarkers.length - 1;
      const hasMultiple = sameTypeMarkers.length > 1;
      
      // Use the tower height as elevation offset
      const elevationOffset = towerData.height || defaultElevationOffsets.repeater;
      updateMarker(markerId, { elevationOffset });
      
      // Create the visual Mapbox marker with red color (for repeater)
      const newMarker = new mapboxgl.Marker({ 
        color: "red", 
        draggable: true,
        // Force high z-index to stay on top of other layers
        offset: [0, 0]
      }).setLngLat([location.lng, location.lat]).addTo(map);
      
      // Set high z-index to ensure visibility
      const markerElement = newMarker.getElement();
      markerElement.style.zIndex = '1000';
      
      // Add label if multiple markers exist
      if (hasMultiple) {
        // Create label element
        const label = createMarkerLabel(markerIndex, 'repeater');
        
        // Append label to marker element
        markerElement.appendChild(label);
      }
      
      // Create and set popup
      const popup = createMarkerPopup(
        'repeater',
        location.elevation, // Map elevation
        elevationOffset,    // Tower height
        () => {
          // Delete marker callback
          newMarker.remove();
          removeMarker(markerId);
        },
        markerId,
        markerIndex,
        hasMultiple
      );
      
      newMarker.setPopup(popup).togglePopup();
      
      // Handle marker drag events - same as in useMarkers
      newMarker.on("dragend", async () => {
        const lngLat = newMarker.getLngLat();
        try {
          // Query new elevation at drag position
          const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
          
          const updatedLocation: LocationData = {
            lng: lngLat.lng,
            lat: lngLat.lat,
            elevation: newElevation,
          };
          
          // Update marker in context
          updateMarker(markerId, { location: updatedLocation });
          
          // Get current markers of same type for indexing
          const currentSameTypeMarkers = markers.filter(m => m.type === 'repeater');
          const currentMarkerIndex = currentSameTypeMarkers.findIndex(m => m.id === markerId);
          const hasMultipleNow = currentSameTypeMarkers.length > 1;
          
          // Recreate popup with updated elevation
          const newPopup = createMarkerPopup(
            'repeater',
            newElevation,
            elevationOffset,
            () => {
              newMarker.remove();
              removeMarker(markerId);
            },
            markerId,
            currentMarkerIndex,
            hasMultipleNow
          );
          
          newMarker.setPopup(newPopup).togglePopup();
        } catch (error) {
          console.error(`Error updating repeater elevation:`, error);
        }
      });
      
      // Track conversion event
      trackEvent('convert_tower_to_repeater', {
        carrier: towerData.carrier,
        technology: towerData.technology,
        action: 'single_conversion'
      });
      
      console.log('Successfully created repeater from tower:', markerId);
      return true;
    } catch (error) {
      console.error('Error converting tower to repeater:', error);
      return false;
    }
  }, [map, terrainLoaded, addMarker, updateMarker, removeMarker, markers, defaultElevationOffsets, createMarkerLabel, queryTerrainElevation]);

  /**
   * Listen for tower conversion events dispatched from tower popups
   */
  useEffect(() => {
    const handleTowerConversion = (event: CustomEvent<TowerData>) => {
      // Process conversion request
      convertTowerToRepeater(event.detail);
    };
    
    // Add event listener
    window.addEventListener('tower:createRepeater' as any, handleTowerConversion as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('tower:createRepeater' as any, handleTowerConversion as EventListener);
    };
  }, [convertTowerToRepeater]);

  return {
    convertTowerToRepeater
  };
}