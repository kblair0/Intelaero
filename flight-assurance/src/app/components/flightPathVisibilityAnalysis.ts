// src/utils/flightPathVisibilityAnalysis.ts
import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { LocationData } from '../components/Map';
import { MarkerConfigs } from '../context/LOSAnalysisContext';
import { FlightPlanData } from '../context/FlightPlanContext';

export interface VisibilitySegment {
  coordinates: [number, number, number][];
  isVisible: boolean;
}

export interface FlightPathVisibilityResult {
  segments: VisibilitySegment[];
  stats: {
    totalLength: number;
    visibleLength: number;
    coveragePercentage: number;
    analysisTime: number;
  };
}

async function checkLineOfSight(
  map: mapboxgl.Map,
  stationPoint: [number, number, number],
  flightPoint: [number, number, number]
): Promise<boolean> {
  const line = turf.lineString([
    [stationPoint[0], stationPoint[1]],
    [flightPoint[0], flightPoint[1]]
  ]);
  
  const distance = turf.length(line, { units: 'meters' });
  const samples = Math.ceil(distance / 10); // Sample every 10m along LOS path

  // Calculate the true 3D line between station and flight point
  const heightDiff = flightPoint[2] - stationPoint[2];
  
  for (let i = 0; i <= samples; i++) {
    const fraction = i / samples;
    const lng = stationPoint[0] + (flightPoint[0] - stationPoint[0]) * fraction;
    const lat = stationPoint[1] + (flightPoint[1] - stationPoint[1]) * fraction;
    
    // Calculate the expected height of our LOS line at this point
    const expectedHeight = stationPoint[2] + heightDiff * fraction;
    
    // Get the terrain height at this point
    const terrainElevation = map.queryTerrainElevation([lng, lat]) || 0;

    // If terrain is higher than our LOS line at this point, there's an obstruction
    if (terrainElevation > expectedHeight) {
      return false;
    }
  }
  
  return true;
}

export async function analyzeFlightPathVisibility(
  map: mapboxgl.Map,
  flightPlan: FlightPlanData,
  stations: {
    gcs: LocationData | null;
    observer: LocationData | null;
    repeater: LocationData | null;
  },
  markerConfigs: MarkerConfigs,
  sampleInterval: number = 10
): Promise<FlightPathVisibilityResult> {
  const startTime = performance.now();
  
  const flightPath = flightPlan.features[0];
  if (!flightPath?.geometry?.coordinates) {
    throw new Error("Invalid flight plan data");
  }

  // Create a line from the 2D coordinates for distance calculation
  const line = turf.lineString(flightPath.geometry.coordinates.map(coord => [coord[0], coord[1]]));
  const length = turf.length(line, { units: 'meters' });
  
  const samples: Array<{
    point: [number, number, number];
    isVisible: boolean;
  }> = [];

  // Get available stations
  const availableStations = Object.entries(stations)
    .filter(([_, location]): location is [string, NonNullable<LocationData>] => 
      location !== null
    )
    .map(([type, location]) => ({
      type: type as 'gcs' | 'observer' | 'repeater',
      location,
      config: markerConfigs[type as keyof MarkerConfigs]
    }));

  // Sample points along the flight path every 10m
  for (let distance = 0; distance <= length; distance += sampleInterval) {
    // Get the 2D point along the path
    const point = turf.along(line, distance / 1000, { units: 'kilometers' });
    const [lng, lat] = point.geometry.coordinates;
    
    // Find the current waypoint segment
    let currentWaypointIndex = 0;
    const coords = flightPath.geometry.coordinates;
    
    for (let i = 0; i < coords.length - 1; i++) {
      const segmentStart = turf.point([coords[i][0], coords[i][1]]);
      const segmentEnd = turf.point([coords[i + 1][0], coords[i + 1][1]]);
      const segment = turf.lineString([[coords[i][0], coords[i][1]], [coords[i + 1][0], coords[i + 1][1]]]);
      
      if (turf.booleanPointOnLine(point, segment)) {
        currentWaypointIndex = i;
        break;
      }
    }

    // Use the current waypoint's altitude (no interpolation)
    const currentAltitude = coords[currentWaypointIndex][2];
    
    const samplePoint: [number, number, number] = [lng, lat, currentAltitude];

    // Check visibility from any station
    let isVisibleFromAnyStation = false;
    
    for (const { location, config } of availableStations) {
      const stationPoint: [number, number, number] = [
        location.lng,
        location.lat,
        (location.elevation || 0) + config.elevationOffset
      ];

      if (await checkLineOfSight(map, stationPoint, samplePoint)) {
        isVisibleFromAnyStation = true;
        break;
      }
    }

    samples.push({
      point: samplePoint,
      isVisible: isVisibleFromAnyStation
    });
  }

  // Create segments
  const segments: VisibilitySegment[] = [];
  let currentSegment: VisibilitySegment | null = null;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    if (!currentSegment) {
      currentSegment = {
        coordinates: [sample.point],
        isVisible: sample.isVisible
      };
      continue;
    }

    if (currentSegment.isVisible !== sample.isVisible) {
      segments.push(currentSegment);
      currentSegment = {
        coordinates: [samples[i-1].point, sample.point],
        isVisible: sample.isVisible
      };
    } else {
      currentSegment.coordinates.push(sample.point);
    }
  }

  if (currentSegment) {
    segments.push(currentSegment);
  }

  // Calculate visible length
  let visibleLength = 0;
  segments.forEach(segment => {
    if (segment.isVisible) {
      const segmentLine = turf.lineString(segment.coordinates.map(coord => [coord[0], coord[1]]));
      visibleLength += turf.length(segmentLine, { units: 'meters' });
    }
  });

  return {
    segments,
    stats: {
      totalLength: length,
      visibleLength,
      coveragePercentage: (visibleLength / length) * 100,
      analysisTime: performance.now() - startTime
    }
  };
}

export function addVisibilityLayer(
  map: mapboxgl.Map, 
  segments: VisibilitySegment[],
  layerId: string = 'flight-path-visibility'
): void {
  // Remove existing layer and source
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(layerId)) {
    map.removeSource(layerId);
  }

  // Create features
  const features: GeoJSON.Feature[] = segments.map(segment => ({
    type: 'Feature',
    properties: {
      isVisible: segment.isVisible
    },
    geometry: {
      type: 'LineString',
      coordinates: segment.coordinates
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
      'line-width': 4,
      'line-dasharray': [
        'case',
        ['==', ['get', 'isVisible'], true],
        [1, 0],     // Solid line for visible
        [2, 2]      // Dashed for not visible
      ]
    }
  });
}