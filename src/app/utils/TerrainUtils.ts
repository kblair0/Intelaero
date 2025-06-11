import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

// In-memory cache for elevation results
const elevationCache = new Map<string, number>();

// Utility to generate cache key from coordinates
function getCacheKey(lon: number, lat: number): string {
  return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
}

/**
 * Gets reliable terrain elevations using a robust approach with minimal retries.
 * Optimized for flight path processing with caching, parallel queries, and preloading.
 * Does not cache negative elevation values < 0.05 and requeries them if requested again.
 * 
 * @param map - The Mapbox GL map instance
 * @param coordinates - Array of [longitude, latitude] coordinates to query
 * @param progressCallback - Optional callback for reporting progress (0-100)
 * @returns Array of elevations for each coordinate
 */
export async function getReliableTerrainElevations(
  map: mapboxgl.Map,
  coordinates: [number, number][],
  progressCallback?: (percent: number) => void
): Promise<number[]> {
  console.log(`[${new Date().toISOString()}] [TerrainUtils] Getting reliable terrain elevations for ${coordinates.length} coordinates`);
  
  const elevations: number[] = new Array(coordinates.length).fill(0);
  const CHUNK_SIZE = 50; // Smaller chunk size for better performance
  
  for (let i = 0; i < coordinates.length; i += CHUNK_SIZE) {
    const chunk = coordinates.slice(i, i + CHUNK_SIZE);
    
    // Process chunk concurrently
    await Promise.all(chunk.map(async ([lon, lat], j) => {
      const cacheKey = getCacheKey(lon, lat);
      
      // Check cache and validate elevation
      if (elevationCache.has(cacheKey)) {
        const cachedElevation = elevationCache.get(cacheKey)!;
        if (cachedElevation >= 0.05) {
          elevations[i + j] = cachedElevation;
          return;
        } else {
          // Remove invalid cached value to force requery
          elevationCache.delete(cacheKey);
          console.log(`[${new Date().toISOString()}] [TerrainUtils] Removed invalid cached elevation ${cachedElevation}m for [${lon}, ${lat}]`);
        }
      }
      
      let elevation: number | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        // Reduced delays: 50ms, 100ms, 150ms
        await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        try {
          const elev = map.queryTerrainElevation([lon, lat]);
          if (elev !== null) {
            elevation = elev;
            break;
          }
          console.warn(`[${new Date().toISOString()}] [TerrainUtils] Attempt ${attempt} returned null for [${lon}, ${lat}]`);
        } catch (err) {
          console.error(`[${new Date().toISOString()}] [TerrainUtils] Error on attempt ${attempt} for [${lon}, ${lat}]:`, err);
        }
      }
      
      if (elevation === null) {
        console.warn(`[${new Date().toISOString()}] [TerrainUtils] Using fallback elevation for [${lon}, ${lat}]`);
        // Use average of valid elevations in current chunk
        const neighbors = elevations.slice(0, i + j).filter(e => e !== 0);
        elevation = neighbors.length > 0 ? neighbors.reduce((sum, e) => sum + e, 0) / neighbors.length : 0;
      }
      
      elevations[i + j] = elevation;
      // Only cache elevations >= 0.05
      if (elevation >= 0.05) {
        elevationCache.set(cacheKey, elevation);
      } else {
        console.log(`[${new Date().toISOString()}] [TerrainUtils] Skipped caching elevation ${elevation}m for [${lon}, ${lat}] (below 0.05m)`);
      }
    }));
    
    // Report progress
    if (progressCallback) {
      progressCallback(Math.min(100, Math.round((i + CHUNK_SIZE) / coordinates.length * 100)));
    }
    
    // Reduced delay between chunks
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  return elevations;
}

/**
 * Ensures that DEM data is loaded, with limited retries and dynamic test points.
 * @param map - The Mapbox GL map instance
 * @param testPoints - Optional array of test coordinates for validation
 * @returns Promise that resolves when DEM is ready or after max retries
 */
