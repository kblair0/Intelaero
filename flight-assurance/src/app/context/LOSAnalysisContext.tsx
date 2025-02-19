// src/context/LOSAnalysisContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

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
}

// Marker Configuration Types
export interface MarkerConfig {
  elevationOffset: number;
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
  
  // Analysis State
  isAnalyzing: boolean;
  results: AnalysisResults | null;
  error: string | null;
  autoAnalysisRunning: boolean;
  setAutoAnalysisRunning: (running: boolean) => void;
  
  // Configuration Actions
  setGridSize: (size: number) => void;
  setElosGridRange: (range: number) => void;
  setMarkerConfig: (
    markerType: keyof MarkerConfigs,
    config: Partial<MarkerConfig>
  ) => void;

  // Analysis Actions
  setResults: (results: AnalysisResults | null) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setError: (error: string | null) => void;
  resetAnalysis: () => void;
}

// ======== Default Values ========
const DEFAULT_MARKER_CONFIG: MarkerConfig = {
  elevationOffset: 3,
  gridRange: 500,
};

const DEFAULT_MARKER_CONFIGS: MarkerConfigs = {
  gcs: { ...DEFAULT_MARKER_CONFIG },
  observer: { ...DEFAULT_MARKER_CONFIG },
  repeater: { ...DEFAULT_MARKER_CONFIG },
};

// ======== Context Creation ========
const LOSAnalysisContext = createContext<LOSAnalysisContextType | undefined>(undefined);

// ======== Provider Component ========
export function LOSAnalysisProvider({ children }: { children: ReactNode }) {
  // Configuration State
  const [gridSize, setGridSize] = useState<number>(30);
  const [elosGridRange, setElosGridRange] = useState<number>(1000);
  const [markerConfigs, setMarkerConfigs] = useState<MarkerConfigs>(DEFAULT_MARKER_CONFIGS);
  
  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoAnalysisRunning, setAutoAnalysisRunning] = useState<boolean>(false);

  // Marker Configuration Handler
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
  };

  const contextValue = {
    // Configuration State
    gridSize,
    elosGridRange,
    markerConfigs,
    
    // Analysis State
    isAnalyzing,
    results,
    error,
    autoAnalysisRunning,
    setAutoAnalysisRunning,
    
    // Configuration Actions
    setGridSize,
    setElosGridRange,
    setMarkerConfig: handleMarkerConfigUpdate,

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