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
} from '../Types/GridAnalysisTypes';

// Define BBox type locally to avoid import issues
type BBox = [number, number, number, number] | [number, number, number, number, number, number];

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
 * Checks LOS between a source point and a single target point.
 * @param queryTerrainElevation Function to query terrain elevation
 * @param sourcePoint Source coordinates [lon, lat, alt]
 * @param targetPoint Target coordinates [lon, lat, alt]
 * @param options Sampling options
 * @returns True if LOS is clear
 */
async function checkSingleLOS(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { sampleCount?: number; minimumOffset?: number } = {}
): Promise<boolean> {
  const [sourceLng, sourceLat, sourceAlt] = sourcePoint;
  const [targetLng, targetLat, targetAlt] = targetPoint;

  // Validate inputs
  if (sourcePoint.some(v => typeof v !== 'number' || isNaN(v)) ||
      targetPoint.some(v => typeof v !== 'number' || isNaN(v))) {
    console.error(`[${new Date().toISOString()}] [gridAnalysisUtils.ts] Invalid coordinates:`, { sourcePoint, targetPoint });
    throw createError('Invalid source or target coordinates', 'INVALID_INPUT');
  }

  const minimumOffset = options.minimumOffset ?? 1;
  const distance = turf.distance([sourceLng, sourceLat], [targetLng, targetLat], { units: 'meters' });
  const sampleCount = options.sampleCount ?? Math.min(20, Math.max(5, Math.ceil(distance / 50)));

  // Cache elevations for better performance
  const elevationCache = new Map<string, number>();
  const getCachedElevation = async (coords: Coordinates2D): Promise<number> => {
    const cacheKey = `${coords[0].toFixed(4)}|${coords[1].toFixed(4)}`;
    if (elevationCache.has(cacheKey)) return elevationCache.get(cacheKey)!;
    const elevation = await queryTerrainElevation(coords);
    elevationCache.set(cacheKey, elevation);
    return elevation;
  };

  // Add the minimum offset to target altitude
  const adjustedTargetAlt = targetAlt + minimumOffset;

  // Check each sample point along the line
  for (let i = 1; i < sampleCount; i++) {
    const fraction = i / sampleCount;
    
    // Interpolate position
    const lng = sourceLng + fraction * (targetLng - sourceLng);
    const lat = sourceLat + fraction * (targetLat - sourceLat);
    
    // Calculate height along the line of sight at this point
    const losHeight = sourceAlt + fraction * (adjustedTargetAlt - sourceAlt);
    
    // Get terrain height at this point
    const terrainHeight = await getCachedElevation([lng, lat]) ?? 0;
    
    // Debug logging for troubleshooting (can be removed in production)
    if (i === Math.floor(sampleCount / 2)) {
      console.log(`[Debug] LOS midpoint check: fraction=${fraction.toFixed(2)}, terrain=${terrainHeight.toFixed(1)}m, los=${losHeight.toFixed(1)}m, clear=${terrainHeight <= losHeight}`);
    }
    
    // If terrain is higher than LOS, the line is blocked
    if (terrainHeight > losHeight) {
      return false;
    }
  }
  
  // If we've checked all sample points and none block the line, we have LOS
  return true;
}

/**
 * Checks LOS for Station Analysis from a station to a single grid cell.
 * @param queryTerrainElevation Function to query terrain elevation
 * @param sourcePoint Station coordinates [lon, lat, alt]
 * @param targetPoint Grid cell center [lon, lat, alt]
 * @param options Sampling options
 * @returns True if LOS is clear
 */
