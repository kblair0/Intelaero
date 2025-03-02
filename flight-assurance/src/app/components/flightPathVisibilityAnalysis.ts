// src/utils/flightPathVisibilityAnalysis.ts
import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { LocationData } from '../components/Map';
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
  elevationOffsets: {
    gcs: number;
    observer: number;
    repeater: number;
  },
  sampleInterval: number = 10
): Promise<FlightPathVisibilityResult> {
  const startTime = performance.now();
  
  console.log('Starting Flight Path Visibility Analysis:', {
    flightPlanFeatures: flightPlan.features.length,
    availableStations: Object.entries(stations).filter(([, loc]) => loc !== null).length,
    sampleInterval
  });

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

  // Create 2D line for distance calculation
  const line = turf.lineString(flightPath.geometry.coordinates.map(coord => [coord[0], coord[1]]));
  const length = turf.length(line, { units: 'meters' });
  
  console.log('Path analysis setup:', {
    pathLengthMeters: length,
    expectedSamples: Math.ceil(length / sampleInterval)
  });

    // Retrieve waypointDistances and initialize the pointer 
    const waypointDistances: number[] = flightPlan.waypointDistances;
    if (!waypointDistances || waypointDistances.length === 0) {
      console.error("Flight plan is missing waypoint distances.");
      throw new Error("Missing waypointDistances in flight plan");
    }
    const coords = flightPath.geometry.coordinates;
    // Initialize the pointer that tracks the current waypoint segment.
    let waypointIndex = 0;

  const samples: Array<{
    point: [number, number, number];
    isVisible: boolean;
  }> = [];

  // Get available stations
  const availableStations = Object.entries(stations)
  .filter(([, location]) => location !== null)
  .map(([type, location]) => ({
    type: type as 'gcs' | 'observer' | 'repeater',
    location,
    elevationOffset: elevationOffsets[type as 'gcs' | 'observer' | 'repeater']
  }));


  console.log('Available stations for analysis:', {
    count: availableStations.length,
    stations: availableStations.map(s => ({
      type: s.type,
      location: {
        lat: s.location.lat,
        lng: s.location.lng,
        elevation: s.location.elevation
      },
      offset: s.elevationOffset
    }))
  });

  const heightAnalysis = availableStations.map(station => ({
    stationType: station.type,
    samples: [] as {
      sampleIndex: number;
      distance: number;
      flightplanHeight: number;
      stationHeight: number;
      terrainHeight: number;
      deltaHeight: number;
    }[]
  }));

  // Sample points along the flight path
  let sampleCount = 0;
  for (let distance = 0; distance <= length; distance += sampleInterval) {
    try {
      const point = turf.along(line, distance / 1000, { units: 'kilometers' });
      const [lng, lat] = point.geometry.coordinates;
      // If the sample's distance is greater than or equal to the next waypoint distance, advance the pointer.
      while (
        waypointIndex < waypointDistances.length - 1 &&
        distance >= waypointDistances[waypointIndex + 1] * 1000
      ) {
        waypointIndex++;
      }
      // Use the altitude from the current waypoint. (Drone holds this altitude until next waypoint.)
      const currentAltitude = coords[waypointIndex][2];
      // Create the sample point with the correct altitude.
      const samplePoint: [number, number, number] = [lng, lat, currentAltitude];

      // Log heights every 10th sample
      if (sampleCount % 10 === 0) {
        const terrainHeight = map.queryTerrainElevation([lng, lat]) || 0;

        // Log heights for each station using elevationOffsets from context
        for (const { type, location, elevationOffset } of availableStations) {
          const stationHeight = (location.elevation || 0) + elevationOffset;
          const heightAnalysisPoint = {
            sampleIndex: sampleCount,
            distance: distance,
            flightplanHeight: currentAltitude,
            stationHeight: stationHeight,
            terrainHeight: terrainHeight,
            deltaHeight: currentAltitude - stationHeight
          };
          
          const stationAnalysis = heightAnalysis.find(a => a.stationType === type);
          if (stationAnalysis) {
            stationAnalysis.samples.push(heightAnalysisPoint);
          }
        }

      }

      if (sampleCount % 100 === 0) {
        console.log(`Processing sample ${sampleCount}:`, {
          distance,
          point: samplePoint,
          waypointIndex, 
          altitude: currentAltitude
        });
      }

      // Check visibility from any station using elevationOffsets from context
      let isVisibleFromAnyStation = false;
      for (const { location, elevationOffset } of availableStations) {
        const stationHeight = (location.elevation || 0) + elevationOffset;
        const stationPoint: [number, number, number] = [
          location.lng,
          location.lat,
          stationHeight,
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
      sampleCount++;
    } catch (error) {
      console.error('Error processing sample point:', {
        distance,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  console.log('Sample collection complete:', {
    totalSamples: samples.length,
    expectedSamples: Math.ceil(length / sampleInterval)
  });



  // Create segments
  const segments: VisibilitySegment[] = [];
  let currentSegment: VisibilitySegment | null = null;
  let segmentCount = 0;

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
    if (currentSegment.coordinates.length < 2) {
      console.warn('Invalid segment detected:', {
        segmentIndex: segmentCount,
        coordinateCount: currentSegment.coordinates.length,
        isVisible: currentSegment.isVisible,
        coordinates: currentSegment.coordinates
      });
      // Don't push invalid segments
    } else {
      segments.push(currentSegment);
      segmentCount++;
    }
    
    currentSegment = {
      coordinates: [samples[i-1].point, sample.point],
      isVisible: sample.isVisible
    };
  } else {
    currentSegment.coordinates.push(sample.point);
  }
}

// Handle final segment
if (currentSegment) {
  if (currentSegment.coordinates.length < 2) {
    console.warn('Final segment invalid:', {
      coordinateCount: currentSegment.coordinates.length,
      isVisible: currentSegment.isVisible,
      coordinates: currentSegment.coordinates
    });
    // Don't push invalid final segment
  } else {
    segments.push(currentSegment);
    segmentCount++;
  }
}

console.log('Segment creation complete:', {
  totalSegments: segments.length,
  segmentDetails: segments.map((seg, idx) => ({
    index: idx,
    coordinateCount: seg.coordinates.length,
    isVisible: seg.isVisible
  }))
});

  // Calculate visible length
  let visibleLength = 0;
  segments.forEach((segment, idx) => {
    if (segment.isVisible) {
      try {
        if (segment.coordinates.length < 2) {
          console.warn(`Skipping length calculation for invalid segment ${idx}`);
          return;
        }
        const segmentLine = turf.lineString(segment.coordinates.map(coord => [coord[0], coord[1]]));
        const segmentLength = turf.length(segmentLine, { units: 'meters' });
        visibleLength += segmentLength;
      } catch (error) {
        console.error('Error calculating segment length:', {
          segmentIndex: idx,
          coordinateCount: segment.coordinates.length,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  });

  const result = {
    segments,
    stats: {
      totalLength: length,
      visibleLength,
      coveragePercentage: (visibleLength / length) * 100,
      analysisTime: performance.now() - startTime
    }
  };

  console.log('Analysis complete:', {
    totalSegments: segments.length,
    stats: result.stats,
    processingTimeMs: result.stats.analysisTime
  });

  console.log('Height Analysis:', heightAnalysis);

  return result;
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

  // Create features with 2D coordinates
  const features: GeoJSON.Feature[] = segments
    .filter(segment => segment.coordinates.length >= 2)
    .map(segment => ({
      type: 'Feature',
      properties: {
        isVisible: segment.isVisible
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