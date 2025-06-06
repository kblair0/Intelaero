/**
 * FlightPathVisibilityEngine.ts - SIMPLIFIED VERSION
 * 
 * Simplified implementation that uses already-processed data instead of 
 * redoing terrain queries, sampling, and position calculations.
 * 
 * Key simplifications:
 * - Uses processed flight plan coordinates (already absolute altitudes)
 * - Uses processed marker positions (already terrain + offset)
 * - Uses proven getLOSProfile function for LOS checks
 * - Removes redundant terrain queries and sampling
 */

import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { FlightPlanData } from '../../../../context/FlightPlanContext';
import { ElevationService } from '../../../../services/ElevationService';
import { Coordinates3D } from '../../Types/GridAnalysisTypes';
import { Marker } from '../../../../context/MarkerContext';
import { getLOSProfile } from '../../Utils/GridAnalysisCore';
import { layerManager, MAP_LAYERS } from '../../../../services/LayerManager';

// ======== Type Definitions ========

export interface VisibilitySegment {
  coordinates: [number, number, number][];
  isVisible: boolean;
  visibleFromStations?: number[];
}

export interface FlightPathVisibilityResult {
  segments: VisibilitySegment[];
  stats: {
    totalLength: number;
    visibleLength: number;
    coveragePercentage: number;
    analysisTime: number;
    stationStats?: {
      stationType: 'gcs' | 'observer' | 'repeater';
      visibleLength: number;
      coveragePercentage: number;
    }[];
  };
}

export interface VisibilityAnalysisOptions {
  sampleInterval?: number;
  minimumOffset?: number;
  onProgress?: (progress: number) => void;
}

// ======== Main Analysis Function ========

/**
 * Simplified flight path visibility analysis that uses processed data
 */
export async function analyzeFlightPathVisibility(
  map: mapboxgl.Map,
  processedFlightPlan: FlightPlanData,
  processedMarkers: Marker[],
  elevationService: ElevationService | null,
  options: VisibilityAnalysisOptions = {}
): Promise<FlightPathVisibilityResult> {
  const startTime = performance.now();
  const { minimumOffset = 1, onProgress = () => {} } = options;
  
  // 1. Validate inputs
  if (!processedFlightPlan?.features?.length || 
      processedFlightPlan.features[0]?.geometry?.type !== 'LineString') {
    throw new Error('Invalid flight plan: must contain a LineString feature');
  }
  
  if (!processedMarkers.length) {
    throw new Error('At least one station is required for analysis');
  }
  
  onProgress(10);
  
  // 2. Extract processed coordinates (already absolute altitudes)
  const coordinates = processedFlightPlan.features[0].geometry.coordinates as [number, number, number][];
  console.log(`🔧 Using ${coordinates.length} processed coordinates (first 3):`, coordinates.slice(0, 3));
  
  // 3. Extract processed station positions (already terrain + offset)
  const stationPositions: Coordinates3D[] = processedMarkers.map(marker => {
    // Fixed: Handle potential null elevation with fallback to 0
    const finalElevation = (marker.location.elevation ?? 0) + marker.elevationOffset;
    
    console.log(`🎯 Station ${marker.type.toUpperCase()}: [${marker.location.lng}, ${marker.location.lat}, ${finalElevation}m]`);
    
    return [marker.location.lng, marker.location.lat, finalElevation];
  });
  
  onProgress(30);
  
  // 4. Sample coordinates at specified interval if needed
  // Needed for relative/absolute modes that aren't densified
  const coordinatesToCheck = options.sampleInterval ? 
    await sampleCoordinates(coordinates, options.sampleInterval) : 
    coordinates;
    
  onProgress(50);
  
  // 5. Check visibility for each coordinate against each station
  const visibilityData = await checkVisibilityBatch(
    map,
    coordinatesToCheck,
    stationPositions,
    minimumOffset,
    elevationService,
    (progress) => onProgress(50 + progress * 0.4)
  );
  
  onProgress(90);
  
  // 6. Create segments from visibility data
  const segments = createVisibilitySegments(coordinatesToCheck, visibilityData);
  
  // 7. Calculate statistics
  const stats = calculateStats(segments, processedMarkers, performance.now() - startTime);
  
  onProgress(100);
  
  console.log(`📊 SIMPLIFIED ANALYSIS: ${segments.filter(s => s.isVisible).length}/${segments.length} segments visible (${stats.coveragePercentage.toFixed(1)}%)`);
  
  return { segments, stats };
}

// ======== Helper Functions ========

/**
 * Sample coordinates at specified interval using turf
 * Needed for relative/absolute modes that aren't densified by the processor
 */
