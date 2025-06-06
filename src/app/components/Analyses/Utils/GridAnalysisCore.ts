/**
 * GridAnalysisCore.ts
 * 
 * High-performance core engine for Line of Sight (LOS) analysis.
 * Provides optimized implementations for grid generation, elevation queries,
 * and visibility calculations with minimal overhead.
 * The GridAnalysisCore.ts that I've just provided will replace the following existing files:
gridAnalysisUtils.ts (completely replaced)
Parts of useGridAnalysis.ts (specifically the core analysis algorithms)
 */

import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { 
  Coordinates2D, 
  Coordinates3D, 
  GridCell, 
  LOSProfilePoint, 
  LocationData,
  StationLOSResult
} from '../Types/GridAnalysisTypes';
import { FlightPlanData } from '../../../context/FlightPlanContext';
import { sampleFlightPath, SamplePoint } from '../../../hooks/useFlightPathSampling';

// Type definitions for internal use
type BBox = [number, number, number, number];
type TerrainQueryFn = (coords: Coordinates2D) => Promise<number>;

// Simple LRU cache for elevation data
class ElevationCache {
  private cache = new Map<string, number>();
  private maxSize: number;
  
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }
  
  private getKey(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }
  
  get(lon: number, lat: number): number | undefined {
    return this.cache.get(this.getKey(lon, lat));
  }
  
  set(lon: number, lat: number, elevation: number): void {
    const key = this.getKey(lon, lat);
    this.cache.set(key, elevation);
    
    // Simple LRU: remove oldest entry if cache is full
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Shared cache instance
const elevationCache = new ElevationCache();

/**
 * Creates an error with additional metadata
 */
export function createError(message: string, code: string, details?: any): Error {
  const error = new Error(message) as any;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Optimized terrain elevation query function
 */
export async function queryElevation(
  map: mapboxgl.Map,
  coordinates: Coordinates2D,
  elevationService?: any
): Promise<number> {
  const [lon, lat] = coordinates;
  
  // Check cache first for fastest response
  const cachedElevation = elevationCache.get(lon, lat);
  if (cachedElevation !== undefined) {
    return cachedElevation;
  }
  
  let elevation: number | null = null;
  
  // Try elevation service if available
  if (elevationService) {
    try {
      elevation = await elevationService.getElevation(lon, lat);
      if (elevation !== null && elevation !== undefined && elevation !== 0) {
        elevationCache.set(lon, lat, elevation);
        return elevation;
      }
    } catch (e) {
      // Fall through to direct query
    }
  }
  
  // Direct map query as fallback
  try {
    elevation = map.queryTerrainElevation(coordinates) ?? null;
    if (elevation !== null && elevation !== undefined) {
      elevationCache.set(lon, lat, elevation);
      return elevation;
    }
  } catch (e) {
    console.warn(`Terrain query error at [${lon}, ${lat}]:`, e);
  }
  
  // Last resort fallback
  return 0;
}

/**
 * Optimized batch elevation query
 */
export async function batchQueryElevations(
  map: mapboxgl.Map,
  coordinates: Coordinates2D[],
  elevationService?: any
): Promise<number[]> {
  if (elevationService && typeof elevationService.batchGetElevations === 'function') {
    try {
      return await elevationService.batchGetElevations(coordinates);
    } catch (e) {
      console.warn('Batch elevation query failed, falling back to individual queries:', e);
    }
  }
  
  // Process in larger batches for better performance
  const BATCH_SIZE = 100;
  const results: number[] = [];
  
  for (let i = 0; i < coordinates.length; i += BATCH_SIZE) {
    const batch = coordinates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(coords => queryElevation(map, coords, elevationService))
    );
    results.push(...batchResults);
  }
  
  return results;
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
 * Generates a grid of cells for analysis.
 * Optimized for performance with batched elevation queries.
 */
export async function generateGrid(
  map: mapboxgl.Map,
  options: {
    center?: Coordinates2D;
    range?: number;
    flightPath?: GeoJSON.Feature<GeoJSON.LineString>;
    elosGridRange?: number;
    gridSize: number;
    elevationService?: any;
  }
): Promise<GridCell[]> {
  const { center, range, flightPath, elosGridRange, gridSize, elevationService } = options;
  const startTime = performance.now();
  
  try {
    let grid;
    
    // Marker-based grid generation
    if (center && range) {
      if (typeof range !== 'number' || range <= 0 || isNaN(range)) {
        throw createError('Invalid range for marker grid', 'INVALID_INPUT');
      }
      
      const point = turf.point(center);
      const buffer = turf.buffer(point, range, { units: 'meters' });
      if (!buffer) throw createError('Failed to create buffer', 'INVALID_INPUT');
      const bounds = turf.bbox(buffer) as BBox;
      
      if (!isValidBounds(bounds)) {
        throw createError('Invalid bounds for marker grid', 'GRID_GENERATION');
      }
      
      grid = turf.pointGrid(bounds, gridSize, {
        units: 'meters',
        mask: buffer
      });
      
      console.log(`Generated marker grid with ${grid.features.length} points`);
    } 
    // Flight path grid generation
    else if (flightPath && elosGridRange) {
      if (typeof elosGridRange !== 'number' || elosGridRange <= 0 || isNaN(elosGridRange)) {
        throw createError('Invalid elosGridRange', 'INVALID_INPUT');
      }
      
      const bounds = turf.bbox(flightPath) as BBox;
      const margin = turf.lengthToDegrees(elosGridRange, 'meters');
      const extendedBounds: BBox = [
        bounds[0] - margin,
        bounds[1] - margin,
        bounds[2] + margin,
        bounds[3] + margin
      ];
      
      if (!isValidBounds(extendedBounds)) {
        throw createError('Invalid extended bounds', 'GRID_GENERATION');
      }
      
      const maskOptions = {
        units: 'meters' as const,
        mask: turf.buffer(flightPath, elosGridRange, { units: 'meters' }),
      };
      
      grid = turf.pointGrid(extendedBounds, gridSize, maskOptions);
      console.log(`Generated flight path grid with ${grid.features.length} points`);
    } 
    else {
      throw createError('Invalid grid generation parameters', 'INVALID_INPUT');
    }
    
    // Extract coordinates for batch elevation query
    const gridCoordinates = grid.features.map(feature => 
      feature.geometry.coordinates as Coordinates2D
    );
    
    // Batch query elevations
    console.time('GridElevationQuery');
    const elevations = await batchQueryElevations(map, gridCoordinates, elevationService);
    console.timeEnd('GridElevationQuery');
    
    // Create cells with elevations
    const cells: GridCell[] = grid.features.map((point, index) => {
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
          elevation: elevations[index],
          lastAnalyzed: Date.now(),
        },
      };
    });
    
    console.log(`Grid generation completed in ${performance.now() - startTime}ms`);
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
 * Processes the flight path with regular sampling
 * @param map - Mapbox map instance
 * @param flightPath - Flight path feature
 * @param samplingResolution - Distance between samples in meters
 * @param elevationService - Optional elevation service for terrain querying
 * @param onProgress - Optional progress callback
 * @returns Array of sampled points along the flight path
 */
export async function processFlightPath(
  map: mapboxgl.Map,
  flightPath: GeoJSON.Feature<GeoJSON.LineString>,
  samplingResolution: number = 10,
  elevationService?: any,
  onProgress?: (progress: number) => void
): Promise<[number, number, number][]> {
  // Extract the LineString from the flight path feature
  const lineString = flightPath.geometry;
  
  // Sample the flight path at the specified resolution
  const sampledPoints = await sampleFlightPath(lineString, {
    resolution: samplingResolution,
    progressCallback: onProgress ? (progress) => {
      onProgress(progress * 0.5); // Use half of progress for sampling
      return false; // Never abort from here
    } : undefined
  });
  
  // Query terrain elevations for all sampled points if needed
  if (onProgress) onProgress(50); // Mark sampling as complete
  
  // Extract and return the 3D coordinates
  const sampledCoordinates: [number, number, number][] = sampledPoints.map(
    point => point.position
  );
  
  if (onProgress) onProgress(100); // Mark processing as complete
  return sampledCoordinates;
}

/**
 * Checks line of sight between a source point and a target point.
 * Optimized version with early termination.
 */
export async function checkLineOfSight(
  map: mapboxgl.Map,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { 
    sampleCount?: number; 
    minimumOffset?: number;
    elevationService?: any;
  } = {}
): Promise<boolean> {
  const [sourceLng, sourceLat, sourceAlt] = sourcePoint;
  const [targetLng, targetLat, targetAlt] = targetPoint;
  
  // Validate inputs
  if (sourcePoint.some(v => typeof v !== 'number' || isNaN(v)) ||
      targetPoint.some(v => typeof v !== 'number' || isNaN(v))) {
    console.error('Invalid coordinates:', { sourcePoint, targetPoint });
    return false;
  }
  
  const minimumOffset = options.minimumOffset ?? 1;
  const distance = turf.distance(
    [sourceLng, sourceLat],
    [targetLng, targetLat],
    { units: 'meters' }
  );
  
  // Adaptive sampling based on distance
  const sampleCount = options.sampleCount ?? 
    Math.min(Math.max(5, Math.ceil(distance / 50)), 20);
  
  // Add the minimum offset to target altitude
  const adjustedTargetAlt = targetAlt + minimumOffset;
  
  // Local elevation cache for this specific LOS check
  const localCache = new Map<string, number>();
  
  // Get elevation with local caching
  const getElevation = async (lng: number, lat: number): Promise<number> => {
    const key = `${lng.toFixed(6)}|${lat.toFixed(6)}`;
    if (localCache.has(key)) return localCache.get(key)!;
    
    const elev = await queryElevation(map, [lng, lat], options.elevationService);
    localCache.set(key, elev);
    return elev;
  };
  
  // Check each sample point along the line
  for (let i = 1; i < sampleCount; i++) {
    const fraction = i / sampleCount;
    
    // Interpolate position
    const lng = sourceLng + fraction * (targetLng - sourceLng);
    const lat = sourceLat + fraction * (targetLat - sourceLat);
    
    // Calculate height along the line of sight at this point
    const losHeight = sourceAlt + fraction * (adjustedTargetAlt - sourceAlt);
    
    // Get terrain height at this point
    const terrainHeight = await getElevation(lng, lat);
    
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
 */
export async function checkStationLOS(
  map: mapboxgl.Map,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { 
    sampleCount?: number; 
    minimumOffset?: number;
    elevationService?: any;
  } = {}
): Promise<boolean> {
  return checkLineOfSight(map, sourcePoint, targetPoint, options);
}

/**
 * Get LOS profile data between two points
 */
export async function getLOSProfile(
  map: mapboxgl.Map,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  options: { 
    sampleDistance?: number; 
    minimumOffset?: number;
    elevationService?: any;
  } = {}
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
  
  // Batch coordinates for efficient querying
  const sampleCoords: Coordinates2D[] = [];
  
  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;
    const lng = sourceLng + fraction * (targetLng - sourceLng);
    const lat = sourceLat + fraction * (targetLat - sourceLat);
    sampleCoords.push([lng, lat]);
  }
  
  // Batch query elevations
  const terrainElevations = await batchQueryElevations(
    map, 
    sampleCoords, 
    options.elevationService
  );
  
  // Create profile points
  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;
    const losAltitude = sourceAlt - ((sourceAlt - (targetAlt + minimumOffset)) * fraction);
    const terrain = terrainElevations[i];
    
    profile.push({
      distance: fraction * totalDistance,
      terrain,
      los: losAltitude,
    });
    
    if (terrain > losAltitude) {
      isObstructed = true;
    }
  }

  // debuggin Add at the end of the getLOSProfile function before returning
  console.log('Generated profile:', {
    pointCount: profile.length,
    clear: !isObstructed,
    samplePoints: profile.slice(0, 3)
  });
  
  return { profile, clear: !isObstructed };
}

/**
 * Checks visibility along flight path from a single location
 * Only considers flight path points within specified grid range
 */
export async function checkFlightPathLOS(
  map: mapboxgl.Map,
  sourcePoint: Coordinates3D,
  flightCoordinates: Coordinates3D[],
  options: { 
    sampleCount?: number; 
    minimumOffset?: number;
    altitudeMode?: "terrain" | "relative" | "absolute";
    elevationService?: any;
    gridRange?: number; // Parameter to use the same range as grid generation
    sampledCoordinates?: Coordinates3D[]; // New parameter for pre-sampled coordinates
  } = {}
): Promise<number> {
  const { 
    sampleCount = 20, 
    minimumOffset = 1, 
    altitudeMode = "absolute",
    gridRange = 500, // Default to 500m if not provided
    sampledCoordinates // This will be used if provided
  } = options;
  
  // Use provided sampled coordinates if available, otherwise use raw coordinates
  const coordinatesToCheck = sampledCoordinates || flightCoordinates;
  
  if (!Array.isArray(sourcePoint) || sourcePoint.length !== 3 || 
      sourcePoint.some(v => typeof v !== 'number' || isNaN(v))) {
    throw createError('Source point must be a valid [lon, lat, alt] array', 'INVALID_INPUT');
  }
  
  if (!Array.isArray(coordinatesToCheck) || !coordinatesToCheck.every(point => 
      Array.isArray(point) && point.length === 3 && point.every(v => typeof v === 'number' && !isNaN(v)))) {
    throw createError('Flight coordinates must be an array of [lon, lat, alt] arrays', 'INVALID_INPUT');
  }
  
  // Filter flight coordinates by distance to only check relevant ones
  const relevantCoordinates: Coordinates3D[] = [];
  
  for (const fpPoint of coordinatesToCheck) {
    // Calculate distance from cell to flight point
    const distance = turf.distance(
      [sourcePoint[0], sourcePoint[1]],
      [fpPoint[0], fpPoint[1]],
      { units: 'meters' }
    );
    
    // Only consider points within the grid range
    if (distance <= gridRange) {
      relevantCoordinates.push(fpPoint);
    }
  }
  
  // If no relevant flight coordinates, cell is not visible
  if (relevantCoordinates.length === 0) {
    return 0;
  }
  
  let visibleCount = 0;
  
  // Check visibility only for relevant coordinates
  for (const targetPoint of relevantCoordinates) {
    try {
      if (altitudeMode === "terrain" || altitudeMode === "relative") {
        const terrainElevation = await queryElevation(
          map, 
          [targetPoint[0], targetPoint[1]], 
          options.elevationService
        );
        
        const adjustedTargetPoint: Coordinates3D = [
          targetPoint[0],
          targetPoint[1],
          terrainElevation + targetPoint[2]
        ];
        
        const isVisible = await checkLineOfSight(
          map,
          sourcePoint,
          adjustedTargetPoint,
          { 
            sampleCount, 
            minimumOffset,
            elevationService: options.elevationService
          }
        );
        
        if (isVisible) visibleCount++;
      } else {
        const isVisible = await checkLineOfSight(
          map,
          sourcePoint,
          targetPoint,
          { 
            sampleCount, 
            minimumOffset,
            elevationService: options.elevationService 
          }
        );
        
        if (isVisible) visibleCount++;
      }
    } catch (e) {
      console.warn('Error checking LOS for point:', targetPoint, e);
      // Continue to next point
    }
  }
  
  const visibilityPercentage = relevantCoordinates.length > 0 ? 
    (visibleCount / relevantCoordinates.length) * 100 : 0;
  
  return visibilityPercentage;
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
    return turf.bbox(buffer) as BBox;
  });
  
  const combinedBbox: BBox = [180, 90, -180, -90];
  bboxes.forEach((bbox) => {
    combinedBbox[0] = Math.min(combinedBbox[0], bbox[0]);
    combinedBbox[1] = Math.min(combinedBbox[1], bbox[1]);
    combinedBbox[2] = Math.max(combinedBbox[2], bbox[2]);
    combinedBbox[3] = Math.max(combinedBbox[3], bbox[3]);
  });
  
  return combinedBbox;
}

