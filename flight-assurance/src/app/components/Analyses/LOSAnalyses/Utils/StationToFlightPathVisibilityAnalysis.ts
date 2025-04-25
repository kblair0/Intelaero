/**
 * StationToFlightPathVisibilityAnalysis.ts
 * 
 * Enhanced utility for analyzing visibility along a flight path from one or more stations.
 * Provides detailed segment-based analysis with efficient terrain queries and visualization.
 * 
 * This module:
 * - Samples points along a flight path
 * - Checks line of sight from stations to each point
 * - Creates visibility segments with color coding
 * - Calculates comprehensive statistics
 * - Visualizes results on the map
 * 
 * Used by:
 * - useGridAnalysis hook
 * - GridAnalysisController
 * - FlightPathAnalysisCard
 */

import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { Coordinates2D, Coordinates3D } from '../../Types/GridAnalysisTypes';
import { FlightPlanData } from '../../../../context/FlightPlanContext';
import { LocationData } from '../../../../types/LocationData';
import { layerManager, MAP_LAYERS } from '../../../../services/LayerManager';
import { checkSingleLOS } from '../../Utils/gridAnalysisUtils';
import { SamplePoint, sampleFlightPath } from '../../../../hooks/useFlightPathSampling';

// ======== Type Definitions ========

/**
 * Represents a segment of the flight path with visibility status
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
  /** Comprehensive statistics about the analysis */
  stats: {
    /** Total length of the flight path in meters */
    totalLength: number;
    /** Length of visible sections in meters */
    visibleLength: number;
    /** Percentage of flight path with visibility */
    coveragePercentage: number;
    /** Time taken to perform the analysis in ms */
    analysisTime: number;
    /** Statistics per station */
    stationStats?: {
      stationType: 'gcs' | 'observer' | 'repeater';
      visibleLength: number;
      coveragePercentage: number;
    }[];
  };
}

/**
 * Configuration options for flight path visibility analysis
 */
export interface VisibilityAnalysisOptions {
  /** Distance in meters between sample points along the flight path */
  sampleInterval?: number;
  /** Safety offset in meters to ensure minimum clearance */
  minimumOffset?: number;
  /** Progress callback for UI updates */
  onProgress?: (progress: number) => void;
  /** Which visibility layer ID to use */
  layerId?: string;
}

/**
 * Interface for station data used in analysis
 */
export interface StationData {
  type: 'gcs' | 'observer' | 'repeater';
  location: LocationData;
  elevationOffset: number;
}

// ======== Main Analysis Functions ========

/**
 * Analyzes visibility of a flight path from one or more stations.
 * 
 * @param map - Mapbox map instance for terrain queries
 * @param flightPlan - Flight plan data to analyze
 * @param stations - Station information including locations and elevation offsets
 * @param queryTerrainElevation - Function to query terrain elevation
 * @param options - Analysis configuration options
 * @returns Detailed visibility analysis results
 */
