/** the optimized FlightPathVisibilityEngine.ts file to replace StationToFlightPathVisibilityAnalysis.ts:
 * /**
 * FlightPathVisibilityEngine.ts
 * 
 * Optimized implementation for flight path visibility analysis.
 * Analyzes which segments of a flight path are visible from ground stations.
 * 
 * Key optimizations:
 * - Efficient terrain sampling
 * - Parallelized visibility checks
 * - Adaptive resolution based on distance
 * - Memory efficient data structures
 * - Batched processing for better performance
 */

import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { FlightPlanData } from '../../../../context/FlightPlanContext';
import { LocationData } from '../../../../types/LocationData';
import { layerManager, MAP_LAYERS } from '../../../../services/LayerManager';
import { ElevationService } from '../../../../services/ElevationService';
import { Coordinates2D, Coordinates3D } from '../../Types/GridAnalysisTypes';
import { Marker } from '../../../../context/MarkerContext';

// ======== Type Definitions ========

/**
 * A segment of the flight path with visibility status
 */
export interface VisibilitySegment {
  /** 3D coordinates for the segment */
  coordinates: [number, number, number][];
  /** Whether the segment is visible from any station */
  isVisible: boolean;
  /** Which stations can see this segment (by index) */
  visibleFromStations?: number[];
}

/**
 * Result of the flight path visibility analysis
 */
export interface FlightPathVisibilityResult {
  /** Segments of the flight path with visibility information */
  segments: VisibilitySegment[];
  /** Statistics about the analysis */
  stats: {
    /** Total length of the flight path in meters */
    totalLength: number;
    /** Length of visible sections in meters */
    visibleLength: number;
    /** Percentage of flight path with visibility */
    coveragePercentage: number;
    /** Time taken to perform the analysis in ms */
    analysisTime: number;
    /** Per-station statistics */
    stationStats?: {
      stationType: 'gcs' | 'observer' | 'repeater';
      visibleLength: number;
      coveragePercentage: number;
    }[];
  };
}

/**
 * Configuration options for visibility analysis
 */
