// src/app/components/Map/Analysis/GridAnalysisController.tsx

/**
 * GridAnalysisController.tsx
 * 
 * This component serves as the central controller for grid-based
 * Line of Sight (LOS) analysis. It coordinates between the map, the analysis 
 * hook, and the UI, handling user interactions and visualizing results.
 * 
 * It provides:
 * - A ref API for triggering analyses programmatically
 * - Progress tracking and visualization
 * - Error handling
 * - Proper cleanup of resources
 */

import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useGridAnalysis } from '../../hooks/useGridAnalysis';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { useMapContext } from '../../context/MapContext';
import { MAP_LAYERS, layerManager } from '../LayerManager';
import { FlightPlanData } from '../../context/FlightPlanContext';
import { LocationData, AnalysisType, StationLOSResult, LOSProfilePoint } from '../../types/GridAnalysisTypes';

export interface GridAnalysisRef {
  runFlightPathAnalysis: () => Promise<void>;
  runStationAnalysis: (options: {
    stationType: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    range: number;
  }) => Promise<void>;
  runMergedAnalysis: (stations: Array<{
    type: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    range: number;
    elevationOffset: number;
  }>) => Promise<void>;
  checkStationToStationLOS: (
    sourceStation: 'gcs' | 'observer' | 'repeater',
    targetStation: 'gcs' | 'observer' | 'repeater'
  ) => Promise<{
    result: StationLOSResult;
    profile: LOSProfilePoint[];
  }>;
  abortAnalysis: () => void;
}

interface GridAnalysisControllerProps {
  flightPlan?: FlightPlanData;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onComplete?: (results: any) => void;
}

const GridAnalysisController = forwardRef<GridAnalysisRef, GridAnalysisControllerProps>(
  ({ flightPlan, onProgress, onError, onComplete }, ref) => {
    const { map } = useMapContext();
    const { setResults, setError, setIsAnalyzing } = useLOSAnalysis();
    const [internalProgress, setInternalProgress] = useState(0);
    
    // Use our grid analysis hook
    const {
      runAnalysis,
      analyzeFlightPath,
      analyzeStation,
      analyzeMerged,
      checkStationToStationLOS,
      abortAnalysis,
      progress,
    } = useGridAnalysis({
      onProgress: (value) => {
        setInternalProgress(value);
        if (onProgress) onProgress(value);
      },
    });

    // Create layer cleanup function
    const cleanup = useCallback(() => {
      if (!map) return;
      
      // Clear previous analysis layers
      layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
      layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
      layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
      layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
      layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
    }, [map]);

    // Public API exposed via ref
    useImperativeHandle(ref, () => ({
      async runFlightPathAnalysis() {
        if (!flightPlan) {
          throw new Error('No flight plan available');
        }
        
        try {
          setIsAnalyzing(true);
          cleanup();
          
          const results = await runAnalysis(AnalysisType.FLIGHT_PATH, { flightPlan });
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
        } catch (error) {
          setError(error.message);
          if (onError) onError(error);
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      async runStationAnalysis(options) {
        try {
          setIsAnalyzing(true);
          
          // Remove only the specific station's layer
          const layerId = 
            options.stationType === 'gcs' 
              ? MAP_LAYERS.GCS_GRID 
              : options.stationType === 'observer' 
                ? MAP_LAYERS.OBSERVER_GRID 
                : MAP_LAYERS.REPEATER_GRID;
                
          layerManager.removeLayer(layerId);
          
          const results = await runAnalysis(AnalysisType.STATION, options);
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
        } catch (error) {
          setError(error.message);
          if (onError) onError(error);
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      async runMergedAnalysis(stations) {
        try {
          setIsAnalyzing(true);
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          
          const results = await runAnalysis(AnalysisType.MERGED, { stations });
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
        } catch (error) {
          setError(error.message);
          if (onError) onError(error);
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      async checkStationToStationLOS(sourceStation, targetStation) {
        try {
          setIsAnalyzing(true);
          
          const losData = await checkStationToStationLOS(
            sourceStation,
            targetStation
          );
          
          // Create minimal results format to keep consistent
          const results = {
            cells: [],
            stats: {
              visibleCells: 0,
              totalCells: 0,
              averageVisibility: losData.result.clear ? 100 : 0,
              analysisTime: 0,
            },
            stationLOSResult: losData.result,
          };
          
          setResults(results);
          
          if (onComplete) onComplete(results);
          return losData;
        } catch (error) {
          setError(error.message);
          if (onError) onError(error);
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      abortAnalysis() {
        abortAnalysis();
      },
    }), [
      map,
      flightPlan,
      runAnalysis,
      checkStationToStationLOS,
      abortAnalysis,
      cleanup,
      setResults,
      setError,
      setIsAnalyzing,
      onComplete,
      onError,
    ]);

    // The component itself doesn't render anything visible
    return null;
  }
);

GridAnalysisController.displayName = 'GridAnalysisController';

export default GridAnalysisController;