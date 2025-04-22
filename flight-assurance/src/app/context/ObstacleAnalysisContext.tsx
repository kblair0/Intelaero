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
import { sampleFlightPath } from '../hooks/useFlightPathSampling';
import * as turf from '@turf/turf';

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
  chartData: TerrainChartData | null; // New property for simplified chart data
  runAnalysis: (options?: Partial<AnalysisOptions>) => Promise<void>;
  cancelAnalysis: () => void;
  clearResults: () => void; // New method to clear results
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
  const { flightPlan, isProcessed } = useFlightPlanContext();
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ObstacleAnalysisResult | null>(null);
  const [chartData, setChartData] = useState<TerrainChartData | null>(null);
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>(defaultAnalysisOptions);
  const cancelAnalysisRef = useRef(false);

/**
 * Converts analysis results to chart data format
 * @param result - The analysis result to convert
 * @returns The formatted chart data
 */
const generateChartData = useCallback((result: ObstacleAnalysisResult): TerrainChartData => {
  // Determine altitude mode
  const altitudeMode = flightPlan?.features[0]?.properties?.waypoints?.[0]?.altitudeMode ?? 'absolute';
  console.log(`Generating chart data for altitude mode: ${altitudeMode}`);
  
  // Convert distances from meters to kilometers for display
  const distancesInKm = result.distances.map(d => d / 1000);
  
  // Find highest points
  const highestTerrain = Math.max(...result.terrainElevations);
  const highestFlight = Math.max(...result.flightAltitudes);
  
  // Extract waypoints from flight plan if available
  const waypoints: WaypointData[] = [];
  if (flightPlan?.features?.[0]?.geometry?.coordinates) {
    const coords = flightPlan.features[0].geometry.coordinates;
    const waypointDistances = flightPlan.waypointDistances || [];
    
    coords.forEach((_, index) => {
      // Use actual waypoint distances if available
      if (waypointDistances[index] !== undefined) {
        waypoints.push({
          distance: waypointDistances[index] / 1000, // Convert to km
          label: `WP ${index + 1}`
        });
      } else {
        // Fallback to estimated position
        const waypointIdx = Math.floor((index * result.distances.length) / coords.length);
        if (waypointIdx < distancesInKm.length) {
          waypoints.push({
            distance: distancesInKm[waypointIdx],
            label: `WP ${index + 1}`
          });
        }
      }
    });
  }
  
  // Format points of interest
  const pointsOfInterest: PointOfInterest[] = [];
  
  // Add minimum clearance point if we have it
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
  
  // Add collision points if minimum clearance is negative
  if (result.minimumClearance < 0) {
    // Find all points where clearance is negative
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
  
  // Add existing points of interest
  if (result.pointsOfInterest && result.pointsOfInterest.length > 0) {
    result.pointsOfInterest.forEach(poi => {
      // Skip if we already have equivalent points
      if (poi.type === 'minimumClearance' && pointsOfInterest.some(p => p.type === 'minimumClearance')) {
        return;
      }
      
      pointsOfInterest.push({
        ...poi,
        distance: poi.distance / 1000, // Convert to km
        elevation: poi.elevation || 0
      });
    });
  }
  
  // For absolute and relative modes, add waypoints as points of interest
  if (altitudeMode !== 'terrain' && waypoints.length > 0) {
    waypoints.forEach((waypoint, idx) => {
      // Find corresponding point in result data
      const wpDistance = waypoint.distance * 1000; // Convert back to meters for comparison
      const resultIndex = result.distances.findIndex(d => Math.abs(d - wpDistance) < 10); // 10m tolerance
      
      if (resultIndex >= 0) {
        pointsOfInterest.push({
          type: 'waypoint',
          distance: waypoint.distance,
          elevation: result.flightAltitudes[resultIndex],
          label: waypoint.label
        });
      }
    });
  }
  
  // Return formatted chart data
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
      if (segmentDistance < 50) continue; // Skip if less than 50m
      
      // Create 5 points between waypoints to check terrain
      const numPoints = Math.min(Math.floor(segmentDistance / 100), 10);
      
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
        const tooClose = pts.some(p => Math.abs(p.distanceFromStart - cp.distanceFromStart) < 50);
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
   * Clears analysis results
   */
  const clearResults = useCallback(() => {
    setResults(null);
    setChartData(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

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
    const coords = flightFeature.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      throw new Error('Flight plan must have at least 2 waypoints.');
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
    const waypoints = flightFeature.properties?.waypoints || [];
    const altitudeMode = waypoints[0]?.altitudeMode ?? 'absolute';
    console.log(`Flight plan altitude mode: ${altitudeMode}`);

    let samplePoints: SamplePoint[] = [];

    if (altitudeMode === 'terrain') {
      // For terrain mode, use dense sampling along the path
      console.time("sampleFlightPath");
      samplePoints = await sampleFlightPath(
        flightFeature.geometry as GeoJSON.LineString,
        {
          resolution: analysisOptions.samplingResolution,
          progressCallback,
          isTerrainMode: true
        }
      );
      console.timeEnd("sampleFlightPath");
    } else {
      // For absolute and relative modes, use the waypoints directly without dense sampling
      console.log("Using waypoints directly for absolute/relative mode");
      
      // Convert waypoints to sample points
      const waypointCoords = coords as [number, number, number][];
      
      // Calculate cumulative distances for each waypoint
      let cumulativeDistance = 0;
      const distances: number[] = [0];
      
      for (let i = 1; i < waypointCoords.length; i++) {
        const prevCoord = waypointCoords[i-1];
        const currCoord = waypointCoords[i];
        const segmentDistance = turf.distance(
          [prevCoord[0], prevCoord[1]], 
          [currCoord[0], currCoord[1]], 
          { units: 'meters' }
        );
        cumulativeDistance += segmentDistance;
        distances.push(cumulativeDistance);
      }
      
      // Create sample points from waypoint coordinates
      samplePoints = waypointCoords.map((coord, index) => ({
        position: coord,
        distanceFromStart: distances[index],
        flightElevation: coord[2],
        terrainElevation: 0, // Will be filled later
        clearance: 0, // Will be calculated later
      }));
      
      // Simulate progress to match UI expectations
      progressCallback(60);
    }

    if (cancelAnalysisRef.current) {
      console.log("Analysis cancelled during sampling");
      setStatus('idle');
      return;
    }

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
}, [map, elevationService, flightPlan, isProcessed, analysisOptions, generateChartData]);
  /**
   * Cancels the ongoing analysis
   */
  const cancelAnalysis = useCallback(() => {
    cancelAnalysisRef.current = true;
    setStatus('idle');
    setProgress(0);
  }, []);

  const value = {
    status,
    progress,
    error,
    results,
    chartData,
    runAnalysis,
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