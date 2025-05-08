/**
 * ElevationService.ts
 * 
 * Optimized service for terrain elevation data access.
 * Provides caching, batch queries, and efficient fallback mechanisms
 * with minimal overhead.
 * wholesale swapout of the old elevation service
 */

import mapboxgl from 'mapbox-gl';
import { Coordinates2D } from '../Types/GridAnalysisTypes';

export class ElevationService {
  private map: mapboxgl.Map;
  private cache: Map<string, number> = new Map();
  private readonly MAX_CACHE_SIZE = 10000;
  private terrainReady = false;
  
  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.ensureTerrainReady();
  }
  
  private key(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }
  
  /**
   * Ensures terrain layer is ready for queries
   */
  async ensureTerrainReady(): Promise<void> {
    if (this.terrainReady) return;
  
    if (!this.map.getSource("mapbox-dem")) {
      this.map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 15,
      });
      this.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });
    }
  
    // Wait for source to be loaded (simplified approach)
    if (!this.map.isSourceLoaded("mapbox-dem")) {
      await new Promise<void>((resolve) => {
        const checkDEM = () => {
          if (this.map.isSourceLoaded("mapbox-dem")) {
            this.map.off("sourcedata", checkDEM);
            resolve();
          }
        };
        this.map.on("sourcedata", checkDEM);
        setTimeout(() => {
          this.map.off("sourcedata", checkDEM);
          resolve(); // Resolve anyway after timeout
        }, 5000);
      });
    }
    
    this.terrainReady = true;
  }

  /**
   * Preloads elevation data for an area of interest.
   * Simplified to focus on essential functionality.
   */
  async preloadArea(coordinates: [number, number, number][]): Promise<void> {
    await this.ensureTerrainReady();
    
    // Take a subset of coordinates to trigger tile loading
    const sampleSize = Math.min(coordinates.length, 20);
    const step = Math.max(1, Math.floor(coordinates.length / sampleSize));
    
    for (let i = 0; i < coordinates.length; i += step) {
      const [lon, lat] = coordinates[i];
      // Just query to trigger tile loading, discard result
      this.map.queryTerrainElevation([lon, lat]);
    }
  }

  /**
   * Gets elevation for a single coordinate with optimized caching
   */
  async getElevation(lon: number, lat: number): Promise<number> {
    const cacheKey = this.key(lon, lat);
    if (this.cache.has(cacheKey)) {
      const cachedValue = this.cache.get(cacheKey)!;
      if (cachedValue !== 0) {
        return cachedValue;
      }
    }
  
    await this.ensureTerrainReady();
    
    try {
      const elev = this.map.queryTerrainElevation([lon, lat]);
      if (elev !== null && elev !== 0) {
        this.cache.set(cacheKey, elev);
        
        // Simple LRU cache management
        if (this.cache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        
        return elev;
      }
    } catch (error) {
      console.warn(`Terrain query error at [${lon}, ${lat}]:`, error);
    }
  
    return 0; // Fallback
  }

  /**
   * Batch query for multiple coordinates with optimized processing
   */
  async batchGetElevations(points: [number, number][], skipPreload: boolean = false): Promise<number[]> {
    if (!skipPreload) {
      const coords = points.map(p => [...p, 0] as [number, number, number]);
      await this.preloadArea(coords);
    }

    // Process in batches for better performance
    const BATCH_SIZE = 100;
    const results: number[] = [];
    
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async ([lon, lat], index) => {
          const cacheKey = this.key(lon, lat);
          
          if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
          }
          
          try {
            const elevation = this.map.queryTerrainElevation([lon, lat]);
            if (elevation !== null && elevation !== undefined) {
              this.cache.set(cacheKey, elevation);
              return elevation;
            }
          } catch (e) {
            // Silent fail and continue
          }
          
          return 0;
        })
      );
      
      results.push(...batchResults);
      
      // Allow UI thread to breathe between large batches
      if (i + BATCH_SIZE < points.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.cache.clear();
  }
}