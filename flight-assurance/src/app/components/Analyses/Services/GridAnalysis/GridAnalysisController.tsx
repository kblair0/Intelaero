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
import { useMarkersContext } from '../../../../context/MarkerContext';


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
          // Get the altitude mode from the flight plan
          const altitudeMode = flightPlan.features[0]?.properties?.waypoints?.[0]?.altitudeMode || "absolute";
          console.log(`[${new Date().toISOString()}] [GridAnalysisController] Flight plan altitude mode: ${altitudeMode}`);
          // After getting altitude mode:
          const waypoints = flightPlan.features[0]?.properties?.waypoints || [];
          console.log(`[Debug] Flight plan waypoints:`, waypoints);
          console.log(`[Debug] First coordinate:`, flightPlan.features[0].geometry.coordinates[0]);

          // ADD THIS CODE HERE - DEM source check
          if (map && map.getSource('mapbox-dem')) {
            console.log(`[Debug] Mapbox DEM source exists and is loaded: ${map.isSourceLoaded('mapbox-dem')}`);
          } else {
            console.error(`[Debug] Mapbox DEM source is missing or not properly configured`);
          }
        
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
          const results = await runAnalysis(AnalysisType.FLIGHT_PATH, { flightPlan, altitudeMode });

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

      async runFlightPathVisibilityAnalysis(options = {}) {
        if (!flightPlan) {
          throw new Error('No flight plan available');
        }
        
        try {
          console.log(`[${new Date().toISOString()}] [GridAnalysisController] runFlightPathVisibilityAnalysis called with options:`, options);
          
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
          
          console.log(`[${new Date().toISOString()}] [GridAnalysisController] Analyzing visibility with ${stations.length} stations`);
          setIsAnalyzing(true);
          
          // Remove previous visibility layer if it exists
          layerManager.removeLayer(MAP_LAYERS.FLIGHT_PATH_VISIBILITY);
          
          // Import the analysis module using dynamic import to maintain tree-shaking
          const { analyzeFlightPathVisibility, addVisibilityLayer } = await import(
            '../../LOSAnalyses/Utils/StationToFlightPathVisibilityAnalysis');
          
          // Set up the terrain elevation query function
          const queryTerrainElevation = async (coords: [number, number]) => {
            if (elevationService) {
              try {
                await elevationService.ensureTerrainReady();
                return await elevationService.getElevation(coords[0], coords[1]);
              } catch (error) {
                console.warn('ElevationService query failed, falling back to direct query:', error);
              }
            }
            
            try {
              const elevation = map?.queryTerrainElevation(coords);
              if (elevation !== null && elevation !== undefined) {
                return elevation;
              }
              return 0;
            } catch (error) {
              console.error('All elevation query methods failed:', error);
              return 0;
            }
          };
          
          // Run the analysis
          const visibilityResults = await analyzeFlightPathVisibility(
            map!,
            flightPlan,
            stations,
            queryTerrainElevation,
            {
              sampleInterval: options.sampleInterval || 10,
              minimumOffset: options.minimumOffset || 1,
              onProgress: (progress) => {
                setProgress(progress);
                if (onProgress) onProgress(progress);
              }
            }
          );
          
          console.log(`[${new Date().toISOString()}] [GridAnalysisController] Visibility analysis complete:`, {
            segmentCount: visibilityResults.segments.length,
            visibleLength: visibilityResults.stats.visibleLength,
            totalLength: visibilityResults.stats.totalLength,
            coverage: visibilityResults.stats.coveragePercentage
          });
          
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
          console.error(`[${new Date().toISOString()}] [GridAnalysisController] Flight path visibility analysis error:`, error);
          setError(message);
          if (onError) onError(error instanceof Error ? error : new Error(message));
          throw error;
        } finally {
          setIsAnalyzing(false);
          setProgress(0);
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
      gcsLocation,
      observerLocation,
      repeaterLocation,
      gcsElevationOffset,
      observerElevationOffset,
      repeaterElevationOffset
    ]);

    return null;
  }
);


GridAnalysisController.displayName = 'GridAnalysisController';

export default GridAnalysisController;