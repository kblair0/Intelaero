/**
 * useGridAnalysis.ts - Enhanced with ElevationService integration
 * 
 * This hook provides a comprehensive interface for performing grid-based
 * Line of Sight (LOS) analyses with optimized elevation data access.
 * Leverages ElevationService for robust terrain queries with caching
 * and preloading capabilities.
 */

import { useCallback, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { useMapContext } from '../context/mapcontext';
import { useMarkersContext } from '../context/MarkerContext';
import { useLOSAnalysis } from '../context/LOSAnalysisContext';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';
import { 
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
  AnalysisType,
  Coordinates2D,
  Coordinates3D
} from '../types/GridAnalysisTypes';
import { FlightPlanData } from '../context/FlightPlanContext';

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
   * Enhanced terrain elevation query function that leverages ElevationService.
   * Provides caching, preloading, and robust fallback mechanisms.
   */
  const getTerrainElevation = useCallback(
    async (coords: Coordinates2D): Promise<number> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
      
      if (elevationService) {
        try {
          await elevationService.ensureTerrainReady();
          return await elevationService.getElevation(coords[0], coords[1]);
        } catch (error) {
          console.warn('ElevationService query failed, falling back to direct query:', error);
        }
      }
      
      try {
        const elevation = map.queryTerrainElevation(coords);
        if (elevation !== null && elevation !== undefined) {
          return elevation;
        }
        return 0;
      } catch (error) {
        console.error('All elevation query methods failed:', error);
        return 0;
      }
    },
    [map, elevationService]
  );

  /**
   * Preloads elevation data for an area of interest to improve query performance.
   */
  const preloadElevationArea = useCallback(
    async (coordinates: [number, number, number][]) => {
      if (elevationService && coordinates.length > 0) {
        try {
          await elevationService.ensureTerrainReady();
          await elevationService.preloadArea(coordinates);
        } catch (error) {
          console.warn('Elevation preloading failed:', error);
        }
      }
    },
    [elevationService]
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

        if (map.getSource(layerId)) {
          const source = map.getSource(layerId) as mapboxgl.GeoJSONSource;
          source.setData(geojson);
          return;
        }

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
        throw createError('Failed to visualize analysis results', 'MAP_INTERACTION', error);
      }
    },
    [map, elosGridRange]
  );

  /**
   * Enhanced flight path analysis with elevation preloading and validation
   */
  const analyzeFlightPath = useCallback(
    async (flightPlan: FlightPlanData): Promise<AnalysisResults> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }

      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] analyzeFlightPath called with flightPlan`);
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
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

        // Extract 3D coordinates for preloading and analysis
        const flightPath = flightPlan.features[0];
        const flightCoordinates = flightPath.geometry.coordinates as [number, number, number][];
        console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Flight path coordinates:`, flightCoordinates.length);

        // Preload elevation data
        updateProgress(7);
        await preloadElevationArea(flightCoordinates);
        console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Elevation preload completed`);

        // Configure batch elevation query
        const batchElevationQuerier = elevationService 
          ? async (points: Coordinates2D[]): Promise<number[]> => {
              return await elevationService.batchGetElevations(points);
            }
          : undefined;

        // Generate grid
        updateProgress(10);
        const cells = await generateGrid(
          getTerrainElevation,
          batchElevationQuerier,
          gridSize,
          {
            flightPath,
            elosGridRange,
          }
        );
        console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Generated ${cells.length} cells`);

        if (!cells || !cells.length) {
          const error = new Error('Generated grid is empty');
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

        updateProgress(30);

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
                center.geometry.coordinates as [number, number],
                flightCoordinates.map(coord => [coord[0], coord[1], coord[2] || 0] as [number, number, number]),
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
          const progressValue = 30 + Math.min(50, ((i + chunkSize) / cells.length) * 50);
          updateProgress(progressValue);
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const analysisTime = performance.now() - startTime;
        updateProgress(95);

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
        console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Flight path analysis error:`, error);
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
      getTerrainElevation,
      preloadElevationArea,
      visualizeGrid,
      updateProgress,
      cleanupAnalysis,
      setIsAnalyzing
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
    }: {
      stationType: "gcs" | "observer" | "repeater";
      location: LocationData;
      range: number;
      elevationOffset: number;
    }) => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }

      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] analyzeStation called for ${stationType} with:`, 
        { location, range, elevationOffset });
      setIsAnalyzing(true);

      try {
        // Validate location data
        if (!location || typeof location.lng !== 'number' || typeof location.lat !== 'number') {
          const error = new Error(`${stationType.toUpperCase()} location not set or invalid`);
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Invalid location data:`, location);
          throw error;
        }

        // Transform LocationData to Coordinates2D format explicitly
        const locationCoordinates: Coordinates2D = [location.lng, location.lat];
        console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Transformed coordinates for grid generation:`, locationCoordinates);

        const startTime = performance.now();

        // Generate grid
        const cells = await generateGrid(
          getTerrainElevation,
          elevationService ? elevationService.batchGetElevations.bind(elevationService) : undefined,
          gridSize,
          {
            center: locationCoordinates, // FIXED: Explicitly pass as Coordinates2D array
            range,
          }
        );

        if (!cells || !cells.length) {
          const error = new Error('Generated grid is empty');
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

        console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Generated ${cells.length} cells for station analysis`);

        // Get observer elevation
        const observerElevation = location.elevation ?? 
          await getTerrainElevation(locationCoordinates) ?? 0;

        // Calculate observer position
        const observerPosition: Coordinates3D = [
          location.lng,
          location.lat,
          observerElevation + elevationOffset,
        ];

        console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Observer position with offset:`, 
          { observerPosition, baseElevation: observerElevation, withOffset: observerElevation + elevationOffset });

        // Run visibility analysis
        let visibleCells = 0;
        let visibilitySum = 0;

        const chunkSize = 50;
        for (let i = 0; i < cells.length; i += chunkSize) {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }

          const chunk = cells.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (cell, index) => {
              try {
                const cellCenter = turf.centroid(cell.geometry);
                const cellCoords = cellCenter.geometry.coordinates as Coordinates2D;

                if (cell.properties.elevation === undefined) {
                  cell.properties.elevation = await getTerrainElevation(cellCoords);
                }

                const targetPosition: Coordinates3D = [
                  cellCoords[0],
                  cellCoords[1],
                  cell.properties.elevation || 0,
                ];

                const isVisible = await checkLineOfSight(
                  getTerrainElevation,
                  observerPosition,
                  targetPosition,
                  { minimumOffset: 1 }
                );

                cell.properties.visibility = isVisible ? 100 : 0;
                cell.properties.fullyVisible = isVisible;
                cell.properties.lastAnalyzed = Date.now();

                if (isVisible) {
                  visibleCells++;
                  visibilitySum += 100;
                }
              } catch (cellError) {
                console.warn(`[${new Date().toISOString()}] [useGridAnalysis.ts] Error analyzing cell ${i + index}:`, cellError);
              }
            })
          );

          const progressValue = 20 + ((i + chunkSize) / cells.length) * 70;
          updateProgress(progressValue);
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const analysisTime = performance.now() - startTime;
        console.log(`[${new Date().toISOString()}} [useGridAnalysis.ts] Station analysis completed in ${analysisTime}ms`);

        const layerId = 
          stationType === 'gcs' ? MAP_LAYERS.GCS_GRID :
          stationType === 'observer' ? MAP_LAYERS.OBSERVER_GRID :
          MAP_LAYERS.REPEATER_GRID;

        const analysisResults: AnalysisResults = {
          cells,
          stats: {
            visibleCells,
            totalCells: cells.length,
            averageVisibility: cells.length > 0 ? visibilitySum / cells.length : 0,
            analysisTime,
          },
        };

        visualizeGrid(analysisResults, layerId);
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        return analysisResults;
      } catch (error) {
        console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Station analysis error:`, error);
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
      getTerrainElevation,
      elevationService,
      visualizeGrid,
      updateProgress,
      cleanupAnalysis,
      setIsAnalyzing
    ]
  );

/**
 * Runs a merged analysis of multiple stations
 * Creates a bounding box based on distances between stations (up to 5km)
 * Visibility is color-coded: red (none), blue (one station), green (two+ stations)
 */
const analyzeMerged = useCallback(
  async ({ stations }: { 
    stations: Array<{
      type: "gcs" | "observer" | "repeater";
      location: LocationData;
      range: number;
      elevationOffset: number;
    }> 
  }) => {
    if (!map) {
      throw createError('Map not initialized', 'MAP_INTERACTION');
    }

    console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Analyzing merged stations: ${stations.length}`);
    setIsAnalyzing(true);

    try {
      // Validate stations array
      if (!stations || !Array.isArray(stations) || stations.length < 2) {
        const error = new Error("At least two stations are required for merged analysis");
        console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
        throw error;
      }

      // Validate each station's data
      for (let i = 0; i < stations.length; i++) {
        const station = stations[i];
        if (!station.location || 
            typeof station.location.lng !== 'number' || 
            typeof station.location.lat !== 'number') {
          const error = new Error(`Invalid location data for station ${i+1} (${station.type})`);
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`, station);
          throw error;
        }
      }

      const startTime = performance.now();
      
      // Step 1: Calculate the maximum distance between any two stations
      let maxInterStationDistance = 0;
      
      // Calculate distances between each pair of stations
      for (let i = 0; i < stations.length; i++) {
        for (let j = i + 1; j < stations.length; j++) {
          const station1 = stations[i];
          const station2 = stations[j];
          
          const distance = turf.distance(
            [station1.location.lng, station1.location.lat],
            [station2.location.lng, station2.location.lat],
            { units: 'meters' }
          );
          
          maxInterStationDistance = Math.max(maxInterStationDistance, distance);
        }
      }
      
      // Cap the distance at 5km (5000m)
      const analysisRange = Math.min(maxInterStationDistance, 5000);
      
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Max inter-station distance: ${maxInterStationDistance}m, using analysis range: ${analysisRange}m`);

      // Update station ranges for analysis to use the calculated distance
      const analysisStations = stations.map(station => ({
        ...station,
        range: analysisRange // Use the same range (inter-station distance) for all stations
      }));
      
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Using ${analysisStations.length} stations with range ${analysisRange}m for merged analysis`);

      // Generate grid using combined bounding box
      const bbox = generateCombinedBoundingBox(analysisStations);
      
      // Create a regular point grid covering the entire bounding box
      const pointGrid = turf.pointGrid(bbox, gridSize, { units: 'meters' });
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Generated point grid with ${pointGrid.features.length} points`);

      // Configure batch elevation query if available
      const batchElevationQuerier = elevationService 
        ? async (points: Coordinates2D[]): Promise<number[]> => {
            return await elevationService.batchGetElevations(points);
          }
        : undefined;
      
      // Convert points to grid cells
      updateProgress(10);
      const cells: GridCell[] = await Promise.all(
        pointGrid.features.map(async (point, index) => {
          const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
            units: 'meters',
            steps: 4,
          });

          const elevation = await getTerrainElevation(point.geometry.coordinates as Coordinates2D)
            .catch(e => {
              console.warn(`[${new Date().toISOString()}] [useGridAnalysis.ts] Elevation fetch error for point:`, point.geometry.coordinates, e);
              return 0;
            });

          return {
            id: `merged-cell-${index}`,
            geometry: cell.geometry as GeoJSON.Polygon,
            properties: {
              visibility: 0,
              fullyVisible: false,
              elevation,
              lastAnalyzed: Date.now(),
            },
          };
        })
      );

      if (!cells || !cells.length) {
        const error = new Error('Generated grid for merged analysis is empty');
        console.error(`[${new Date().toISOString()}} [useGridAnalysis.ts] ${error.message}`);
        throw error;
      }

      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Created ${cells.length} cells for merged analysis`);
      updateProgress(30);

      // Calculate observer positions
      const observerPositions = await Promise.all(stations.map(async (station) => {
        const observerElevation = station.location.elevation ?? 
          await getTerrainElevation([station.location.lng, station.location.lat]) ?? 0;

        return {
          station: station.type,
          position: [
            station.location.lng,
            station.location.lat,
            observerElevation + station.elevationOffset,
          ] as Coordinates3D
        };
      }));

      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Calculated observer positions for ${observerPositions.length} stations`);

      // Run visibility analysis on all cells
      let visibleCells = 0;
      let visibilitySum = 0;

      const chunkSize = 50;
      for (let i = 0; i < cells.length; i += chunkSize) {
        if (abortControllerRef.current?.signal.aborted) {
          throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
        }

        const chunk = cells.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (cell, index) => {
            try {
              const cellCenter = turf.centroid(cell.geometry);
              const cellCoords = cellCenter.geometry.coordinates as Coordinates2D;

              if (cell.properties.elevation === undefined) {
                cell.properties.elevation = await getTerrainElevation(cellCoords);
              }

              const targetPosition: Coordinates3D = [
                cellCoords[0],
                cellCoords[1],
                cell.properties.elevation || 0,
              ];

              // Count stations that can see this cell
              let visibleStationCount = 0;

              for (const observer of observerPositions) {
                // Calculate distance to station
                const distance = turf.distance(
                  [observer.position[0], observer.position[1]],
                  cellCoords,
                  { units: 'meters' }
                );
                
                // Only check visibility if within analysis range
                if (distance <= analysisRange) {
                  const isVisible = await checkLineOfSight(
                    getTerrainElevation,
                    observer.position,
                    targetPosition,
                    { minimumOffset: 1 }
                  );

                  if (isVisible) {
                    visibleStationCount++;
                  }
                }
              }

              // Calculate visibility based on count:
              // 0: 0% (red)
              // 1: 50% (blue)
              // 2+: 100% (green)
              const isVisibleFromAny = visibleStationCount > 0;
              const isVisibleFromAll = visibleStationCount >= observerPositions.length;

              // Set visibility percentage based on the number of stations that can see it
              // This works with the default color ramp in visualizeGrid:
              // 0% = red, 50% = blue, 100% = green
              let visibilityPercentage = 0;
              if (visibleStationCount === 1) {
                visibilityPercentage = 50; // Blue - one station can see it
              } else if (visibleStationCount >= 2) {
                visibilityPercentage = 100; // Green - two or more stations can see it
              }

              cell.properties.visibility = visibilityPercentage;
              cell.properties.fullyVisible = isVisibleFromAll;
              cell.properties.visibleStationCount = visibleStationCount; // Add this for reference
              cell.properties.lastAnalyzed = Date.now();

              if (isVisibleFromAny) {
                visibleCells++;
                visibilitySum += visibilityPercentage;
              }
            } catch (cellError) {
              console.warn(`[${new Date().toISOString()}] [useGridAnalysis.ts] Error analyzing merged cell ${i + index}:`, cellError);
            }
          })
        );

        const progressValue = 30 + ((i + chunkSize) / cells.length) * 60;
        updateProgress(progressValue);
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const analysisTime = performance.now() - startTime;
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Merged analysis completed in ${analysisTime}ms`);

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
      console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Merged analysis error:`, error);
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
    getTerrainElevation,
    elevationService,
    visualizeGrid,
    updateProgress,
    cleanupAnalysis,
    generateCombinedBoundingBox,
    setIsAnalyzing
  ]
);
/**
 * Checks line of sight between two stations (continued)
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

    console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] checkStationToStationLOS called:`, { sourceStation, targetStation });
    setIsAnalyzing(true);

    try {
      if (!source.location || !target.location || 
          typeof source.location.lng !== 'number' || typeof source.location.lat !== 'number' ||
          typeof target.location.lng !== 'number' || typeof target.location.lat !== 'number') {
        const error = new Error(`Both ${sourceStation.toUpperCase()} and ${targetStation.toUpperCase()} locations must be set and valid`);
        console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`, { source: source.location, target: target.location });
        throw error;
      }

      updateProgress(10);

      const sourcePoint: Coordinates3D = [
        source.location.lng,
        source.location.lat,
        (source.location.elevation ?? 0) + source.offset,
      ];

      const targetPoint: Coordinates3D = [
        target.location.lng,
        target.location.lat,
        (target.location.elevation ?? 0) + target.offset,
      ];

      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Station positions:`, { sourcePoint, targetPoint });

      updateProgress(30);

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
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Station-to-station LOS result:`, result);
      return { result, profile };
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Station-to-station LOS error:`, error);
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
    getTerrainElevation,
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
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Analysis already in progress, type: ${type}`);
      throw createError('Analysis already in progress', 'INVALID_INPUT');
    }

    try {
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Starting analysis, type: ${type}`);
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
          
          // Log the location data for debugging
          console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] STATION options:`, {
            stationType: options.stationType,
            location: options.location,
            range: options.range,
            elevationOffset: options.elevationOffset || 0
          });
          
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
      console.log(`[${new Date().toISOString()}] [useGridAnalysis.ts] Analysis completed, type: ${type}`);
      return result;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Analysis error, type: ${type}:`, error);
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
  visualizeGrid,
};
}