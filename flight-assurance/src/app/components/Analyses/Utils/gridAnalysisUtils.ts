/**
 * gridAnalysisUtils.ts
 * 
 * Contains utility functions for grid analysis with enhanced elevation handling.
 * These utilities now support both ElevationService and direct DEM queries.
 * 
 * These utilities are used by:
 * - Analysis modules
 * - useGridAnalysis hook
 * - GridAnalysisController component
 */

import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { 
  Coordinates2D, 
  Coordinates3D, 
  GridCell, 
  LOSProfilePoint, 
  LocationData 
} from '../types/GridAnalysisTypes';

/**
 * Creates a normalized error object for grid analysis
 */
export interface GridAnalysisError extends Error {
  code: 'GRID_GENERATION' | 'VISIBILITY_ANALYSIS' | 'MAP_INTERACTION' | 'INVALID_INPUT';
  details?: unknown;
}

export function createError(
  message: string,
  code: GridAnalysisError['code'],
  details?: unknown
): GridAnalysisError {
  const error = new Error(message) as GridAnalysisError;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Checks if bounding box coordinates are valid
 */
export function isValidBounds(bounds: number[]): boolean {
  return (
    bounds.length === 4 &&
    bounds[0] >= -180 &&
    bounds[1] >= -90 &&
    bounds[2] <= 180 &&
    bounds[3] <= 90
  );
}

/**
 * Creates a function to query terrain elevation using Mapbox
 */
export function createTerrainElevationQuerier(map: mapboxgl.Map) {
  return async function queryTerrainElevation(
    coordinates: Coordinates2D,
    retryCount = 3
  ): Promise<number> {
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
          const fallbackElevation = await fetchTerrainElevation(coordinates[0], coordinates[1]);
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
  };
}

/**
 * Fetches terrain elevation using Mapbox Terrain-RGB API
 */
export async function fetchTerrainElevation(lng: number, lat: number): Promise<number> {
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
      (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale - tileY) *
        tileSize
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
}

/**
 * Generates a grid of cells around a point or flight path.
 * Enhanced to preload elevation data for improved performance.
 * 
 * @param queryTerrainElevation - Function to retrieve terrain elevation
 * @param gridSize - Size of each grid cell in meters
 * @param options - Configuration options including center, range, flight path
 * @returns Promise resolving to array of grid cells
 */
export async function generateGrid(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  batchGetElevations?: (points: Coordinates2D[]) => Promise<number[]>,
  gridSize: number,
  options: {
    center?: Coordinates2D;
    range?: number;
    flightPath?: GeoJSON.Feature<GeoJSON.LineString>;
    elosGridRange?: number;
  }
): Promise<GridCell[]> {
  try {
    let grid;

    // Marker-based grid generation
    if (options.center && options.range) {
      const point = turf.point(options.center);
      const buffer = turf.buffer(point, options.range, { units: 'meters' });
      const bounds = turf.bbox(buffer);
      console.log(`[${new Date().toISOString()}] [gridAnalysisUtils.ts] generateGrid called with options:`, options);

      if (!isValidBounds(bounds)) {
        throw createError('Invalid bounds for marker grid', 'GRID_GENERATION');
      }

      grid = turf.pointGrid(bounds, gridSize, {
        units: 'meters',
        mask: buffer
      });
      
      console.log('Generated marker grid features:', grid.features.length);
    } 
    // Flight path grid generation
    else if (options.flightPath && options.elosGridRange) {
      const lineString = options.flightPath;
      console.log('Generated LineString:', lineString);

      // Generate bounds and grid
      const bounds = turf.bbox(lineString);
      const margin = turf.lengthToDegrees(options.elosGridRange, 'meters');
      const extendedBounds = [
        bounds[0] - margin,
        bounds[1] - margin,
        bounds[2] + margin,
        bounds[3] + margin,
      ];

      if (!isValidBounds(extendedBounds)) {
        throw createError('Invalid extended bounds', 'GRID_GENERATION', extendedBounds);
      }

      const maskOptions = {
        units: 'meters' as const,
        mask: turf.buffer(lineString, options.elosGridRange, { units: 'meters' }),
      };

      grid = turf.pointGrid(extendedBounds, gridSize, maskOptions);
      console.log('Generated grid features:', grid.features.length);
    } 
    else {
      throw createError('Invalid grid generation parameters', 'GRID_GENERATION');
    }

    // Process grid cells with more efficient batching
    const batchSize = 100; // Larger batch size for parallel processing
    const cells: GridCell[] = [];
    
    // Process grid cells in batches for better performance
    for (let i = 0; i < grid.features.length; i += batchSize) {
      const batch = grid.features.slice(i, i + batchSize);
      
      if (batchGetElevations) {
        // Use batch elevation query when available
        const batchPoints = batch.map(point => point.geometry.coordinates as Coordinates2D);
        const batchElevations = await batchGetElevations(batchPoints);
        
        // Create cells with batch-queried elevations
        const batchResults = batch.map((point, batchIndex) => {
          const index = i + batchIndex;
          const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
            units: 'meters',
            steps: 4,
          });

          return {
            id: `cell-${index}`,
            geometry: cell.geometry as GeoJSON.Polygon,
            properties: {
              visibility: 0,
              fullyVisible: false,
              elevation: batchElevations[batchIndex],
              lastAnalyzed: Date.now(),
            },
          };
        });
        
        cells.push(...batchResults);
      } else {
        // Fall back to individual queries
        const batchResults = await Promise.all(
          batch.map(async (point, batchIndex) => {
            try {
              const index = i + batchIndex;
              const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
                units: 'meters',
                steps: 4,
              });

              const elevation = await queryTerrainElevation(point.geometry.coordinates as Coordinates2D)
                .catch((e) => {
                  console.warn('Elevation fetch error for point:', point.geometry.coordinates, e);
                  return 0; // Fallback elevation
                });

              return {
                id: `cell-${index}`,
                geometry: cell.geometry as GeoJSON.Polygon,
                properties: {
                  visibility: 0,
                  fullyVisible: false,
                  elevation,
                  lastAnalyzed: Date.now(),
                },
              };
            } catch (e) {
              console.error('Error processing grid cell in batch:', batchIndex, e);
              throw e;
            }
          })
        );
        
        cells.push(...batchResults);
      }
    }

    return cells;
  } catch (error) {
    console.error('Error in generateGrid:', error);
    throw createError(
      'Failed to generate analysis grid', 
      'GRID_GENERATION', 
      error
    );
  }
}

