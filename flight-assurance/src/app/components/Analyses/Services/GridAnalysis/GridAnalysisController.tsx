/**
 * GridAnalysisController.tsx
 * 
 * Enhanced controller for grid-based LOS analysis that leverages ElevationService
 * for improved performance and reliability. Manages analysis operations and coordinates
 * between map, analysis hook, and UI components.
 * 
 * It provides:
 * - A ref API for triggering analyses programmatically
 * - Progress tracking and visualization
 * - Error handling
 * - Proper cleanup of resources
 */

import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { useGridAnalysis } from '../../Hooks/useGridAnalysis';
import { AnalysisResults, useLOSAnalysis } from '../../../../context/LOSAnalysisContext';
import { useMapContext } from '../../../../context/mapcontext';
import { MAP_LAYERS, layerManager } from '../../../../services/LayerManager';
import { FlightPlanData } from '../../../../context/FlightPlanContext';
import { LocationData, AnalysisType, StationLOSResult, LOSProfilePoint } from '../../Types/GridAnalysisTypes';


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
    const { map, elevationService } = useMapContext();
    const { setResults, setError, setProgress, setIsAnalyzing } = useLOSAnalysis();
    const [internalProgress, setInternalProgress] = useState(0);
    
    
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

    const cleanup = useCallback(() => {
      if (!map) return;
      
      layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
      layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
      layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
      layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
      layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
    }, [map]);

    useImperativeHandle(ref, () => ({
      async runFlightPathAnalysis() {
        if (!flightPlan) {
          throw new Error('No flight plan available');
        }
        try {
          console.log(`[${new Date().toISOString()}] [GridArunFlightPathAnalysis] Setting isAnalyzing to true`);
          setIsAnalyzing(true);
          cleanup();
          if (map && elevationService) {
            try {
              const coordinates = flightPlan.features[0].geometry.coordinates.map(
                coord => [coord[0], coord[1], 0] as [number, number, number]
              );
              await elevationService.preloadArea(coordinates);
            } catch (preloadError) {
              console.warn('Flight path area preload failed:', preloadError);
            }
          } else {
            console.warn('Map or elevationService not available, skipping preload');
          }
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
      
      async runStationAnalysis(options) {
        try {
          console.log(`[${new Date().toISOString()}] [GridAnalysisController] runStationAnalysis called with:`, options);
          
          // Validate location data before proceeding
          if (!options.location || typeof options.location.lng !== 'number' || typeof options.location.lat !== 'number') {
            const errorMsg = `${options.stationType.toUpperCase()} location not set or invalid`;
            console.error(`[${new Date().toISOString()}] [GridAnalysisController] ${errorMsg}:`, options.location);
            setError(errorMsg);
            throw new Error(errorMsg);
          }
          
          console.log(`[${new Date().toISOString()}] [GridARunStationAnalysis] Setting isAnalyzing to true`);
          setIsAnalyzing(true);
            
          const layerId = 
            options.stationType === 'gcs' 
              ? MAP_LAYERS.GCS_GRID 
              : options.stationType === 'observer' 
                ? MAP_LAYERS.OBSERVER_GRID 
                : MAP_LAYERS.REPEATER_GRID;
                
          layerManager.removeLayer(layerId);
          
          // Ensure we're using the valid location data for analysis
          const analysisOptions = {
            ...options,
            location: {
              lng: options.location.lng,
              lat: options.location.lat,
              elevation: options.location.elevation || 0
            }
          };
          
          console.log(`[${new Date().toISOString()}] [GridAnalysisController] Running analysis with:`, analysisOptions);
          
          const results = await runAnalysis(AnalysisType.STATION, analysisOptions);
          setResults(results);
          
          if (onComplete) onComplete(results);
          return results;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error(`[${new Date().toISOString()}] [GridAnalysisController] Station analysis error:`, error);
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
        }
      },
      
      async runMergedAnalysis(stations) {
        try {
          console.log(`[${new Date().toISOString()}] [GridArunMergedAnalysis] Setting isAnalyzing to true`);
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
      
      async checkStationToStationLOS(sourceStation, targetStation) {
        try {
          console.log(`[${new Date().toISOString()}] [GridAcheckStationToStationLOS] Setting isAnalyzing to true`);
          setIsAnalyzing(true);
          
          const losData = await checkStationToStationLOS(
            sourceStation,
            targetStation
          );
          
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
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
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
      elevationService,
    ]);

    return null;
  }
);

GridAnalysisController.displayName = 'GridAnalysisController';

export default GridAnalysisController;