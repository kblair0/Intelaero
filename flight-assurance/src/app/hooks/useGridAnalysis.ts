// src/app/hooks/useGridAnalysis.ts

/**
 * useGridAnalysis.ts
 * 
 * This hook provides a comprehensive interface for performing grid-based
 * Line of Sight (LOS) analyses. It handles flight path analysis, station-based
 * analysis, merged visibility, station-to-station LOS, and elevation profiles.
 * 
 * It integrates with:
 * - MapContext for map instance access
 * - MarkerContext for station location data
 * - LOSAnalysisContext for analysis configuration and results storage
 * - LayerManager for visualization
 */

import { useCallback, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { useMapContext } from '../context/mapcontext';
import { useMarkersContext } from '../context/MarkerContext';
import { useLOSAnalysis } from '../context/LOSAnalysisContext';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';
import { 
  createTerrainElevationQuerier,
  generateGrid,
  checkLineOfSight,
  getLOSProfile,
  generateCombinedBoundingBox,
  createError
} from '../utils/gridAnalysisUtils';
import {
  AnalysisResults,
  GridCell,
  LocationData,
  MarkerType,
  StationConfig,
  StationLOSResult,
  LOSProfilePoint,
  AnalysisType
} from '../types/GridAnalysisTypes';
import { FlightPlanData } from '../context/FlightPlanContext';

interface UseGridAnalysisOptions {
  onProgress?: (progress: number) => void;
}

export function useGridAnalysis(options: UseGridAnalysisOptions = {}) {
  const { map } = useMapContext();
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

  // State
  const [analysisInProgress, setAnalysisInProgress] = useState<AnalysisType | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { timestamp: number; result: AnalysisResults }>>(new Map());

  // Get terrain elevation function
  const getTerrainElevation = useCallback(
    (coords: [number, number]): Promise<number> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
      const querier = createTerrainElevationQuerier(map);
      return querier(coords);
    },
    [map]
  );

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
        throw createError('Map not initialized', 'MAP_INTERACTION');
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

        // If source exists, update data
        if (map.getSource(layerId)) {
          const source = map.getSource(layerId) as mapboxgl.GeoJSONSource;
          source.setData(geojson);
          return;
        }

        // Otherwise create new source and layer
        map.addSource(layerId, {
          type: 'geojson',
          data: geojson,
        });

        map.addLayer({
          id: layerId,
          type: 'fill',
          source: layerId,
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'visibility'],
              0, '#d32f2f',
              25, '#f57c00',
              50, '#fbc02d',
              75, '#7cb342',
              100, '#1976d2',
            ],
            'fill-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0.7,
              15, 0.5,
            ],
          },
        });

        // Setup popup event handlers
        const onMouseMove = (e: mapboxgl.MapMouseEvent & mapboxgl.EventData) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const vis = feature.properties?.visibility?.toFixed(1);
            const elev = feature.properties?.elevation?.toFixed(1);
            
            // Remove any existing popup
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
        
        // Add property to store popup reference
        onMouseMove.popup = null;
        
        const onMouseLeave = () => {
          if (onMouseMove.popup) {
            onMouseMove.popup.remove();
            onMouseMove.popup = null;
          }
        };
        
        // Add event listeners
        map.off('mousemove', layerId, onMouseMove);
        map.off('mouseleave', layerId, onMouseLeave);
        map.on('mousemove', layerId, onMouseMove);
        map.on('mouseleave', layerId, onMouseLeave);
        
        // Register with LayerManager
        layerManager.registerLayer(layerId, true);
      } catch (error) {
        console.error('Error in visualization:', error);
        throw createError('Failed to visualize analysis results', 'MAP_INTERACTION', error);
      }
    },
    [map, elosGridRange]
  );

  /**
   * Analyzes visibility from a flight path
   */
  const analyzeFlightPath = useCallback(
    async (flightPlan: FlightPlanData): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }

      const startTime = performance.now();
      setAnalysisInProgress(AnalysisType.FLIGHT_PATH);
      abortControllerRef.current = new AbortController();

      try {
        updateProgress(5);

        // Extract flight path as LineString
        const flightPath = flightPlan.features[0];
        if (!flightPath || flightPath.geometry.type !== 'LineString') {
          throw createError('Invalid flight path geometry', 'INVALID_INPUT');
        }

        // Generate grid
        updateProgress(10);
        const cells = await generateGrid(getTerrainElevation, gridSize, {
          flightPath,
          elosGridRange,
        });
        
        updateProgress(30);

        // Extract 3D coordinates
        const flightCoordinates = flightPath.geometry.coordinates as [number, number, number][];

        // Process cells in chunks for better UI responsiveness
        const chunkSize = 50;
        const results: GridCell[] = [];
        let visibleCellCount = 0;
        let totalVisibility = 0;

        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }

          const chunk = cells.slice(i, i + chunkSize);
          const processedChunk = await Promise.all(
            chunk.map(async (cell) => {
              const center = turf.center(cell.geometry);
              const targetElevation = cell.properties.elevation ?? 0;
              // src/app/hooks/useGridAnalysis.ts (continued)

              // Check visibility from flight path
              let visiblePoints = 0;
              let pointsInRange = 0;

              // For each point in flight path
              for (const coord of flightCoordinates) {
                // Calculate distance from this flight path point to the cell
                const pointDistance = turf.distance(
                  [coord[0], coord[1]],
                  center.geometry.coordinates,
                  { units: 'meters' }
                );

                // Only consider points within ELOS range
                if (pointDistance <= elosGridRange) {
                  pointsInRange++;
                  
                  const isVisible = await checkLineOfSight(
                    getTerrainElevation,
                    [coord[0], coord[1], coord[2]],
                    [...center.geometry.coordinates, targetElevation],
                    { minimumOffset: 1 }
                  );

                  if (isVisible) {
                    visiblePoints++;
                  }
                }
              }

              // Calculate visibility percentage
              const visibility = pointsInRange === 0 ? 0 : (visiblePoints / pointsInRange) * 100;
              const isFullyVisible = visibility === 100;

              if (isFullyVisible) visibleCellCount++;
              totalVisibility += visibility;

              return {
                ...cell,
                properties: {
                  ...cell.properties,
                  visibility,
                  fullyVisible: isFullyVisible,
                },
              };
            })
          );

          results.push(...processedChunk);

          // Update progress
          const progressValue = 30 + Math.min(60, ((i + chunkSize) / cells.length) * 60);
          updateProgress(progressValue);

          // Yield control to UI
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const analysisTime = performance.now() - startTime;
        updateProgress(95);

        // Prepare results
        const analysisResults: AnalysisResults = {
          cells: results,
          stats: {
            totalCells: cells.length,
            visibleCells: visibleCellCount,
            averageVisibility: totalVisibility / cells.length,
            analysisTime,
          },
        };

        // Visualize results
        visualizeGrid(analysisResults, MAP_LAYERS.ELOS_GRID);
        
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        return analysisResults;
      } catch (error) {
        if (error.message !== 'Analysis aborted') {
          console.error('Flight path analysis error:', error);
          throw error;
        }
        throw error;
      } finally {
        cleanupAnalysis();
      }
    },
    [
      map,
      gridSize,
      elosGridRange,
      getTerrainElevation,
      visualizeGrid,
      updateProgress,
      cleanupAnalysis,
    ]
  );

  /**
   * Analyzes visibility from a single station
   */
  const analyzeStation = useCallback(
    async (stationType: MarkerType, location: LocationData, range: number): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }

      const startTime = performance.now();
      setAnalysisInProgress(AnalysisType.STATION);
      abortControllerRef.current = new AbortController();

      try {
        updateProgress(5);

        // Get the station's elevation offset
        let stationOffset = 0;
        if (stationType === 'gcs') {
          stationOffset = gcsElevationOffset;
        } else if (stationType === 'observer') {
          stationOffset = observerElevationOffset;
        } else if (stationType === 'repeater') {
          stationOffset = repeaterElevationOffset;
        }

        // Calculate effective station elevation (terrain + offset)
        const stationElevation = (location.elevation ?? 0) + stationOffset;

        // Generate grid for this station
        updateProgress(20);
        const cells = await generateGrid(getTerrainElevation, gridSize, {
          center: [location.lng, location.lat],
          range,
        });

        updateProgress(40);

        // Process cells in chunks
        const chunkSize = 50;
        const results: GridCell[] = [];
        let visibleCellCount = 0;
        let totalVisibility = 0;

        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }

          const chunk = cells.slice(i, i + chunkSize);
          const processedChunk = await Promise.all(
            chunk.map(async (cell) => {
              const center = turf.center(cell.geometry);
              
              const isVisible = await checkLineOfSight(
                getTerrainElevation,
                [location.lng, location.lat, stationElevation],
                [...center.geometry.coordinates, cell.properties.elevation ?? 0],
                { minimumOffset: 1 }
              );

              const visibility = isVisible ? 100 : 0;
              if (isVisible) visibleCellCount++;
              totalVisibility += visibility;

              return {
                ...cell,
                properties: {
                  ...cell.properties,
                  visibility,
                  fullyVisible: isVisible,
                },
              };
            })
          );

          results.push(...processedChunk);

          // Update progress
          const progressValue = 40 + Math.min(50, ((i + chunkSize) / cells.length) * 50);
          updateProgress(progressValue);

          // Yield control to UI
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const analysisTime = performance.now() - startTime;
        updateProgress(95);

        // Prepare results
        const analysisResults: AnalysisResults = {
          cells: results,
          stats: {
            totalCells: cells.length,
            visibleCells: visibleCellCount,
            averageVisibility: totalVisibility / cells.length,
            analysisTime,
          },
        };

        // Visualize results (use different layer based on station type)
        const layerId = stationType === 'gcs' 
          ? MAP_LAYERS.GCS_GRID 
          : stationType === 'observer' 
            ? MAP_LAYERS.OBSERVER_GRID 
            : MAP_LAYERS.REPEATER_GRID;
        
        visualizeGrid(analysisResults, layerId);
        
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        return analysisResults;
      } catch (error) {
        if (error.message !== 'Analysis aborted') {
          console.error('Station analysis error:', error);
          throw error;
        }
        throw error;
      } finally {
        cleanupAnalysis();
      }
    },
    [
      map,
      gridSize,
      getTerrainElevation,
      gcsElevationOffset,
      observerElevationOffset,
      repeaterElevationOffset,
      visualizeGrid,
      updateProgress,
      cleanupAnalysis,
    ]
  );

  /**
   * Runs a merged analysis of multiple stations
   */
  const analyzeMerged = useCallback(
    async (stations: StationConfig[]): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
      
      if (stations.length < 2) {
        throw createError('At least two stations are required for merged analysis', 'INVALID_INPUT');
      }

      const startTime = performance.now();
      setAnalysisInProgress(AnalysisType.MERGED);
      abortControllerRef.current = new AbortController();

      try {
        updateProgress(5);
        
        // Calculate a combined bounding box for all stations
        const combinedBbox = generateCombinedBoundingBox(
          stations.map(s => ({
            location: s.location,
            range: s.range
          }))
        );
        
        // Generate grid points over this area
        const grid = turf.pointGrid(combinedBbox, gridSize, { units: 'meters' });
        updateProgress(15);
        
        // Process grid into cells
        const cells: GridCell[] = await Promise.all(
          grid.features.map(async (point, index) => {
            try {
              // Create a circular cell at the grid point
              const cellPolygon = turf.circle(point.geometry.coordinates, gridSize / 2, {
                units: 'meters',
                steps: 4,
              });

              // Get terrain elevation for the cell
              const elevation = await getTerrainElevation(point.geometry.coordinates as [number, number])
                .catch(e => {
                  console.warn('Elevation fetch error:', e);
                  return 0;
                });

              return {
                id: `merged-cell-${index}`,
                geometry: cellPolygon.geometry as GeoJSON.Polygon,
                properties: {
                  visibility: 0,
                  fullyVisible: false,
                  elevation,
                  lastAnalyzed: Date.now(),
                },
              };
            } catch (error) {
              console.error('Error processing grid cell:', error);
              throw error;
            }
          })
        );
        
        updateProgress(30);
        
        // Process visibility for each cell
        const chunkSize = 50;
        const results: GridCell[] = [];
        let visibleCellCount = 0;
        let totalVisibility = 0;

        // Prepare effective station coordinates
        const stationPoints = stations.map(s => ({
          coords: [
            s.location.lng, 
            s.location.lat, 
            (s.location.elevation ?? 0) + s.elevationOffset
          ] as [number, number, number],
          range: s.range
        }));

        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }

          const chunk = cells.slice(i, i + chunkSize);
          const processedChunk = await Promise.all(
            chunk.map(async (cell) => {
              try {
                const center = turf.center(cell.geometry);
                const cellCoords = [...center.geometry.coordinates, cell.properties.elevation ?? 0] as [number, number, number];
                
                // Check visibility from each station
                const stationVisibilities = await Promise.all(
                  stationPoints.map(async station => {
                    // Check if within range
                    const distance = turf.distance(
                      [station.coords[0], station.coords[1]],
                      [cellCoords[0], cellCoords[1]],
                      { units: 'meters' }
                    );
                    
                    if (distance > station.range) return 0;
                    
                    // Check line of sight
                    const visible = await checkLineOfSight(
                      getTerrainElevation,
                      station.coords,
                      cellCoords,
                      { minimumOffset: 1 }
                    );
                    
                    return visible ? 100 : 0;
                  })
                );
                
                // Take maximum visibility from any station
                const maxVisibility = Math.max(...stationVisibilities);
                const isFullyVisible = maxVisibility === 100;
                
                if (isFullyVisible) visibleCellCount++;
                totalVisibility += maxVisibility;
                
                return {
                  ...cell,
                  properties: {
                    ...cell.properties,
                    visibility: maxVisibility,
                    fullyVisible: isFullyVisible
                  }
                };
              } catch (error) {
                console.error('Error processing cell visibility:', error);
                throw error;
              }
            })
          );

          results.push(...processedChunk);

          // Update progress
          const progressValue = 30 + Math.min(60, ((i + chunkSize) / cells.length) * 60);
          updateProgress(progressValue);

          // Yield control to UI
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const analysisTime = performance.now() - startTime;
        updateProgress(95);

        // Prepare results
        const analysisResults: AnalysisResults = {
          cells: results,
          stats: {
            totalCells: cells.length,
            visibleCells: visibleCellCount,
            averageVisibility: totalVisibility / cells.length,
            analysisTime,
          },
        };

        // Visualize results
        visualizeGrid(analysisResults, MAP_LAYERS.MERGED_VISIBILITY);
        
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        return analysisResults;
      } catch (error) {
        if (error.message !== 'Analysis aborted') {
          console.error('Merged analysis error:', error);
          throw error;
        }
        throw error;
      } finally {
        cleanupAnalysis();
      }
    },
    [
      map,
      gridSize,
      getTerrainElevation,
      visualizeGrid,
      updateProgress,
      cleanupAnalysis,
    ]
  );

  /**
   * Checks line of sight between two stations
   */
  const checkStationToStationLOS = useCallback(
    async (
      sourceStation: MarkerType,
      targetStation: MarkerType
    ): Promise<{ result: StationLOSResult; profile: LOSProfilePoint[] }> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }

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

      const source = stations[sourceStation];
      const target = stations[targetStation];

      if (!source.location || !target.location) {
        throw createError(
          `Both ${sourceStation} and ${targetStation} locations must be set`,
          'INVALID_INPUT'
        );
      }

      setAnalysisInProgress(AnalysisType.STATION_TO_STATION);
      try {
        updateProgress(10);

        const sourcePoint: [number, number, number] = [
          source.location.lng,
          source.location.lat,
          (source.location.elevation ?? 0) + source.offset,
        ];

        const targetPoint: [number, number, number] = [
          target.location.lng,
          target.location.lat,
          (target.location.elevation ?? 0) + target.offset,
        ];

        updateProgress(30);

        // Get profile data
        const { profile, clear } = await getLOSProfile(
          getTerrainElevation,
          sourcePoint,
          targetPoint,
          {
            sampleDistance: 10,
            minimumOffset: 3,
          }
        );

        updateProgress(90);

        // If not clear, find obstruction point
        let obstructionFraction = null;
        let obstructionDistance = null;

        if (!clear) {
          for (let i = 0; i < profile.length; i++) {
            if (profile[i].terrain > profile[i].los) {
              obstructionFraction = i / (profile.length - 1);
              obstructionDistance = profile[i].distance;
              break;
            }
          }
        }

        const result: StationLOSResult = {
          clear,
          obstructionFraction: obstructionFraction ?? undefined,
          obstructionDistance: obstructionDistance ?? undefined,
        };

        updateProgress(100);
        return { result, profile };
      } catch (error) {
        console.error('Station-to-station LOS error:', error);
        throw error;
      } finally {
        cleanupAnalysis();
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
      getTerrainElevation,
      updateProgress,
      cleanupAnalysis,
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
              throw createError('Station type, location and range are required', 'INVALID_INPUT');
            }
            result = await analyzeStation(options.stationType, options.location, options.range);
            break;

          case AnalysisType.MERGED:
            if (!options?.stations || options.stations.length < 2) {
              throw createError('At least two stations are required', 'INVALID_INPUT');
            }
            result = await analyzeMerged(options.stations);
            break;

          case AnalysisType.STATION_TO_STATION:
            if (!options?.sourceStation || !options?.targetStation) {
              throw createError('Source and target stations are required', 'INVALID_INPUT');
            }
            const stationResult = await checkStationToStationLOS(
              options.sourceStation,
              options.targetStation
            );
            
            // Convert to standard result format
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
      checkStationToStationLOS,
    ]
  );

  return {
    // State
    isAnalyzing: isAnalyzing || analysisInProgress !== null,
    currentAnalysisType: analysisInProgress,
    progress,
    lastAnalysisTime,

    // Main analysis function
    runAnalysis,
    
    // Individual analysis functions
    analyzeFlightPath,
    analyzeStation,
    analyzeMerged,
    checkStationToStationLOS,
    
    // Control functions
    abortAnalysis,
    
    // Helpers
    visualizeGrid,
  };
}