/**
 * Checks line of sight between two 3D points, sampling terrain in between.
 * Enhanced with optimized sampling strategy based on distance.
 * 
 * @param queryTerrainElevation - Function to retrieve terrain elevation
 * @param sourcePoint - Source coordinates [lng, lat, alt]
 * @param targetPoint - Target coordinates [lng, lat, alt]
 * @param options - Configuration options
 * @returns Promise resolving to boolean indicating clear line of sight
 */
export async function checkLineOfSight(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { sampleCount?: number; minimumOffset?: number } = {}
): Promise<boolean> {
  const [sourceLng, sourceLat, sourceAlt] = sourcePoint;
  const [targetLng, targetLat, targetAlt] = targetPoint;
  
  const minimumOffset = options.minimumOffset ?? 1; // Just above terrain

  const distance = turf.distance(
    [sourceLng, sourceLat],
    [targetLng, targetLat],
    { units: 'meters' }
  );

  // Adaptive sampling strategy based on distance
  const sampleCount = options.sampleCount ?? 
    Math.min(50, Math.max(10, Math.ceil(distance / 30))); // Cap at 50 samples
  
  // Critical point sampling: Check key areas first
  // Check midpoint first as it's most likely to obstruct LOS
  const midpointFraction = 0.5;
  const midLng = sourceLng + midpointFraction * (targetLng - sourceLng);
  const midLat = sourceLat + midpointFraction * (targetLat - sourceLat);
  const midHeight = sourceAlt - ((sourceAlt - (targetAlt + minimumOffset)) * midpointFraction);
  
  const midTerrainHeight = await queryTerrainElevation([midLng, midLat]) ?? 0;
  if (midTerrainHeight > midHeight) {
    return false; // Quick early rejection
  }
  
  // Now check remaining points
  for (let i = 1; i < sampleCount; i++) {
    // Skip midpoint as we already checked it
    if (i === Math.floor(sampleCount / 2)) continue;
    
    const fraction = i / sampleCount;
    
    const lng = sourceLng + fraction * (targetLng - sourceLng);
    const lat = sourceLat + fraction * (targetLat - sourceLat);
    
    const interpolatedHeight = 
      sourceAlt - ((sourceAlt - (targetAlt + minimumOffset)) * fraction);

    const terrainHeight = await queryTerrainElevation([lng, lat]) ?? 0;

    if (terrainHeight > interpolatedHeight) {
      return false;
    }
  }

  return true;
}