export async function checkStationLOS(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { sampleCount?: number; minimumOffset?: number } = {}
): Promise<boolean> {
  return await checkSingleLOS(queryTerrainElevation, sourcePoint, targetPoint, options);
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
 */
export async function generateGrid(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  gridSize: number,
  batchGetElevations?: (points: Coordinates2D[], skipPreload?: boolean) => Promise<number[]>,
  options: {
    center?: Coordinates2D;
    range?: number;
    flightPath?: GeoJSON.Feature<GeoJSON.LineString>;
    elosGridRange?: number;
    preloadComplete?: boolean;
  } = {}
): Promise<GridCell[]> {
  try {
    let grid;

    // Marker-based grid generation
    if (options.center && options.range) {
      if (typeof options.range !== 'number' || options.range <= 0 || isNaN(options.range)) {
        throw createError('Invalid range for marker grid', 'INVALID_INPUT', { range: options.range });
      }
      const point = turf.point(options.center);
      const buffer = turf.buffer(point, options.range, { units: 'meters' });
      if (!buffer) {
        throw createError('Failed to create buffer for marker grid', 'GRID_GENERATION', { center: options.center, range: options.range });
      }
      const bounds = turf.bbox(buffer) as [number, number, number, number];

      if (!isValidBounds(bounds)) {
        throw createError('Invalid bounds for marker grid', 'GRID_GENERATION', bounds);
      }

      grid = turf.pointGrid(bounds, gridSize, {
        units: 'meters',
        mask: buffer
      });
    } 
    // Flight path grid generation
    else if (options.flightPath && options.elosGridRange) {
      if (typeof options.elosGridRange !== 'number' || options.elosGridRange <= 0 || isNaN(options.elosGridRange)) {
        throw createError('Invalid elosGridRange for flight path grid', 'INVALID_INPUT', { elosGridRange: options.elosGridRange });
      }
      const lineString = options.flightPath;
      const bounds = turf.bbox(lineString) as [number, number, number, number];
      const margin = turf.lengthToDegrees(options.elosGridRange, 'meters');
      const extendedBounds: BBox = [
        bounds[0] - margin,
        bounds[1] - margin,
        bounds[2] + margin,
        bounds[3] + margin
      ];

      if (!isValidBounds(extendedBounds)) {
        throw createError('Invalid extended bounds', 'GRID_GENERATION', extendedBounds);
      }

      const maskOptions = {
        units: 'meters' as const,
        mask: turf.buffer(lineString, options.elosGridRange, { units: 'meters' }),
      };

      grid = turf.pointGrid(extendedBounds, gridSize, maskOptions);
    } 
    else {
      throw createError('Invalid grid generation parameters', 'INVALID_INPUT');
    }

    // Process grid cells with more efficient batching
    const batchSize = 100;
    const cells: GridCell[] = [];
    
    // Process grid cells in batches for better performance
    for (let i = 0; i < grid.features.length; i += batchSize) {
      const batch = grid.features.slice(i, i + batchSize);
      
      if (batchGetElevations) {
        // Use batch elevation query when available
        const batchPoints = batch.map(point => point.geometry.coordinates as Coordinates2D);
        const batchElevations = await batchGetElevations(batchPoints, options.preloadComplete);
        
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
                  return 0;
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
 * Checks LOS for Flight Path Analysis from a source to multiple target points.
 * Returns the percentage of visible points.
 */
export async function checkFlightPathLOS(
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  sourcePoint: Coordinates3D,
  targetPoints: Coordinates3D[],
  options: { 
    sampleCount?: number; 
    minimumOffset?: number;
    altitudeMode?: "terrain" | "relative" | "absolute";
  }
): Promise<number> {
  const { sampleCount = 20, minimumOffset = 1, altitudeMode = "absolute" } = options;

  if (!Array.isArray(sourcePoint) || sourcePoint.length !== 3 || 
      sourcePoint.some(v => typeof v !== 'number' || isNaN(v))) {
    throw createError('Source point must be a valid [lon, lat, alt] array', 'INVALID_INPUT');
  }

  if (!Array.isArray(targetPoints) || !targetPoints.every(point => 
      Array.isArray(point) && point.length === 3 && point.every(v => typeof v === 'number' && !isNaN(v)))) {
    throw createError('Target points must be an array of [lon, lat, alt] arrays', 'INVALID_INPUT');
  }

  console.log(`[Debug] Flight LOS check with altitudeMode: ${altitudeMode}, points: ${targetPoints.length}`);

  let visibleCount = 0;

  for (const targetPoint of targetPoints) {
    try {
      if (targetPoints.length > 0 && visibleCount < 3) {
        const point = targetPoint;
        if (altitudeMode === "terrain" || altitudeMode === "relative") {
          const terrainElevation = await queryTerrainElevation([point[0], point[1]]);
          console.log(`[Debug] Point [${point[0].toFixed(5)}, ${point[1].toFixed(5)}]: terrain=${terrainElevation.toFixed(1)}m, point_alt=${point[2]}m, adjusted=${(terrainElevation + point[2]).toFixed(1)}m`);
          
          const adjustedTargetPoint: Coordinates3D = [
            targetPoint[0],
            targetPoint[1],
            terrainElevation + targetPoint[2]
          ];
          
          const isVisible = await checkSingleLOS(
            queryTerrainElevation,
            sourcePoint,
            adjustedTargetPoint,
            { sampleCount, minimumOffset }
          );
          if (isVisible) visibleCount++;
        } else {
          const isVisible = await checkSingleLOS(
            queryTerrainElevation,
            sourcePoint,
            targetPoint,
            { sampleCount, minimumOffset }
          );
          if (isVisible) visibleCount++;
        }
      } else {
        if (altitudeMode === "terrain" || altitudeMode === "relative") {
          const terrainElevation = await queryTerrainElevation([targetPoint[0], targetPoint[1]]);
          const adjustedTargetPoint: Coordinates3D = [
            targetPoint[0],
            targetPoint[1],
            terrainElevation + targetPoint[2]
          ];
          
          const isVisible = await checkSingleLOS(
            queryTerrainElevation,
            sourcePoint,
            adjustedTargetPoint,
            { sampleCount, minimumOffset }
          );
          if (isVisible) visibleCount++;
        } else {
          const isVisible = await checkSingleLOS(
            queryTerrainElevation,
            sourcePoint,
            targetPoint,
            { sampleCount, minimumOffset }
          );
          if (isVisible) visibleCount++;
        }
      }
    } catch (e) {
      console.warn('Error checking LOS for point:', targetPoint, e);
      // Continue to next point
    }
  }

  const visibilityPercentage = targetPoints.length > 0 ? (visibleCount / targetPoints.length) * 100 : 0;
  console.log(`[Debug] Visibility result: ${visibleCount}/${targetPoints.length} = ${visibilityPercentage.toFixed(1)}%`);

  return visibilityPercentage;
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
  
  const minimumOffset = options.minimumOffset ?? 3;
  const point1 = turf.point([sourceLng, sourceLat]);
  const point2 = turf.point([targetLng, targetLat]);
  const totalDistance = turf.distance(point1, point2, { units: 'meters' });
  
  const sampleDistance = options.sampleDistance ?? 10;
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
): BBox {
  if (!stations.length) {
    throw new Error('No stations provided for analysis');
  }

  const bboxes = stations.map((station) => {
    const point = turf.point([station.location.lng, station.location.lat]);
    const buffer = turf.buffer(point, station.range, { units: 'meters' });
    if (!buffer) {
      throw createError('Failed to create buffer for station', 'GRID_GENERATION', { location: station.location, range: station.range });
    }
    return turf.bbox(buffer) as [number, number, number, number];
  });

  const combinedBbox: BBox = [180, 90, -180, -90];
  bboxes.forEach((bbox) => {
    combinedBbox[0] = Math.min(combinedBbox[0], bbox[0]);
    combinedBbox[1] = Math.min(combinedBbox[1], bbox[1]);
    combinedBbox[2] = Math.max(combinedBbox[2], bbox[2]);
    combinedBbox[3] = Math.max(combinedBbox[3], bbox[3]);
  });

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

  const centerLng = (combinedBbox[0] + combinedBbox[2]) / 2;
  const centerLat = (combinedBbox[1] + combinedBbox[3]) / 2;
  const center = [centerLng, centerLat];

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