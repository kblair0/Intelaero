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
  private terrainReady: boolean = false;

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  private key(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }

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
  
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Waiting for DEM source to load...`);
    
    // Wait for source to be loaded
    if (!this.map.isSourceLoaded("mapbox-dem")) {
      await new Promise<void>((resolve) => {
        const checkDEM = () => {
          if (this.map!.isSourceLoaded("mapbox-dem")) {
            this.map!.off("sourcedata", checkDEM);
            resolve();
          }
        };
        this.map!.on("sourcedata", checkDEM);
        setTimeout(() => {
          this.map!.off("sourcedata", checkDEM);
          console.warn(`[${new Date().toISOString()}] [ElevationService.ts] Initial source load timed out after 15 seconds`);
          resolve();
        }, 15000);
      });
    }
    
    // Now validate with test points to ensure data is actually available
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Source loaded, validating DEM data availability...`);
    
    // Pick a few test points across the map
    const testPoints = [
      [151.275, -33.888], // example from your logs
      [151.2696, -33.8845], // another from your logs
      [151.27, -33.885] // additional test point
    ];
    
    let attempt = 0;
    const maxAttempts = 5;
    let validElevations = false;
    
    while (!validElevations && attempt < maxAttempts) {
      attempt++;
      console.log(`[${new Date().toISOString()}] [ElevationService.ts] DEM validation attempt ${attempt}/${maxAttempts}`);
      
      // Try to get elevations for test points
      const elevations = await Promise.all(
        testPoints.map(([lon, lat]) => {
          const elev = this.map!.queryTerrainElevation([lon, lat]);
          return { lon, lat, elev };
        })
      );
      
      // Check if we got valid non-zero elevations
      const invalidPoints = elevations.filter(e => e.elev === null || e.elev === 0);
      if (invalidPoints.length === 0) {
        validElevations = true;
        console.log(`[${new Date().toISOString()}] [ElevationService.ts] ✅ DEM source loaded successfully`);
        break;
      }
      
      console.warn(`[${new Date().toISOString()}] [ElevationService.ts] ${invalidPoints.length}/${testPoints.length} test points returned invalid elevations`);
      
      // Wait before next attempt
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
    
    this.terrainReady = true;
  }

  async preloadArea(coordinates: [number, number, number][]): Promise<void> {
    if (coordinates.length === 0) return;
    const preloadStart = Date.now();
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Starting preloadArea for ${coordinates.length} coordinates`);
    
    await this.ensureTerrainReady();
    
    // Setup validation points - pick a subset of coordinates for validation
    const validationCount = Math.min(coordinates.length, 5);
    const validationPoints = Array.from({ length: validationCount }, (_, i) => 
      Math.floor(i * coordinates.length / validationCount)
    ).map(idx => [coordinates[idx][0], coordinates[idx][1]]);
    
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Will validate terrain using ${validationPoints.length} points`);
    
    // Ensure tiles are loaded by requesting them in smaller batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < coordinates.length; i += BATCH_SIZE) {
      const batch = coordinates.slice(i, i + BATCH_SIZE);
      
      // Just trigger queries to load tiles
      await Promise.all(batch.map(([lon, lat]) => 
        this.map.queryTerrainElevation([lon, lat])
      ));
      
      // Small delay between batches
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Now verify we can get actual elevations
    let attempt = 0;
    const maxAttempts = 5;
    let success = false;
    
    while (!success && attempt < maxAttempts) {
      attempt++;
      
      const elevations = await Promise.all(
        validationPoints.map(([lon, lat]) => {
          const elev = this.map.queryTerrainElevation([lon, lat]);
          return { lon, lat, elev };
        })
      );
      
      const invalidCount = elevations.filter(e => e.elev === null || e.elev === 0).length;
      const validRate = 1 - (invalidCount / validationPoints.length);
      
      console.log(`[${new Date().toISOString()}] [ElevationService.ts] Validation attempt ${attempt}: ${(validRate*100).toFixed(1)}% valid`);
      
      if (validRate > 0.8) { // Accept if > 80% of points have valid elevations
        success = true;
        break;
      }
      
      // Wait progressively longer between attempts
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
    
    if (!success) {
      console.warn(`[${new Date().toISOString()}] [ElevationService.ts] Terrain preload validation failed after ${maxAttempts} attempts`);
    }
    
    this.clearFailedElevations();
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Terrain tiles preloaded in ${Date.now() - preloadStart}ms`);
  }

  async getElevation(lon: number, lat: number, maxRetries = 3, retryDelay = 200): Promise<number> {
    const cacheKey = this.key(lon, lat);
    if (this.cache.has(cacheKey)) {
      const cachedValue = this.cache.get(cacheKey)!;
      if (cachedValue === 0) {
        console.warn(`[${new Date().toISOString()}] [ElevationService.ts] Cache returned 0 for [${lon}, ${lat}], retrying`);
        // Do not return the cached zero - proceed to query again
      } else {
        console.log(`[${new Date().toISOString()}] [ElevationService.ts] Cache hit for [${lon}, ${lat}]: ${cachedValue}`);
        return cachedValue;
      }
    }
  
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Cache miss for [${lon}, ${lat}]`);
    if (this.pendingLoads.has(cacheKey)) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (this.cache.has(cacheKey) && this.cache.get(cacheKey)! !== 0) return this.cache.get(cacheKey)!;
    }
    this.pendingLoads.add(cacheKey);
  
    try {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        console.log(`[${new Date().toISOString()}] [ElevationService.ts] Query attempt ${attempt + 1} for [${lon}, ${lat}]`);
        const elev = this.map.queryTerrainElevation([lon, lat]);
        if (elev !== null && elev !== 0) {
          const normalized = normaliseElevation(elev);
          console.log(`[${new Date().toISOString()}] [ElevationService.ts] Query success for [${lon}, ${lat}]: ${normalized}`);
          this.cache.set(cacheKey, normalized);
          return normalized;
        }
        console.warn(`[${new Date().toISOString()}] [ElevationService.ts] Query returned null or 0 for [${lon}, ${lat}] on attempt ${attempt + 1}`);
        
        // Add a delay between retries to allow DEM tiles to load
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
  
      // Only check offset points if all direct queries failed
      console.warn(`[${new Date().toISOString()}] [ElevationService.ts] All retries failed for [${lon}, ${lat}], trying offsets`);
      for (const offset of [[0.0001, 0], [0, 0.0001], [-0.0001, 0], [0, -0.0001]]) {
        const elev = this.map.queryTerrainElevation([lon + offset[0], lat + offset[1]]);
        if (elev !== null && elev !== 0) {
          const normalized = normaliseElevation(elev);
          console.log(`[${new Date().toISOString()}] [ElevationService.ts] Offset query success for [${lon + offset[0]}, ${lat + offset[1]}]: ${normalized}`);
          this.cache.set(cacheKey, normalized);
          return normalized;
        }
      }
  
      // Return 0 but DON'T cache it
      console.warn(`[${new Date().toISOString()}] [ElevationService.ts] Returning 0 for [${lon}, ${lat}] without caching`);
      return 0;
    } finally {
      this.pendingLoads.delete(cacheKey);
    }
  }

  async batchGetElevations(points: [number, number][], skipPreload: boolean = false): Promise<number[]> {
    const cachedResults: (number | null)[] = points.map(([lon, lat]) => {
      const cacheKey = this.key(lon, lat);
      return this.cache.has(cacheKey) ? this.cache.get(cacheKey)! : null;
    });

    if (!cachedResults.includes(null)) {
      return cachedResults as number[];
    }

    const uncachedPoints = points.filter((_, i) => cachedResults[i] === null);
    if (uncachedPoints.length > 0 && !skipPreload) {
      const coords = uncachedPoints.map(p => [...p, 0] as [number, number, number]);
      await this.preloadArea(coords);
    }

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

  async getElevationsWithRetries(coordinates: [number, number, number][]): Promise<number[]> {
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Processing ${coordinates.length} coordinates with chunked retries`);
    
    const results: number[] = new Array(coordinates.length).fill(0);
    const CHUNK_SIZE = 10; // Process in smaller chunks, like fillTerrain
    
    for (let i = 0; i < coordinates.length; i += CHUNK_SIZE) {
      const chunk = coordinates.slice(i, i + CHUNK_SIZE);
      
      // Process chunk sequentially for better reliability
      for (let j = 0; j < chunk.length; j++) {
        const [lon, lat] = chunk[j];
        try {
          // Try multiple times with backoff
          const elevation = await this.getElevation(lon, lat, 3);
          results[i + j] = elevation;
        } catch (err) {
          console.error(`[${new Date().toISOString()}] [ElevationService.ts] Failed to get elevation for [${lon}, ${lat}]`, err);
        }
      }
      
      // Add delay between chunks to allow DEM tiles to load fully
      if (i + CHUNK_SIZE < coordinates.length) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    // Validate results
    const zeroCount = results.filter(elev => elev === 0).length;
    if (zeroCount > 0) {
      console.warn(`[${new Date().toISOString()}] [ElevationService.ts] ${zeroCount}/${results.length} coordinates returned zero elevation`);
    }
    
    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearFailedElevations(): void {
    let clearedCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (value === 0) {
        this.cache.delete(key);
        clearedCount++;
      }
    }
    console.log(`[${new Date().toISOString()}] [ElevationService.ts] Cleared ${clearedCount} failed elevations from cache`);
    this.pendingLoads.clear();
  }
}