/**
 * Get LOS profile data between two points
 */
export async function getLOSProfile(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { sampleDistance?: number; minimumOffset?: number } = {}
): Promise<{ profile: LOSProfilePoint[]; clear: boolean }> {
  const [sourceLng, sourceLat, sourceAlt] = sourcePoint;
  const [targetLng, targetLat, targetAlt] = targetPoint;
  
  const minimumOffset = options.minimumOffset ?? 3; // Default minimum offset
  const point1 = turf.point([sourceLng, sourceLat]);
  const point2 = turf.point([targetLng, targetLat]);
  const totalDistance = turf.distance(point1, point2, { units: 'meters' });
  
  const sampleDistance = options.sampleDistance ?? 10; // Default 10m between samples
  const sampleCount = Math.ceil(totalDistance / sampleDistance);
  
  const profile: LOSProfilePoint[] = [];
  let isObstructed = false;

  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;
    const lng = sourceLng + fraction * (targetLng - sourceLng);
    const lat = sourceLat + fraction * (targetLat - sourceLat);
    const losAltitude = sourceAlt - ((sourceAlt - (targetAlt + minimumOffset)) * fraction);
    const terrain = await queryTerrainElevation([lng, lat]);

    profile.push({
      distance: fraction * totalDistance,
      terrain,
      los: losAltitude,
    });

    if (terrain > losAltitude) {
      isObstructed = true;
    }
  }

  return { profile, clear: !isObstructed };
}

/**
 * Generate a combined bounding box for multiple stations
 */
export function generateCombinedBoundingBox(
  stations: Array<{ location: LocationData; range: number }>
): turf.BBox {
  if (!stations.length) {
    throw new Error('No stations provided for analysis');
  }

  // For each station, create a buffer (circle) and extract its bbox
  const bboxes = stations.map((station) => {
    const point = turf.point([station.location.lng, station.location.lat]);
    const buffer = turf.buffer(point, station.range, { units: 'meters' });
    return turf.bbox(buffer); // returns [minLng, minLat, maxLng, maxLat]
  });

  // Combine the individual bboxes
  const combinedBbox: turf.BBox = [180, 90, -180, -90];
  bboxes.forEach((bbox) => {
    combinedBbox[0] = Math.min(combinedBbox[0], bbox[0]);
    combinedBbox[1] = Math.min(combinedBbox[1], bbox[1]);
    combinedBbox[2] = Math.max(combinedBbox[2], bbox[2]);
    combinedBbox[3] = Math.max(combinedBbox[3], bbox[3]);
  });

  // Calculate horizontal and vertical distances
  const horizontalDistance = turf.distance(
    [combinedBbox[0], combinedBbox[1]],
    [combinedBbox[2], combinedBbox[1]],
    { units: 'meters' }
  );
  const verticalDistance = turf.distance(
    [combinedBbox[0], combinedBbox[1]],
    [combinedBbox[0], combinedBbox[3]],
    { units: 'meters' }
  );

  // Compute the center
  const centerLng = (combinedBbox[0] + combinedBbox[2]) / 2;
  const centerLat = (combinedBbox[1] + combinedBbox[3]) / 2;
  const center = [centerLng, centerLat];

  // Clamp if too large (>5000m)
  if (horizontalDistance > 5000) {
    const westPoint = turf.destination(center, 2500, 270, { units: 'meters' });
    const eastPoint = turf.destination(center, 2500, 90, { units: 'meters' });
    combinedBbox[0] = westPoint.geometry.coordinates[0];
    combinedBbox[2] = eastPoint.geometry.coordinates[0];
  }

  if (verticalDistance > 5000) {
    const southPoint = turf.destination(center, 2500, 180, { units: 'meters' });
    const northPoint = turf.destination(center, 2500, 0, { units: 'meters' });
    combinedBbox[1] = southPoint.geometry.coordinates[1];
    combinedBbox[3] = northPoint.geometry.coordinates[1];
  }

  return combinedBbox;
}