export async function ensureDEMLoaded(map: mapboxgl.Map, testPoints?: [number, number][]): Promise<void> {
  console.log(`[${new Date().toISOString()}] [TerrainUtils] Ensuring DEM is fully loaded...`);
  
  return new Promise<void>((resolve) => {
    let retries = 0;
    const maxRetries = 3;
    
    const checkDEM = async () => {
      if (map.isSourceLoaded('mapbox-dem')) {
        const isValid = await validateDEMData(map, testPoints);
        if (isValid) {
          console.log(`[${new Date().toISOString()}] [TerrainUtils] ✅ DEM fully loaded and validated`);
          resolve();
        } else if (retries < maxRetries) {
          retries++;
          console.log(`[${new Date().toISOString()}] [TerrainUtils] DEM validation failed, retrying (${retries}/${maxRetries})...`);
          setTimeout(checkDEM, 500);
        } else {
          console.warn(`[${new Date().toISOString()}] [TerrainUtils] DEM validation failed after ${maxRetries} retries, proceeding with warning`);
          resolve();
        }
      } else {
        console.log(`[${new Date().toISOString()}] [TerrainUtils] Waiting for DEM source to load...`);
        map.once('sourcedata', checkDEM);
      }
    };
    
    checkDEM();
  });
}

/**
 * Validates that DEM data is available using provided or dynamic test points.
 * @param map - The Mapbox GL map instance
 * @param testPoints - Optional array of test coordinates
 * @returns Promise resolving to boolean indicating if DEM data is valid
 */
export async function validateDEMData(map: mapboxgl.Map, testPoints?: [number, number][]): Promise<boolean> {
  const points = testPoints && testPoints.length > 0 ? testPoints.slice(0, 3) : [
    map.getCenter().toArray() as [number, number], // Fallback to map center
  ];
  
  const elevations = await Promise.all(
    points.map(async point => {
      const elevation = map.queryTerrainElevation(point);
      return { point, elevation };
    })
  );
  
  const validElevations = elevations.filter(e => e.elevation !== null && e.elevation !== 0);
  
  if (validElevations.length === points.length) {
    console.log(`[${new Date().toISOString()}] [TerrainUtils] DEM validation successful:`, 
      validElevations.map(v => `[${v.point}]: ${v.elevation}m`).join(', ')
    );
    return true;
  }
  
  console.warn(`[${new Date().toISOString()}] [TerrainUtils] DEM validation failed:`,
    elevations.map(e => `[${e.point}]: ${e.elevation !== null ? e.elevation : 'null'}m`).join(', ')
  );
  return false;
}

/**
 * Preloads DEM tiles for a set of coordinates to minimize null results.
 * @param map - The Mapbox GL map instance
 * @param coordinates - Array of [longitude, latitude] coordinates
 * @returns Promise that resolves when preloading is complete
 */
export async function preloadTiles(map: mapboxgl.Map, coordinates: [number, number][]): Promise<void> {
  if (!coordinates.length) return;
  
  console.log(`[${new Date().toISOString()}] [TerrainUtils] Preloading DEM tiles for ${coordinates.length} coordinates`);
  
  // Create a bounding box
  const points = coordinates.map(([lon, lat]) => turf.point([lon, lat]));
  const featureCollection = turf.featureCollection(points);
  const bbox = turf.bbox(featureCollection);
  
  // Generate sample points within the bbox
  const samplePoints = turf.pointGrid(bbox, 100, { units: 'meters' }).features.map(f => f.geometry.coordinates as [number, number]);
  
  // Query sample points to load tiles
  const BATCH_SIZE = 50;
  for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
    const batch = samplePoints.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(([lon, lat]) => map.queryTerrainElevation([lon, lat])));
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  // Query waypoints directly to ensure coverage
  await Promise.all(coordinates.map(([lon, lat]) => map.queryTerrainElevation([lon, lat])));
  
  console.log(`[${new Date().toISOString()}] [TerrainUtils] DEM tiles preloaded`);
}

/**
 * Clears the elevation cache to free memory.
 */
export function clearElevationCache(): void {
  elevationCache.clear();
  console.log(`[${new Date().toISOString()}] [TerrainUtils] Elevation cache cleared`);
}