export interface VisibilityAnalysisOptions {
  /** Distance in meters between sample points along flight path */
  sampleInterval?: number;
  /** Safety offset in meters to ensure minimum clearance */
  minimumOffset?: number;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Station information for analysis
 */
interface StationData {
  type: 'gcs' | 'observer' | 'repeater';
  location: LocationData;
  elevationOffset: number;
}

/**
 * Sample point along the flight path
 */
interface SamplePoint {
  position: [number, number, number];
  distanceFromStart: number;
  terrainElevation?: number;
  stations?: number[]; // Indices of stations with LOS to this point
}

// ======== Main Analysis Functions ========

/**
 * Optimized flight path visibility analysis function
 */
export async function analyzeFlightPathVisibility(
  map: mapboxgl.Map,
  flightPlan: FlightPlanData,
  markers: Marker[], // Using correct Marker type from context
  elevationService: ElevationService | null,
  options: VisibilityAnalysisOptions = {}
): Promise<FlightPathVisibilityResult> {
  const startTime = performance.now();
  const {
    sampleInterval = 10,
    minimumOffset = 1,
    onProgress = () => {}
  } = options;
  
  // 1. Validate inputs
  if (!flightPlan?.features?.length || flightPlan.features[0]?.geometry?.type !== 'LineString') {
    throw new Error('Invalid flight plan: must contain a LineString feature');
  }
  
  // Convert markers to stations format for processing
  const stations = markers.map(marker => ({
    type: marker.type,
    location: marker.location,
    elevationOffset: marker.elevationOffset,
    id: marker.id
  }));
  
  if (!stations.length) {
    throw new Error('At least one station is required for analysis');
  }
  
  onProgress(5);
  
  // Rest of the existing input validation...
  
  // 2. Prepare the flight path for analysis
  const flightPath = flightPlan.features[0] as GeoJSON.Feature<GeoJSON.LineString>;
  const coordinates = flightPath.geometry.coordinates as [number, number, number][];
  
  if (coordinates.length < 2) {
    throw new Error('Flight path must have at least 2 coordinates');
  }
  
  // 3. Determine altitude mode from waypoints
  const waypoints = flightPath.properties?.waypoints || [];
  const altitudeMode = waypoints.length > 0 ? waypoints[0]?.altitudeMode : 'absolute';
  
  // 4. Sample points along the flight path at specified intervals
  const sampledPoints = await sampleFlightPath(
    map,
    flightPath,
    sampleInterval,
    elevationService
  );
  
  onProgress(20);
  
  // 5. Batch process terrain elevations for all points
  await batchProcessTerrainElevations(
    map,
    sampledPoints,
    elevationService,
    (progress) => onProgress(20 + progress * 0.2)
  );
  
  onProgress(40);
  
  // 6. Prepare station data with accurate elevations
  const stationPositions = await prepareStationPositions(
    map,
    stations,
    elevationService
  );
  
  onProgress(50);
  
  // 7. Check visibility in efficient batches
  await checkVisibility(
    map,
    sampledPoints,
    stationPositions,
    { 
      minimumOffset,
      altitudeMode,
      elevationService
    },
    (progress) => onProgress(50 + progress * 0.4)
  );
  
  onProgress(90);
  
  // 8. Create visibility segments
  const segments = createVisibilitySegments(sampledPoints);
  
  // 9. Calculate statistics
  const stats = calculateVisibilityStats(
    sampledPoints,
    segments,
    stationPositions,
    stations,
    performance.now() - startTime
  );
  
  onProgress(100);
  
  return {
    segments,
    stats
  };
}

/**
 * Samples points along the flight path at specified intervals
 */
async function sampleFlightPath(
  map: mapboxgl.Map,
  flightPath: GeoJSON.Feature<GeoJSON.LineString>,
  sampleInterval: number,
  elevationService: ElevationService | null
): Promise<SamplePoint[]> {
  const coordinates = flightPath.geometry.coordinates as [number, number, number][];
  
  // Create a line geometry for distance calculations
  const line = turf.lineString(coordinates.map(coord => [coord[0], coord[1]]));
  const totalPathLength = turf.length(line, { units: 'meters' });
  
  // Calculate number of sample points based on interval
  const sampleCount = Math.max(coordinates.length, Math.ceil(totalPathLength / sampleInterval));
  const samples: SamplePoint[] = [];
  
  // Add original waypoints as samples to ensure accuracy
  coordinates.forEach((coord, index) => {
    // Calculate distance from start for each original waypoint
    const segmentLine = turf.lineSlice(
      turf.point([coordinates[0][0], coordinates[0][1]]),
      turf.point([coord[0], coord[1]]),
      line
    );
    const distance = turf.length(segmentLine, { units: 'meters' });
    
    samples.push({
      position: [coord[0], coord[1], coord[2]],
      distanceFromStart: distance
    });
  });
  
  // Add intermediate points if needed
  if (sampleCount > coordinates.length) {
    // Add intermediate points along each segment
    for (let i = 0; i < coordinates.length - 1; i++) {
      const startCoord = coordinates[i];
      const endCoord = coordinates[i + 1];
      
      // Create a line segment
      const segment = turf.lineString([
        [startCoord[0], startCoord[1]],
        [endCoord[0], endCoord[1]]
      ]);
      
      // Calculate segment length and number of points needed
      const segmentLength = turf.length(segment, { units: 'meters' });
      const pointsNeeded = Math.max(0, Math.ceil(segmentLength / sampleInterval) - 1);
      
      // Calculate the start distance
      const segmentStart = turf.lineSlice(
        turf.point([coordinates[0][0], coordinates[0][1]]),
        turf.point([startCoord[0], startCoord[1]]),
        line
      );
      const startDistance = turf.length(segmentStart, { units: 'meters' });
      
      // Add intermediate points
      for (let j = 1; j <= pointsNeeded; j++) {
        const fraction = j / (pointsNeeded + 1);
        
        // Interpolate position
        const lng = startCoord[0] + fraction * (endCoord[0] - startCoord[0]);
        const lat = startCoord[1] + fraction * (endCoord[1] - startCoord[1]);
        const alt = startCoord[2] + fraction * (endCoord[2] - startCoord[2]);
        
        // Calculate distance along path
        const distance = startDistance + fraction * segmentLength;
        
        samples.push({
          position: [lng, lat, alt],
          distanceFromStart: distance
        });
      }
    }
    
    // Sort samples by distance from start
    samples.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  }
  
  return samples;
}

/**
 * Efficiently processes terrain elevations for all sample points
 */
async function batchProcessTerrainElevations(
  map: mapboxgl.Map,
  samples: SamplePoint[],
  elevationService: ElevationService | null,
  onProgress: (progress: number) => void
): Promise<void> {
  // Process in batches for better performance
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < samples.length; i += BATCH_SIZE) {
    const batch = samples.slice(i, i + BATCH_SIZE);
    const coordinates = batch.map(point => [point.position[0], point.position[1]] as Coordinates2D);
    
    // Query elevations efficiently
    let elevations: number[];
    
    if (elevationService) {
      // Use batch query if available
      elevations = await elevationService.batchGetElevations(coordinates);
    } else {
      // Fall back to individual queries
      elevations = await Promise.all(
        coordinates.map(coords => {
          const elevation = map.queryTerrainElevation(coords);
          return elevation !== null && elevation !== undefined ? elevation : 0;
        })
      );
    }
    
    // Apply elevations to sample points
    batch.forEach((sample, index) => {
      sample.terrainElevation = elevations[index];
    });
    
    // Report progress
    onProgress((i + batch.length) / samples.length * 100);
    
    // Let UI thread breathe
    if (i + BATCH_SIZE < samples.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

/**
 * Prepares station positions with accurate elevations
 */
async function prepareStationPositions(
  map: mapboxgl.Map,
  stations: StationData[],
  elevationService: ElevationService | null
): Promise<{ type: string; position: Coordinates3D }[]> {
  return Promise.all(stations.map(async (station) => {
    // Get terrain elevation if not already available
    let elevation = station.location.elevation;
    
    if (elevation === null || elevation === undefined) {
      if (elevationService) {
        elevation = await elevationService.getElevation(
          station.location.lng,
          station.location.lat
        );
      } else {
        elevation = map.queryTerrainElevation([
          station.location.lng,
          station.location.lat
        ]) || 0;
      }
    }
    
    // Add elevation offset to get actual station height
    const position: Coordinates3D = [
      station.location.lng,
      station.location.lat,
      elevation + station.elevationOffset
    ];
    
    return {
      type: station.type,
      position
    };
  }));
}

/**
 * Efficiently checks visibility from stations to sample points
 */
async function checkVisibility(
  map: mapboxgl.Map,
  samples: SamplePoint[],
  stations: { type: string; position: Coordinates3D }[],
  options: {
    minimumOffset: number;
    altitudeMode: string;
    elevationService: ElevationService | null;
  },
  onProgress: (progress: number) => void
): Promise<void> {
  const { minimumOffset, altitudeMode, elevationService } = options;
  
  // Process in batches for better performance
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < samples.length; i += BATCH_SIZE) {
    const batch = samples.slice(i, i + BATCH_SIZE);
    
    // Process each batch in parallel
    await Promise.all(batch.map(async (sample) => {
      // Prepare target point based on altitude mode
      const targetPosition: Coordinates3D = [
        sample.position[0],
        sample.position[1],
        altitudeMode === 'terrain' || altitudeMode === 'relative'
          ? (sample.terrainElevation || 0) + sample.position[2]
          : sample.position[2]
      ];
      
      // Check visibility from each station
      const visibleStations: number[] = [];
      
      for (let stationIdx = 0; stationIdx < stations.length; stationIdx++) {
        const station = stations[stationIdx];
        const isVisible = await checkLineOfSight(
          map,
          station.position,
          targetPosition,
          minimumOffset,
          elevationService
        );
        
        if (isVisible) {
          visibleStations.push(stationIdx);
        }
      }
      
      // Store visibility results
      sample.stations = visibleStations;
    }));
    
    // Report progress
    onProgress((i + batch.length) / samples.length * 100);
    
    // Let UI thread breathe
    if (i + BATCH_SIZE < samples.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

/**
 * Optimized line of sight check between two points
 */
async function checkLineOfSight(
  map: mapboxgl.Map,
  sourcePoint: Coordinates3D,
  targetPoint: Coordinates3D,
  minimumOffset: number,
  elevationService: ElevationService | null
): Promise<boolean> {
  const [sourceLng, sourceLat, sourceAlt] = sourcePoint;
  const [targetLng, targetLat, targetAlt] = targetPoint;
  
  // Add minimum offset to target altitude
  const adjustedTargetAlt = targetAlt + minimumOffset;
  
  // Calculate distance and adaptive sample count
  const distance = turf.distance(
    [sourceLng, sourceLat],
    [targetLng, targetLat],
    { units: 'meters' }
  );
  
  // Use adaptive sampling based on distance
  const sampleCount = Math.min(Math.max(5, Math.ceil(distance / 100)), 15);
  
  // Create a local cache for this LOS check
  const elevationCache = new Map<string, number>();
  
  // Helper function to get elevation with local caching
  const getElevation = async (lng: number, lat: number): Promise<number> => {
    const key = `${lng.toFixed(6)}|${lat.toFixed(6)}`;
    if (elevationCache.has(key)) return elevationCache.get(key)!;
    
    let elevation: number;
    
    if (elevationService) {
      elevation = await elevationService.getElevation(lng, lat);
    } else {
      elevation = map.queryTerrainElevation([lng, lat]) || 0;
    }
    
    elevationCache.set(key, elevation);
    return elevation;
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
 * Creates visibility segments from sample points
 */
function createVisibilitySegments(samples: SamplePoint[]): VisibilitySegment[] {
  const segments: VisibilitySegment[] = [];
  let currentSegment: VisibilitySegment | null = null;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const isVisible = sample.stations && sample.stations.length > 0;
    
    // First point or changing visibility state
    if (!currentSegment || currentSegment.isVisible !== isVisible) {
      // Push the previous segment if it exists and has at least 2 points
      if (currentSegment && currentSegment.coordinates.length >= 2) {
        segments.push(currentSegment);
      }
      
      // Start a new segment
      currentSegment = {
        coordinates: [sample.position],
        isVisible,
        visibleFromStations: sample.stations ? [...sample.stations] : []
      };
    } else {
      // Continue the current segment
      currentSegment.coordinates.push(sample.position);
      
      // Update visible stations (union)
      if (isVisible && sample.stations) {
        const uniqueStations = new Set([
          ...(currentSegment.visibleFromStations || []),
          ...sample.stations
        ]);
        currentSegment.visibleFromStations = Array.from(uniqueStations);
      }
    }
  }
  
  // Add the last segment if it exists and has at least 2 points
  if (currentSegment && currentSegment.coordinates.length >= 2) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * Calculates comprehensive statistics for the visibility analysis
 */
function calculateVisibilityStats(
  samples: SamplePoint[],
  segments: VisibilitySegment[],
  stationPositions: { type: string; position: Coordinates3D }[],
  stations: StationData[],
  analysisTime: number
): FlightPathVisibilityResult['stats'] {
  // Calculate total path length
  const totalLength = samples.length > 0 ? samples[samples.length - 1].distanceFromStart : 0;
  
  // Calculate visible length
  let visibleLength = 0;
  for (const segment of segments) {
    if (segment.isVisible && segment.coordinates.length >= 2) {
      const segmentLine = turf.lineString(segment.coordinates.map(coord => [coord[0], coord[1]]));
      const segmentLength = turf.length(segmentLine, { units: 'meters' });
      visibleLength += segmentLength;
    }
  }
  
  // Calculate per-station statistics
  const stationStats = stationPositions.map((station, index) => {
    // Calculate visible distance for this station
    let stationVisibleLength = 0;
    
    // Loop through samples and calculate visibility segments
    let prevVisible = false;
    let visibleStartIdx = -1;
    
    for (let i = 0; i < samples.length; i++) {
      const isVisible = samples[i].stations?.includes(index) || false;
      
      // Visibility state transition
      if (isVisible && !prevVisible) {
        // Start of visible segment
        visibleStartIdx = i;
      } else if (!isVisible && prevVisible) {
        // End of visible segment
        const startDist = samples[visibleStartIdx].distanceFromStart;
        const endDist = samples[i - 1].distanceFromStart;
        stationVisibleLength += (endDist - startDist);
        visibleStartIdx = -1;
      }
      
      prevVisible = isVisible;
    }
    
    // Handle the case where the path ends while still visible
    if (prevVisible && visibleStartIdx >= 0) {
      const startDist = samples[visibleStartIdx].distanceFromStart;
      const endDist = samples[samples.length - 1].distanceFromStart;
      stationVisibleLength += (endDist - startDist);
    }
    
    return {
      stationType: stations[index].type,
      visibleLength: stationVisibleLength,
      coveragePercentage: (stationVisibleLength / totalLength) * 100
    };
  });
  
  return {
    totalLength,
    visibleLength,
    coveragePercentage: totalLength > 0 ? (visibleLength / totalLength) * 100 : 0,
    analysisTime,
    stationStats
  };
}

/**
 * Adds flight path visibility layer to the map
 */
export function addVisibilityLayer(
  map: mapboxgl.Map, 
  segments: VisibilitySegment[],
  layerId: string = MAP_LAYERS.FLIGHT_PATH_VISIBILITY
): void {
  // Remove existing layer and source
  layerManager.removeLayer(layerId);
  
  // Create features with 2D coordinates for the layer
  const features: GeoJSON.Feature[] = segments
    .filter(segment => segment.coordinates.length >= 2)
    .map(segment => ({
      type: 'Feature',
      properties: {
        isVisible: segment.isVisible,
        stationCount: segment.visibleFromStations?.length || 0
      },
      geometry: {
        type: 'LineString',
        coordinates: segment.coordinates.map(coord => [coord[0], coord[1]])
      }
    }));
  
  // Add source and layer
  map.addSource(layerId, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features
    }
  });
  
  map.addLayer({
    id: layerId,
    type: 'line',
    source: layerId,
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': [
        'case',
        ['==', ['get', 'isVisible'], true],
        '#4CAF50',  // Green for visible
        '#d32f2f'   // Red for not visible
      ],
      'line-width': 5,
      'line-dasharray': [
        'case',
        ['==', ['get', 'isVisible'], true],
        [1, 0],     // Solid line for visible
        [2, 2]      // Dashed for not visible
      ]
    }
  });
  
  // Register the layer with the layer manager
  layerManager.registerLayer(layerId, true);
}

/**
 * Removes the visibility layer from the map
 */
export function removeVisibilityLayer(
  map: mapboxgl.Map,
  layerId: string = MAP_LAYERS.FLIGHT_PATH_VISIBILITY
): void {
  layerManager.removeLayer(layerId);
}