/**
 * Checks if station has line of sight to all provided locations
 */
export async function checkStationToLocationLOS(
  map: mapboxgl.Map,
  stationLocation: LocationData,
  stationElevationOffset: number,
  targetLocations: LocationData[],
  options: {
    elevationService?: any;
  } = {}
): Promise<{ 
  visibleLocations: LocationData[]; 
  visibilityPercentage: number; 
}> {
  if (!stationLocation || typeof stationLocation.lng !== 'number' || 
      typeof stationLocation.lat !== 'number') {
    throw createError('Invalid station location', 'INVALID_INPUT');
  }
  
  if (!targetLocations || !targetLocations.length) {
    return { visibleLocations: [], visibilityPercentage: 0 };
  }
  
  // Get station elevation if not available
  const stationElevation = stationLocation.elevation ?? 
    await queryElevation(map, [stationLocation.lng, stationLocation.lat], options.elevationService);
  
  const stationPoint: Coordinates3D = [
    stationLocation.lng,
    stationLocation.lat,
    stationElevation + stationElevationOffset
  ];
  
  const visibleLocations: LocationData[] = [];
  
  // Check visibility to each target location
  for (const targetLocation of targetLocations) {
    try {
      if (!targetLocation || typeof targetLocation.lng !== 'number' || 
          typeof targetLocation.lat !== 'number') {
        continue; // Skip invalid locations
      }
      
      // Get target elevation if not available
      const targetElevation = targetLocation.elevation ??
        await queryElevation(map, [targetLocation.lng, targetLocation.lat], options.elevationService);
      
      const targetPoint: Coordinates3D = [
        targetLocation.lng,
        targetLocation.lat,
        targetElevation
      ];
      
      const isVisible = await checkLineOfSight(
        map,
        stationPoint,
        targetPoint,
        { elevationService: options.elevationService }
      );
      
      if (isVisible) {
        visibleLocations.push(targetLocation);
      }
    } catch (e) {
      console.warn('Error checking LOS to location:', targetLocation, e);
    }
  }
  
  const visibilityPercentage = targetLocations.length > 0 ?
    (visibleLocations.length / targetLocations.length) * 100 : 0;
  
  return { visibleLocations, visibilityPercentage };
}

