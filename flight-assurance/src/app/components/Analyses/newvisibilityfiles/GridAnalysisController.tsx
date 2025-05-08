/**
 * GridAnalysisController.tsx
 * 
 * Optimized controller for grid-based LOS analysis that coordinates
 * between map, analysis hook, and UI components.
 * 
 * Provides:
 * - A ref API for triggering analyses programmatically
 * - Progress tracking
 * - Error handling
 * - Proper resource management
 */

import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import { useGridAnalysis } from '../../Hooks/useGridAnalysis';
import { AnalysisResults, useLOSAnalysis } from '../../../../context/LOSAnalysisContext';
import { useMapContext } from '../../../../context/mapcontext';
import { layerManager, MAP_LAYERS } from '../../../../services/LayerManager';
import { FlightPlanData } from '../../../../context/FlightPlanContext';
import { LocationData, AnalysisType, StationLOSResult, LOSProfilePoint } from '../../Types/GridAnalysisTypes';
import { useMarkersContext } from '../../../../context/MarkerContext';

// Interface for the controller's public methods
export interface GridAnalysisRef {
  runFlightPathAnalysis: () => Promise<AnalysisResults>;
  runStationAnalysis: (options: {
    stationType: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    range: number;
    elevationOffset: number;
  }) => Promise<AnalysisResults>;
  runMergedAnalysis: (stations: Array<{
    type: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    range: number;
    elevationOffset: number;
  }>) => Promise<AnalysisResults>;
  checkStationToStationLOS: (
    sourceStation: 'gcs' | 'observer' | 'repeater',
    targetStation: 'gcs' | 'observer' | 'repeater'
  ) => Promise<{
    result: StationLOSResult;
    profile: LOSProfilePoint[];
  }>;
  runFlightPathVisibilityAnalysis: (options?: {
    sampleInterval?: number;
    minimumOffset?: number;
    showLayer?: boolean;
  }) => Promise<AnalysisResults>;
  abortAnalysis: () => void;
}

interface GridAnalysisControllerProps {
  flightPlan?: FlightPlanData;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onComplete?: (results: any) => void;
}

/**
 * Main controller component for grid analysis functionality
 */
