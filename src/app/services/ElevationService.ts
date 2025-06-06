/**
 * ElevationService.ts
 * 
 * Optimized service for terrain elevation data access.
 * Provides caching, batch queries, preloading, and efficient fallback mechanisms
 * with minimal overhead. Replaces and enhances TerrainUtils functionality.
 */

import * as turf from '@turf/turf';

export class ElevationService {
  private map: mapboxgl.Map;
  private cache: Map<string, number> = new Map();
  private readonly MAX_CACHE_SIZE = 10000;
  private terrainReady = false;
  private isPreloading = false;
  
  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.ensureTerrainReady();
  }
  
  /**
   * Creates cache key from coordinates
   */
  private key(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }
  
  /**
   * Ensures terrain layer is ready for queries with enhanced reliability
   */
  async ensureTerrainReady(): Promise<void> {
    if (this.terrainReady) return;
  
    if (!this.map.getSource("mapbox-dem")) {
      console.log(`[${new Date().toISOString()}] [ElevationService] Adding DEM source`);
      this.map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 15,
      });
      this.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });
    }
  
    // Enhanced reliability: Wait for source to be loaded with timeout and retry
    if (!this.map.isSourceLoaded("mapbox-dem")) {
      const maxRetries = 3;
      let retries = 0;
      
      while (retries < maxRetries) {
        try {
          await new Promise<void>((resolve, reject) => {
            const checkDEM = () => {
              if (this.map.isSourceLoaded("mapbox-dem")) {
                this.map.off("sourcedata", checkDEM);
                resolve();
              }
            };
            
            this.map.on("sourcedata", checkDEM);
            // Initial check in case it's already loaded
            if (this.map.isSourceLoaded("mapbox-dem")) {
              this.map.off("sourcedata", checkDEM);
              resolve();
            }
            
            // Timeout safety
            setTimeout(() => {
              this.map.off("sourcedata", checkDEM);
              reject(new Error("DEM source loading timeout"));
            }, 5000);
          });
          
          // If we get here, loading was successful
          break;
        } catch (error) {
          retries++;
          console.warn(`[${new Date().toISOString()}] [ElevationService] DEM loading retry ${retries}/${maxRetries}`);
          
          // Last retry failed, continue anyway
          if (retries >= maxRetries) {
            console.warn(`[${new Date().toISOString()}] [ElevationService] Max retries reached, proceeding with warning`);
          }
        }
      }
    }
    
    // Validate DEM with sample queries
    await this.validateDEM();
    
    this.terrainReady = true;
    console.log(`[${new Date().toISOString()}] [ElevationService] Terrain ready`);
  }

  /**
   * Validates that DEM data is available using sample points
   */
  private async validateDEM(): Promise<boolean> {
    const center = this.map.getCenter();
    const testPoints = [
      [center.lng, center.lat],
      [center.lng + 0.01, center.lat],
      [center.lng, center.lat + 0.01]
    ];
    
    const elevations = await Promise.all(
      testPoints.map(point => this.map.queryTerrainElevation(point))
    );
    
    const validElevations = elevations.filter(e => e !== null && e !== 0);
    const isValid = validElevations.length > 0;
    
    if (!isValid) {
      console.warn(`[${new Date().toISOString()}] [ElevationService] DEM validation failed:`,
        elevations.map((e, i) => `[${testPoints[i]}]: ${e !== null ? e : 'null'}m`).join(', ')
      );
    } else {
      console.log(`[${new Date().toISOString()}] [ElevationService] DEM validation successful:`, 
        validElevations.map((v, i) => `[${testPoints[i]}]: ${v}m`).join(', ')
      );
    }
    
    return isValid;
  }

  /**
   * Preloads elevation data for an area of interest based on coordinates.
   * Replaces TerrainUtils.preloadTiles with more efficient implementation.
   */
  async preloadArea(coordinates: [number, number][] | [number, number, number][]): Promise<void> {
    if (this.isPreloading || !coordinates.length) return;
    
    try {
      this.isPreloading = true;
      await this.ensureTerrainReady();
      
      console.log(`[${new Date().toISOString()}] [ElevationService] Preloading terrain for ${coordinates.length} coordinates`);
      
      // Create a bounding box around coordinates
      const points = coordinates.map(coord => turf.point([coord[0], coord[1]]));
      const featureCollection = turf.featureCollection(points);
      const bbox = turf.bbox(featureCollection);
      
      // Generate sample points within the bbox for more efficient coverage
      const samplePoints = turf.pointGrid(bbox, 100, { units: 'meters' }).features
        .map(f => f.geometry.coordinates as [number, number])
        .slice(0, 100); // Limit number of sample points
      
      // Query sample points to load tiles
      const BATCH_SIZE = 20;
      for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
        const batch = samplePoints.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(([lon, lat]) => this.map.queryTerrainElevation([lon, lat])));
        await new Promise(resolve => setTimeout(resolve, 10)); // Smaller delay for efficiency
      }
      
      // Also query original coordinates to ensure they're loaded
      const waypoints = coordinates.map(coord => [coord[0], coord[1]]);
      await this.batchGetElevations(waypoints as [number, number][], true);
      
      console.log(`[${new Date().toISOString()}] [ElevationService] Terrain preloading completed`);
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] [ElevationService] Preloading error:`, error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Gets elevation for a single coordinate with optimized caching
   */
  async getElevation(lon: number, lat: number): Promise<number> {
    const cacheKey = this.key(lon, lat);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
  
    await this.ensureTerrainReady();
    
    try {
      const elev = this.map.queryTerrainElevation([lon, lat]);
      if (elev !== null && elev !== undefined) {
        // Cache all valid elevation values, including zero
        // Zero is a valid elevation (e.g., sea level, water bodies)
        this.cache.set(cacheKey, elev);
        
        // Simple LRU cache management
        if (this.cache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        
        return elev;
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] [ElevationService] Terrain query error at [${lon}, ${lat}]:`, error);
    }
  
    // Enhanced fallback: Only use when we got null or undefined (not for zero)
    try {
      const gridSize = 0.0002; // Small grid for neighboring points
      const neighbors = [
        [lon + gridSize, lat],
        [lon - gridSize, lat],
        [lon, lat + gridSize],
        [lon, lat - gridSize]
      ];
      
      const elevations = await Promise.all(
        neighbors.map(([nlon, nlat]) => this.map.queryTerrainElevation([nlon, nlat]))
      );
      
      const validElevations = elevations.filter(e => e !== null && e !== undefined);
      if (validElevations.length > 0) {
        const avgElev = validElevations.reduce((sum, e) => sum + e!, 0) / validElevations.length;
        this.cache.set(cacheKey, avgElev);
        return avgElev;
      }
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] [ElevationService] Fallback query error:`, error);
    }
  
    return 0; // Final fallback
  }

  /**
   * Batch query for multiple coordinates with optimized processing
   * Replaces and enhances TerrainUtils.getReliableTerrainElevations
   */
  async batchGetElevations(
    points: [number, number][],
    skipPreload: boolean = false,
    progressCallback?: (percent: number) => void
  ): Promise<number[]> {
    if (!skipPreload) {
      const coords = points.map(p => [...p, 0] as [number, number, number]);
      await this.preloadArea(coords);
    }

    console.log(`[${new Date().toISOString()}] [ElevationService] Batch querying elevations for ${points.length} points`);
    
    // Process in batches for better performance
    const BATCH_SIZE = 100;
    const results: number[] = [];
    
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async ([lon, lat]) => {
          const cacheKey = this.key(lon, lat);
          
          if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
          }
          
          try {
            const elevation = this.map.queryTerrainElevation([lon, lat]);
            if (elevation !== null && elevation !== undefined) {
              // Cache all valid elevation values, including zero (sea level)
              this.cache.set(cacheKey, elevation);
              return elevation;
            }
          } catch (e) {
            // Silent fail and continue to fallback
          }
          
          // Try fallback with nearby points ONLY when we got null/undefined (not for zero)
          try {
            const offset = 0.0002;
            const neighbors = [
              [lon + offset, lat],
              [lon - offset, lat],
              [lon, lat + offset],
              [lon, lat - offset]
            ];
            
            const neighborElevations = await Promise.all(
              neighbors.map(([nlon, nlat]) => this.map.queryTerrainElevation([nlon, nlat]))
            );
            
            const validElevations = neighborElevations.filter(e => e !== null && e !== undefined);
            if (validElevations.length > 0) {
              const avgElev = validElevations.reduce((sum, e) => sum + e!, 0) / validElevations.length;
              this.cache.set(cacheKey, avgElev);
              return avgElev;
            }
          } catch (e) {
            // Silent fail and return 0
          }
          
          return 0;
        })
      );
      
      results.push(...batchResults);
      
      // Report progress if callback provided
      if (progressCallback) {
        const progress = Math.min(100, Math.round(((i + BATCH_SIZE) / points.length) * 100));
        progressCallback(progress);
      }
      
      // Allow UI thread to breathe between large batches
      if (i + BATCH_SIZE < points.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }

  /**
   * Gets reliable terrain elevations with enhanced fallback mechanisms.
   * Direct replacement for TerrainUtils.getReliableTerrainElevations.
   */
  async getReliableTerrainElevations(
    coordinates: [number, number][],
    progressCallback?: (percent: number) => void
  ): Promise<number[]> {
    return this.batchGetElevations(coordinates, false, progressCallback);
  }

  /**
   * Ensures DEM data is loaded and validated.
   * Direct replacement for TerrainUtils.ensureDEMLoaded.
   */
  async ensureDEM(): Promise<void> {
    await this.ensureTerrainReady();
  }

  /**
   * Preloads DEM tiles for a set of coordinates.
   * Direct replacement for TerrainUtils.preloadTiles.
   */
  async preloadTiles(coordinates: [number, number][]): Promise<void> {
    await this.preloadArea(coordinates);
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    console.log(`[${new Date().toISOString()}] [ElevationService] Clearing elevation cache with ${this.cache.size} entries`);
    this.cache.clear();
  }
}