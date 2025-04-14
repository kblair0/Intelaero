// useMap.ts
"use client";
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

/**
 * Returns a promise that resolves when the DEM source (raster-dem) is loaded.
 */

const waitForDEM = (map: mapboxgl.Map): Promise<void> => {
  return new Promise((resolve) => {
    const checkDEM = () => {
      if (map.isSourceLoaded("mapbox-dem")) {
        console.log("✅ DEM source loaded");
        resolve();
      } else {
        map.once("sourcedata", checkDEM);
      }
    };
    checkDEM();
  });
};

/**
 * Custom hook that initializes a Mapbox map instance and sets up terrain.
 *
 * @param containerId - The HTML element ID to render the map into.
 * @param options - The map initialization options (style, center, zoom, etc.).
 * @returns An object with the map instance (or null) and a terrainLoaded flag.
 */
export const useMap = (containerId: string, options: mapboxgl.MapboxOptions) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [terrainLoaded, setTerrainLoaded] = useState(false);

  useEffect(() => {
    if (!containerId) return;

    // Set Mapbox access token
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
    if (!mapboxgl.accessToken) {
      console.error("❌ Mapbox access token is not set");
      return;
    }

    // Create a new map instance
    const map = new mapboxgl.Map({
      container: containerId,
      ...options,
    });

    // Wait for the style to be fully loaded
    map.once('style.load', () => {
      try {
        // Add the DEM source if it isn't already added
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 15,
          });
        }

        // Set the terrain based on the DEM source
        map.setTerrain({
          source: "mapbox-dem",
          exaggeration: 1.5,
        });

        // Wait until the map is idle and the DEM is loaded
        Promise.all([
          new Promise((resolve) => map.once("idle", resolve)),
          waitForDEM(map),
        ])
          .then(() => {
            mapRef.current = map;
            setTerrainLoaded(true);
            console.log("✅ Map style and terrain fully loaded");
          })
          .catch((error) => {
            console.error("❌ Error waiting for map or DEM:", error);
          });
      } catch (error) {
        console.error("❌ Error initializing map layers:", error);
      }
    });

    map.on('error', (e) => {
      console.error("Mapbox error:", e);
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    containerId,
    options.style,
    options.center?.[0],
    options.center?.[1],
    options.zoom,
    options.projection,
  ]);

  return { map: mapRef.current, terrainLoaded };
};