async function sampleCoordinates(
  coordinates: [number, number, number][],
  interval: number
): Promise<[number, number, number][]> {
  const line = turf.lineString(coordinates.map(c => [c[0], c[1]]));
  const length = turf.length(line, { units: 'meters' });
  const samples: [number, number, number][] = [];
  
  for (let distance = 0; distance <= length; distance += interval) {
    const point = turf.along(line, distance, { units: 'meters' });
    // Interpolate altitude
    const totalDistance = length;
    const fraction = distance / totalDistance;
    const segmentIndex = Math.floor(fraction * (coordinates.length - 1));
    const altitude = coordinates[segmentIndex]?.[2] || coordinates[0][2];
    
    samples.push([
      point.geometry.coordinates[0],
      point.geometry.coordinates[1],
      altitude
    ]);
  }
  
  return samples;
}

/**
 * Check visibility for all coordinates against all stations
 */
async function checkVisibilityBatch(
  map: mapboxgl.Map,
  coordinates: [number, number, number][],
  stationPositions: Coordinates3D[],
  minimumOffset: number,
  elevationService: ElevationService | null,
  onProgress: (progress: number) => void
): Promise<boolean[][]> {
  const results: boolean[][] = [];
  
  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    // Use processed altitude directly (no pre-adding of minimumOffset)
    const targetPosition: Coordinates3D = [
      coord[0], 
      coord[1], 
      coord[2]
    ];
    
    const stationResults: boolean[] = [];
    
    for (const stationPos of stationPositions) {
      // Use the proven getLOSProfile function with correct minimumOffset handling
      const { clear } = await getLOSProfile(
        map,
        stationPos,
        targetPosition,
        {
          sampleDistance: 10,
          minimumOffset: minimumOffset, // Fixed: Pass actual minimumOffset value
          elevationService
        }
      );
      
      stationResults.push(clear);
    }
    
    results.push(stationResults);
    
    // Report progress
    onProgress((i / coordinates.length) * 100);
  }
  
  return results;
}

/**
 * Create visibility segments from coordinate and visibility data
 */
function createVisibilitySegments(
  coordinates: [number, number, number][],
  visibilityData: boolean[][]
): VisibilitySegment[] {
  const segments: VisibilitySegment[] = [];
  let currentSegment: VisibilitySegment | null = null;
  
  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    const visibleStations = visibilityData[i]
      .map((isVisible, stationIdx) => isVisible ? stationIdx : -1)
      .filter(idx => idx >= 0);
    
    const isVisible = visibleStations.length > 0;
    
    // Start new segment if visibility changed
    if (!currentSegment || currentSegment.isVisible !== isVisible) {
      if (currentSegment && currentSegment.coordinates.length >= 2) {
        segments.push(currentSegment);
      }
      
      currentSegment = {
        coordinates: [coord],
        isVisible,
        visibleFromStations: visibleStations
      };
    } else {
      currentSegment.coordinates.push(coord);
      
      // Merge visible stations
      if (isVisible && currentSegment.visibleFromStations) {
        const allStations = new Set([...currentSegment.visibleFromStations, ...visibleStations]);
        currentSegment.visibleFromStations = Array.from(allStations);
      }
    }
  }
  
  // Add final segment
  if (currentSegment && currentSegment.coordinates.length >= 2) {
    segments.push(currentSegment);
  }
  
  return segments;
}

/**
 * Calculate analysis statistics
 */
function calculateStats(
  segments: VisibilitySegment[],
  markers: Marker[],
  analysisTime: number
): FlightPathVisibilityResult['stats'] {
  let totalLength = 0;
  let visibleLength = 0;
  
  for (const segment of segments) {
    if (segment.coordinates.length >= 2) {
      const line = turf.lineString(segment.coordinates.map(c => [c[0], c[1]]));
      const length = turf.length(line, { units: 'meters' });
      totalLength += length;
      
      if (segment.isVisible) {
        visibleLength += length;
      }
    }
  }
  
  const stationStats = markers.map(marker => ({
    stationType: marker.type,
    visibleLength: visibleLength, // Simplified - could be per-station
    coveragePercentage: totalLength > 0 ? (visibleLength / totalLength) * 100 : 0
  }));
  
  return {
    totalLength,
    visibleLength,
    coveragePercentage: totalLength > 0 ? (visibleLength / totalLength) * 100 : 0,
    analysisTime,
    stationStats
  };
}

/**
 * Add visibility layer to map (unchanged)
 */
export function addVisibilityLayer(
  map: mapboxgl.Map,
  segments: VisibilitySegment[],
  layerId: string = MAP_LAYERS.FLIGHT_PATH_VISIBILITY
): void {
  // Remove existing layer
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(layerId)) map.removeSource(layerId);
  
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
  
  map.addSource(layerId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  });
  
  map.addLayer({
    id: layerId,
    type: 'line',
    source: layerId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['case', ['==', ['get', 'isVisible'], true], '#4CAF50', '#d32f2f'],
      'line-width': 5,
      'line-dasharray': ['case', ['==', ['get', 'isVisible'], true], [1, 0], [2, 2]]
    }
  });
  
  layerManager.registerLayer(layerId, true);
}

export function removeVisibilityLayer(
  map: mapboxgl.Map,
  layerId: string = MAP_LAYERS.FLIGHT_PATH_VISIBILITY
): void {
  layerManager.removeLayer(layerId);
}