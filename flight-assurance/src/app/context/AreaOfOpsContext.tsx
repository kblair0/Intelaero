// src/context/AreaOfOpsContext.tsx
"use client";
import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from "react";
import { useMapContext } from "./mapcontext";
import { analyzeTerrainGrid } from "../components/Analyses/Utils/GridAnalysisCore";
import { useAnalysisController } from "./AnalysisControllerContext";
export interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    elevation: number;
    [key: string]: any;
  };
}


/**
 * Terrain analysis result interface
 */
export interface TerrainAnalysisResult {
  highestElevation: number;
  lowestElevation: number;
  averageElevation: number;
  elevationDistribution: Record<string, number>;
  sampleElevations: number[];
  gridCellCount: number;
  referenceAltitude: number;
}

interface AreaOfOpsContextType {
  aoGeometry: GeoJSON.FeatureCollection | null;
  setAoGeometry: (geometry: GeoJSON.FeatureCollection | null) => void;
  aoTerrainGrid: GridCell[] | null;
  setAoTerrainGrid: (grid: GridCell[] | null) => void;
  bufferDistance: number;
  setBufferDistance: (distance: number) => void;
  
  // New terrain analysis properties
  terrainAnalysisResult: TerrainAnalysisResult | null;
  analyzeTerrainElevation: (referenceAltitude?: number) => Promise<TerrainAnalysisResult | null>;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisError: string | null;
}

const AreaOfOpsContext = createContext<AreaOfOpsContextType | undefined>(undefined);
// Add this at the top of AreaOfOpsContext.tsx, outside of any component
const createError = (message: string, code?: string, details?: any): Error => {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).details = details;
  return error;
};

export const AreaOfOpsProvider = ({ children }: { children: ReactNode }) => {
  const { map, elevationService } = useMapContext();
  const { gridAnalysisRef } = useAnalysisController();
  
  // State for AO
  const [aoGeometry, setAoGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [aoTerrainGrid, setAoTerrainGrid] = useState<GridCell[] | null>(null);
  const [bufferDistance, setBufferDistance] = useState<number>(500);
  
  // State for terrain analysis
  const [terrainAnalysisResult, setTerrainAnalysisResult] = useState<TerrainAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const abortAnalysisRef = useRef<boolean>(false);

/**
 * Analyzes the AO terrain grid for elevation data
 * Delegates to GridAnalysisController while maintaining compatible interface
 */
const analyzeTerrainElevation = useCallback(async (referenceAltitude: number = 120): Promise<TerrainAnalysisResult | null> => {
  if (!aoTerrainGrid || aoTerrainGrid.length === 0) {
    setAnalysisError("No terrain grid available for analysis");
    return null;
  }
  
  if (!gridAnalysisRef.current) {
    console.warn("GridAnalysisController not available, falling back to direct analysis");
    // Fall back to original implementation if controller not available
    try {
      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisError(null);
      abortAnalysisRef.current = false;
      
      // Use grid analysis core directly as fallback
      const result = await analyzeTerrainGrid(
        aoTerrainGrid,
        {
          batchSize: 1000,
          referenceAltitude,
          onProgress: (progress) => {
            setAnalysisProgress(progress);
            return abortAnalysisRef.current;
          }
        }
      );
      
      if (abortAnalysisRef.current) return null;
      
      const analysisResult: TerrainAnalysisResult = {
        highestElevation: result.highestElevation,
        lowestElevation: result.lowestElevation,
        averageElevation: result.averageElevation,
        elevationDistribution: result.elevationDistribution,
        sampleElevations: result.elevations,
        gridCellCount: aoTerrainGrid.length,
        referenceAltitude
      };
      
      setTerrainAnalysisResult(analysisResult);
      return analysisResult;
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }
  
  try {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisError(null);
    abortAnalysisRef.current = false;
    
    // Use the controller instead
    const analysisResults = await gridAnalysisRef.current.analyzeTerrainGrid(
      aoTerrainGrid,
      {
        referenceAltitude,
        onProgress: (progress) => {
          setAnalysisProgress(progress);
          return abortAnalysisRef.current;
        }
      }
    );
    
    if (abortAnalysisRef.current) return null;
    
    // Convert controller results to expected TerrainAnalysisResult format
    const terrainStats = analysisResults.stats.terrainStats;
    if (!terrainStats) {
      throw new Error("Missing terrain statistics in analysis results");
    }
    
    const analysisResult: TerrainAnalysisResult = {
      highestElevation: terrainStats.highestElevation,
      lowestElevation: terrainStats.lowestElevation,
      averageElevation: terrainStats.averageElevation,
      elevationDistribution: terrainStats.elevationDistribution,
      sampleElevations: terrainStats.sampleElevations || [],
      gridCellCount: aoTerrainGrid.length,
      referenceAltitude
    };
    
    setTerrainAnalysisResult(analysisResult);
    return analysisResult;
  } catch (error) {
    setAnalysisError(error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    setIsAnalyzing(false);
    setAnalysisProgress(0);
  }
}, [aoTerrainGrid, gridAnalysisRef]);

  return (
    <AreaOfOpsContext.Provider
      value={{
        aoGeometry,
        setAoGeometry,
        aoTerrainGrid,
        setAoTerrainGrid,
        bufferDistance,
        setBufferDistance,
        
        // New terrain analysis properties
        terrainAnalysisResult,
        analyzeTerrainElevation,
        isAnalyzing,
        analysisProgress,
        analysisError,
      }}
    >
      {children}
    </AreaOfOpsContext.Provider>
  );
};

export const useAreaOfOpsContext = () => {
  const context = useContext(AreaOfOpsContext);
  if (!context) {
    throw new Error("useAreaOfOpsContext must be used within an AreaOfOpsProvider");
  }
  return context;
};