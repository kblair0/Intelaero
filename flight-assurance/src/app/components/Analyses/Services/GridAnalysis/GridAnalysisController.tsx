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
    markerId: string;
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
    
    // Use the markers collection instead of individual locations
    const { markers } = useMarkersContext();
    
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
      
      // Clean up analysis layers - now need to find layers with dynamic prefixes
      Object.values(MAP_LAYERS).forEach(layerId => {
        // Remove exact matches
        if (map.getLayer(layerId)) {
          layerManager.removeLayer(layerId);
        }
        
        // For marker-specific layers (those with ID pattern like "gcs-grid-123")
        // we can find and remove them by checking all layers
        const layers = map.getStyle().layers || [];
        layers.forEach(layer => {
          if (layer.id.startsWith(`${layerId}-`)) {
            layerManager.removeLayer(layer.id);
          }
        });
      });
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
            
          // Create a unique layer ID using marker type and ID
          const layerPrefix = 
            options.stationType === 'gcs' 
              ? MAP_LAYERS.GCS_GRID 
              : options.stationType === 'observer' 
                ? MAP_LAYERS.OBSERVER_GRID 
                : MAP_LAYERS.REPEATER_GRID;
                
          const layerId = options.markerId 
            ? `${layerPrefix}-${options.markerId}`
            : layerPrefix;
          
          // Remove existing layer if present
          layerManager.removeLayer(layerId);
          
          // Run the analysis with the unique layer ID
          const results = await runAnalysis(AnalysisType.STATION, {
            ...options,
            layerId
          });
          
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
      
      // Merged analysis - update to use markers collection
      async runMergedAnalysis(options) {
        try {
          setIsAnalyzing(true);
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          
          // If no specific stations are provided, use all markers
          const stations = options?.stations || markers.map(marker => ({
            type: marker.type,
            location: marker.location,
            range: 500, // Default range if not specified
            elevationOffset: marker.elevationOffset
          }));
          
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
      
      // Station-to-station LOS check - update to use marker IDs
      async checkStationToStationLOS(sourceMarkerId, targetMarkerId) {
        try {
          setIsAnalyzing(true);
          
          // Find markers by ID
          const sourceMarker = markers.find(m => m.id === sourceMarkerId);
          const targetMarker = markers.find(m => m.id === targetMarkerId);
          
          if (!sourceMarker || !targetMarker) {
            throw new Error("One or both markers not found");
          }
          
          // Create clean objects with only the needed properties
          // This avoids passing full markers which might have circular references
          const sourceStationData = {
            type: sourceMarker.type,
            location: {
              ...sourceMarker.location
            },
            elevationOffset: sourceMarker.elevationOffset
          };
          
          const targetStationData = {
            type: targetMarker.type,
            location: {
              ...targetMarker.location
            },
            elevationOffset: targetMarker.elevationOffset
          };
          
          const losData = await runAnalysis(
            AnalysisType.STATION_TO_STATION,
            { 
              sourceStation: sourceStationData,
              targetStation: targetStationData
            }
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

      // Flight path visibility analysis - update to use markers collection
      async runFlightPathVisibilityAnalysis(options = {}) {
        if (!flightPlan) {
          throw new Error('No flight plan available');
        }
        
        try {
          setIsAnalyzing(true);
          
          // Remove previous visibility layer
          layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
          
          // Import the visibility analysis dynamically (only when needed)
          const { analyzeFlightPathVisibility, addVisibilityLayer } = await import(
            '../../LOSAnalyses/Utils/FlightPathVisibilityEngine');
          
          // Run the analysis with all markers
          const visibilityResults = await analyzeFlightPathVisibility(
            map!,
            flightPlan,
            markers, // Pass all markers instead of filtered stations
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
      markers // Add markers to dependencies
    ]);

    // The controller doesn't render anything, it just manages state
    return null;
  }
);

GridAnalysisController.displayName = 'GridAnalysisController';

export default GridAnalysisController;