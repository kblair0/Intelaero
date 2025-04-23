/**
 * ElevationService.ts
 * 
 * Enhanced service class for robust elevation data access optimized for LOS analysis.
 * Provides caching, preloading, batch queries, and fallback mechanisms for 
 * reliably accessing terrain elevation from Mapbox DEM.
 */

import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { normaliseElevation } from '../utils/elevation';

export class ElevationService {
  private map: mapboxgl.Map;
  private cache: Map<string, number> = new Map();
  private pendingLoads: Set<string> = new Set();

  /**
   * Initializes the service with a Mapbox map instance.
   * @param map - The Mapbox map instance to query elevations from.
   */
  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  /**
   * Generates a unique cache key for a coordinate pair.
   * @param lon - Longitude of the coordinate.
   * @param lat - Latitude of the coordinate.
   * @returns A string key for caching elevation data.
   */
  private key(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }

  /**
   * Ensures the terrain source ("mapbox-dem") is added and ready.
   * Adds the source and terrain layer if not present, and waits for initial loading.
   * @returns A promise that resolves when the terrain source is ready.
   */
  async ensureTerrainReady(): Promise<void> {
    if (!this.map.getSource("mapbox-dem")) {
      this.map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 15,
      });
      this.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });
    }

    if (!this.map.isSourceLoaded("mapbox-dem")) {
      await new Promise<void>((resolve) => {
        const checkDEM = () => {
          if (this.map!.isSourceLoaded("mapbox-dem")) {
            this.map!.off("sourcedata", checkDEM);
            resolve();
          }
        };
        this.map!.on("sourcedata", checkDEM);
        
        // Safety timeout to avoid hanging indefinitely
        setTimeout(() => {
          this.map!.off("sourcedata", checkDEM);
          resolve();
        }, 5000);
      });
    }
  }

  /**
   * Preloads DEM tiles for a given set of coordinates by adjusting the map view.
   * Optimized for LOS analysis by ensuring all necessary tiles are loaded.
   * @param coordinates - Array of [lon, lat, alt] coordinates defining the area.
   * @returns A promise that resolves when the map is idle and tiles are loaded.
   */
  async preloadArea(coordinates: [number, number, number][]): Promise<void> {
    if (coordinates.length === 0) return;
    
    // Create a feature from the coordinates
    const points = coordinates.map(c => [c[0], c[1]]);
    let geom: GeoJSON.FeatureCollection;
    
    // Handle different coordinate patterns
    if (points.length === 1) {
      // Single point - create a small buffer around it
      const point = turf.point(points[0]);
      const buffered = turf.buffer(point, 200, { units: 'meters' });
      geom = turf.featureCollection([buffered]);
    } else if (points.length === 2) {
      // Two points - create a corridor with buffer
      const line = turf.lineString(points);
      const buffered = turf.buffer(line, 100, { units: 'meters' });
      geom = turf.featureCollection([buffered]);
    } else {
      // Multiple points - create a convex hull with buffer
      const pointFeatures = points.map(p => turf.point(p));
      const collection = turf.featureCollection(pointFeatures);
      const hull = turf.convex(collection);
      
      if (hull) {
        const buffered = turf.buffer(hull, 100, { units: 'meters' });
        geom = turf.featureCollection([buffered]);
      } else {
        // Fallback if hull creation fails
        const line = turf.lineString(points);
        const buffered = turf.buffer(line, 100, { units: 'meters' });
        geom = turf.featureCollection([buffered]);
      }
    }
    
    const bounds = turf.bbox(geom);
    const [minLng, minLat, maxLng, maxLat] = bounds;

    // Remember current view
    const currentCenter = this.map.getCenter();
    const currentZoom = this.map.getZoom();
    const currentBearing = this.map.getBearing();
    const currentPitch = this.map.getPitch();

    // Adjust the map to load the region
    this.map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]], 
      { 
        padding: 50,
        maxZoom: 13, // Limit zoom to ensure we don't load too detailed tiles
        duration: 0   // Instant transition
      }
    );

    // Wait for the map to be idle (all tiles loaded)
    await new Promise<void>((resolve) => {
      const checkIdle = () => {
        resolve();
        this.map.off('idle', checkIdle);
      };
      
      this.map.once('idle', checkIdle);
      
      // Safety timeout
      setTimeout(() => {
        this.map.off('idle', checkIdle);
        resolve();
      }, 5000);
    });

    // Restore original view
    this.map.jumpTo({
      center: currentCenter,
      zoom: currentZoom,
      bearing: currentBearing,
      pitch: currentPitch
    });
  }

  /**
   * Retrieves elevation at a specific coordinate with caching and retries.
   * Optimized for high-volume queries during LOS analysis.
   * @param lon - Longitude of the point.
   * @param lat - Latitude of the point.
   * @param maxRetries - Maximum number of retry attempts if elevation is null.
   * @param retryDelay - Delay between retries in milliseconds.
   * @returns The elevation in meters, or 0 if data is unavailable after retries.
   */
  async getElevation(lon: number, lat: number, maxRetries = 3, retryDelay = 200): Promise<number> {
    const cacheKey = this.key(lon, lat);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    // Skip if this query is already in progress (prevents duplicative queries)
    if (this.pendingLoads.has(cacheKey)) {
      // Wait briefly and check cache again
      await new Promise(resolve => setTimeout(resolve, 50));
      if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;
    }
    
    this.pendingLoads.add(cacheKey);

    try {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const elev = this.map.queryTerrainElevation([lon, lat]);
        if (elev !== null) {
          const normalized = normaliseElevation(elev);
          this.cache.set(cacheKey, normalized);
          return normalized;
        }
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      // All retries failed, use fallback method
      try {
        // Try to get elevation from a slightly offset point
        for (const offset of [[0.0001, 0], [0, 0.0001], [-0.0001, 0], [0, -0.0001]]) {
          const elev = this.map.queryTerrainElevation([lon + offset[0], lat + offset[1]]);
          if (elev !== null) {
            const normalized = normaliseElevation(elev);
            this.cache.set(cacheKey, normalized);
            return normalized;
          }
        }
      } catch (e) {
        console.warn('Offset fallback elevation query failed:', e);
      }

      console.warn(`Elevation data not loaded for [${lon}, ${lat}] after all attempts`);
      this.cache.set(cacheKey, 0);
      return 0;
    } finally {
      this.pendingLoads.delete(cacheKey);
    }
  }

  /**
   * Batch queries elevations for multiple points.
   * Optimized for LOS analysis where many elevations are needed at once.
   * @param points - Array of [longitude, latitude] coordinates
   * @returns Array of elevations corresponding to input points
   */
  async batchGetElevations(points: [number, number][]): Promise<number[]> {
    // First check cache for all points
    const cachedResults: (number | null)[] = points.map(([lon, lat]) => {
      const cacheKey = this.key(lon, lat);
      return this.cache.has(cacheKey) ? this.cache.get(cacheKey)! : null;
    });
    
    // If all points are cached, return immediately
    if (!cachedResults.includes(null)) {
      return cachedResults as number[];
    }
    
    // For uncached points, preload their area
    const uncachedPoints = points.filter((_, i) => cachedResults[i] === null);
    
    if (uncachedPoints.length > 0) {
      // Add a dummy altitude value to match the expected coordinate format
      const coords = uncachedPoints.map(p => [...p, 0] as [number, number, number]);
      await this.preloadArea(coords);
    }
    
    // Now query all uncached elevations
    const results = await Promise.all(
      points.map(async ([lon, lat], i) => {
        if (cachedResults[i] !== null) {
          return cachedResults[i] as number;
        }
        return await this.getElevation(lon, lat);
      })
    );
    
    return results;
  }
  
  /**
   * Clears the elevation cache.
   * Useful when map style changes or after long periods.
   */
  clearCache(): void {
    this.cache.clear();
  }
}