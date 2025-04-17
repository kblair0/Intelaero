import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { useMapContext } from "./MapContext";
import { useFlightPlanContext } from "./FlightPlanContext";
import { useFlightPathSampling } from "../hooks/useFlightPathSampling";
import * as turf from '@turf/turf';

export interface SamplePoint {
  position: [number, number, number];
  distanceFromStart: number;
  flightElevation: number;
  terrainElevation: number;
  clearance: number;
}

export interface PointOfInterest {
  type: 'collision' | 'minimumClearance' | 'waypoint';
  position: [number, number, number];
  distanceFromStart: number;
  clearance: number;
  obstacleType?: string;
}

export interface ObstacleAnalysisResult {
  samplePoints: SamplePoint[];
  pointsOfInterest: PointOfInterest[];
  minimumClearance: number;
  highestObstacle: number;
  criticalPointDistance: number | null;
  waypointDistances?: number[];
}

export interface ObstacleAnalysisOutput {
  distances: number[];
  flightAltitudes: number[];
  terrainElevations: number[];
  minClearance: number;
  criticalPoint: number;
}

export interface AnalysisOptions {
  samplingResolution: number;
  verticalBuffer: number;
  maxDistance?: number;
}

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ObstacleAnalysisContextValue {
  results: ObstacleAnalysisResult | null;
  status: AnalysisStatus;
  progress: number;
  error: string | null;
  analysisOptions: AnalysisOptions;
  runAnalysis: (options?: Partial<AnalysisOptions>) => Promise<void>;
  cancelAnalysis: () => void;
  clearResults: () => void;
  updateOptions: (options: Partial<AnalysisOptions>) => void;
  analysisData: ObstacleAnalysisOutput | null;
  setAnalysisData: (data: ObstacleAnalysisOutput | null) => void;
}

const ObstacleAnalysisContext = createContext<ObstacleAnalysisContextValue | undefined>(undefined);

const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  samplingResolution: 10,
  verticalBuffer: 10,
};

const ensureNumericCoords = (coords: any[]): [number, number] => {
  if (!Array.isArray(coords) || coords.length < 2) {
    console.error('Invalid coordinate format:', coords);
    return [0, 0];
  }
  const x = Number(coords[0]);
  const y = Number(coords[1]);
  if (isNaN(x) || isNaN(y)) {
    console.error('NaN values in coordinates:', coords);
    return [0, 0];
  }
  return [x, y];
};

export const ObstacleAnalysisProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { map } = useMapContext();
  const { flightPlan } = useFlightPlanContext();
  const { sampleFlightPath } = useFlightPathSampling();

  const [results, setResults] = useState<ObstacleAnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisOptions, setAnalysisOptions] = useState<AnalysisOptions>(DEFAULT_ANALYSIS_OPTIONS);
  const [analysisData, setAnalysisData] = useState<ObstacleAnalysisOutput | null>(null);
  const cancelAnalysisRef = useRef(false);

  const runAnalysis = useCallback(async (options?: Partial<AnalysisOptions>) => {
    if (!map) {
      setError("Map not available");
      return;
    }
    if (!flightPlan) {
      setError("Flight plan not available");
      return;
    }
    try {
      setStatus('loading');
      setProgress(0);
      setError(null);
      cancelAnalysisRef.current = false;

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
        setProgress(value);
        return cancelAnalysisRef.current;
      };

      const samplePoints = await sampleFlightPath(
        flightFeature.geometry as GeoJSON.LineString,
        { resolution: analysisOptions.samplingResolution, progressCallback }
      );
      if (cancelAnalysisRef.current) {
        setStatus('idle');
        return;
      }

      let waypointDistances: number[] = [0];
      try {
        const waypoints = coords.map(coord => ensureNumericCoords(coord));
        let cumulativeDistance = 0;
        for (let i = 1; i < waypoints.length; i++) {
          const from = turf.point(waypoints[i - 1]);
          const to = turf.point(waypoints[i]);
          const d = turf.distance(from, to, { units: 'meters' });
          cumulativeDistance += d;
          waypointDistances.push(cumulativeDistance);
        }
      } catch {
        coords.forEach((_, idx) => {
          if (idx > 0) waypointDistances.push(idx * 100);
        });
      }

      const clearances = samplePoints.map(p => p.clearance);
      const minClearance = Math.min(...clearances);
      const minIndex = clearances.indexOf(minClearance);
      const criticalPoint = samplePoints[minIndex];
      const terrainElevations = samplePoints.map(p => p.terrainElevation);
      const highestObstacle = Math.max(...terrainElevations);

      const pointsOfInterest: PointOfInterest[] = [];
      pointsOfInterest.push({
        type: minClearance < 0 ? 'collision' : 'minimumClearance',
        position: criticalPoint.position,
        distanceFromStart: criticalPoint.distanceFromStart,
        clearance: minClearance,
      });

      coords.forEach((coord, idx) => {
        if (!Array.isArray(coord) || coord.length < 3) return;
        const dist = waypointDistances[idx] || 0;
        let closestIndex = 0;
        let minDiff = Infinity;
        samplePoints.forEach((sp, i) => {
          const diff = Math.abs(sp.distanceFromStart - dist);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
          }
        });
        const sp = samplePoints[closestIndex];
        pointsOfInterest.push({
          type: 'waypoint',
          position: [Number(coord[0]), Number(coord[1]), Number(coord[2] || 0)],
          distanceFromStart: dist,
          clearance: sp.clearance,
        });
      });

      const analysisResults: ObstacleAnalysisResult = {
        samplePoints,
        pointsOfInterest,
        minimumClearance: minClearance,
        highestObstacle,
        criticalPointDistance: criticalPoint.distanceFromStart,
        waypointDistances,
      };

      const legacyData: ObstacleAnalysisOutput = {
        distances: samplePoints.map(p => p.distanceFromStart),
        flightAltitudes: samplePoints.map(p => p.flightElevation),
        terrainElevations: samplePoints.map(p => p.terrainElevation),
        minClearance,
        criticalPoint: criticalPoint.distanceFromStart,
      };

      setAnalysisData(legacyData);
      setResults(analysisResults);
      setStatus('success');
      setProgress(100);
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [map, flightPlan, sampleFlightPath, analysisOptions]);

  const cancelAnalysis = useCallback(() => {
    cancelAnalysisRef.current = true;
    setStatus('idle');
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setAnalysisData(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  const updateOptions = useCallback((opts: Partial<AnalysisOptions>) => {
    setAnalysisOptions(prev => ({ ...prev, ...opts }));
  }, []);

  const value: ObstacleAnalysisContextValue = {
    results,
    status,
    progress,
    error,
    analysisOptions,
    runAnalysis,
    cancelAnalysis,
    clearResults,
    updateOptions,
    analysisData,
    setAnalysisData,
  };

  return (
    <ObstacleAnalysisContext.Provider value={value}>
      {children}
    </ObstacleAnalysisContext.Provider>
  );
};

export const useObstacleAnalysis = (): ObstacleAnalysisContextValue => {
  const context = useContext(ObstacleAnalysisContext);
  if (!context) {
    throw new Error("useObstacleAnalysis must be used within an ObstacleAnalysisProvider");
  }
  return context;
};
