/**
 * ObstacleAnalysisContext.tsx
 * 
 * Purpose:
 * Provides a context for obstacle analysis functionality, including state management
 * and methods for running terrain clearance analysis. This context serves as the
 * data layer for the obstacle analysis feature.
 * 
 * Related Files:
 * - ObstacleChart.tsx: Visualizes the analysis results
 * - ObstacleAnalysisDashboard.tsx: UI component using this context
 * - ObstacleChartModal.tsx: Modal dialog showing the chart
 * - useFlightPathSampling.ts: Utility for generating sample points
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useMapContext } from './mapcontext';
import { useFlightPlanContext } from './FlightPlanContext';
import { useAreaOfOpsContext } from './AreaOfOpsContext';
import { sampleFlightPath } from '../hooks/useFlightPathSampling';
import * as turf from '@turf/turf';
import { GridCell } from './AreaOfOpsContext';

/**
 * Interface for sample points used in analysis
 */
interface SamplePoint {
  position: [number, number, number];
  distanceFromStart: number;
  flightElevation: number;
  terrainElevation: number;
  clearance: number;
}

/**
 * Interface for a point of interest in the analysis
 */
export interface PointOfInterest {
  type: 'waypoint' | 'collision' | 'minimumClearance' | 'custom';
  distance: number;                // Distance along route (km)
  elevation: number;               // Elevation (meters) 
  clearance?: number;              // Optional, used for collision or minimumClearance
  label?: string;                  // Optional custom label
}

/**
 * Waypoint data for chart display
 */
export interface WaypointData {
  distance: number;                // Distance along route (km)
  label: string;                   // Waypoint label (e.g., "WP 1")
}

/**
 * Unified interface for terrain chart data
 */
export interface TerrainChartData {
  // Core chart data
  distances: number[];             // X-axis values (km)
  terrainElevations: number[];     // Terrain Y-values (meters)
  flightAltitudes: number[];       // Flight path Y-values (meters)
  
  // Analysis results
  minimumClearance: number;        // Minimum terrain clearance value (meters)
  criticalPointDistance: number | null; // Distance at which minimum clearance occurs (km)
  highestPoint: {                  // Highest point information
    terrain: number;               // Highest terrain elevation
    flight: number;                // Highest flight altitude
  };
  
  // Optional visualization enhancements
  waypoints?: WaypointData[];      // Waypoint markers
  pointsOfInterest?: PointOfInterest[]; // Special points (collisions, etc.)
}

/**
 * Interface for analysis options
 */
export interface AnalysisOptions {
  samplingResolution: number;
}

/**
 * Interface for analysis result
 */
export interface ObstacleAnalysisResult {
  samplePoints: SamplePoint[];
  minimumClearance: number;
  criticalPointDistance: number | null;
  highestObstacle: number;
  flightAltitudes: number[];
  terrainElevations: number[];
  distances: number[];
  pointsOfInterest: PointOfInterest[]; 
}

/**
 * Analysis status
 */
export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Interface for ObstacleAnalysisContext
 */
interface ObstacleAnalysisContextProps {
  status: AnalysisStatus;
  progress: number;
  error: string | null;
  results: ObstacleAnalysisResult | null;
  chartData: TerrainChartData | null;
  runAnalysis: (options?: Partial<AnalysisOptions>) => Promise<void>;
  runAOAnalysis: (gridCells: GridCell[]) => Promise<void>; 
  cancelAnalysis: () => void;
  clearResults: () => void;
}

/**
 * Default analysis options
 */
const defaultAnalysisOptions: AnalysisOptions = {
  samplingResolution: 10,
};

const ObstacleAnalysisContext = createContext<ObstacleAnalysisContextProps | null>(null);

/**
 * Provides obstacle analysis state and methods
 * @param children - React components to render within the provider
 */
