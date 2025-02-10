import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';

// --- Enhanced Type Definitions ---
export type Coordinates2D = [number, number];
export type Coordinates3D = [number, number, number];

export interface StationLOSResult {
  clear: boolean;                   
  obstructionFraction?: number;     
  obstructionDistance?: number;     
}

// New type for LOS profile data
export interface LOSProfilePoint {
  distance: number; // meters along the LOS line
  terrain: number;  // terrain elevation at that point (m)
  los: number;      // ideal LOS altitude at that point (m)
}

/**
 * Performs a station-to-station LOS check between two effective 3D points.
 *
 * @param map - The Mapbox GL map instance.
 * @param station1 - Effective 3D coordinates [lng, lat, altitude] for the first station.
 * @param station2 - Effective 3D coordinates [lng, lat, altitude] for the second station.
 * @param queryTerrainElevation - A function returning a Promise that resolves to the terrain elevation (in meters) for given [lng, lat].
 *
 * @returns A promise that resolves with a StationLOSResult.
 */
export async function checkStationToStationLOS(
  map: mapboxgl.Map,
  station1: Coordinates3D,
  station2: Coordinates3D,
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>
): Promise<StationLOSResult> {
  console.log("[LOS Check] Invoked with station1:", station1, "station2:", station2);

  const MINIMUM_OFFSET = 3;

  // Calculate the total distance between the two stations.
  const point1 = turf.point([station1[0], station1[1]]);
  const point2 = turf.point([station2[0], station2[1]]);
  const lineDistance = turf.distance(point1, point2, { units: 'meters' });

  console.log(`[LOS Check] Total distance: ${lineDistance.toFixed(2)} m`);

  // 10m Samples
  const sampleCount = Math.ceil(lineDistance / 10);

  // Iterate along the line from station1 to station2.
  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;
    const lng = station1[0] + fraction * (station2[0] - station1[0]);
    const lat = station1[1] + fraction * (station2[1] - station1[1]);

    // Calculate the interpolated LOS altitude at this sample point.
    const interpolatedAltitude = station1[2] - ((station1[2] - (station2[2] + MINIMUM_OFFSET)) * fraction);

    // Get terrain elevation.
    const terrainHeight = await queryTerrainElevation([lng, lat]);

    if (terrainHeight > interpolatedAltitude) {
      console.log(`[LOS Check] Obstruction detected at sample ${i} (fraction: ${fraction.toFixed(2)})`);
      return {
        clear: false,
        obstructionFraction: fraction,
        obstructionDistance: fraction * lineDistance,
      };
    }
  }

  console.log("[LOS Check] LOS is clear between the two stations.");
  return { clear: true };
}

/**
 * Generates LOS profile data along the line between two stations.
 *
 * @param station1 - Effective 3D coordinates [lng, lat, altitude] for the first station.
 * @param station2 - Effective 3D coordinates [lng, lat, altitude] for the second station.
 * @param queryTerrainElevation - Function returning a Promise<number> for given [lng, lat].
 * @param sampleInterval - Distance between samples (default: 10m).
 *
 * @returns A promise that resolves with an array of LOSProfilePoint.
 */
export async function getLOSProfile(
  station1: Coordinates3D,
  station2: Coordinates3D,
  queryTerrainElevation: (coords: Coordinates2D) => Promise<number>,
  sampleInterval: number = 10
): Promise<LOSProfilePoint[]> {
  const MINIMUM_OFFSET = 3;
  const point1 = turf.point([station1[0], station1[1]]);
  const point2 = turf.point([station2[0], station2[1]]);
  const totalDistance = turf.distance(point1, point2, { units: 'meters' });
  const sampleCount = Math.ceil(totalDistance / sampleInterval);
  const profile: LOSProfilePoint[] = [];

  for (let i = 0; i <= sampleCount; i++) {
    const fraction = i / sampleCount;
    const lng = station1[0] + fraction * (station2[0] - station1[0]);
    const lat = station1[1] + fraction * (station2[1] - station1[1]);
    const losAltitude = station1[2] - ((station1[2] - (station2[2] + MINIMUM_OFFSET)) * fraction);
    const terrain = await queryTerrainElevation([lng, lat]);

    profile.push({
      distance: fraction * totalDistance,
      terrain,
      los: losAltitude,
    });
  }
  return profile;
}
