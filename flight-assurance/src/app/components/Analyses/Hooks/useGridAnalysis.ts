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
import { useMapContext } from '../../../context/mapcontext';
import { useMarkersContext } from '../../../context/MarkerContext';
import { useLOSAnalysis } from '../../../context/LOSAnalysisContext';
import { layerManager, MAP_LAYERS } from '../../../services/LayerManager';
import { 
  generateGrid,
  checkStationLOS,
  checkFlightPathLOS,
  getLOSProfile,
  generateCombinedBoundingBox,
  createError
} from '../Utils/gridAnalysisUtils';

import {
  analyzeFlightPathVisibility,
  FlightPathVisibilityResult,
  addVisibilityLayer,
  removeVisibilityLayer
} from '../LOSAnalyses/Utils/StationToFlightPathVisibilityAnalysis';
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
import { FlightPlanData } from '../../../context/FlightPlanContext';

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
   */
  const getTerrainElevation = useCallback(
    async (coords: Coordinates2D): Promise<number> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
      
      try {
        // First try ElevationService
        if (elevationService) {
          try {
            await elevationService.ensureTerrainReady();
            const elevation = await elevationService.getElevation(coords[0], coords[1]);
            if (elevation === 0) {
              console.warn(`[Debug] ElevationService returned 0 for [${coords[0]}, ${coords[1]}]`);
            }
            return elevation;
          } catch (error) {
            console.warn('ElevationService query failed, falling back to direct query:', error);
          }
        }
        
        // Fall back to direct map query
        const directElev = map.queryTerrainElevation(coords);
        if (directElev !== null && directElev !== undefined) {
          if (directElev === 0) {
            console.warn(`[Debug] Direct terrain query returned 0 for [${coords[0]}, ${coords[1]}]`);
          }
          return directElev;
        }
        
        console.warn(`[Debug] All elevation methods returned null/undefined for [${coords[0]}, ${coords[1]}]`);
        return 0;
      } catch (error) {
        console.error('All elevation query methods failed:', error);
        return 0;
      }
    },
    [map, elevationService]
  );

  /**
   * Preloads elevation data for an area of interest with cache checking.
   * Supports both station (point + range) and flight path (coordinates + buffer) analyses.
   */
  const preloadElevationArea = useCallback(
    async (input: { coordinates?: [number, number, number][]; center?: Coordinates2D; range?: number }) => {
      if (!elevationService || (!input.coordinates && !input.center)) return;

      let coords: [number, number, number][];
      if (input.center && input.range) {
        // Station analysis: Buffer around a single point
        const point = turf.point(input.center);
        const buffer = turf.buffer(point, input.range, { units: 'meters' });
        coords = turf.getCoords(buffer)[0].map(([lon, lat]) => [lon, lat, 0] as [number, number, number]);
      } else if (input.coordinates) {
        // Flight path analysis: Buffer around the flight path
        const line = turf.lineString(input.coordinates.map(c => [c[0], c[1]]));
        const buffer = turf.buffer(line, elosGridRange, { units: 'meters' });
        coords = turf.getCoords(buffer)[0].map(([lon, lat]) => [lon, lat, 0] as [number, number, number]);
      } else {
        return;
      }

      // Check if all coordinates are already in the cache
      const allCached = coords.every(([lon, lat]) => elevationService.cache.has(`${lon.toFixed(4)}|${lat.toFixed(4)}`));
      if (allCached) {
        return;
      }

      try {
        await elevationService.ensureTerrainReady();
        await elevationService.preloadArea(coords);

        // Validate key waypoints
        const validationPoints = [
          coords[0], // Start
          coords[Math.floor(coords.length / 2)], // Middle
          coords[coords.length - 1] // End
        ];

        console.log("Validating terrain data at key waypoints...");
        let allValid = true;

        for (const [idx, point] of validationPoints.entries()) {
          const [lon, lat] = point;
          const elev = await elevationService.getElevation(lon, lat);

          console.log(`Waypoint ${idx === 0 ? "Start" : idx === validationPoints.length - 1 ? "End" : "Middle"}: ${elev.toFixed(1)}m at [${lon.toFixed(5)}, ${lat.toFixed(5)}]`);

          if (elev === 0) {
            console.warn(`⚠️ Zero elevation at waypoint ${idx} - terrain data may be incomplete!`);
            allValid = false;
          }
        }

        if (!allValid) {
          console.warn("Some terrain data appears invalid - results may be inaccurate");
        }

      } catch (error) {
        console.warn('Elevation preloading failed:', error);
      }
    },
    [elevationService, elosGridRange]
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
   * Enhanced flight path analysis with optimized preloading and performance logging.
   * Preloads the flight path area once and uses batch elevation queries.
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
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

        // Extract and validate 3D coordinates
        const flightPath = flightPlan.features[0];
        const flightCoordinates = flightPath.geometry.coordinates as [number, number, number][];

        // Determine altitude mode from flight plan data
        const waypoints = flightPath.properties?.waypoints || [];
        // Use the first waypoint's altitude mode
        const altitudeMode = waypoints.length > 0 ? 
          waypoints[0].altitudeMode : 
          "absolute"; // Default to absolute if not specified

        const validCoordinates = flightCoordinates.filter(coord => {
          const isValid = Array.isArray(coord) && 
                          coord.length === 3 && 
                          coord.every(val => typeof val === 'number' && !isNaN(val));
          if (!isValid) {
            console.warn(`[${new Date().toISOString()}] [useGridAnalysis.ts] Invalid flight coordinate:`, coord);
          }
          return isValid;
        });
        console.log(`[Debug] Analyzing flight path with altitude mode: ${altitudeMode}, coordinates: ${validCoordinates.length}`);

        if (validCoordinates.length === 0) {
          const error = new Error('No valid coordinates in flight plan');
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

        // Preload elevation data with timing
        console.time('FlightPathPreload');
        await preloadElevationArea({ coordinates: validCoordinates });
        console.timeEnd('FlightPathPreload');
        updateProgress(7);

        // Configure batch elevation query
        const batchElevationQuerier = elevationService 
          ? async (points: Coordinates2D[]): Promise<number[]> => {
              return await elevationService.batchGetElevations(points, true);
            }
          : undefined;

        // Generate grid with timing
        console.time('FlightPathGridGeneration');
        const cells = await generateGrid(
          getTerrainElevation,
          batchElevationQuerier,
          gridSize,
          {
            flightPath,
            elosGridRange,
            preloadComplete: true, // Skip redundant preloading in generateGrid
          }
        );
        console.timeEnd('FlightPathGridGeneration');

        if (!cells || !cells.length) {
          const error = new Error('Generated grid is empty');
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

        updateProgress(30);

        // Process cells in chunks with timing
        console.time('FlightPathLOSChecks');
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
            chunk.map(async (cell, index) => {
              const center = turf.center(cell.geometry);
              const centerCoords = center.geometry.coordinates as Coordinates2D;
          
              const visibility = await checkFlightPathLOS(
                getTerrainElevation,
                [centerCoords[0], centerCoords[1], cell.properties.elevation || 0],
                validCoordinates,
                { minimumOffset: 1, altitudeMode }

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
            })
          );

          results.push(...processedChunk);
          const progressValue = 30 + Math.min(50, ((i + chunkSize) / cells.length) * 50);
          updateProgress(progressValue);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        console.timeEnd('FlightPathLOSChecks');

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
      setIsAnalyzing,
      elevationService
    ]
  );

/**
   * Analyzes visibility from a single station with optimized preloading and target point validation.
   * @param stationType - Type of station (gcs, observer, repeater)
   * @param location - Station location data
   * @param range - Analysis range in meters
   * @param elevationOffset - Elevation offset in meters
   * @returns Analysis results
   * @throws Error with detailed message if analysis fails
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

    setIsAnalyzing(true);
    const startTime = performance.now();

    try {
      // Validate location data
      if (!location || typeof location.lng !== 'number' || typeof location.lat !== 'number') {
        throw createError(`${stationType.toUpperCase()} location not set or invalid`, 'INVALID_INPUT', { location });
      }

      const locationCoordinates: Coordinates2D = [location.lng, location.lat];

      // Preload elevation data with timing
      console.time('StationPreload');
      await preloadElevationArea({ center: locationCoordinates, range });
      console.timeEnd('StationPreload');

      // Generate grid with timing
      console.time('StationGridGeneration');
      const cells = await generateGrid(
        getTerrainElevation,
        gridSize,
        elevationService ? elevationService.batchGetElevations.bind(elevationService) : undefined,
        {
          center: locationCoordinates,
          range,
          preloadComplete: true,
        }
      );
      console.timeEnd('StationGridGeneration');

      if (!cells || !cells.length) {
        throw createError('Failed to generate grid: no cells produced', 'GRID_GENERATION', {
          stationType,
          location,
          range,
          gridSize
        });
      }

      // Get observer elevation
      const observerElevation = location.elevation ?? 
        await getTerrainElevation(locationCoordinates) ?? 0;

      const observerPosition: Coordinates3D = [
        location.lng,
        location.lat,
        observerElevation + elevationOffset,
      ];

      // Run visibility analysis with optimized batching and validation
      console.time('StationLOSChecks');
      let visibleCells = 0;
      let visibilitySum = 0;
      const chunkSize = 100;
      const updatedCells: GridCell[] = [];

      for (let i = 0; i < cells.length; i += chunkSize) {
        if (abortControllerRef.current?.signal.aborted) {
          throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
        }

        const chunk = cells.slice(i, i + chunkSize);
        const cellCenters = chunk.map(cell => turf.centroid(cell.geometry).geometry.coordinates as Coordinates2D);

        const cellElevations = await (elevationService?.batchGetElevations(cellCenters, true) ?? 
          Promise.all(cellCenters.map(coord => getTerrainElevation(coord))));

        const chunkResults = await Promise.all(
          chunk.map(async (cell, index) => {
            try {
              const cellCoords = cellCenters[index];
              const cellElevation = cellElevations[index];

              // Ensure targetPosition is a valid Coordinates3D
              const targetPosition: Coordinates3D = [
                cellCoords[0],
                cellCoords[1],
                cellElevation || 0,
              ];

              const isVisible = await checkStationLOS(
                getTerrainElevation,
                observerPosition,
                targetPosition,
                { minimumOffset: 1, sampleCount: 20 }
              );

              const visibility = isVisible ? 100 : 0;
              if (isVisible) {
                visibleCells++;
                visibilitySum += 100;
              }

              return {
                ...cell,
                properties: {
                  ...cell.properties,
                  elevation: cellElevation,
                  visibility,
                  fullyVisible: isVisible,
                  lastAnalyzed: Date.now(),
                },
              };
            } catch (cellError) {
              console.warn(`[${new Date().toISOString()}] [useGridAnalysis.ts] Error analyzing cell ${i + index}:`, cellError);
              return cell; // Return unmodified cell on error
            }
          })
        );

        updatedCells.push(...chunkResults);
        const progressValue = 20 + ((i + chunkSize) / cells.length) * 70;
        updateProgress(progressValue);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      console.timeEnd('StationLOSChecks');

      const analysisTime = performance.now() - startTime;

      const layerId = 
        stationType === 'gcs' ? MAP_LAYERS.GCS_GRID :
        stationType === 'observer' ? MAP_LAYERS.OBSERVER_GRID :
        MAP_LAYERS.REPEATER_GRID;

      const analysisResults: AnalysisResults = {
        cells: updatedCells,
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
      throw createError(
        error.message || 'Station analysis failed',
        'VISIBILITY_ANALYSIS',
        { stationType, location, range, gridSize, originalError: error }
      );
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
    preloadElevationArea,
    visualizeGrid,
    updateProgress,
    cleanupAnalysis,
    setIsAnalyzing,
  ]
);

  /**
   * Runs a merged analysis of multiple stations with optimized preloading and target point validation.
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

      setIsAnalyzing(true);
      const startTime = performance.now();

      try {
        if (!stations || !Array.isArray(stations) || stations.length < 2) {
          const error = new Error("At least two stations are required for merged analysis");
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }

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

        let maxInterStationDistance = 0;
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

        const analysisRange = Math.min(maxInterStationDistance, 5000);
        const analysisStations = stations.map(station => ({
          ...station,
          range: analysisRange,
        }));

        const bbox = generateCombinedBoundingBox(analysisStations);

        // Preload elevation data for the bounding box with timing
        console.time('MergedPreload');
        const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] as Coordinates2D;
        await preloadElevationArea({ center, range: analysisRange });
        console.timeEnd('MergedPreload');

        // Generate grid with timing
        console.time('MergedGridGeneration');
        const pointGrid = turf.pointGrid(bbox, gridSize, { units: 'meters' });
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
        console.timeEnd('MergedGridGeneration');

        if (!cells || !cells.length) {
          const error = new Error('Generated grid for merged analysis is empty');
          console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] ${error.message}`);
          throw error;
        }
        updateProgress(30);

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

        // Run visibility analysis with validation
        console.time('MergedLOSChecks');
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

                // Validate targetPosition
                if (!Array.isArray(targetPosition) || targetPosition.length !== 3 || 
                    targetPosition.some(v => typeof v !== 'number' || isNaN(v))) {
                  console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Invalid targetPosition for merged cell ${i + index}:`, targetPosition);
                  return;
                }
                let visibleStationCount = 0;

                for (const observer of observerPositions) {
                  const distance = turf.distance(
                    [observer.position[0], observer.position[1]],
                    cellCoords,
                    { units: 'meters' }
                  );
                  
                  if (distance <= analysisRange) {
                    const isVisible = await checkStationLOS(
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

                const isVisibleFromAny = visibleStationCount > 0;
                const isVisibleFromAll = visibleStationCount >= observerPositions.length;

                let visibilityPercentage = 0;
                if (visibleStationCount === 1) {
                  visibilityPercentage = 50;
                } else if (visibleStationCount >= 2) {
                  visibilityPercentage = 100;
                }

                cell.properties.visibility = visibilityPercentage;
                cell.properties.fullyVisible = isVisibleFromAll;
                cell.properties.visibleStationCount = visibleStationCount;
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
        console.timeEnd('MergedLOSChecks');

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
      preloadElevationArea,
      visualizeGrid,
      updateProgress,
      cleanupAnalysis,
      setIsAnalyzing,
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
   * Analyzes visibility of a flight path from available stations
   */
  const analyzeFlightPathVisibilityCoverage = useCallback(
    async (flightPlan: FlightPlanData, options: {
      sampleInterval?: number;
      minimumOffset?: number;
      showLayer?: boolean;
    } = {}): Promise<FlightPathVisibilityResult> => {
      if (!map) {
        throw createError('Map not initialized', 'MAP_INTERACTION');
      }
      setIsAnalyzing(true);
      setAnalysisInProgress(AnalysisType.FLIGHT_PATH_VISIBILITY);
      abortControllerRef.current = new AbortController();

      try {
        updateProgress(5);

        const availableStations = [];
        
        if (gcsLocation) {
          availableStations.push({
            type: 'gcs' as const,
            location: gcsLocation,
            elevationOffset: gcsElevationOffset
          });
        }
        
        if (observerLocation) {
          availableStations.push({
            type: 'observer' as const,
            location: observerLocation,
            elevationOffset: observerElevationOffset
          });
        }
        
        if (repeaterLocation) {
          availableStations.push({
            type: 'repeater' as const,
            location: repeaterLocation,
            elevationOffset: repeaterElevationOffset
          });
        }
        
        if (availableStations.length === 0) {
          throw createError('At least one station is required for analysis', 'INVALID_INPUT');
        }
        
        const queryTerrainElevation = async (coords: Coordinates2D): Promise<number> => {
          if (abortControllerRef.current?.signal.aborted) {
            throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
          }
          
          if (elevationService) {
            try {
              await elevationService.ensureTerrainReady();
              return await elevationService.getElevation(coords[0], coords[1]);
            } catch (elevError) {
              console.warn('ElevationService query failed, falling back to direct query:', elevError);
            }
          }
          
          try {
            const elevation = map.queryTerrainElevation(coords);
            if (elevation !== null && elevation !== undefined) {
              return elevation;
            }
            return 0;
          } catch (mapError) {
            console.error('All elevation query methods failed:', mapError);
            return 0;
          }
        };
        
        removeVisibilityLayer(map);
        
        const results = await analyzeFlightPathVisibility(
          map,
          flightPlan,
          availableStations,
          queryTerrainElevation,
          {
            sampleInterval: options.sampleInterval || 10,
            minimumOffset: options.minimumOffset || 1,
            onProgress: (progress) => {
              updateProgress(5 + progress * 0.9);
            }
          }
        );
        
        updateProgress(95);
        
        if (options.showLayer !== false) {
          addVisibilityLayer(map, results.segments);
        }
        
        updateProgress(100);
        setLastAnalysisTime(Date.now());
        
        return results;
      } catch (error) {
        console.error(`[${new Date().toISOString()}] [useGridAnalysis.ts] Flight path visibility analysis error:`, error);
        throw error;
      } finally {
        cleanupAnalysis();
        setIsAnalyzing(false);
      }
    },
    [
      map,
      elevationService,
      gcsLocation,
      observerLocation,
      repeaterLocation,
      gcsElevationOffset,
      observerElevationOffset,
      repeaterElevationOffset,
      updateProgress,
      setAnalysisInProgress,
      setIsAnalyzing,
      cleanupAnalysis,
      setLastAnalysisTime
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
        console.error(`[${new Date().toISOString()}] [use  Analysis error, type: ${type}:`, error);
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
    analyzeFlightPathVisibilityCoverage,
  };
}