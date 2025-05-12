/**
 * useGridAnalysis.ts
 * 
 * Optimized React hook for grid-based Line of Sight (LOS) analyses.
 * Provides an interface between UI components and the optimized GridAnalysisCore.
 * Maintains the same API for existing UI components while using the more
 * efficient implementations internally.
 * 
 * This optimized hook replaces the existing useGridAnalysis.ts file while maintaining the same interface for the UI components. 
 */

import { useCallback, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapContext } from '../../../context/mapcontext';
import { useMarkersContext } from '../../../context/MarkerContext';
import { useLOSAnalysis } from '../../../context/LOSAnalysisContext';
import { layerManager, MAP_LAYERS } from '../../../services/LayerManager';
import { FlightPlanData } from '../../../context/FlightPlanContext';

// Import from the optimized core engine
import {
  generateGrid,
  checkStationLOS,
  checkFlightPathLOS,
  getLOSProfile,
  checkStationToStationLOS as coreCheckStationToStationLOS,
  generateCombinedBoundingBox,
  createError
} from '../Utils/GridAnalysisCore';

import {
  AnalysisResults,
  GridCell,
  LocationData,
  MarkerType,
  StationConfig,
  StationLOSResult,
  LOSProfilePoint,
  AnalysisType,
  Coordinates2D,
  Coordinates3D
} from '../Types/GridAnalysisTypes';

interface UseGridAnalysisOptions {
  onProgress?: (progress: number) => void;
}