/**
 * Checks line of sight between two stations
 */
export async function checkStationToStationLOS(
  map: mapboxgl.Map,
  sourceStation: {
    location: LocationData;
    elevationOffset: number;
  },
  targetStation: {
    location: LocationData;
    elevationOffset: number;
  },
  options: {
    elevationService?: any;
  } = {}
): Promise<{ 
  result: StationLOSResult; 
  profile: LOSProfilePoint[];
}> {
  if (!sourceStation.location || !targetStation.location || 
      typeof sourceStation.location.lng !== 'number' || 
      typeof sourceStation.location.lat !== 'number' ||
      typeof targetStation.location.lng !== 'number' || 
      typeof targetStation.location.lat !== 'number') {
    throw createError('Both station locations must be set and valid', 'INVALID_INPUT');
  }
  
  // Get source station elevation if not available
  const sourceElevation = sourceStation.location.elevation ?? 
    await queryElevation(
      map, 
      [sourceStation.location.lng, sourceStation.location.lat],
      options.elevationService
    );
  
  // Get target station elevation if not available
  const targetElevation = targetStation.location.elevation ?? 
    await queryElevation(
      map, 
      [targetStation.location.lng, targetStation.location.lat],
      options.elevationService
    );
  
  const sourcePoint: Coordinates3D = [
    sourceStation.location.lng,
    sourceStation.location.lat,
    sourceElevation + sourceStation.elevationOffset
  ];
  
  const targetPoint: Coordinates3D = [
    targetStation.location.lng,
    targetStation.location.lat,
    targetElevation + targetStation.elevationOffset
  ];
  
  const { profile, clear } = await getLOSProfile(
    map,
    sourcePoint,
    targetPoint,
    { 
      sampleDistance: 10,
      minimumOffset: 3,
      elevationService: options.elevationService
    }
  );
  
  let obstructionFraction = null;
  let obstructionDistance = null;
  
  if (!clear) {
    for (let i = 0; i < profile.length; i++) {
      if (profile[i].terrain > profile[i].los) {
        obstructionFraction = i / (profile.length - 1);
        obstructionDistance = profile[i].distance;
        break;
      }
    }
  }
  
  const result: StationLOSResult = {
    clear,
    obstructionFraction: obstructionFraction ?? undefined,
    obstructionDistance: obstructionDistance ?? undefined,
  };
  
  return { result, profile };
}

