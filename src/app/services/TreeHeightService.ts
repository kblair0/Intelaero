/**
 * TreeHeightService.ts
 * 
 * Purpose:
 * Service for querying tree height data from the forest-height raster-array layer.
 * Follows ElevationService pattern for consistency and integrates with MapContext.
 * 
 * Data Source: Australia Forest Height 2019 (GEDI/Landsat)
 * Values: 0-60m (tree height), 101=water, 102=snow/ice, 103=no data
 * 
 * Related Files:
 * - ElevationService.ts: Pattern reference for implementation
 * - LayerManager.ts: Manages the forest-height layer visibility
 * - mapcontext.tsx: Provides this service to components
 */

import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

export interface TreeHeightQueryResult {
  height: number | null;
  type: 'tree' | 'water' | 'snow' | 'nodata';
  coordinates: [number, number];
}

// Add these interfaces to TreeHeightService.ts

export interface TreeHeightStatistics {
  count: number;
  average: number;
  min: number;
  max: number;
  noDataCount: number;
}

export interface TreeHeightDistribution {
  className: string;
  range: { min: number; max: number; color: string };
  count: number;
  percentage: number;
  color: string;
}

export interface TreeHeightQueryResultsData {
  statistics: TreeHeightStatistics;
  distribution?: TreeHeightDistribution[];
  heights: number[]; // Raw height values
  bounds: [number, number, number, number]; // [west, south, east, north]
  metadata?: {
    zoomLevel?: number;
    tilesProcessed?: number;
    durationMs?: number;
    timestamp?: string;
  };
}

export interface TreeHeightQueryResultsProps {
  result: TreeHeightQueryResultsData;
  isOpen: boolean;
  onClose: () => void;
  onRerun?: () => void;
  onExport?: (format: 'csv' | 'json') => void;
  className?: string;
}

// Height classes configuration
export const TREE_HEIGHT_ANALYSIS = {
  HEIGHT_CLASSES: {
    'No Trees': { min: 0, max: 2, color: '#e5e7eb' },
    'Low': { min: 2, max: 5, color: '#90ee90' },
    'Small': { min: 5, max: 10, color: '#32cd32' },
    'Medium': { min: 10, max: 20, color: '#228b22' },
    'Tall': { min: 20, max: 30, color: '#f7c708' },
    'Very Tall': { min: 30, max: 45, color: '#ff8c00' },
    'Exceptional': { min: 45, max: 100, color: '#dc143c' }
  }
};

export class TreeHeightService {
  private map: mapboxgl.Map;
  private cache: Map<string, TreeHeightQueryResult> = new Map();
  private readonly MAX_CACHE_SIZE = 5000;
  
  constructor(map: mapboxgl.Map) {
    this.map = map;
  }
  
  /**
   * Creates cache key from coordinates
   */
  private key(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }
  
  /**
   * Interprets raw raster values according to GEDI data specification
   */
  private interpretValue(rawValue: number | null): TreeHeightQueryResult['type'] {
    if (rawValue === null || rawValue === undefined) return 'nodata';
    if (rawValue === 101) return 'water';
    if (rawValue === 102) return 'snow';
    if (rawValue === 103) return 'nodata';
    return 'tree';
  }
  
/**
 * Queries tree height at a specific coordinate using Mapbox Tilequery API
 * @param coordinates - [longitude, latitude] coordinate pair
 * @returns Tree height result with interpreted data
 */
async queryTreeHeight(coordinates: [number, number]): Promise<TreeHeightQueryResult> {
  const [lon, lat] = coordinates;
  const cacheKey = this.key(lon, lat);
  
  // Check cache first
  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey)!;
  }
  
  try {
    // Use Mapbox Tilequery API for raster-array data
    const accessToken: string = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
    if (!accessToken) {
      throw new Error('Mapbox access token not found');
    }
    
    const tilesetId = 'intelaero.forest-height-aus-data';
    // FIXED: Use correct API endpoint with required parameters
    const apiUrl = `https://api.mapbox.com/v4/${tilesetId}/tilequery/${lon},${lat}.json?layers=forest_height&bands=band-1&access_token=${accessToken}`;
    
    console.log(`🌲 Querying tree height API: ${lon}, ${lat}`);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`🌲 API response:`, data);

    // ADD THIS DEBUG CODE:
console.log(`🌲 DEBUG: Features array length:`, data.features?.length || 0);
if (data.features && data.features.length > 0) {
  console.log(`🌲 DEBUG: First feature:`, JSON.stringify(data.features[0], null, 2));
} else {
  console.log(`🌲 DEBUG: Empty features - this means wrong layer/band names`);
}
    
    let rawValue: number | null = null;
    
    // FIXED: Extract tree height value from raster-array API response
    if (data && data.features && data.features.length > 0) {
      const feature = data.features[0];
      
      // For raster-array, the value is in properties.val
        if (feature.properties && Array.isArray(feature.properties.val) && feature.properties.val.length > 0) {
        rawValue = feature.properties.val[0];
        }
    }
    
    console.log(`🌲 Extracted raw value: ${rawValue}`);
    
    const type = this.interpretValue(rawValue);
    const height = (type === 'tree' && rawValue !== null) ? rawValue : null;
    
    const result: TreeHeightQueryResult = {
      height,
      type,
      coordinates
    };
    
    // Cache the result
    this.cache.set(cacheKey, result);
    
    // Simple cache size management
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    console.log(`🌲 Final result:`, result);
    return result;
    
  } catch (error) {
    console.warn(`🌲 Error querying tree height at [${lon}, ${lat}]:`, error);
    
    // Return no-data result for any errors
    const result: TreeHeightQueryResult = {
      height: null,
      type: 'nodata',
      coordinates
    };
    
    // Don't cache errors
    return result;
  }
}
  
  /**
   * Batch query tree heights for multiple coordinates
   * @param coordinates - Array of [longitude, latitude] pairs
   * @param progressCallback - Optional progress callback (0-100)
   * @returns Array of tree height results
   */
  async batchQueryTreeHeights(
    coordinates: [number, number][],
    progressCallback?: (percent: number) => void
  ): Promise<TreeHeightQueryResult[]> {
    console.log(`[TreeHeightService] Batch querying ${coordinates.length} points`);
    
    const results: TreeHeightQueryResult[] = [];
    const BATCH_SIZE = 50; // Process in smaller batches
    
    for (let i = 0; i < coordinates.length; i += BATCH_SIZE) {
      const batch = coordinates.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(coord => this.queryTreeHeight(coord))
      );
      
      results.push(...batchResults);
      
      // Report progress
      if (progressCallback) {
        const progress = Math.min(100, Math.round(((i + BATCH_SIZE) / coordinates.length) * 100));
        progressCallback(progress);
      }
      
      // Small delay to prevent overwhelming the renderer
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }
  
  /**
   * Analyzes tree heights within an Area of Operations
   * @param aoGeometry - GeoJSON geometry defining the area
   * @param gridSize - Grid sampling size in meters (default: 100m)
   * @param progressCallback - Optional progress callback
   * @returns Tree height analysis results
   */
/**
 * Enhanced analysis method that returns data for the results modal
 */
async analyzeTreeHeightsInAO(
  aoGeometry: GeoJSON.FeatureCollection,
  gridSize: number = 100,
  progressCallback?: (percent: number) => void
): Promise<TreeHeightQueryResultsData> {
  console.log(`[TreeHeightService] Analyzing tree heights in AO with ${gridSize}m grid`);
  const startTime = Date.now();
  
  try {
    // Generate sample points within the AO
    const bbox = turf.bbox(aoGeometry);
    const samplePoints = turf.pointGrid(bbox, gridSize, { 
      units: 'meters',
      mask: aoGeometry.features[0]
    });
    
    const coordinates = samplePoints.features.map(
      feature => feature.geometry.coordinates as [number, number]
    );
    
    console.log(`Generated ${coordinates.length} sample points`);
    
    // Query tree heights for all sample points
    const results = await this.batchQueryTreeHeights(coordinates, progressCallback);
    
    // Extract valid tree heights and count no-data
    const validResults = results.filter(result => result.type === 'tree' && result.height !== null);
    const heights = validResults.map(result => result.height!);
    const noDataCount = results.length - validResults.length;
    
    if (heights.length === 0) {
      return {
        statistics: {
          count: 0,
          average: 0,
          min: 0,
          max: 0,
          noDataCount: results.length
        },
        heights: [],
        bounds: bbox as [number, number, number, number],
        metadata: {
          zoomLevel: 13,
          tilesProcessed: coordinates.length,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Calculate statistics
    const count = heights.length;
    const average = heights.reduce((sum, h) => sum + h, 0) / count;
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    
    // Calculate distribution
    const distribution = Object.entries(TREE_HEIGHT_ANALYSIS.HEIGHT_CLASSES).map(([className, range]) => {
      const classCount = heights.filter(h => h >= range.min && h < range.max).length;
      return {
        className,
        range,
        count: classCount,
        percentage: (classCount / count) * 100,
        color: range.color
      };
    }).filter(item => item.count > 0);
    
    return {
      statistics: {
        count,
        average,
        min,
        max,
        noDataCount
      },
      distribution,
      heights,
      bounds: bbox as [number, number, number, number],
      metadata: {
        zoomLevel: 13,
        tilesProcessed: coordinates.length,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[TreeHeightService] Error analyzing tree heights in AO:', error);
    throw error;
  }
}
  
  /**
   * Clear the cache to free memory
   */
  clearCache(): void {
    console.log(`[TreeHeightService] Clearing tree height cache with ${this.cache.size} entries`);
    this.cache.clear();
  }
}