export function useGridAnalysis(options: UseGridAnalysisOptions = {}) {
  const { map, elevationService } = useMapContext();
  const { 
    gcsLocation, 
    observerLocation, 
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset
  } = useMarkersContext();
  const { 
    gridSize, 
    elosGridRange,
    isAnalyzing, 
    setIsAnalyzing,
    setResults,
    setError,
    setProgress: setGlobalProgress
  } = useLOSAnalysis();

  // State and refs
  const [analysisInProgress, setAnalysisInProgress] = useState<AnalysisType | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { timestamp: number; result: AnalysisResults }>>(new Map());

  /**
   * Updates progress and notifies via callback
   */
  const updateProgress = useCallback((value: number) => {
    setProgress(value);
    setGlobalProgress(value);
    if (options.onProgress) {
      options.onProgress(value);
    }
  }, [options, setGlobalProgress]);

  /**
   * Cleans up after analysis
   */
  const cleanupAnalysis = useCallback(() => {
    setAnalysisInProgress(null);
    setProgress(0);
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Aborts any running analysis
   */
  const abortAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);
    cleanupAnalysis();
  }, [cleanupAnalysis, setIsAnalyzing]);

  /**
   * Visualizes grid cells on the map
   */
  const visualizeGrid = useCallback(
    (analysisResults: AnalysisResults, layerId: string = MAP_LAYERS.ELOS_GRID) => {
      if (!map) {
        console.error('Map not initialized, cannot visualize grid');
        return;
      }
  
      try {
        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: analysisResults.cells.map((cell) => ({
            type: 'Feature',
            geometry: cell.geometry,
            properties: cell.properties,
          })),
        };
  
        if (map.getSource(layerId)) {
          const source = map.getSource(layerId) as mapboxgl.GeoJSONSource;
          source.setData(geojson);
          return;
        }
        
        map.addSource(layerId, {
          type: 'geojson',
          data: geojson,
        });

        // Define color ramp based on layer type
        const colorRamp = layerId === MAP_LAYERS.MERGED_VISIBILITY
          ? [
              'interpolate',
              ['linear'],
              ['get', 'visibility'],
              0, '#d32f2f',   // Red: No stations
              50, '#1976d2',  // Blue: One station
              100, '#7cb342'  // Green: Two or more stations
            ]
          : [
              'interpolate',
              ['linear'],
              ['get', 'visibility'],
              0, '#d32f2f',   // Red
              25, '#f57c00',  // Orange
              50, '#fbc02d',  // Yellow
              75, '#7cb342',  // Green
              100, '#1976d2'  // Blue
            ];

        map.addLayer({
          id: layerId,
          type: 'fill',
          source: layerId,
          paint: {
            'fill-color': colorRamp,
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0.7,
              15, 0.5,
            ],
          },
        });

        // Set up popup
        const onMouseMove = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const vis = feature.properties?.visibility?.toFixed(1);
            const elev = feature.properties?.elevation?.toFixed(1);
            
            if (onMouseMove.popup) {
              onMouseMove.popup.remove();
            }
            
            onMouseMove.popup = new mapboxgl.Popup({
              closeButton: false,
              closeOnMove: true,
            })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="bg-white text-black p-2 rounded shadow">
                  <strong>Visibility Analysis</strong>
                  <hr class="my-1 border-gray-300"/>
                  <div class="grid grid-cols-2 gap-1">
                    <span>Visibility:</span>
                    <strong>${vis || 'N/A'}%</strong>
                    <span>Terrain Elevation:</span>
                    <strong>${elev || 'N/A'}m</strong>
                    <span>Distance Range:</span>
                    <strong>${elosGridRange}m</strong>
                  </div>
                </div>
              `)
              .addTo(map);
          }
        };
        
        // Set up event handling
        onMouseMove.popup = null;
        
        const onMouseLeave = () => {
          if (onMouseMove.popup) {
            onMouseMove.popup.remove();
            onMouseMove.popup = null;
          }
        };
        
        map.off('mousemove', layerId, onMouseMove);
        map.off('mouseleave', layerId, onMouseLeave);
        map.on('mousemove', layerId, onMouseMove);
        map.on('mouseleave', layerId, onMouseLeave);
        
        layerManager.registerLayer(layerId, true);
      } catch (error) {
        console.error('Error in visualization:', error);
      }
    },
    [map, elosGridRange]
  );

  /**
   * Optimized flight path analysis implementation
   */
  const analyzeFlightPath = useCallback(
    async (flightPlan: FlightPlanData): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
      
      setIsAnalyzing(true);
      const startTime = performance.now();
      setAnalysisInProgress(AnalysisType.FLIGHT_PATH);
      abortControllerRef.current = new AbortController();

      try {
        updateProgress(5);

        // Validate flight plan
        if (!flightPlan || !flightPlan.features || !flightPlan.features[0] || 
            flightPlan.features[0].geometry.type !== 'LineString') {
          const error = new Error('Invalid flight plan geometry');
          throw error;
        }

        // Extract and validate 3D coordinates
        const flightPath = flightPlan.features[0];
        const flightCoordinates = flightPath.geometry.coordinates as [number, number, number][];

        // Determine altitude mode
        const waypoints = flightPath.properties?.waypoints || [];
        const altitudeMode = waypoints.length > 0 ? 
          waypoints[0].altitudeMode : 
          "absolute"; // Default

        updateProgress(10);

        // Generate grid using optimized core function
        const cells = await generateGrid(map, {
          flightPath,
          elosGridRange,
          gridSize,
          elevationService
        });

        if (!cells || !cells.length) {
          throw new Error('Generated grid is empty');
        }

        updateProgress(40);

        // Process cells in optimized batches
        const chunkSize = 100; // Larger batch size for efficiency
        const results: GridCell[] = [];
        let visibleCellCount = 0;
        let totalVisibility = 0;

        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }

          const chunk = cells.slice(i, i + chunkSize);
          
          // Process chunk in parallel
          const processedChunk = await Promise.all(
            chunk.map(async (cell) => {
              try {
                const center = [
                  (cell.geometry.coordinates[0][0][0] + cell.geometry.coordinates[0][2][0]) / 2,
                  (cell.geometry.coordinates[0][0][1] + cell.geometry.coordinates[0][2][1]) / 2
                ] as Coordinates2D;
                
                const visibility = await checkFlightPathLOS(
                  map,
                  [center[0], center[1], cell.properties.elevation || 0],
                  flightCoordinates,
                  { altitudeMode, elevationService }
                );

                if (visibility > 0) visibleCellCount++;
                totalVisibility += visibility;
          
                return {
                  ...cell,
                  properties: {
                    ...cell.properties,
                    visibility,
                    fullyVisible: visibility === 100,
                    lastAnalyzed: Date.now(),
                  },
                };
              } catch (e) {
                console.warn('Error processing cell:', e);
                return cell; // Return unmodified on error
              }
            })
          );

          results.push(...processedChunk);
          const progressValue = 40 + Math.min(50, ((i + chunkSize) / cells.length) * 50);
          updateProgress(progressValue);
          await new Promise(resolve => setTimeout(resolve, 0)); // Let UI breathe
        }

        updateProgress(95);

        const analysisTime = performance.now() - startTime;
        const analysisResults: AnalysisResults = {
          cells: results,
          stats: {
            totalCells: cells.length,
            visibleCells: visibleCellCount,
            averageVisibility: totalVisibility / cells.length,
            analysisTime,
          },
        };

        visualizeGrid(analysisResults, MAP_LAYERS.ELOS_GRID);
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        return analysisResults;
      } catch (error) {
        console.error(`Flight path analysis error:`, error);
        throw error;
      } finally {
        cleanupAnalysis();
        setIsAnalyzing(false);
      }
    },
    [
      map,
      gridSize,
      elosGridRange,
      updateProgress,
      visualizeGrid,
      cleanupAnalysis,
      setIsAnalyzing,
      elevationService
    ]
  );

  /**
   * Analyzes visibility from a single station
   */
  const analyzeStation = useCallback(
    async ({
      stationType,
      location,
      range,
      elevationOffset,
      markerId,
      layerId
    }: {
      stationType: "gcs" | "observer" | "repeater";
      location: LocationData;
      range: number;
      elevationOffset: number;
      markerId?: string;
      layerId?: string;
    }): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
  
      setIsAnalyzing(true);
      const startTime = performance.now();
  
      try {
        // Validate location data
        if (!location || typeof location.lng !== 'number' || typeof location.lat !== 'number') {
          throw createError(`${stationType.toUpperCase()} location not set or invalid`, 'INVALID_INPUT');
        }
  
        updateProgress(10);
  
        // Generate grid using optimized core function
        const cells = await generateGrid(map, {
          center: [location.lng, location.lat],
          range,
          gridSize,
          elevationService
        });
  
        if (!cells || !cells.length) {
          throw createError('Failed to generate grid', 'GRID_GENERATION');
        }
  
        updateProgress(40);

        // Get observer elevation
        const stationElevation = location.elevation ?? 
          await elevationService?.getElevation(location.lng, location.lat) ?? 0;

        const stationPosition: Coordinates3D = [
          location.lng,
          location.lat,
          stationElevation + elevationOffset,
        ];

        // Process in optimized batches
        const chunkSize = 100;
        let visibleCells = 0;
        let totalVisibility = 0;
        const updatedCells: GridCell[] = [];

        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }

          const chunk = cells.slice(i, i + chunkSize);
          
          // Process in parallel
          const chunkResults = await Promise.all(
            chunk.map(async (cell) => {
              try {
                const center = [
                  (cell.geometry.coordinates[0][0][0] + cell.geometry.coordinates[0][2][0]) / 2,
                  (cell.geometry.coordinates[0][0][1] + cell.geometry.coordinates[0][2][1]) / 2
                ];
                
                const isVisible = await checkStationLOS(
                  map,
                  stationPosition,
                  [center[0], center[1], cell.properties.elevation || 0],
                  { elevationService }
                );

                const visibility = isVisible ? 100 : 0;
                if (isVisible) {
                  visibleCells++;
                  totalVisibility += 100;
                }

                return {
                  ...cell,
                  properties: {
                    ...cell.properties,
                    visibility,
                    fullyVisible: isVisible,
                    lastAnalyzed: Date.now(),
                  },
                };
              } catch (e) {
                console.warn('Error processing cell:', e);
                return cell; // Return unmodified on error
              }
            })
          );

          updatedCells.push(...chunkResults);
          const progressValue = 40 + ((i + chunkSize) / cells.length) * 50;
          updateProgress(progressValue);
          await new Promise(resolve => setTimeout(resolve, 0)); // Let UI breathe
        }

        const analysisTime = performance.now() - startTime;
        updateProgress(95);

      // Use the provided layerId or generate a default one
      const effectiveLayerId = layerId || 
        (stationType === 'gcs' ? MAP_LAYERS.GCS_GRID :
         stationType === 'observer' ? MAP_LAYERS.OBSERVER_GRID :
         MAP_LAYERS.REPEATER_GRID);

      const analysisResults: AnalysisResults = {
        cells: updatedCells,
        stats: {
          visibleCells: visibleCells,
          totalCells: cells.length,
          averageVisibility: cells.length > 0 ? totalVisibility / cells.length : 0,
          analysisTime,
        },
      };

      // Visualize with the effective layer ID
      visualizeGrid(analysisResults, effectiveLayerId);
      
      updateProgress(100);
      setLastAnalysisTime(Date.now());
      return analysisResults;
    } catch (error) {
      console.error(`Station analysis error:`, error);
      throw error;
    } finally {
      updateProgress(0);
      cleanupAnalysis();
      setIsAnalyzing(false);
    }
  },
    [
      map,
      gridSize,
      elevationService,
      updateProgress,
      visualizeGrid,
      cleanupAnalysis,
      setIsAnalyzing
    ]
  );

  /**
   * Optimized merged analysis implementation
   */
  const analyzeMerged = useCallback(
    async ({ stations }: { 
      stations: Array<{
        type: "gcs" | "observer" | "repeater";
        location: LocationData;
        range: number;
        elevationOffset: number;
      }> 
    }): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }

      setIsAnalyzing(true);
      const startTime = performance.now();

      try {
        if (!stations || !Array.isArray(stations) || stations.length < 2) {
          throw new Error("At least two stations are required for merged analysis");
        }

        // Validate stations
        for (const station of stations) {
          if (!station.location || 
              typeof station.location.lng !== 'number' || 
              typeof station.location.lat !== 'number') {
            throw new Error(`Invalid location data for station (${station.type})`);
          }
        }
        
        updateProgress(10);

        // Generate combined bounding box
        const bbox = generateCombinedBoundingBox(stations);
        const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as Coordinates2D;
        const maxRange = Math.max(...stations.map(s => s.range));
        
        // Prepare station positions with elevations
        const stationPositions = await Promise.all(stations.map(async (station) => {
          const elev = station.location.elevation ?? 
            await elevationService?.getElevation(station.location.lng, station.location.lat) ?? 0;
          
          return {
            type: station.type,
            position: [
              station.location.lng,
              station.location.lat,
              elev + station.elevationOffset
            ] as Coordinates3D
          };
        }));
        
        updateProgress(20);
        
        // Generate grid - use larger grid size for better performance
        const cells = await generateGrid(map, {
          center,
          range: maxRange * 1.1, // Slightly larger to ensure coverage
          gridSize,
          elevationService
        });
        
        if (!cells.length) {
          throw new Error('Failed to generate grid for merged analysis');
        }
        
        updateProgress(40);
        
        // Process in more efficient batches
        const chunkSize = 100;
        let visibleCells = 0;
        let visibilitySum = 0;
        
        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }
          
          const chunk = cells.slice(i, i + chunkSize);
          
          // Process batch in parallel
          await Promise.all(chunk.map(async (cell, cellIndex) => {
            try {
              const center = [
                (cell.geometry.coordinates[0][0][0] + cell.geometry.coordinates[0][2][0]) / 2,
                (cell.geometry.coordinates[0][0][1] + cell.geometry.coordinates[0][2][1]) / 2
              ] as Coordinates2D;
              
              const targetPosition: Coordinates3D = [
                center[0],
                center[1],
                cell.properties.elevation || 0
              ];
              
              let visibleStationCount = 0;
              
              // Check visibility from each station
              for (const station of stationPositions) {
                const isVisible = await checkStationLOS(
                  map,
                  station.position,
                  targetPosition,
                  { elevationService }
                );
                
                if (isVisible) {
                  visibleStationCount++;
                }
              }
              
              // Set visibility based on number of visible stations
              let visibilityPercentage = 0;
              if (visibleStationCount === 1) {
                visibilityPercentage = 50;
              } else if (visibleStationCount >= 2) {
                visibilityPercentage = 100;
              }
              
              cell.properties.visibility = visibilityPercentage;
              cell.properties.fullyVisible = visibleStationCount >= stationPositions.length;
              cell.properties.visibleStationCount = visibleStationCount;
              cell.properties.lastAnalyzed = Date.now();
              
              if (visibleStationCount > 0) {
                visibleCells++;
                visibilitySum += visibilityPercentage;
              }
            } catch (e) {
              console.warn('Error analyzing merged cell:', e);
            }
          }));
          
          const progressValue = 40 + ((i + chunkSize) / cells.length) * 50;
          updateProgress(progressValue);
          await new Promise(resolve => setTimeout(resolve, 0)); // Let UI breathe
        }
        
        updateProgress(95);
        
        const analysisTime = performance.now() - startTime;
        const analysisResults: AnalysisResults = {
          cells,
          stats: {
            visibleCells,
            totalCells: cells.length,
            averageVisibility: cells.length > 0 ? visibilitySum / cells.length : 0,
            analysisTime,
          },
        };
        
        visualizeGrid(analysisResults, MAP_LAYERS.MERGED_VISIBILITY);
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        return analysisResults;
      } catch (error) {
        console.error(`Merged analysis error:`, error);
        throw error;
      } finally {
        updateProgress(0);
        cleanupAnalysis();
        setIsAnalyzing(false);
      }
    },
    [
      map,
      gridSize,
      elevationService,
      updateProgress,
      visualizeGrid,
      cleanupAnalysis,
      setIsAnalyzing
    ]
  );

/**
 * Checks LOS between two stations - either by marker IDs or station types
 */
const checkStationToStationLOS = useCallback(
  async (
    sourceStationData: string | { type: string; location: LocationData; elevationOffset: number },
    targetStationData: string | { type: string; location: LocationData; elevationOffset: number }
  ): Promise<{ result: StationLOSResult; profile: LOSProfilePoint[] }> => {
    if (!map) {
      throw createError('Map not initialized', 'MAP_INTERACTION');
    }
    
    setIsAnalyzing(true);

    try {
      // Handle string-based station types (backward compatibility)
      if (typeof sourceStationData === 'string' && typeof targetStationData === 'string') {
        // Original implementation for string-based station types
        const sourceStation = sourceStationData as 'gcs' | 'observer' | 'repeater';
        const targetStation = targetStationData as 'gcs' | 'observer' | 'repeater';

        // Log the station types for debugging
        console.log('Using string-based station types:', { sourceStation, targetStation });
    
        const stations = {
          gcs: {
            location: gcsLocation,
            offset: gcsElevationOffset,
          },
          observer: {
            location: observerLocation,
            offset: observerElevationOffset,
          },
          repeater: {
            location: repeaterLocation,
            offset: repeaterElevationOffset,
          },
        };
    
        // Ensure sourceStation and targetStation are valid strings
        if (!['gcs', 'observer', 'repeater'].includes(sourceStation)) {
          throw new Error(`Invalid source station type: ${sourceStation}`);
        }
    
        if (!['gcs', 'observer', 'repeater'].includes(targetStation)) {
          throw new Error(`Invalid target station type: ${targetStation}`);
        }
    
        const source = stations[sourceStation as keyof typeof stations];
        const target = stations[targetStation as keyof typeof stations];
        
        // Defensive null check before accessing properties
        if (!source?.location || !target?.location) {
          console.error('Station details:', {
            source: { type: sourceStation, data: source },
            target: { type: targetStation, data: target }
          });
          throw new Error(`Both ${sourceStation} and ${targetStation} must be on the map with valid locations.`);
        }
    
        updateProgress(20);
        
        // Use the renamed core function to avoid recursion
        const losData = await coreCheckStationToStationLOS(
          map,
          {
            location: source.location,
            elevationOffset: source.offset
          },
          {
            location: target.location,
            elevationOffset: target.offset
          },
          { elevationService }
        );
        
        updateProgress(100);
        return losData;
      } 
      // Handle direct object station data
      else if (
        typeof sourceStationData === 'object' && sourceStationData !== null &&
        typeof targetStationData === 'object' && targetStationData !== null
      ) {
        // New implementation for object-based station data
        console.log('Using object-based station data');
        
        const sourceStation = sourceStationData as { type: string; location: LocationData; elevationOffset: number };
        const targetStation = targetStationData as { type: string; location: LocationData; elevationOffset: number };

        // Validate input objects
        if (!sourceStation.location || !targetStation.location) {
          console.error('Invalid station data:', { sourceStation, targetStation });
          throw new Error('Both source and target stations must have valid location data');
        }

        updateProgress(20);
        
        // Directly use the core function with the station objects
        const losData = await coreCheckStationToStationLOS(
          map,
          {
            location: sourceStation.location,
            elevationOffset: sourceStation.elevationOffset
          },
          {
            location: targetStation.location,
            elevationOffset: targetStation.elevationOffset
          },
          { elevationService }
        );
        
        updateProgress(100);
        return losData;
      }
      else {
        throw new Error(`Invalid station data format. Expected either station type strings or station objects.`);
      }
    } catch (error) {
      console.error(`Station-to-station LOS error:`, error);
      throw error;
    } finally {
      updateProgress(0);
      cleanupAnalysis();
      setIsAnalyzing(false);
    }
  },
  [
    map,
    gcsLocation,
    observerLocation,
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset,
    elevationService,
    updateProgress,
    cleanupAnalysis,
    setIsAnalyzing
  ]
);
  /**
   * Main analysis function that handles all analysis types
   */
  const runAnalysis = useCallback(
    async (type: AnalysisType, options?: any): Promise<AnalysisResults> => {
      if (isAnalyzing) {
        throw createError('Analysis already in progress', 'INVALID_INPUT');
      }
  
      try {
        setIsAnalyzing(true);
        setError(null);
  
        let result: AnalysisResults;

        switch (type) {
          case AnalysisType.FLIGHT_PATH:
            if (!options?.flightPlan) {
              throw createError('Flight plan is required', 'INVALID_INPUT');
            }
            result = await analyzeFlightPath(options.flightPlan);
            break;

          case AnalysisType.STATION:
            if (!options?.stationType || !options?.location || !options?.range) {
              throw createError('Station type, location, and range are required', 'INVALID_INPUT');
            }
           
            result = await analyzeStation({
              stationType: options.stationType,
              location: options.location,
              range: options.range,
              elevationOffset: options.elevationOffset || 0
            });
            break;

          case AnalysisType.MERGED:
            if (!options?.stations || options.stations.length < 2) {
              throw createError('At least two stations are required', 'INVALID_INPUT');
            }
            result = await analyzeMerged({ stations: options.stations });
            break;

          case AnalysisType.STATION_TO_STATION:
            if (!options?.sourceStation || !options?.targetStation) {
              throw createError('Source and target stations are required', 'INVALID_INPUT');
            }
            // Pass the station data objects directly to checkStationToStationLOS
            const stationResult = await checkStationToStationLOS(
              options.sourceStation,
              options.targetStation
            );
            result = {
              cells: [],
              stats: {
                visibleCells: 0,
                totalCells: 0,
                averageVisibility: stationResult.result.clear ? 100 : 0,
                analysisTime: 0,
              },
              stationLOSResult: stationResult.result,
            };
            break;

          default:
            throw createError(`Unsupported analysis type: ${type}`, 'INVALID_INPUT');
        }

        setResults(result);
        return result;
      } catch (error) {
        console.error(`Analysis error, type: ${type}:`, error);
        setError(error.message || 'Analysis failed');
        throw error;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [
      isAnalyzing,
      setIsAnalyzing,
      setError,
      setResults,
      analyzeFlightPath,
      analyzeStation,
      analyzeMerged,
      checkStationToStationLOS
    ]
  );

  // Return the same interface for backward compatibility
  return {
    isAnalyzing: isAnalyzing || analysisInProgress !== null,
    currentAnalysisType: analysisInProgress,
    progress,
    lastAnalysisTime,
    runAnalysis,
    analyzeFlightPath,
    analyzeStation,
    analyzeMerged,
    checkStationToStationLOS,
    abortAnalysis,
    visualizeGrid
  };
}