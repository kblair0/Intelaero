"use client";
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const waitForDEM = (map: mapboxgl.Map, timeoutMs = 20000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn("⚠️ DEM load timeout reached, proceeding anyway");
      resolve();
    }, timeoutMs);

    const checkDEM = () => {
      if (map.isSourceLoaded("mapbox-dem")) {
        console.log("✅ DEM source loaded successfully");
        clearTimeout(timeout);
        resolve();
      } else {
        map.once("sourcedata", checkDEM);
      }
    };

    checkDEM();
  });
};

export const useMap = (containerId: string, options: mapboxgl.MapboxOptions) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [terrainLoaded, setTerrainLoaded] = useState(false);
  const [mapError, setMapError] = useState<Error | null>(null);
  const centerString = JSON.stringify(options.center);

  useEffect(() => {
    if (!containerId) {
      setMapError(new Error("No containerId provided"));
      return;
    }

    let isInitializing = true;
    let mapInstance: mapboxgl.Map | null = null;

    try {
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
      if (!mapboxgl.accessToken) {
        throw new Error("Mapbox access token is not set");
      }

      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with id "${containerId}" not found`);
      }

      const map = new mapboxgl.Map({
        container, // Pass DOM element directly
        style: options.style,
        center: JSON.parse(centerString),
        zoom: options.zoom,
        projection: options.projection,
      });

      mapInstance = map;

      map.once('style.load', () => {
        try {
          if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 15,
            });
          }

          map.setTerrain({
            source: "mapbox-dem",
            exaggeration: 1.5,
          });

          Promise.all([
            new Promise<boolean>((resolve) => {
              if (map.loaded()) {
                resolve(true);
              } else {
                map.once("load", () => resolve(true));
              }
            }),
            waitForDEM(map).then(() => true).catch(() => false),
          ])
            .then(([mapLoaded, demLoaded]) => {
              if (!isInitializing) return;
              mapRef.current = map;
              setTerrainLoaded(true);
              setTimeout(() => {
                // Add comprehensive validation before calling resize
                if (map && map.loaded) {
                  try {
                    // Check if map is still loaded and container exists
                    const container = map.getContainer();
                    const canvas = map.getCanvas();
                    
                    if (container && canvas && map.loaded()) {
                      map.resize();
                    } else {
                      console.warn("Map resize skipped: container or canvas not available");
                    }
                  } catch (resizeError) {
                    console.warn("Error during map resize:", resizeError);
                  }
                }
              }, 100);
            })
            .catch((error) => {
              setMapError(error instanceof Error ? error : new Error(String(error)));
            });
        } catch (error) {
          setMapError(error instanceof Error ? error : new Error(String(error)));
        }
      });
    } catch (error) {
      setMapError(error instanceof Error ? error : new Error(String(error)));
    }

    return () => {
      isInitializing = false;
      if (mapInstance) {
        try {
          // Check if map has a remove method and is still valid
          if (mapInstance.remove && typeof mapInstance.remove === 'function') {
            mapInstance.remove();
          } else {
            console.warn("Map already destroyed, skipping cleanup");
          }
        } catch (err) {
          console.warn("Error removing map:", err);
        }
      }
      mapRef.current = null;
    };
  }, [containerId, options.style, centerString, options.zoom, options.projection]);

  return {
    map: mapRef.current,
    terrainLoaded,
    error: mapError,
  };
};