export const ObstacleAnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { map, elevationService } = useMapContext();
  const { flightPlan, isProcessed, setFlightPlan } = useFlightPlanContext();
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ObstacleAnalysisResult | null>(null);
  const [chartData, setChartData] = useState<TerrainChartData | null>(null);
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>(defaultAnalysisOptions);
  const cancelAnalysisRef = useRef(false);
  const { aoTerrainGrid } = useAreaOfOpsContext();

/**
 * Converts analysis results to chart data format
 * @param result - The analysis result to convert
 * @returns The formatted chart data
 */
// In src/app/context/ObstacleAnalysisContext.tsx, replace generateChartData (around line 149):
const generateChartData = useCallback((result: ObstacleAnalysisResult): TerrainChartData => {
  const altitudeMode = flightPlan?.features[0]?.properties?.waypoints?.[0]?.altitudeMode ?? 'absolute';
  console.log(`Generating chart data for altitude mode: ${altitudeMode}`);
  
  const distancesInKm = result.distances.map(d => d / 1000);
  const highestTerrain = Math.max(...result.terrainElevations);
  const highestFlight = Math.max(...result.flightAltitudes);
  
  const waypoints: WaypointData[] = [];
  const pointsOfInterest: PointOfInterest[] = [];

  console.groupCollapsed('[generateChartData] Distance Sources and Units');
  console.log('Sampled Distances (meters, source: sampleFlightPath via result.distances):', result.distances);
  console.log('Sampled Distances (km, source: result.distances / 1000):', distancesInKm);

  if (flightPlan?.features?.[0]?.properties?.waypoints && flightPlan?.originalWaypointDistances) {
    const waypointData = flightPlan.features[0].properties.waypoints;
    const waypointDistances = flightPlan.originalWaypointDistances;

    console.log('Original Waypoints (source: flightPlan.properties.waypoints):', waypointData);
    console.log('Waypoint Distances (meters, source: flightPlan.originalWaypointDistances):', waypointDistances);
    console.log('Converted Waypoint Distances (km, source: waypointDistances / 1000):', waypointDistances.map(d => d / 1000));

    waypointData.forEach((wp, idx) => {
      if (idx < waypointDistances.length) {
        const distanceInKm = waypointDistances[idx] / 1000;
        const label = `WP ${idx + 1}`;
        const elevation = wp.originalAltitude;

        waypoints.push({
          distance: distanceInKm,
          label: label
        });

        pointsOfInterest.push({
          type: 'waypoint',
          distance: distanceInKm,
          elevation: elevation,
          label: label
        });
      }
    });
  } else {
    console.warn('Missing waypoints or originalWaypointDistances:', {
      hasWaypoints: !!flightPlan?.features?.[0]?.properties?.waypoints,
      hasDistances: !!flightPlan?.originalWaypointDistances
    });
  }

  console.groupEnd();
  
  if (result.criticalPointDistance !== null) {
    const criticalIndex = result.distances.findIndex(d => d === result.criticalPointDistance);
    if (criticalIndex >= 0) {
      pointsOfInterest.push({
        type: 'minimumClearance',
        distance: distancesInKm[criticalIndex],
        elevation: result.flightAltitudes[criticalIndex],
        clearance: result.minimumClearance,
        label: 'Min Clearance'
      });
    }
  }
  
  if (result.minimumClearance < 0) {
    result.distances.forEach((d, i) => {
      const clearance = result.flightAltitudes[i] - result.terrainElevations[i];
      if (clearance < 0) {
        pointsOfInterest.push({
          type: 'collision',
          distance: distancesInKm[i],
          elevation: result.flightAltitudes[i],
          clearance: clearance,
          label: 'Collision'
        });
      }
    });
  }
  
  if (result.pointsOfInterest && result.pointsOfInterest.length > 0) {
    result.pointsOfInterest.forEach(poi => {
      if (poi.type !== 'waypoint') {
        pointsOfInterest.push({
          ...poi,
          distance: poi.distance / 1000,
          elevation: poi.elevation || 0
        });
      }
    });
  }
  
  return {
    distances: distancesInKm,
    terrainElevations: result.terrainElevations,
    flightAltitudes: result.flightAltitudes,
    minimumClearance: result.minimumClearance,
    criticalPointDistance: result.criticalPointDistance !== null ? 
      result.criticalPointDistance / 1000 : null,
    highestPoint: {
      terrain: highestTerrain,
      flight: highestFlight
    },
    waypoints,
    pointsOfInterest
  };
}, [flightPlan]);