const GridAnalysisController = forwardRef<GridAnalysisRef, GridAnalysisControllerProps>(
  ({ flightPlan, onProgress, onError, onComplete }, ref) => {
    const { map, elevationService } = useMapContext();
    const { setResults, setError, setProgress, setIsAnalyzing } = useLOSAnalysis();
    const [internalProgress, setInternalProgress] = useState(0);
    const { 
      gcsLocation, 
      observerLocation, 
      repeaterLocation,
      gcsElevationOffset,
      observerElevationOffset,
      repeaterElevationOffset
    } = useMarkersContext();
    
    // Initialize the grid analysis hook with progress tracking
    const {
      runAnalysis,
      abortAnalysis,
      progress,
    } = useGridAnalysis({
      onProgress: (value) => {
        setInternalProgress(value);
        if (onProgress) onProgress(value);
        setProgress(value);
      },
    });

    // Clean up layers when needed
    const cleanup = useCallback(() => {
      if (!map) return;
      
      layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
      layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
      layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
      layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
      layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
      layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
    }, [map]);

    // Expose methods through the ref
    useImperativeHandle(ref, () => ({
      // Flight path analysis
      async runFlightPathAnalysis() {
        if (!flightPlan) {
          throw new Error('No flight plan available');
        }
        
        try {
          setIsAnalyzing(true);
          cleanup();
          
          // Perform analysis
          const results = await runAnalysis(AnalysisType.FLIGHT_PATH, { flightPlan });

          setResults(results);
          if (onComplete) onComplete(results);
          return results;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      // Station analysis
      async runStationAnalysis(options) {
        try {
          // Validate location
          if (!options.location || typeof options.location.lng !== 'number' || typeof options.location.lat !== 'number') {
            const errorMsg = `${options.stationType.toUpperCase()} location not set or invalid`;
            setError(errorMsg);
            throw new Error(errorMsg);
          }
          
          setIsAnalyzing(true);
            
          const layerId = 
            options.stationType === 'gcs' 
              ? MAP_LAYERS.GCS_GRID 
              : options.stationType === 'observer' 
                ? MAP_LAYERS.OBSERVER_GRID 
                : MAP_LAYERS.REPEATER_GRID;
                
          layerManager.removeLayer(layerId);
          
          // Run the analysis
          const results = await runAnalysis(AnalysisType.STATION, options);
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      // Merged analysis
      async runMergedAnalysis(stations) {
        try {
          setIsAnalyzing(true);
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          
          const results = await runAnalysis(AnalysisType.MERGED, { stations });
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      // Station-to-station LOS check
      async checkStationToStationLOS(sourceStation, targetStation) {
        try {
          setIsAnalyzing(true);
          
          const losData = await runAnalysis(
            AnalysisType.STATION_TO_STATION,
            { sourceStation, targetStation }
          );
          
          // Extract LOS result from analysis results
          const results = {
            cells: [],
            stats: {
              visibleCells: 0,
              totalCells: 0,
              averageVisibility: losData.stationLOSResult?.clear ? 100 : 0,
              analysisTime: 0,
            },
            stationLOSResult: losData.stationLOSResult,
          };
          
          setResults(results);
          
          if (onComplete) onComplete(results);
          
          // The LOS data is expected to be in this format by UI components
          return { 
            result: losData.stationLOSResult!, 
            profile: losData.profile || [] 
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },

      // Flight path visibility analysis
      async runFlightPathVisibilityAnalysis(options = {}) {
        if (!flightPlan) {
          throw new Error('No flight plan available');
        }
        
        try {
          // Get the available stations for analysis
          const stations = [];
          
          if (gcsLocation) {
            stations.push({
              type: 'gcs' as const,
              location: gcsLocation,
              elevationOffset: gcsElevationOffset
            });
          }
          
          if (observerLocation) {
            stations.push({
              type: 'observer' as const,
              location: observerLocation,
              elevationOffset: observerElevationOffset
            });
          }
          
          if (repeaterLocation) {
            stations.push({
              type: 'repeater' as const,
              location: repeaterLocation,
              elevationOffset: repeaterElevationOffset
            });
          }
          
          if (stations.length === 0) {
            throw new Error('At least one station (GCS, Observer, or Repeater) must be placed on the map');
          }
          
          setIsAnalyzing(true);
          
          // Remove previous visibility layer
          layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
          
          // Import the visibility analysis dynamically (only when needed)
          const { analyzeFlightPathVisibility, addVisibilityLayer } = await import(
            '../../LOSAnalyses/Utils/FlightPathVisibilityEngine');
          
          // Run the analysis
          const visibilityResults = await analyzeFlightPathVisibility(
            map!,
            flightPlan,
            stations,
            elevationService,
            {
              sampleInterval: options.sampleInterval || 10,
              minimumOffset: options.minimumOffset || 1,
              onProgress: (progress) => {
                setProgress(progress);
                if (onProgress) onProgress(progress);
              }
            }
          );
          
          // Add the visibility layer to the map if requested
          if (options.showLayer !== false && map) {
            addVisibilityLayer(map, visibilityResults.segments);
          }
          
          // Create the analysis results object
          const results: AnalysisResults = {
            cells: [], // Not using cells for this analysis
            stats: {
              visibleCells: 0,
              totalCells: 0,
              averageVisibility: visibilityResults.stats.coveragePercentage,
              analysisTime: visibilityResults.stats.analysisTime
            },
            flightPathVisibility: {
              visibleLength: visibilityResults.stats.visibleLength,
              totalLength: visibilityResults.stats.totalLength,
              coveragePercentage: visibilityResults.stats.coveragePercentage,
              stationStats: visibilityResults.stats.stationStats
            }
          };
          
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
          
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
          setProgress(0);
        }
      },

      // Abort any running analysis
      abortAnalysis() {
        abortAnalysis();
      },
    }), [
      map,
      flightPlan,
      runAnalysis,
      abortAnalysis,
      cleanup,
      setResults,
      setError,
      setIsAnalyzing,
      onComplete,
      onError,
      elevationService,
      gcsLocation,
      observerLocation,
      repeaterLocation,
      gcsElevationOffset,
      observerElevationOffset,
      repeaterElevationOffset
    ]);

    // The controller doesn't render anything, it just manages state
    return null;
  }
);

GridAnalysisController.displayName = 'GridAnalysisController';

export default GridAnalysisController;