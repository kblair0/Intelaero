"use client";
import { useCallback, useState } from 'react';
import * as turf from '@turf/turf';
import { FlightPlanData, WaypointData } from '../../../context/FlightPlanContext';
import { useMapContext } from '../../../context/mapcontext';

/**
 * Hook to process flight plans, integrating elevation data using ElevationService.
 * @returns Functions and state for processing flight plans.
 */
export const useFlightPlanProcessor = () => {
  const { map, elevationService } = useMapContext();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Processes a flight plan by resolving altitudes with terrain data.
   * @param flightPlan - The flight plan data to process.
   * @returns The processed flight plan with updated coordinates.
   */
  const processFlightPlan = useCallback(async (
    flightPlan: FlightPlanData
  ): Promise<FlightPlanData> => {
    console.log('processFlightPlan: entry');
    if (!map || !elevationService) {
      console.error('processFlightPlan: Map or elevation service not available');
      throw new Error('Map or elevation service not available');
    }
    if (flightPlan.properties?.processed) {
      console.log('processFlightPlan: Flight plan already processed, skipping');
      return flightPlan;
    }

    console.log('processFlightPlan: Starting flight plan processing');
    setIsProcessing(true);
    setError(null);

    try {
      console.log('processFlightPlan: Ensuring terrain ready');
      await elevationService.ensureTerrainReady();
      console.log('processFlightPlan: Terrain ready');

      const newPlan: FlightPlanData = structuredClone(flightPlan);
      console.log('processFlightPlan: Cloned flight plan');

      const coordinates = newPlan.features[0].geometry.coordinates;
      console.log('processFlightPlan: Original coordinates:', coordinates.map(c => ({
        lng: c[0].toFixed(6),
        lat: c[1].toFixed(6),
        alt: c[2].toFixed(1)
      })));

      console.log('processFlightPlan: Preloading area');
      await elevationService.preloadArea(coordinates);
      console.log('processFlightPlan: Area preloaded');

      console.log('processFlightPlan: Fetching home terrain elevation');
      const homeTerrainElev = await elevationService.getElevation(
        newPlan.properties.homePosition.longitude,
        newPlan.properties.homePosition.latitude
      );
      console.log(`processFlightPlan: Home terrain elevation = ${homeTerrainElev.toFixed(1)}m`);

      // altitude resolver
      const resolveAltitude = async (
        wp: WaypointData,
        coord: [number, number, number],
        homeElev: number
      ): Promise<number> => {
        const [lon, lat, origAlt] = coord;
        const terrainElev = wp.altitudeMode === 'terrain' || wp.altitudeMode === 'relative'
          ? await elevationService.getElevation(lon, lat)
          : homeElev;

        switch (wp.altitudeMode) {
          case 'terrain': {
            const alt = terrainElev + (wp.originalAltitude ?? origAlt);
            console.log(`processFlightPlan: terrain mode at [${lon},${lat}] => ${alt.toFixed(1)}`);
            return alt;
          }
          case 'relative': {
            const relAlt = terrainElev + (wp.originalAltitude ?? origAlt);
            console.log(`processFlightPlan: relative mode at [${lon},${lat}] => ${relAlt.toFixed(1)}`);
            return relAlt;
          }
          case 'absolute': {
            const absAlt = wp.originalAltitude ?? origAlt;
            console.log(`processFlightPlan: absolute mode at [${lon},${lat}] => ${absAlt.toFixed(1)}`);
            return absAlt;
          }
          default:
            console.warn(`processFlightPlan: Unknown altitude mode at [${lon},${lat}]`);
            return terrainElev;
        }
      };

      console.log('processFlightPlan: Segmenting waypoints');
      const waypoints = newPlan.features[0].properties.waypoints;
      const segments: Array<Array<{ waypoint: WaypointData; coordinate: [number, number, number] }>> = [];
      let currentSegment: Array<{ waypoint: WaypointData; coordinate: [number, number, number] }> = [];

      waypoints.forEach(wp => {
        const coord = coordinates[wp.index];
        if (!coord) return;
        const item = { waypoint: wp, coordinate: coord };
        if (
          currentSegment.length &&
          wp.altitudeMode !== currentSegment[currentSegment.length - 1].waypoint.altitudeMode
        ) {
          segments.push(currentSegment);
          currentSegment = [item];
        } else {
          currentSegment.push(item);
        }
      });
      if (currentSegment.length) segments.push(currentSegment);
      console.log(`processFlightPlan: Built ${segments.length} segments`);

      const processedCoords: [number, number, number][] = [];
      const originalCoords: [number, number, number][] = [];

      console.log('processFlightPlan: Processing each segment');
      for (const segment of segments) {
        const mode = segment[0].waypoint.altitudeMode;
        console.log(`processFlightPlan: Segment mode="${mode}" length=${segment.length}`);

        if (mode === 'terrain') {
          console.log('processFlightPlan: Densifying terrain segment');
          const densified = await densifyTerrainSegment(
            segment.map(item => item.coordinate),
            segment.map(item => item.waypoint)
          );
          console.log(`processFlightPlan: Densified to ${densified.length} points`);
          processedCoords.push(...densified);
          // record original for logging
          segment.forEach(({ waypoint, coordinate }) => {
            resolveAltitude(waypoint, coordinate, homeTerrainElev).then(a =>
              console.log(`processFlightPlan: original point [${coordinate[0]},${coordinate[1]}] alt=${a.toFixed(1)}`)
            );
            originalCoords.push([coordinate[0], coordinate[1], coordinate[2]]);
          });
        } else {
          console.log('processFlightPlan: Handling non-terrain segment');
          for (const { waypoint, coordinate } of segment) {
            const resolvedAlt = await resolveAltitude(waypoint, coordinate, homeTerrainElev);
            console.log(`processFlightPlan: resolved non-terrain at [${coordinate[0]},${coordinate[1]}] => ${resolvedAlt.toFixed(1)}`);
            processedCoords.push([coordinate[0], coordinate[1], resolvedAlt]);
            originalCoords.push([coordinate[0], coordinate[1], resolvedAlt]);
          }
        }
      }
      console.log(`processFlightPlan: Total processed coords=${processedCoords.length}`);

      console.log('processFlightPlan: Calculating distances');
      let totalDistance = 0;
      const waypointDistances: number[] = [0];
      for (let i = 1; i < processedCoords.length; i++) {
        const line = turf.lineString([
          processedCoords[i - 1].slice(0, 2),
          processedCoords[i].slice(0, 2)
        ]);
        totalDistance += turf.length(line, { units: 'kilometers' });
        waypointDistances.push(totalDistance);
      }
      console.log(`processFlightPlan: Total distance=${totalDistance.toFixed(3)}km`);

      console.log('processFlightPlan: Finalizing flight plan');
      newPlan.properties.homePosition.altitude = await resolveAltitude(
        waypoints[0],
        coordinates[0],
        homeTerrainElev
      );
      newPlan.properties.totalDistance = totalDistance;
      newPlan.properties.processed = true;
      newPlan.features[0].geometry.coordinates = processedCoords;
      newPlan.features[0].properties.originalCoordinates = originalCoords;
      newPlan.waypointDistances = processedCoords.map((_, i) => waypointDistances[i] || totalDistance);

      setIsProcessing(false);
      console.log('processFlightPlan: Complete');
      return newPlan;
    } catch (err) {
      console.error('processFlightPlan: Error', err);
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to process flight plan: ' + msg);
      throw err;
    }
  }, [map, elevationService]);

  /**
   * Densifies a terrain-following segment by interpolating points every 10 meters.
   */
  const densifyTerrainSegment = useCallback(async (
    segmentCoords: [number, number, number][],
    waypoints: WaypointData[]
  ): Promise<[number, number, number][]> => {
    if (!elevationService) throw new Error('Elevation service not available');
    if (segmentCoords.length < 2) return segmentCoords;

    const coords2D = segmentCoords.map(([lon, lat]) => [lon, lat]);
    const line = turf.lineString(coords2D);
    const cumDist: number[] = [0];
    for (let i = 1; i < segmentCoords.length; i++) {
      cumDist.push(cumDist[i - 1] + turf.distance(coords2D[i - 1], coords2D[i], { units: 'meters' }));
    }
    const totalLen = cumDist[cumDist.length - 1];
    const densified: [number, number, number][] = [];
    for (let d = 0; d <= totalLen; d += 10) {
      const pt = turf.along(line, d, { units: 'meters' });
      const [lon, lat] = pt.geometry.coordinates;
      // simple linear offset between endpoints
      const ratio = d / totalLen;
      const startAlt = waypoints[0].originalAltitude ?? segmentCoords[0][2];
      const endAlt   = waypoints[waypoints.length - 1].originalAltitude ?? segmentCoords[segmentCoords.length-1][2];
      const interp = startAlt + ratio * (endAlt - startAlt);
      const elev = await elevationService.getElevation(lon, lat);
      densified.push([lon, lat, elev + interp]);
    }
    return densified;
  }, [elevationService]);

  return { processFlightPlan, isProcessing, error, setError };
};