/**
 * Fills terrain elevation data for sample points using ElevationService
 * @param pts - Array of sample points to fill with terrain elevation
 * @param onProgress - Optional callback to report progress (returns true to cancel)
 * @returns Promise that resolves when terrain data is filled
 */
async function fillTerrain(
  pts: SamplePoint[],
  onProgress?: (percent: number) => boolean
) {
  if (!elevationService) {
    throw new Error("Elevation service not available");
  }

  console.log(`Filling terrain for ${pts.length} sample points`);
  
  // For absolute/relative modes with few points, we want to check more points
  // along the straight line segments for potential terrain conflicts
  const altitudeMode = flightPlan?.features[0]?.properties?.waypoints?.[0]?.altitudeMode ?? 'absolute';
  const isNonTerrainMode = altitudeMode !== 'terrain';
  const hasLimitedPoints = pts.length < 20; // Typically indicates we're using waypoints directly
  
  let additionalPoints: SamplePoint[] = [];
  
  if (isNonTerrainMode && hasLimitedPoints) {
    console.log(`Adding intermediate terrain checks for ${altitudeMode} mode`);
    
    // Create additional points to check terrain between waypoints
    for (let i = 0; i < pts.length - 1; i++) {
      const startPoint = pts[i];
      const endPoint = pts[i + 1];
      
      // Skip if points are too close
      const segmentDistance = endPoint.distanceFromStart - startPoint.distanceFromStart;
      if (segmentDistance < 2) continue; // Skip if less than 2m
      
      // Create 5 points between waypoints to check terrain
      const numPoints = Math.min(Math.floor(segmentDistance / 2), 10);
      
      for (let j = 1; j < numPoints; j++) {
        const ratio = j / numPoints;
        const distance = startPoint.distanceFromStart + ratio * (endPoint.distanceFromStart - startPoint.distanceFromStart);
        
        // Linear interpolation of position
        const lon = startPoint.position[0] + ratio * (endPoint.position[0] - startPoint.position[0]);
        const lat = startPoint.position[1] + ratio * (endPoint.position[1] - startPoint.position[1]);
        
        // Linear interpolation of flight elevation
        const flightElevation = startPoint.flightElevation + ratio * (endPoint.flightElevation - startPoint.flightElevation);
        
        additionalPoints.push({
          position: [lon, lat, flightElevation] as [number, number, number],
          distanceFromStart: distance,
          flightElevation: flightElevation,
          terrainElevation: 0,
          clearance: 0
        });
      }
    }
    
    console.log(`Added ${additionalPoints.length} intermediate points for terrain checking`);
  }
  
  // Process all points including any additional intermediate points
  const allPoints = [...pts, ...additionalPoints];
  
  // Sort points by distance to maintain proper order
  allPoints.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  
  const CHUNK = 250; // Process in chunks to keep UI responsive
  for (let i = 0; i < allPoints.length; i += CHUNK) {
    for (let j = i; j < Math.min(i + CHUNK, allPoints.length); j++) {
      const p = allPoints[j];
      const [lon, lat] = p.position;
      
      // Get terrain elevation from DEM
      p.terrainElevation = await elevationService.getElevation(lon, lat);
      
      // Calculate clearance
      p.clearance = p.flightElevation - p.terrainElevation;
    }

    if (onProgress && onProgress(((i + CHUNK) / pts.length) * 100)) return;
    await new Promise(r => requestAnimationFrame(r)); // Yield to UI
  }
  
  // For non-terrain modes with additional points, find critical clearance points
  // and update the original points array if needed
  if (additionalPoints.length > 0) {
    // Find any critical points from additional points
    const criticalPoints = additionalPoints.filter(p => 
      p.clearance < 0 || // Collision points
      p.clearance < Math.min(...pts.map(op => op.clearance)) + 5 // Points close to minimum clearance
    );
    
    if (criticalPoints.length > 0) {
      console.log(`Found ${criticalPoints.length} critical intermediate points`);
      
      // Add critical points to the original array
      criticalPoints.forEach(cp => {
        // Don't add points if too close to existing points (within 50m)
        const tooClose = pts.some(p => Math.abs(p.distanceFromStart - cp.distanceFromStart) < 2);
        if (!tooClose) {
          pts.push(cp);
        }
      });
      
      // Re-sort original points array
      pts.sort((a, b) => a.distanceFromStart - b.distanceFromStart);
    }
  }
  
  console.log(`Terrain filling complete for ${pts.length} sample points`);
}

