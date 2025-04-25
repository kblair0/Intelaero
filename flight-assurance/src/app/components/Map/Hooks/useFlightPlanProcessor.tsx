// src/components/Map/Hooks/useFlightPlanProcessor.tsx
"use client";
import { useCallback, useState } from 'react';
import * as turf from '@turf/turf';
import { FlightPlanData, WaypointData } from '../../../context/FlightPlanContext';
import { useMapContext } from '../../../context/mapcontext';
import { useAreaOpsProcessor } from '../../AO/Hooks/useAreaOpsProcessor';
import { 
  getReliableTerrainElevations, 
  ensureDEMLoaded, clearElevationCache,
  preloadTiles,
} from '../../../utils/TerrainUtils';

/**
 * Hook to process flight plans, integrating elevation data using direct map queries.
 * Uses a two-stage approach to handle elevation loading race conditions.
 * @returns Functions and state for processing flight plans.
 */
export const useFlightPlanProcessor = () => {
  const { map } = useMapContext();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { generateAOFromFlightPlan } = useAreaOpsProcessor();

  /**
   * Updates a flight plan with real terrain elevations
   */
/**
 * Updates a flight plan with real terrain elevations
 */
const updateFlightPlanElevations = async (plan: FlightPlanData): Promise<FlightPlanData> => {
  if (!map) throw new Error('Map not initialized');
  
  console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Updating flight plan with real elevations...`);
  
  const updatedPlan = structuredClone(plan);
  const coordinates = updatedPlan.features[0].geometry.coordinates as [number, number, number][];
  const waypoints = updatedPlan.features[0].properties.waypoints;
  
  // Extract 2D coordinates for all points
  const coords2D = coordinates.map(coord => [coord[0], coord[1]] as [number, number]);
  
  // Get home position
  const homeLngLat: [number, number] = [
    updatedPlan.properties.homePosition.longitude,
    updatedPlan.properties.homePosition.latitude
  ];
  
  const allCoords = [homeLngLat, ...coords2D];
  
  // Clear cache to avoid stale values
  clearElevationCache();
  
  // Preload tiles
  await preloadTiles(map, allCoords);
  
  // Use dynamic test points
  await ensureDEMLoaded(map, allCoords.slice(0, 3));
  
  const elevations = await getReliableTerrainElevations(map, allCoords, 
    (progress) => console.log(`Elevation update progress: ${progress}%`)
  );
  
  // Log elevations for debugging
  console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Elevations:`, elevations);
  
  const homeTerrainElev = elevations[0];
  console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Home terrain elevation = ${homeTerrainElev.toFixed(1)}m`);
  if (homeTerrainElev <= -0.5) {
    console.warn(`[${new Date().toISOString()}] [FlightPlanProcessor] Invalid home elevation (${homeTerrainElev.toFixed(1)}m), possible DEM query failure`);
  }
  
  const waypointElevations = elevations.slice(1);
  
  // Group waypoints by altitude mode
  const segments: Array<Array<{ waypoint: WaypointData; coordinate: [number, number, number]; elevation: number }>> = [];
  let currentSegment: Array<{ waypoint: WaypointData; coordinate: [number, number, number]; elevation: number }> = [];
  
  waypoints.forEach((wp, idx) => {
    if (idx >= coordinates.length) return;
    
    const coord = coordinates[idx];
    const elevation = waypointElevations[idx];
    const item = { waypoint: wp, coordinate: coord, elevation };
    
    if (currentSegment.length && 
        wp.altitudeMode !== currentSegment[currentSegment.length - 1].waypoint.altitudeMode) {
      segments.push(currentSegment);
      currentSegment = [item];
    } else {
      currentSegment.push(item);
    }
  });
  
  if (currentSegment.length) segments.push(currentSegment);
  console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Built ${segments.length} segments with real elevations`);
  
  const processedCoords: [number, number, number][] = [];
  const originalCoords: [number, number, number][] = [];
  
  // Process each segment
  for (const segment of segments) {
    const mode = segment[0].waypoint.altitudeMode;
    
    if (mode === 'terrain') {
      console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Processing terrain segment with real elevations`);
      
      // For terrain mode, densify the segment
      const densified = await densifyTerrainSegment(
        segment.map(item => item.coordinate),
        segment.map(item => item.waypoint),
        segment.map(item => item.elevation)
      );
      
      processedCoords.push(...densified);
      
      // Original coordinates just need the elevation added
      for (const { waypoint, coordinate, elevation } of segment) {
        const alt = elevation + waypoint.originalAltitude;
        originalCoords.push([coordinate[0], coordinate[1], alt]);
        console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Original point [${coordinate[0]}, ${coordinate[1]}] alt=${alt.toFixed(1)}`);
      }
    } else if (mode === 'relative') {
      console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Processing relative segment with real elevations`);
      
      // For relative mode, add terrain elevation to waypoint altitude
      for (const { waypoint, coordinate, elevation } of segment) {
        const alt = elevation + waypoint.originalAltitude;
        processedCoords.push([coordinate[0], coordinate[1], alt]);
        originalCoords.push([coordinate[0], coordinate[1], alt]);
      }
    } else {
      console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Processing absolute segment`);
      
      // For absolute mode, just use the waypoint altitude
      for (const { waypoint, coordinate } of segment) {
        const alt = waypoint.originalAltitude;
        processedCoords.push([coordinate[0], coordinate[1], alt]);
        originalCoords.push([coordinate[0], coordinate[1], alt]);
      }
    }
  }
  
  // We'll keep the same distances from the placeholder version
  const waypointDistances = plan.waypointDistances || [];
  const originalWaypointDistances = plan.originalWaypointDistances || [];
  
  // Update flight plan
  updatedPlan.properties.homePosition.altitude = homeTerrainElev + 
    (waypoints[0]?.originalAltitude || 0);
  
  updatedPlan.properties.processed = true;
  updatedPlan.properties.placeholder = false; // No longer using placeholders
  updatedPlan.features[0].geometry.coordinates = processedCoords;
  updatedPlan.features[0].properties.originalCoordinates = originalCoords;
  updatedPlan.waypointDistances = waypointDistances;
  updatedPlan.originalWaypointDistances = originalWaypointDistances;
  
  return updatedPlan;
};

  /**
   * Processes a flight plan by resolving altitudes with terrain data.
   * Uses a two-stage approach to handle DEM loading race conditions.
   * @param flightPlan - The flight plan data to process.
   * @returns The processed flight plan with updated coordinates.
   */
  const processFlightPlan = useCallback(async (
    flightPlan: FlightPlanData
  ): Promise<FlightPlanData> => {
    if (!map) {
      console.error('processFlightPlan: Map not initialized');
      throw new Error('Map not initialized');
    }
    
    if (flightPlan.properties?.processed) {
      return flightPlan;
    }
    
    console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Starting two-stage flight plan processing`);
    setIsProcessing(true);
    setError(null);
    
    try {
      // STAGE 1: Initial load with placeholder elevations
      console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] STAGE 1 - Initial load with placeholders`);
      const newPlan: FlightPlanData = structuredClone(flightPlan);
      const coordinates = newPlan.features[0].geometry.coordinates as [number, number, number][];
      const waypoints = newPlan.features[0].properties.waypoints;
      
      // Apply placeholder elevation of 25m for each coordinate
      // This is a reasonable default for urban areas like Sydney
      const PLACEHOLDER_ELEVATION = 25;
      
      const processedCoords: [number, number, number][] = [];
      const originalCoords: [number, number, number][] = [];
      
      // Process waypoints with placeholder elevations
      waypoints.forEach((wp, idx) => {
        if (idx >= coordinates.length) return;
        
        const coord = coordinates[idx];
        const [lon, lat, originalAlt] = coord;
        
        let altitude = wp.originalAltitude;
        if (wp.altitudeMode === 'terrain' || wp.altitudeMode === 'relative') {
          // For terrain/relative modes, add placeholder elevation
          altitude = PLACEHOLDER_ELEVATION + originalAlt;
        }
        
        processedCoords.push([lon, lat, altitude]);
        originalCoords.push([lon, lat, altitude]);
      });
      
      // Calculate distances (same as before)
      let totalDistance = 0;
      const waypointDistances: number[] = [0];
      
      for (let i = 1; i < processedCoords.length; i++) {
        const line = turf.lineString([
          processedCoords[i - 1].slice(0, 2),
          processedCoords[i].slice(0, 2)
        ]);
        
        totalDistance += turf.length(line, { units: 'kilometers' });
        waypointDistances.push(totalDistance * 1000); // Convert to meters
      }
      
      // Update flight plan with placeholder data
      newPlan.properties.homePosition.altitude = PLACEHOLDER_ELEVATION + 
        (waypoints[0]?.originalAltitude || 0);
      
      newPlan.properties.totalDistance = totalDistance;
      newPlan.properties.processed = true; // Mark as processed so we don't repeat Stage 1
      newPlan.properties.placeholder = true; // Mark that this is placeholder data
      newPlan.features[0].geometry.coordinates = processedCoords;
      newPlan.features[0].properties.originalCoordinates = originalCoords;
      newPlan.waypointDistances = waypointDistances;
      newPlan.originalWaypointDistances = [...waypointDistances];
      
      // Generate AO with placeholder data
      try {
        await generateAOFromFlightPlan(newPlan, false);
      } catch (aoError) {
        console.warn(`[${new Date().toISOString()}] [FlightPlanProcessor] Failed to generate AO with placeholder data`, aoError);
      }
      
      // STAGE 2: Update with real elevations in the background
      console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] STAGE 2 - Starting terrain elevation update`);
      
      // Ensure DEM is properly loaded before proceeding
      await ensureDEMLoaded(map);
      
      // Now get accurate elevations and update the plan
      const updatedPlan = await updateFlightPlanElevations(newPlan);
      
      // Generate AO with real data
      try {
        await generateAOFromFlightPlan(updatedPlan, false);
      } catch (aoError) {
        console.warn(`[${new Date().toISOString()}] [FlightPlanProcessor] Failed to generate AO with real elevations`, aoError);
      }
      
      console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Complete with real elevations`);
      return updatedPlan;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [FlightPlanProcessor] Error`, err);
      setError('Failed to process flight plan: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [map, generateAOFromFlightPlan]);

  /**
   * Densifies a terrain-following segment by interpolating points.
   */
  const densifyTerrainSegment = async (
    segmentCoords: [number, number, number][],
    waypoints: WaypointData[],
    elevations: number[]
  ): Promise<[number, number, number][]> => {
    if (!map) throw new Error('Map not initialized');
    if (segmentCoords.length < 2) return segmentCoords;
    
    const coords2D = segmentCoords.map(([lon, lat]) => [lon, lat]);
    const line = turf.lineString(coords2D);
    const cumDist: number[] = [0];
    
    for (let i = 1; i < segmentCoords.length; i++) {
      cumDist.push(cumDist[i - 1] + turf.distance(coords2D[i - 1], coords2D[i], { units: 'meters' }));
    }
    
    const totalLen = cumDist[cumDist.length - 1];
    const step = 10; // 10 meter steps
    const densified: [number, number, number][] = [];
    
    const points: [number, number][] = [];
    for (let d = 0; d <= totalLen; d += step) {
      const pt = turf.along(line, d, { units: 'meters' });
      points.push(pt.geometry.coordinates as [number, number]);
    }
    
    // Clear cache to avoid stale values
    clearElevationCache();
    
    // Preload tiles
    await preloadTiles(map, points);
    
    // Use dynamic test points
    await ensureDEMLoaded(map, points.slice(0, 3));
    
    const interpElevations = await getReliableTerrainElevations(map, points);
    
    // Log elevations for debugging
    console.log(`[${new Date().toISOString()}] [FlightPlanProcessor] Interpolated elevations:`, interpElevations);
    
    // Add terrain and waypoint altitude
    for (let i = 0; i < points.length; i++) {
      const [lon, lat] = points[i];
      const elev = interpElevations[i];
      
      // Interpolate waypoint altitude
      let waypointAlt = waypoints[0].originalAltitude;
      if (waypoints.length > 1) {
        const d = i * step;
        const segmentIdx = cumDist.findIndex(cd => cd > d) - 1;
        const idx = Math.max(0, segmentIdx);
        const nextIdx = Math.min(waypoints.length - 1, idx + 1);
        
        if (idx === nextIdx) {
          waypointAlt = waypoints[idx].originalAltitude;
        } else {
          const segStart = cumDist[idx];
          const segEnd = cumDist[nextIdx];
          const ratio = (d - segStart) / (segEnd - segStart);
          waypointAlt = waypoints[idx].originalAltitude + 
            ratio * (waypoints[nextIdx].originalAltitude - waypoints[idx].originalAltitude);
        }
      }
      
      densified.push([lon, lat, elev + waypointAlt]);
    }
    
    return densified;
  };

  return { 
    processFlightPlan, 
    generateAOFromFlightPlan, 
    isProcessing, 
    error, 
    setError
  };
};