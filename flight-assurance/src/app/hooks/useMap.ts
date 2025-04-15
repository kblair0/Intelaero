// src/hooks/useMap.ts
"use client";
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

/**
 * Returns a promise that resolves when the DEM source (raster-dem) is loaded.
 * Includes a timeout to prevent infinite waiting.
 */
const waitForDEM = (map: mapboxgl.Map, timeoutMs = 20000): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Set a timeout to prevent infinite waiting
    const timeout = setTimeout(() => {
      console.warn("⚠️ DEM load timeout reached, proceeding anyway");
      resolve(); // Resolve anyway to prevent blocking
    }, timeoutMs);
    
    const checkDEM = () => {
      if (map.isSourceLoaded("mapbox-dem")) {
        console.log("✅ DEM source loaded successfully");
        clearTimeout(timeout);
        resolve();
      } else {
        // Schedule another check
        map.once("sourcedata", checkDEM);
      }
    };
    
    // Initial check
    checkDEM();
  });
};

/**
 * Custom hook that initializes a Mapbox map instance and sets up terrain.
 * Includes robust error handling and debugging capabilities.
 *
 * @param containerId - The HTML element ID to render the map into.
 * @param options - The map initialization options (style, center, zoom, etc.).
 * @returns An object with the map instance (or null) and a terrainLoaded flag.
 */
export const useMap = (containerId: string, options: mapboxgl.MapboxOptions) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [terrainLoaded, setTerrainLoaded] = useState(false);
  const [mapError, setMapError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!containerId) {
      console.error("No containerId provided to useMap");
      return;
    }
    
    // Track initialization state to avoid race conditions
    let isInitializing = true;
    let mapInstance: mapboxgl.Map | null = null;
    
    console.log(`🗺️ Initializing map with containerId: ${containerId}`);
    
    try {
      // Validate Mapbox token
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
      if (!mapboxgl.accessToken) {
        throw new Error("Mapbox access token is not set");
      }
      
      // Check if container exists
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container with id "${containerId}" not found`);
      }
      
      // Create map instance
      const map = new mapboxgl.Map({
        container: containerId,
        ...options,
      });
      
      mapInstance = map;
      
      // Set up event listeners for debugging
      map.on('style.load', () => {
        console.log('🎨 Map style loaded!');
      });
      
      map.on('load', () => {
        console.log('🌐 Map fully loaded!');
      });
      
      map.on('idle', () => {
        console.log('⚓ Map is idle and ready for interaction');
      });
      
      map.on('error', (e) => {
        console.error("❌ Mapbox error:", e);
        if (isInitializing) {
          setMapError(new Error(`Mapbox error: ${e.error?.message || 'Unknown error'}`));
        }
      });
      
      // Initialize terrain once style is loaded
      map.once('style.load', () => {
        try {
          console.log('Setting up terrain...');
          
          // Add DEM source if not already present
          if (!map.getSource("mapbox-dem")) {
            map.addSource("mapbox-dem", {
              type: "raster-dem",
              url: "mapbox://mapbox.mapbox-terrain-dem-v1",
              tileSize: 512,
              maxzoom: 15,
            });
            console.log('Added mapbox-dem source');
          } else {
            console.log('mapbox-dem source already exists');
          }
          
          // Set terrain with the DEM source
          map.setTerrain({
            source: "mapbox-dem",
            exaggeration: 1.5,
          });
          console.log('Terrain set up with mapbox-dem source');
          
          // Periodically check DEM status
          const checkDEMStatus = () => {
            if (!map || !map.getSource) return;
            
            try {
              const demSource = map.getSource('mapbox-dem');
              if (demSource) {
                const isLoaded = map.isSourceLoaded('mapbox-dem');
                console.log(`📊 DEM source exists, loaded: ${isLoaded}`);
                if (!isLoaded && isInitializing) {
                  setTimeout(checkDEMStatus, 1000);
                }
              } else {
                console.log('⚠️ DEM source does not exist yet');
                if (isInitializing) {
                  setTimeout(checkDEMStatus, 1000);
                }
              }
            } catch (err) {
              console.warn('Error checking DEM status:', err);
            }
          };
          
          // Start DEM status checks
          setTimeout(checkDEMStatus, 1000);
          
          // Wait for both map and DEM to be ready
          Promise.all([
            new Promise<boolean>((resolve) => {
              if (map.loaded()) {
                console.log("Map already loaded, resolving immediately");
                resolve(true);
              } else {
                console.log("Waiting for map load event");
                map.once("load", () => {
                  console.log("Map load event received");
                  resolve(true);
                });
              }
            }),
            waitForDEM(map).then(() => true).catch(err => {
              console.error("Error waiting for DEM:", err);
              return false;
            })
          ])
          .then(([mapLoaded, demLoaded]) => {
            if (!isInitializing) return; // Abort if component unmounted
            
            console.log(`✅ Initialization complete - Map loaded: ${mapLoaded}, DEM loaded: ${demLoaded}`);
            mapRef.current = map;
            setTerrainLoaded(true);
            
            // Force a map resize to ensure correct sizing
            setTimeout(() => {
              if (map) map.resize();
            }, 100);
            
            console.log("Map instance stored in ref and terrainLoaded set to true");
          })
          .catch((error) => {
            console.error("❌ Error during map/DEM initialization:", error);
            setMapError(error);
          });
          
        } catch (error) {
          console.error("❌ Error setting up terrain:", error);
          setMapError(error instanceof Error ? error : new Error(String(error)));
        }
      });
      
    } catch (error) {
      console.error("❌ Fatal error initializing map:", error);
      setMapError(error instanceof Error ? error : new Error(String(error)));
    }
    
    // Cleanup function for unmounting
    return () => {
      console.log("🧹 Cleaning up map instance");
      isInitializing = false;
      
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch (err) {
          console.warn("Error removing map:", err);
        }
      }
      
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (err) {
          console.warn("Error removing map from ref:", err);
        }
        mapRef.current = null;
      }
    };
  }, [
    containerId,
    // Only include stable dependencies to avoid recreating the map unnecessarily
    options.style,
    // Use JSON.stringify for complex objects like center
    JSON.stringify(options.center),
    options.zoom,
    options.projection,
  ]);
  
  // Return the map instance, terrain loaded state, and any errors
  return { 
    map: mapRef.current, 
    terrainLoaded,
    error: mapError
  };
};