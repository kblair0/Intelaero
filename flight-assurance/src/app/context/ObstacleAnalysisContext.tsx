import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useMapContext } from './mapcontext';
import { useFlightPlanContext } from './FlightPlanContext';
import { sampleFlightPath } from '../hooks/useFlightPathSampling';

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
interface PointOfInterest {
  type: 'waypoint' | 'collision' | 'minimumClearance';
  distanceFromStart: number;
  position: [number, number, number];
  clearance?: number; // Optional, used for collision or minimumClearance
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
  pointsOfInterest: PointOfInterest[]; // Added property
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
  runAnalysis: (options?: Partial<AnalysisOptions>) => Promise<void>;
  cancelAnalysis: () => void;
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
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>(defaultAnalysisOptions);
  const cancelAnalysisRef = useRef(false);

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

    const CHUNK = 250; // Process in chunks to keep UI responsive
    for (let i = 0; i < pts.length; i += CHUNK) {
      for (let j = i; j < Math.min(i + CHUNK, pts.length); j++) {
        const p = pts[j];
        const [lon, lat] = p.position;
        p.terrainElevation = await elevationService.getElevation(lon, lat);
        p.clearance = p.flightElevation - p.terrainElevation;
      }

      if (onProgress && onProgress(((i + CHUNK) / pts.length) * 100)) return;
      await new Promise(r => requestAnimationFrame(r)); // Yield to UI
    }
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

      const altitudeMode = flightFeature.properties?.waypoints?.[0]?.altitudeMode ?? 'absolute';
      console.log(`Flight plan altitude mode: ${altitudeMode}`);

      console.time("sampleFlightPath");
      const samplePoints = await sampleFlightPath(
        flightFeature.geometry as GeoJSON.LineString,
        {
          resolution: analysisOptions.samplingResolution,
          progressCallback,
          isTerrainMode: altitudeMode === 'terrain'
        }
      );

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

      // Compute analysis results
      const flightAltitudes = samplePoints.map(p => p.flightElevation);
      const terrainElevations = samplePoints.map(p => p.terrainElevation);
      const distances = samplePoints.map(p => p.distanceFromStart);
      const clearances = samplePoints.map(p => p.clearance);
      const minimumClearance = Math.min(...clearances);
      const highestObstacle = Math.max(...terrainElevations);
      const criticalPointIndex = clearances.indexOf(minimumClearance);
      const criticalPointDistance = criticalPointIndex >= 0 ? distances[criticalPointIndex] : null;

      setResults({
        samplePoints,
        minimumClearance,
        criticalPointDistance,
        highestObstacle,
        flightAltitudes,
        terrainElevations,
        distances,
        pointsOfInterest: [],
      });

      console.timeEnd("sampleFlightPath");
      setStatus('success');
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [map, elevationService, flightPlan, isProcessed, analysisOptions]);

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
    runAnalysis,
    cancelAnalysis,
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