/**
 * Runs the obstacle analysis for the flight plan
 * @param options - Optional analysis options to override defaults
 */
const runAnalysis = useCallback(async (options?: Partial<AnalysisOptions>) => {
  console.log('runAnalysis called with:', {
    map: !!map,
    elevationService: !!elevationService,
    flightPlan: !!flightPlan,
    isProcessed,
    hasFeatures: flightPlan?.features?.length,
    geometryType: flightPlan?.features[0]?.geometry.type,
  });

  if (!map || !elevationService || !flightPlan || !isProcessed) {
    const errorMessage = `Map, elevation service, flight plan, or processing incomplete (map: ${!!map}, elevationService: ${!!elevationService}, flightPlan: ${!!flightPlan}, isProcessed: ${isProcessed})`;
    console.error(errorMessage);
    setError(errorMessage);
    setStatus('error');
    return;
  }

  try {
    console.log("Starting terrain analysis with options:", { ...analysisOptions, ...options });
    setStatus('loading');
    setProgress(0);
    setError(null);
    cancelAnalysisRef.current = false;

    await new Promise(resolve => setTimeout(resolve, 100));

    if (cancelAnalysisRef.current) {
      console.log("Analysis cancelled during initial delay");
      return;
    }

    if (options) {
      setAnalysisOptions(prev => ({ ...prev, ...options }));
    }

    const flightFeature = flightPlan.features[0];
    if (!flightFeature || flightFeature.geometry.type !== 'LineString') {
      throw new Error('Invalid flight plan geometry. Expected LineString.');
    }
    const coords = flightFeature.geometry.coordinates as [number, number, number][];
    if (!Array.isArray(coords) || coords.length < 2) {
      throw new Error('Flight plan must have at least 2 waypoints.');
    }

    const waypoints = flightFeature.properties?.waypoints || [];
    if (waypoints.length < 2) {
      throw new Error('Flight plan must have at least 2 valid waypoints.');
    }

    const progressCallback = (value: number) => {
      const roundedValue = Math.round(value);
      if (roundedValue % 5 === 0 || roundedValue === 100) {
        console.log(`Sampling progress: ${roundedValue}%`);
        setProgress(roundedValue);
      }
      return cancelAnalysisRef.current;
    };

    // Get the altitude mode from the first waypoint
    const altitudeMode = waypoints[0]?.altitudeMode ?? 'absolute';
    console.log(`Flight plan altitude mode: ${altitudeMode}`);

    // Sample the flight path densely for all modes
    console.time("sampleFlightPath");
    let samplePoints: SamplePoint[] = await sampleFlightPath(
      flightFeature.geometry as GeoJSON.LineString,
      {
        resolution: analysisOptions.samplingResolution,
        progressCallback,
        isTerrainMode: altitudeMode === 'terrain'
      }
    );
    console.timeEnd("sampleFlightPath");

    if (cancelAnalysisRef.current) {
      console.log("Analysis cancelled during sampling");
      setStatus('idle');
      return;
    }

    // Log sample points for debugging
    console.log('[runAnalysis] Sample Points (first 10):', samplePoints.slice(0, 10).map(p => ({
      distance_m: p.distanceFromStart,
      flightElevation: p.flightElevation
    })));

    // Compute waypoint distances from original waypoints
    let cumulativeDistance = 0;
    const originalWaypointDistances: number[] = [0];
    const waypointCoords = waypoints.map((wp, idx) => {
      const coord = flightFeature.geometry.coordinates[idx];
      if (!coord || !Array.isArray(coord) || coord.length < 2) {
        console.warn(`Invalid coordinate for waypoint ${idx}:`, coord);
        return null;
      }
      return coord;
    }).filter(coord => coord !== null) as [number, number, number][];

    if (waypointCoords.length !== waypoints.length) {
      console.warn('Coordinate mismatch:', {
        waypointsLength: waypoints.length,
        coordsLength: waypointCoords.length
      });
    }

    for (let i = 1; i < waypointCoords.length; i++) {
      const prevCoord = waypointCoords[i - 1];
      const currCoord = waypointCoords[i];
      const segmentDistance = turf.distance(
        [prevCoord[0], prevCoord[1]],
        [currCoord[0], currCoord[1]],
        { units: 'meters' }
      );
      cumulativeDistance += segmentDistance;
      originalWaypointDistances.push(cumulativeDistance);
    }

    // Fallback to totalDistance if distances are incomplete
    const totalDistance = flightPlan.properties?.totalDistance ?? cumulativeDistance;
    if (originalWaypointDistances.length < waypoints.length && totalDistance) {
      console.warn('Incomplete waypoint distances, interpolating with totalDistance:', totalDistance);
      const factor = totalDistance / (waypoints.length - 1);
      originalWaypointDistances.length = 0;
      for (let i = 0; i < waypoints.length; i++) {
        originalWaypointDistances.push(i * factor);
      }
    }
    console.log('[runAnalysis] Original Waypoint Distances (meters):', originalWaypointDistances);

    const updatedFlightPlan = {
      ...flightPlan,
      waypointDistances: flightPlan.originalWaypointDistances || flightPlan.waypointDistances
    };
    setFlightPlan(updatedFlightPlan);

    // For absolute/relative modes, assign flight elevations to match start waypoint altitude
    if (altitudeMode !== 'terrain') {
      console.log("Assigning waypoint-based flight elevations for absolute/relative mode");

      samplePoints.forEach(point => {
        // Find the segment this point belongs to
        let segmentIndex = 0;
        while (
          segmentIndex < originalWaypointDistances.length - 1 &&
          point.distanceFromStart > originalWaypointDistances[segmentIndex + 1] + Number.EPSILON
        ) {
          segmentIndex++;
        }

        // Use the start waypoint's altitude for the entire segment
        point.flightElevation = waypoints[segmentIndex].originalAltitude;
      });
    }

    // Fill terrain elevations
    await fillTerrain(samplePoints, (p) => {
      setProgress(60 + Math.round(p * 0.4)); // Sampler ≈60%, DEM ≈40%
      return cancelAnalysisRef.current;
    });

    if (cancelAnalysisRef.current) {
      console.log("Analysis cancelled during terrain filling");
      setStatus('idle');
      return;
    }

    // Recalculate clearance for all points
    samplePoints.forEach(point => {
      point.clearance = point.flightElevation - point.terrainElevation;
    });

    // Compute analysis results
    const flightAltitudes = samplePoints.map(p => p.flightElevation);
    const terrainElevations = samplePoints.map(p => p.terrainElevation);
    const distances = samplePoints.map(p => p.distanceFromStart);
    const clearances = samplePoints.map(p => p.clearance);
    const minimumClearance = Math.min(...clearances);
    const highestObstacle = Math.max(...terrainElevations);
    const criticalPointIndex = clearances.indexOf(minimumClearance);
    const criticalPointDistance = criticalPointIndex >= 0 ? distances[criticalPointIndex] : null;

    // Create basic points of interest
    const pointsOfInterest: PointOfInterest[] = [];

    // Create the analysis result
    const result: ObstacleAnalysisResult = {
      samplePoints,
      minimumClearance,
      criticalPointDistance,
      highestObstacle,
      flightAltitudes,
      terrainElevations,
      distances,
      pointsOfInterest,
    };

    // Set both the detailed results and the chart-friendly data
    setResults(result);
    setChartData(generateChartData(result));

    setStatus('success');
  } catch (err: any) {
    console.error("Analysis error:", err);
    setError(err instanceof Error ? err.message : String(err));
    setStatus('error');
  }
}, [map, elevationService, flightPlan, isProcessed, analysisOptions, setError, setStatus, setProgress, setFlightPlan, generateChartData]);

  const runAOAnalysis = useCallback(async (gridCells: GridCell[]) => {
    console.log('Running AO terrain analysis');

    if (!map || !elevationService) {
      const errorMessage = "Map or elevation service not available";
      setError(errorMessage);
      setStatus('error');
      return;
    }
    
    if (!gridCells || gridCells.length === 0) {
      const errorMessage = "No terrain grid available for AO analysis";
      setError(errorMessage);
      setStatus('error');
      return;
    }
    
    try {
      setStatus('loading');
      setProgress(0);
      setError(null);
      
      // Use the passed gridCells instead of accessing context directly
      const terrainElevations = gridCells.map(cell => cell.properties.elevation);
      const highestObstacle = Math.max(...terrainElevations);
        
        // Use flight configuration for reference altitude if available
        // or default to 120m AGL
        const referenceAltitude = 120; // This could come from settings
        
        const minimumClearance = referenceAltitude - highestObstacle;
        
        // Create result object compatible with existing UI
        const result: ObstacleAnalysisResult = {
          samplePoints: [], // Not applicable for AO
          minimumClearance,
          criticalPointDistance: null, // Not applicable for AO
          highestObstacle,
          flightAltitudes: [referenceAltitude], // Single reference value
          terrainElevations,
          distances: Array(terrainElevations.length).fill(0), // Placeholder
          pointsOfInterest: [],
        };
        
        // Set results
        setResults(result);
        
        // Set chart data (simplified for AO case)
        setChartData({
          distances: [0, 1], // Placeholder
          terrainElevations: [highestObstacle, highestObstacle],
          flightAltitudes: [referenceAltitude, referenceAltitude],
          minimumClearance,
          criticalPointDistance: null,
          highestPoint: {
            terrain: highestObstacle,
            flight: referenceAltitude
          },
          waypoints: [],
          pointsOfInterest: []
        });
        
        setStatus('success');
      } catch (err: any) {
        console.error("AO terrain analysis error:", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    }, [map, elevationService, aoTerrainGrid, setError, setStatus, setProgress, setResults, setChartData]);

/**
 * Cancels the ongoing analysis
 */
const cancelAnalysis = useCallback(() => {
  cancelAnalysisRef.current = true;
  setStatus('idle');
  setProgress(0);
}, []);

/**
 * Clears analysis results
 */
const clearResults = useCallback(() => {
  setResults(null);
  setChartData(null);
  setStatus('idle');
  setProgress(0);
  setError(null);
}, []);

const value = {
  status,
  progress,
  error,
  results,
  chartData,
  runAnalysis,
  runAOAnalysis,
  cancelAnalysis,
  clearResults,
};

return <ObstacleAnalysisContext.Provider value={value}>{children}</ObstacleAnalysisContext.Provider>;
};

/**
 * Hook to access the ObstacleAnalysisContext
 * @returns The ObstacleAnalysisContext properties
 * @throws Error if used outside of ObstacleAnalysisProvider
 */
export const useObstacleAnalysis = () => {
  const context = useContext(ObstacleAnalysisContext);
  if (!context) throw new Error('useObstacleAnalysis must be used within an ObstacleAnalysisProvider');
  return context;
};