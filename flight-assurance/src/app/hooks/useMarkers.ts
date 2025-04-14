// src/app/hooks/useMarkers.ts
"use client";
import { useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMarkersContext } from '../context/MarkerContext';
import { LocationData } from '../types/LocationData';
import { createMarkerPopup } from '../utils/markerPopup';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';

type MarkerType = 'gcs' | 'observer' | 'repeater';

interface UseMarkersProps {
  map: mapboxgl.Map | null;
  terrainLoaded: boolean;
}

export function useMarkers({ map, terrainLoaded }: UseMarkersProps) {
  const {
    gcsLocation,
    setGcsLocation,
    observerLocation,
    setObserverLocation,
    repeaterLocation,
    setRepeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset,
  } = useMarkersContext();

  // Marker refs
  const gcsMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const observerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const repeaterMarkerRef = useRef<mapboxgl.Marker | null>(null);

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

  // Fallback function for querying terrain elevation from Mapbox Terrain-RGB
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

  // ----------------------------
  // Marker Creation Functions
  // ----------------------------

  // Add Ground Station
  const addGroundStation = useCallback(async () => {
    if (!map || !terrainLoaded) return;
    const center = map.getCenter();
    try {
      const elevation = await queryTerrainElevation([center.lng, center.lat]);
      const initialLocation: LocationData = {
        lng: center.lng,
        lat: center.lat,
        elevation: elevation,
      };
      console.log("GCS Initial Location:", initialLocation);
      setGcsLocation(initialLocation);

      const gcsMarker = new mapboxgl.Marker({ color: "blue", draggable: true })
        .setLngLat(center)
        .addTo(map);
      gcsMarkerRef.current = gcsMarker;

      // Create and set popup using the popup utility,
      // passing the appropriate elevation offset for GCS.
      const popup = createMarkerPopup(
        "gcs",
        elevation,
        gcsElevationOffset,
        () => {
          gcsMarker.remove();
          setGcsLocation(null);
        }
      );
      gcsMarker.setPopup(popup).togglePopup();

      // Update marker on drag end
      gcsMarker.on("dragend", async () => {
        const lngLat = gcsMarker.getLngLat();
        try {
          const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
          const location: LocationData = {
            lng: lngLat.lng,
            lat: lngLat.lat,
            elevation: newElevation,
          };
          setGcsLocation(location);
          // Clean up outdated analysis layers
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
          // Recreate popup with updated elevation
          const newPopup = createMarkerPopup(
            "gcs",
            newElevation,
            gcsElevationOffset,
            () => {
              gcsMarker.remove();
              setGcsLocation(null);
            }
          );
          gcsMarker.setPopup(newPopup).togglePopup();
        } catch (error) {
          console.error("Error updating GCS elevation:", error);
        }
      });
    } catch (error) {
      console.error("Error initializing GCS:", error);
    }
  }, [map, terrainLoaded, queryTerrainElevation, setGcsLocation, gcsElevationOffset]);

  // Add Observer
  const addObserver = useCallback(async () => {
    if (!map || !terrainLoaded) return;
    const center = map.getCenter();
    try {
      const elevation = await queryTerrainElevation([center.lng, center.lat]);
      const initialLocation: LocationData = {
        lng: center.lng,
        lat: center.lat,
        elevation: elevation,
      };
      console.log("Observer Initial Location:", initialLocation);
      setObserverLocation(initialLocation);

      const observerMarker = new mapboxgl.Marker({ color: "green", draggable: true })
        .setLngLat(center)
        .addTo(map);
      observerMarkerRef.current = observerMarker;

      const popup = createMarkerPopup(
        "observer",
        elevation,
        observerElevationOffset,
        () => {
          observerMarker.remove();
          setObserverLocation(null);
        }
      );
      observerMarker.setPopup(popup).togglePopup();

      observerMarker.on("dragend", async () => {
        const lngLat = observerMarker.getLngLat();
        try {
          const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
          const location: LocationData = {
            lng: lngLat.lng,
            lat: lngLat.lat,
            elevation: newElevation,
          };
          setObserverLocation(location);
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
          const newPopup = createMarkerPopup(
            "observer",
            newElevation,
            observerElevationOffset,
            () => {
              observerMarker.remove();
              setObserverLocation(null);
            }
          );
          observerMarker.setPopup(newPopup).togglePopup();
        } catch (error) {
          console.error("Error updating Observer elevation:", error);
        }
      });
    } catch (error) {
      console.error("Error initializing Observer:", error);
    }
  }, [map, terrainLoaded, queryTerrainElevation, setObserverLocation, observerElevationOffset]);

  // Add Repeater
  const addRepeater = useCallback(async () => {
    if (!map || !terrainLoaded) return;
    const center = map.getCenter();
    try {
      const elevation = await queryTerrainElevation([center.lng, center.lat]);
      const initialLocation: LocationData = {
        lng: center.lng,
        lat: center.lat,
        elevation: elevation,
      };
      console.log("Repeater Initial Location:", initialLocation);
      setRepeaterLocation(initialLocation);

      const repeaterMarker = new mapboxgl.Marker({ color: "red", draggable: true })
        .setLngLat(center)
        .addTo(map);
      repeaterMarkerRef.current = repeaterMarker;

      const popup = createMarkerPopup(
        "repeater",
        elevation,
        repeaterElevationOffset,
        () => {
          repeaterMarker.remove();
          setRepeaterLocation(null);
        }
      );
      repeaterMarker.setPopup(popup).togglePopup();

      repeaterMarker.on("dragend", async () => {
        const lngLat = repeaterMarker.getLngLat();
        try {
          const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
          const location: LocationData = {
            lng: lngLat.lng,
            lat: lngLat.lat,
            elevation: newElevation,
          };
          setRepeaterLocation(location);
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
          const newPopup = createMarkerPopup(
            "repeater",
            newElevation,
            repeaterElevationOffset,
            () => {
              repeaterMarker.remove();
              setRepeaterLocation(null);
            }
          );
          repeaterMarker.setPopup(newPopup).togglePopup();
        } catch (error) {
          console.error("Error updating Repeater elevation:", error);
        }
      });
    } catch (error) {
      console.error("Error initializing Repeater:", error);
    }
  }, [map, terrainLoaded, queryTerrainElevation, setRepeaterLocation, repeaterElevationOffset]);

  // Update marker popups when elevation offsets change
  const updateMarkerPopups = useCallback(() => {
    if (gcsMarkerRef.current && gcsLocation && gcsLocation.elevation !== null) {
      const updatedPopup = createMarkerPopup(
        "gcs",
        gcsLocation.elevation,
        gcsElevationOffset,
        () => {
          gcsMarkerRef.current?.remove();
          setGcsLocation(null);
        }
      );
      gcsMarkerRef.current.setPopup(updatedPopup);
      if (gcsMarkerRef.current.getPopup()?.isOpen()) {
        gcsMarkerRef.current.getPopup()?.setDOMContent(updatedPopup.getElement());
      }
    }
    if (observerMarkerRef.current && observerLocation && observerLocation.elevation !== null) {
      const updatedPopup = createMarkerPopup(
        "observer",
        observerLocation.elevation,
        observerElevationOffset,
        () => {
          observerMarkerRef.current?.remove();
          setObserverLocation(null);
        }
      );
      observerMarkerRef.current.setPopup(updatedPopup);
      if (observerMarkerRef.current.getPopup()?.isOpen()) {
        observerMarkerRef.current.getPopup()?.setDOMContent(updatedPopup.getElement());
      }
    }
    if (repeaterMarkerRef.current && repeaterLocation && repeaterLocation.elevation !== null) {
      const updatedPopup = createMarkerPopup(
        "repeater",
        repeaterLocation.elevation,
        repeaterElevationOffset,
        () => {
          repeaterMarkerRef.current?.remove();
          setRepeaterLocation(null);
        }
      );
      repeaterMarkerRef.current.setPopup(updatedPopup);
      if (repeaterMarkerRef.current.getPopup()?.isOpen()) {
        repeaterMarkerRef.current.getPopup()?.setDOMContent(updatedPopup.getElement());
      }
    }
  }, [
    gcsLocation,
    observerLocation,
    repeaterLocation,
    setGcsLocation,
    setObserverLocation,
    setRepeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset,
  ]);

  // Remove all markers and clean up analysis layers
  const removeAllMarkers = useCallback(() => {
    if (gcsMarkerRef.current) {
      gcsMarkerRef.current.remove();
      gcsMarkerRef.current = null;
      setGcsLocation(null);
    }
    if (observerMarkerRef.current) {
      observerMarkerRef.current.remove();
      observerMarkerRef.current = null;
      setObserverLocation(null);
    }
    if (repeaterMarkerRef.current) {
      repeaterMarkerRef.current.remove();
      repeaterMarkerRef.current = null;
      setRepeaterLocation(null);
    }
    layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
    layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
    layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
    layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
  }, [setGcsLocation, setObserverLocation, setRepeaterLocation]);

  return {
    gcsLocation,
    observerLocation,
    repeaterLocation,
    gcsMarkerRef,
    observerMarkerRef,
    repeaterMarkerRef,
    addGroundStation,
    addObserver,
    addRepeater,
    updateMarkerPopups,
    removeAllMarkers,
  };
}
// Note: The above code assumes the existence of the following utility functions:
// - createMarkerPopup: A utility function to create a popup for the marker.
// - layerManager: A utility for managing layers on the map.
// - MAP_LAYERS: An object containing the layer names used in the application.
// - LocationData: A type definition for the location data structure.
// - useMarkersContext: A custom hook to access the marker context.
// - LocationData: A type definition for the location data structure.