export async function analyzeFlightPathVisibility(
  map: mapboxgl.Map,
  flightPlan: FlightPlanData,
  stations: StationData[],
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  options: VisibilityAnalysisOptions = {}
): Promise<FlightPathVisibilityResult> {
  const startTime = performance.now();
  const {
    sampleInterval = 10,
    minimumOffset = 1,
    onProgress
  } = options;
  
  console.log(`[${new Date().toISOString()}] Starting Flight Path Visibility Analysis:`, {
    flightPlanFeatures: flightPlan.features.length,
    availableStations: stations.length,
    sampleInterval
  });

  // Validate flight plan data
  const flightPath = flightPlan.features[0];
  if (!flightPath?.geometry?.coordinates) {
    console.error('Invalid flight plan data:', flightPath);
    throw new Error("Invalid flight plan data");
  }

  console.log('Flight path coordinates:', {
    count: flightPath.geometry.coordinates.length,
    firstCoord: flightPath.geometry.coordinates[0],
    lastCoord: flightPath.geometry.coordinates[flightPath.geometry.coordinates.length - 1]
  });

  // Sample points along the flight path
  onProgress?.(5);
  const sampledPath = await sampleFlightPath(flightPath.geometry, {
    resolution: sampleInterval,
    progressCallback: (p) => {
      onProgress?.(5 + p * 0.15);
      return false; // Don't abort
    }
  });

  console.log(`Sampled path points: ${sampledPath.length}`);
  onProgress?.(20);

  // Calculate terrain elevation for each sample point
  for (let i = 0; i < sampledPath.length; i++) {
    const point = sampledPath[i];
    const terrainElevation = await queryTerrainElevation([point.position[0], point.position[1]]);
    point.terrainElevation = terrainElevation;
    point.clearance = point.flightElevation - terrainElevation;
    
    if (i % 50 === 0) {
      const progress = 20 + (i / sampledPath.length) * 30;
      onProgress?.(progress);
    }
  }
  
  onProgress?.(50);
  
  // Prepare station positions with elevation data
  const stationPositions = await Promise.all(stations.map(async (station) => {
    const { location, elevationOffset, type } = station;
    
    // Get station elevation if not available
    const stationElevation = location.elevation ?? 
      await queryTerrainElevation([location.lng, location.lat]) ?? 
      0;
    
    // Add elevation offset to get actual station height
    const stationPosition: Coordinates3D = [
      location.lng,
      location.lat,
      stationElevation + elevationOffset
    ];
    
    return {
      type,
      position: stationPosition,
      visiblePoints: [] as number[] // indices of visible points
    };
  }));
  
  console.log('Prepared station positions:', stationPositions.map(s => ({
    type: s.type,
    position: s.position
  })));
  
  // Check visibility for each sample point from each station
  const pointVisibility: { 
    isVisible: boolean;
    visibleFromStations: number[];
  }[] = [];
  
  for (let i = 0; i < sampledPath.length; i++) {
    const sample = sampledPath[i];
    const samplePoint: Coordinates3D = [
      sample.position[0],
      sample.position[1],
      sample.flightElevation
    ];
    
    let isVisibleFromAny = false;
    const visibleFromStations: number[] = [];
    
    // Check visibility from each station
    for (let stationIdx = 0; stationIdx < stationPositions.length; stationIdx++) {
      const station = stationPositions[stationIdx];
      
      const isVisible = await checkSingleLOS(
        queryTerrainElevation,
        station.position,
        samplePoint,
        { minimumOffset }
      );
      
      if (isVisible) {
        isVisibleFromAny = true;
        visibleFromStations.push(stationIdx);
        station.visiblePoints.push(i);
      }
    }
    
    pointVisibility.push({
      isVisible: isVisibleFromAny,
      visibleFromStations
    });
    
    if (i % 20 === 0) {
      const progress = 50 + (i / sampledPath.length) * 40;
      onProgress?.(progress);
    }
  }
  
  onProgress?.(90);
  
  // Create visibility segments
  const segments = createVisibilitySegments(sampledPath, pointVisibility);
  console.log(`Created ${segments.length} visibility segments`);
  
  // Calculate statistics
  const stats = calculateVisibilityStats(
    sampledPath, 
    segments, 
    stationPositions, 
    stations,
    performance.now() - startTime
  );
  
  onProgress?.(100);
  
  return {
    segments,
    stats
  };
}

/**
 * Creates visibility segments from sample points
 */
function createVisibilitySegments(
  samples: SamplePoint[], 
  pointVisibility: { isVisible: boolean; visibleFromStations: number[] }[]
): VisibilitySegment[] {
  const segments: VisibilitySegment[] = [];
  let currentSegment: VisibilitySegment | null = null;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const visibility = pointVisibility[i];
    
    // First point or changing visibility state
    if (!currentSegment || currentSegment.isVisible !== visibility.isVisible) {
      // Push the previous segment if it exists and has at least 2 points
      if (currentSegment && currentSegment.coordinates.length >= 2) {
        segments.push(currentSegment);
      }
      
      // Start a new segment
      currentSegment = {
        coordinates: [[
          sample.position[0], 
          sample.position[1], 
          sample.flightElevation
        ]],
        isVisible: visibility.isVisible,
        visibleFromStations: [...visibility.visibleFromStations]
      };
    } else {
      // Continue the current segment
      currentSegment.coordinates.push([
        sample.position[0], 
        sample.position[1], 
        sample.flightElevation
      ]);
      
      // Update visible stations (union)
      if (visibility.visibleFromStations.length > 0) {
        const uniqueStations = new Set([
          ...(currentSegment.visibleFromStations || []),
          ...visibility.visibleFromStations
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
  stationPositions: { type: 'gcs' | 'observer' | 'repeater'; position: Coordinates3D; visiblePoints: number[] }[],
  stations: StationData[],
  analysisTime: number
): FlightPathVisibilityResult['stats'] {
  // Calculate total path length
  const totalLength = samples.length > 0 ? 
    samples[samples.length - 1].distanceFromStart : 0;
  
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
    let prevVisible = false;
    let visibleStartIdx = -1;
    
    for (let i = 0; i < samples.length; i++) {
      const isVisible = station.visiblePoints.includes(i);
      
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