/**
 * Analyzes a terrain grid efficiently for elevation statistics
 * Uses a batched approach to prevent call stack overflow with large areas
 */
export async function analyzeTerrainGrid(
  gridCells: GridCell[],
  options: {
    batchSize?: number;
    referenceAltitude?: number;
    onProgress?: (progress: number) => boolean;
  } = {}
): Promise<{
  highestElevation: number;
  lowestElevation: number;
  averageElevation: number;
  elevationDistribution: Record<string, number>;
  elevations: number[];
}> {
  const { 
    batchSize = 1000,
    onProgress
  } = options;
  
  if (!gridCells || gridCells.length === 0) {
    throw createError('No grid cells provided for analysis', 'INVALID_INPUT');
  }
  
  console.log(`Analyzing terrain grid with ${gridCells.length} cells`);
  
  // For very large datasets, use a reduced set of elevation points for statistics
  // to prevent memory issues, but still analyze all points for highest/lowest
  const totalCells = gridCells.length;
  const useReducedSet = totalCells > 10000;
  const sampleInterval = useReducedSet ? Math.ceil(totalCells / 10000) : 1;
  
  let highestElevation = -Infinity;
  let lowestElevation = Infinity;
  let elevationSum = 0;
  const elevationCounts: Record<string, number> = {};
  const sampleElevations: number[] = [];
  
  // Process in batches to prevent stack overflow
  for (let i = 0; i < totalCells; i += batchSize) {
    // Check for abort if callback provided
    if (onProgress) {
      const progressValue = Math.round((i / totalCells) * 100);
      const shouldAbort = onProgress(progressValue);
      if (shouldAbort) {
        throw createError('Analysis aborted by user', 'USER_ABORT');
      }
    }
    
    // Process current batch
    const endIndex = Math.min(i + batchSize, totalCells);
    const batchCells = gridCells.slice(i, endIndex);
    
    for (let j = 0; j < batchCells.length; j++) {
      const elevation = batchCells[j].properties.elevation;
      
      // Update highest and lowest
      highestElevation = Math.max(highestElevation, elevation);
      lowestElevation = Math.min(lowestElevation, elevation);
      
      // Only include in average and distribution if part of reduced set or using full set
      if (!useReducedSet || (i + j) % sampleInterval === 0) {
        elevationSum += elevation;
        
        // Add to sample array
        sampleElevations.push(elevation);
        
        // Update distribution count
        // Round to nearest 10m for reasonable histogram
        const elevationBucket = Math.round(elevation / 10) * 10;
        const bucketKey = elevationBucket.toString();
        elevationCounts[bucketKey] = (elevationCounts[bucketKey] || 0) + 1;
      }
    }
    
    // Yield to event loop to prevent stack overflow and UI freezing
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Calculate averages based on the sample set
  const averageElevation = sampleElevations.length > 0 ? 
    elevationSum / sampleElevations.length : 0;
  
  // Report completion
  if (onProgress) {
    onProgress(100);
  }
  
  return {
    highestElevation,
    lowestElevation,
    averageElevation,
    elevationDistribution: elevationCounts,
    elevations: sampleElevations
  };
}