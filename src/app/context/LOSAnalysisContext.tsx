// src/context/LOSAnalysisContext.tsx
"use client";
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { StationLOSResult } from '../components/Analyses/Types/GridAnalysisTypes';

// ======== Type Definitions ========

export interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    visibility: number;
    fullyVisible: boolean;
    elevation?: number;
    lastAnalyzed: number;
  };
}

export interface AnalysisStats {
  visibleCells: number;
  totalCells: number;
  averageVisibility: number;
  analysisTime: number;
  // Add terrainStats property for terrain analysis
  terrainStats?: {
    highestElevation: number;
    lowestElevation: number;
    averageElevation: number;
    elevationDistribution: Record<string, number>;
    sampleElevations?: number[];
  };
}

export interface AnalysisResults {
  cells: GridCell[];
  stats: AnalysisStats | null;
  stationLOSResult?: StationLOSResult;
  flightPathVisibility?: FlightPathVisibilityResults;
}

export interface FlightPathVisibilityResults {
  visibleLength: number;
  totalLength: number;
  coveragePercentage: number;
  stationStats?: Array<{
    stationType: 'gcs' | 'observer' | 'repeater';
    visibleLength: number;
    coveragePercentage: number;
  }>;
}

// Marker Configuration Types
// Note: Elevation offset has been removed from marker configurations
// because elevation is now managed via LocationContext.
export interface MarkerConfig {
  gridRange: number;
}

export interface MarkerConfigs {
  gcs: MarkerConfig;
  observer: MarkerConfig;
  repeater: MarkerConfig;
}

// ======== Context Interface ========
interface LOSAnalysisContextType {
  // Configuration State
  gridSize: number;
  elosGridRange: number;
  markerConfigs: MarkerConfigs;
  // New sampling resolution state
  samplingResolution: number;
  
  // Analysis State
  isAnalyzing: boolean;
  results: AnalysisResults | null;
  error: string | null;
  progress: number;
  
  // Configuration Actions
  setGridSize: (size: number) => void;
  setElosGridRange: (range: number) => void;
  setMarkerConfig: (
    markerType: keyof MarkerConfigs,
    config: Partial<MarkerConfig>
  ) => void;
  // New setter for sampling resolution
  setSamplingResolution: (resolution: number) => void;

  // Analysis Actions
  setResults: (results: AnalysisResults | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;
  resetAnalysis: () => void;
}

// ======== Default Values ========
const DEFAULT_MARKER_CONFIG: MarkerConfig = {
  gridRange: 500,
};

const DEFAULT_MARKER_CONFIGS: MarkerConfigs = {
  gcs: { ...DEFAULT_MARKER_CONFIG },
  observer: { ...DEFAULT_MARKER_CONFIG },
  repeater: { ...DEFAULT_MARKER_CONFIG },
};

// Default sampling resolution (10 meters)
const DEFAULT_SAMPLING_RESOLUTION = 10;

// ======== Context Creation ========
const LOSAnalysisContext = createContext<LOSAnalysisContextType | undefined>(undefined);

// ======== Provider Component ========
export function LOSAnalysisProvider({ children }: { children: ReactNode }) {
  // Configuration State
  const [gridSize, setGridSize] = useState<number>(30);
  const [elosGridRange, setElosGridRange] = useState<number>(1000);
  const [markerConfigs, setMarkerConfigs] = useState<MarkerConfigs>(DEFAULT_MARKER_CONFIGS);
  // Add sampling resolution state
  const [samplingResolution, setSamplingResolution] = useState<number>(DEFAULT_SAMPLING_RESOLUTION);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Marker Configuration Handler (now only updates gridRange)
  const handleMarkerConfigUpdate = (
    markerType: keyof MarkerConfigs,
    config: Partial<MarkerConfig>
  ) => {
    setMarkerConfigs(prev => ({
      ...prev,
      [markerType]: {
        ...prev[markerType],
        ...config,
      },
    }));
  };

  // Analysis Reset Handler
  const resetAnalysis = () => {
    setResults(null);
    setError(null);
    setIsAnalyzing(false);
    setProgress(0);
  };

  const contextValue = {
    // Configuration State
    gridSize,
    elosGridRange,
    markerConfigs,
    samplingResolution, // Add to context value
    
    // Analysis State
    isAnalyzing,
    results,
    error,
    progress,
    setProgress,
    
    // Configuration Actions
    setGridSize,
    setElosGridRange,
    setMarkerConfig: handleMarkerConfigUpdate,
    setSamplingResolution, // Add to context value

    // Analysis Actions
    setResults,
    setIsAnalyzing,
    setError,
    resetAnalysis,
  };

  return (
    <LOSAnalysisContext.Provider value={contextValue}>
      {children}
    </LOSAnalysisContext.Provider>
  );
}

// ======== Custom Hook ========
export function useLOSAnalysis() {
  const context = useContext(LOSAnalysisContext);
  if (context === undefined) {
    throw new Error('useLOSAnalysis must be used within a LOSAnalysisProvider');
  }
  return context;
}