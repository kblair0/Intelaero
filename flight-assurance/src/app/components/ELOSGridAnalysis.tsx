/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { layerManager, MAP_LAYERS } from './LayerManager';
import { useLOSAnalysis } from '../context/LOSAnalysisContext';
import type { 
  GridCell, 
  AnalysisResults 
} from '../context/LOSAnalysisContext';

// Enhanced type definitions for 2D and 3D coordinates
type Coordinates2D = [number, number];
type Coordinates3D = [number, number, number]; // [longitude, latitude, altitude]

const isValidBounds = (bounds: number[]): boolean =>
    bounds.length === 4 &&
    bounds[0] >= -180 &&
    bounds[1] >= -90 &&
    bounds[2] <= 180 &&
    bounds[3] <= 90;

interface ELOSError extends Error {
  code: 'GRID_GENERATION' | 'VISIBILITY_ANALYSIS' | 'MAP_INTERACTION' | 'INVALID_INPUT';
  details?: unknown;
}

interface LocationData {
  lng: number;
  lat: number;
  elevation?: number;
}

interface Props {
  map: mapboxgl.Map;
  flightPath?: GeoJSON.FeatureCollection;
  onError?: (error: ELOSError) => void;
  onSuccess?: (result: AnalysisResults) => void;
}

interface AnalysisOptions {
  markerOptions?: {
    markerType: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    range: number;
  };
}

export interface ELOSGridAnalysisRef {
  runAnalysis: (options?: {
    markerOptions?: MarkerAnalysisOptions;
  }) => Promise<void>;
  runMergedAnalysis: (options: MergedAnalysisOptions) => Promise<AnalysisResults>;
  isAnalyzing: boolean;
}

interface MergedAnalysisOptions {
  stations: Array<{
    type: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    config: MarkerConfig;
  }>;
}

// Utility function for generating points along a LineString
const generatePointsAlongLine = (
    line: GeoJSON.Feature<GeoJSON.LineString>,
    stepSize: number
  ): GeoJSON.FeatureCollection => {
    const lineLength = turf.length(line, { units: 'meters' });
    const numSteps = Math.ceil(lineLength / stepSize);
    const points: GeoJSON.Feature[] = [];
  
    for (let i = 0; i <= numSteps; i++) {
      const distance = i * stepSize;
      const point = turf.along(line, distance, { units: 'meters' });
      points.push(point);
    }
  
    return turf.featureCollection(points);
  };

/**
 * ELOS Grid Analysis Component
 * Performs visibility analysis for drone flight paths using a grid-based approach
 */
const ELOSGridAnalysis = forwardRef<ELOSGridAnalysisRef, Props>((props, ref) => {
    const { map, flightPath, onError, onSuccess } = props;
    
    const {
      gridSize,
      elosGridRange,
      isAnalyzing,
      markerConfigs,
      setIsAnalyzing,
      setResults,
      setError
    } = useLOSAnalysis();

    const abortControllerRef = useRef<AbortController | null>(null);
    const workerRef = useRef<Worker | null>(null);

  // LRU Cache for results
  const resultsCache = useRef(new Map<string, { 
    timestamp: number;
    result: AnalysisResults;
  }>());
  const MAX_CACHE_SIZE = 10;
  const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes

  // Error handling utility
  const createError = (message: string, code: ELOSError['code'], details?: unknown): ELOSError => {
    const error = new Error(message) as ELOSError;
    error.code = code;
    error.details = details;
    return error;
  };

  // Cache management
  const manageCache = useCallback(() => {
    const now = Date.now();
    for (const [key, value] of resultsCache.current) {
      if (now - value.timestamp > CACHE_EXPIRY) {
        resultsCache.current.delete(key);
      }
    }
    if (resultsCache.current.size > MAX_CACHE_SIZE) {
      const oldest = [...resultsCache.current.entries()]
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      resultsCache.current.delete(oldest);
    }
  }, []);

  // Get terrain elevation using Mapbox API
  const getTerrainElevation = async (coordinates: Coordinates2D): Promise<number> => {
    return map.queryTerrainElevation(coordinates) ?? 0;
  };

  const generateGrid = useCallback(async (
    center?: [number, number],
    range?: number
  ): Promise<GridCell[]> => {
    try {
      if (center && range) {
        // Marker-based grid generation
        const point = turf.point(center);
        const buffer = turf.buffer(point, range, { units: 'meters' });
        const bounds = turf.bbox(buffer);
  
        if (!isValidBounds(bounds)) {
          throw createError('Invalid bounds for marker grid', 'GRID_GENERATION');
        }
  
        const grid = turf.pointGrid(bounds, gridSize, {
          units: 'meters',
          mask: buffer
        });
        
        console.log('Generated marker grid features:', grid.features.length);
  
        // Process grid cells for marker
        const cells = await Promise.all(
          grid.features.map(async (point, index) => {
            try {
              const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
                units: 'meters',
                steps: 4,
              });
  
              const elevation = await getTerrainElevation(point.geometry.coordinates as Coordinates2D)
                .catch((e) => {
                  console.error('Elevation fetch error for point:', point.geometry.coordinates, e);
                  return 0; // Fallback elevation
                });
  
              return {
                id: `cell-${index}`,
                geometry: cell.geometry as GeoJSON.Polygon,
                properties: {
                  visibility: 0,
                  fullyVisible: false,
                  elevation,
                  lastAnalyzed: Date.now(),
                },
              };
            } catch (e) {
              console.error('Error processing marker grid cell:', index, e);
              throw e;
            }
          })
        );
  
        return cells;
  
      } else {
        // Flight path grid generation
        if (!flightPath?.features.length) {
          throw createError('Flight path contains no valid features', 'INVALID_INPUT');
        }
  
        // Extract waypoints from LineString
        const waypoints = flightPath.features[0]?.geometry.type === 'LineString'
          ? flightPath.features[0]?.geometry.coordinates
          : [];
  
        // Validate waypoints
        if (waypoints.length < 2) {
          console.error('Flight path features:', flightPath.features);
          throw createError('Insufficient waypoints for LineString', 'INVALID_INPUT');
        }
  
        // Create LineString with 3D coordinates
        const lineString = turf.lineString(waypoints, {
          name: flightPath.features[0]?.properties?.name || 'Flight Path',
          description: flightPath.features[0]?.properties?.description || '',
        });
        console.log('Generated LineString with altitude:', lineString);
  
        // Generate bounds and grid
        const bounds = turf.bbox(lineString);
        const margin = turf.lengthToDegrees(elosGridRange, 'meters');
        const extendedBounds = [
          bounds[0] - margin,
          bounds[1] - margin,
          bounds[2] + margin,
          bounds[3] + margin,
        ];
        console.log('Flight path bounds:', bounds);
        console.log('Margin (degrees):', margin);
        console.log('Extended bounds:', extendedBounds);
  
        if (!isValidBounds(extendedBounds)) {
          throw createError('Invalid extended bounds', 'GRID_GENERATION', extendedBounds);
        }
  
        const options = {
          units: 'meters',
          mask: turf.buffer(lineString, elosGridRange, { units: 'meters' }),
        };
        console.log('Grid options:', options);
  
        const grid = turf.pointGrid(extendedBounds, gridSize, options);
        console.log('Generated grid features:', grid.features.length);
  
        // Process grid cells...
        const cells = await Promise.all(
          grid.features.map(async (point, index) => {
            try {
              const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
                units: 'meters',
                steps: 4,
              });
  
              const elevation = await getTerrainElevation(point.geometry.coordinates as Coordinates2D)
                .catch((e) => {
                  console.error('Elevation fetch error for point:', point.geometry.coordinates, e);
                  return 0; // Fallback elevation
                });
  
              return {
                id: `cell-${index}`,
                geometry: cell.geometry as GeoJSON.Polygon,
                properties: {
                  visibility: 0,
                  fullyVisible: false,
                  elevation,
                  lastAnalyzed: Date.now(),
                },
              };
            } catch (e) {
              console.error('Error processing grid cell:', index, e);
              throw e;
            }
          })
        );

        console.log('Generated cells:', cells.length);
  
        return cells;
      }
    } catch (error) {
      console.error('Error in generateGrid:', error);
      throw createError('Failed to generate analysis grid', 'GRID_GENERATION', error);
    }
  }, [flightPath, elosGridRange, gridSize, getTerrainElevation]);

  // Ensure elos-grid-layer is visible
  useEffect(() => {
    if (!map) return;
    
    const onStyleData = () => {
      if (map.getLayer('elos-grid-layer')) {
        map.setLayoutProperty('elos-grid-layer', 'visibility', 'visible');
        console.log('Ensured elos-grid-layer is visible on styledata update.');
      }
    };
  
    map.on('styledata', onStyleData);
  
    // Clean up the listener on unmount
    return () => {
      map.off('styledata', onStyleData);
    };
  }, [map]);
  

  // Enhanced visibility analysis with terrain consideration
  const analyzeVisibility = useCallback(async (cells: GridCell[]): Promise<AnalysisResults> => {
    const startTime = performance.now();

    // Extract 3D coordinates from flight path
    const flightCoordinates = flightPath.features[0].geometry.type === 'LineString'
    ? (flightPath.features[0].geometry.coordinates.map(coord => [
        coord[0], 
        coord[1], 
        coord[2] // ✅ Ensure resolved altitude is used
      ]) as Coordinates3D[])
    : [];
  

    // Add logging before using flightCoordinates
    console.log('Analysis parameters:', {
      elosGridRange,
      totalCells: cells.length,
      flightPathPoints: flightCoordinates.length
    });

    // Validate that we have altitude data
    if (!flightCoordinates.every(coord => coord.length === 3)) {
      throw createError(
        'Flight path must include altitude data',
        'INVALID_INPUT',
        'Missing altitude values in flight path coordinates'
      );
    }

    const chunkSize = 50;
    const results: GridCell[] = [];
    let visibleCellCount = 0;
    let totalVisibility = 0;

    for (let i = 0; i < cells.length; i += chunkSize) {
      if (abortControllerRef.current?.signal.aborted) {
        throw createError('Analysis aborted', 'VISIBILITY_ANALYSIS');
      }

      const chunk = cells.slice(i, i + chunkSize);
      const processedChunk = await Promise.all(chunk.map(async (cell) => {
        try {
          const visibility = await checkCellVisibility(cell, flightCoordinates);
          const isFullyVisible = visibility === 100;
          
          if (isFullyVisible) visibleCellCount++;
          totalVisibility += visibility;

          return {
            ...cell,
            properties: {
              ...cell.properties,
              visibility,
              fullyVisible: isFullyVisible
            }
          };
        } catch (error) {
          console.error('Error processing cell:', cell.id, error);
          throw error;
        }
      }));

      results.push(...processedChunk);
    }

    const analysisTime = performance.now() - startTime;
    console.log('Analysis input cells:', cells.length);
    console.log('Analysis result:', results.length);
    return {
      cells: results,
      stats: {
        totalCells: cells.length,
        visibleCells: visibleCellCount,
        averageVisibility: totalVisibility / cells.length,
        analysisTime
      }
    };

  }, [flightPath, elosGridRange]);

  // Enhanced cell visibility checking with 3D coordinates and only points within gridrange
  const checkCellVisibility = async (
    cell: GridCell,
    flightCoordinates: Coordinates3D[]
  ): Promise<number> => {
    const center = turf.center(cell.geometry);
    const targetElevation = cell.properties.elevation ?? 0;
    
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
          [coord[0], coord[1], coord[2]],
          [...center.geometry.coordinates, targetElevation] as Coordinates3D
        );
  
        if (isVisible) {
          visiblePoints++;
        }
      }
    }
  
    // If no points were in range, return 0
    if (pointsInRange === 0) {
      return 0;
    }
  
    // Calculate visibility percentage only from points within range
    const visibility = (visiblePoints / pointsInRange) * 100;

//    console.log('Cell Analysis:', {
//      totalFlightPoints: flightCoordinates.length,
//      pointsInRange,
//      visiblePoints,
//      visibility,
//      cellCenter: center.geometry.coordinates
//    });
  
    return visibility;
  };

  // Enhanced line of sight checking using flight plan altitudes and sampling terrain altitudes (3D LOS approach)
  //  Offset to avoid 0 values interpolated over short distance e.g 100m grid distance.
  const checkLineOfSight = async (
    dronePoint: Coordinates3D,
    targetPoint: Coordinates3D
  ): Promise<boolean> => {
    const [droneLng, droneLat, droneAltitude] = dronePoint;
    const [targetLng, targetLat, targetElevation] = targetPoint;
    
    const MINIMUM_OFFSET = 1; // Just above terrain
  
    const distance = turf.distance(
      [droneLng, droneLat],
      [targetLng, targetLat],
      { units: 'meters' }
    );
  
    const sampleCount = Math.max(10, Math.ceil(distance / 50));
    const points: Coordinates3D[] = [];
    const pointDetails: any[] = [];
  
    for (let i = 0; i <= sampleCount; i++) {
      const fraction = i / sampleCount;
      
      const lng = droneLng + fraction * (targetLng - droneLng);
      const lat = droneLat + fraction * (targetLat - droneLat);
      
      // Modified interpolation with minimal offset
      const interpolatedHeight = 
        droneAltitude - 
        ((droneAltitude - (targetElevation + MINIMUM_OFFSET)) * fraction);
  
      const terrainHeight = await getTerrainElevation([lng, lat]) ?? 0;
  
      points.push([lng, lat, interpolatedHeight]);
      pointDetails.push({
        fraction,
        lng,
        lat,
        interpolatedHeight,
        terrainHeight,
        heightDifference: interpolatedHeight - terrainHeight
      });
  
      if (terrainHeight > interpolatedHeight) {
        return false;
      }
    }
  
    return true;
  };
// Modified visualizeGrid function with better style loading handling
const visualizeGrid = useCallback(
  (
    analysisResults: AnalysisResults | { cells: GridCell[] },
    layerId?: string,
    currentVisibility: 'visible' | 'none' = 'visible'
  ) => {
    const targetLayerId = layerId || MAP_LAYERS.ELOS_GRID;
    console.log('VisualizeGrid called for layer:', targetLayerId);

    if (!map) {
      console.error('Map is not initialized');
      return;
    }

    // Create a promise that resolves when the style is loaded
    const waitForStyle = () => new Promise<void>((resolve) => {
      if (map.isStyleLoaded()) {
        console.log('Map style already loaded, proceeding with visualization');
        resolve();
      } else {
        console.log('Waiting for map style to load...');
        const styleListener = () => {
          console.log('Map style loaded, proceeding with visualization');
          map.off('styledata', styleListener);
          resolve();
        };
        map.on('styledata', styleListener);
      }
    });

    // Create a promise that resolves when the terrain is loaded
    const waitForTerrain = () => new Promise<void>((resolve) => {
      if (map.getTerrain()) {
        const terrain = map.getTerrain();
        if (terrain && terrain.source === 'mapbox-dem') {
          console.log('Terrain already loaded');
          resolve();
        }
      }
      
      const terrainListener = () => {
        const terrain = map.getTerrain();
        if (terrain && terrain.source === 'mapbox-dem') {
          console.log('Terrain loaded');
          map.off('terrain', terrainListener);
          resolve();
        }
      };
      map.on('terrain', terrainListener);
    });

    // Combine both promises and proceed with visualization
    Promise.all([waitForStyle(), waitForTerrain()])
      .then(() => {
        try {
          // Create GeoJSON from analysis cells
          const geojson: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: analysisResults.cells.map((cell) => ({
              type: 'Feature',
              geometry: cell.geometry,
              properties: cell.properties,
            })),
          };

          // Update or create the source and layer
          if (map.getSource(targetLayerId)) {
            const source = map.getSource(targetLayerId) as mapboxgl.GeoJSONSource;
            source.setData(geojson);
            map.setLayoutProperty(targetLayerId, 'visibility', currentVisibility);
          } else {
            map.addSource(targetLayerId, {
              type: 'geojson',
              data: geojson,
            });

            map.addLayer({
              id: targetLayerId,
              type: 'fill',
              source: targetLayerId,
              layout: {
                visibility: currentVisibility,
              },
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
            
            layerManager.registerLayer(targetLayerId, currentVisibility === 'visible');
          }

          // --- SET UP EVENT HANDLERS FOR POPUPS ---
          // Define the mousemove handler
          const onMouseMove = (
            e: mapboxgl.MapMouseEvent & mapboxgl.EventData
          ) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              const vis = feature.properties?.visibility?.toFixed(1);
              const elev = feature.properties?.elevation?.toFixed(1);
    
              // Remove any existing popup before adding a new one
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
                      <span>Analysis Method:</span>
                      <strong>3D Terrain Sampling</strong>
                    </div>
                    <p class="text-xs text-gray-600 mt-2">
                      Checks line of sight across multiple terrain points
                    </p>
                  </div>
                `)
                .addTo(map);
            }
          };
          // Attach a property to store the popup reference
          onMouseMove.popup = onMouseMove.popup || null;
    
          const onMouseLeave = () => {
            if (onMouseMove.popup) {
              onMouseMove.popup.remove();
              onMouseMove.popup = null;
            }
          };
    
          // Remove any existing listeners for this layer to avoid duplicate handlers
          map.off('mousemove', targetLayerId, onMouseMove);
          map.off('mouseleave', targetLayerId, onMouseLeave);
          map.on('mousemove', targetLayerId, onMouseMove);
          map.on('mouseleave', targetLayerId, onMouseLeave);

          console.log('Grid visualization completed successfully');
        } catch (error) {
          console.error('Error in visualization:', error);
          throw createError(
            'Failed to visualize analysis results',
            'MAP_INTERACTION',
            error
          );
        }
      })
      .catch((error) => {
        console.error('Error waiting for map resources:', error);
      });
  },
  [map, layerManager, elosGridRange]
);
    //Merged Analysis
/**
 * Generates a bounding box that encompasses all station analysis areas
 */
const generateCombinedBoundingBox = (
  stations: Array<{ location: LocationData; range: number }>
): turf.BBox => {
  if (!stations.length) {
    throw new Error('No stations provided for analysis');
  }

  // For each station, create a buffer (circle) and extract its bbox.
  const bboxes = stations.map((station) => {
    const point = turf.point([station.location.lng, station.location.lat]);
    // Create a circular area using the station’s analysis range.
    const buffer = turf.buffer(point, station.range, { units: 'meters' });
    return turf.bbox(buffer); // returns [minLng, minLat, maxLng, maxLat]
  });

  // Combine the individual bboxes.
  const combinedBbox: turf.BBox = [180, 90, -180, -90];
  bboxes.forEach((bbox) => {
    combinedBbox[0] = Math.min(combinedBbox[0], bbox[0]);
    combinedBbox[1] = Math.min(combinedBbox[1], bbox[1]);
    combinedBbox[2] = Math.max(combinedBbox[2], bbox[2]);
    combinedBbox[3] = Math.max(combinedBbox[3], bbox[3]);
  });

  // Calculate horizontal distance (east-west) and vertical distance (north-south)
  const horizontalDistance = turf.distance(
    [combinedBbox[0], combinedBbox[1]],
    [combinedBbox[2], combinedBbox[1]],
    { units: 'meters' }
  );
  const verticalDistance = turf.distance(
    [combinedBbox[0], combinedBbox[1]],
    [combinedBbox[0], combinedBbox[3]],
    { units: 'meters' }
  );

  // Compute the center of the combined bbox.
  const centerLng = (combinedBbox[0] + combinedBbox[2]) / 2;
  const centerLat = (combinedBbox[1] + combinedBbox[3]) / 2;
  const center = [centerLng, centerLat];

  // If the horizontal distance is greater than 5000 m, clamp it.
  if (horizontalDistance > 5000) {
    // 2500 m to the west and 2500 m to the east from the center.
    const westPoint = turf.destination(center, 2500, 270, { units: 'meters' });
    const eastPoint = turf.destination(center, 2500, 90, { units: 'meters' });
    combinedBbox[0] = westPoint.geometry.coordinates[0];
    combinedBbox[2] = eastPoint.geometry.coordinates[0];
  }

  // If the vertical distance is greater than 5000 m, clamp it.
  if (verticalDistance > 5000) {
    // 2500 m to the south and 2500 m to the north from the center.
    const southPoint = turf.destination(center, 2500, 180, { units: 'meters' });
    const northPoint = turf.destination(center, 2500, 0, { units: 'meters' });
    combinedBbox[1] = southPoint.geometry.coordinates[1];
    combinedBbox[3] = northPoint.geometry.coordinates[1];
  }

  return combinedBbox;
};

/**
 * Computes visibility for each cell from all stations
 */
const computeMergedVisibility = async (
  cells: GridCell[],
  stations: Array<{
    location: LocationData;
    elevation: number;
    range: number;
  }>,
  abortSignal?: AbortSignal
): Promise<GridCell[]> => {
  const chunkSize = 50; // Process cells in chunks for better performance
  const results: GridCell[] = [];

  for (let i = 0; i < cells.length; i += chunkSize) {
    if (abortSignal?.aborted) {
      throw new Error('Analysis aborted');
    }

    const chunk = cells.slice(i, i + chunkSize);
    const processedChunk = await Promise.all(
      chunk.map(async (cell) => {
        try {
          const center = turf.center(cell.geometry);
          const stationVisibilities = await Promise.all(
            stations.map(async station => {
              // Check if cell is within station range
              const distance = turf.distance(
                [station.location.lng, station.location.lat],
                center.geometry.coordinates,
                { units: 'meters' }
              );

              if (distance > station.range) return 0;

              const visible = await checkLineOfSight(
                [station.location.lng, station.location.lat, station.elevation],
                [...center.geometry.coordinates, cell.properties.elevation ?? 0] as [number, number, number]
              );

              return visible ? 100 : 0;
            })
          );

          // Use maximum visibility from any station
          const maxVisibility = Math.max(...stationVisibilities);

          return {
            ...cell,
            properties: {
              ...cell.properties,
              visibility: maxVisibility,
              fullyVisible: maxVisibility === 100
            }
          };
        } catch (error) {
          console.error('Error processing cell visibility:', error);
          throw error;
        }
      })
    );

    results.push(...processedChunk);
  }

  return results;
};

/**
 * Generates a unified grid for merged analysis.
 * It computes a combined bounding box from the given stations (each with a location and analysis range)
 * and then creates a point grid (with circular cells) over that box.
 *
 * @param gridSize The spacing (in meters) for the grid.
 * @param stations An array of station objects containing a location and a range.
 * @returns A promise that resolves to an array of GridCell objects.
 */
const generateUnifiedGrid = async (
  gridSize: number,
  stations: Array<{ location: LocationData; range: number }>
): Promise<GridCell[]> => {
  // Compute the combined bounding box using our helper:
  const combinedBbox = generateCombinedBoundingBox(stations);
  console.log('Combined bounding box:', combinedBbox);

  // Generate grid points over the combined bounding box.
  const grid = turf.pointGrid(combinedBbox, gridSize, { units: 'meters' });
  console.log('Generated grid features:', grid.features.length);

  // Process each grid point into a circular cell with elevation data.
  const cells: GridCell[] = await Promise.all(
    grid.features.map(async (point, index) => {
      try {
        // Create a circular cell (polygon) centered at the grid point.
        const cellPolygon = turf.circle(point.geometry.coordinates, gridSize / 2, {
          units: 'meters',
          steps: 4,
        });

        // Retrieve elevation for the grid point.
        const elevation = await getTerrainElevation(point.geometry.coordinates as Coordinates2D)
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
        } as GridCell;
      } catch (error) {
        console.error('Error processing grid cell:', error);
        throw error;
      }
    })
  );

  return cells;
};


  /**
 * Main merged analysis function
 */
/**
 * Main merged analysis function.
 * Combines the analysis for all stations by generating a unified grid over the combined bounding box
 * and then computing the visibility for each cell.
 */
const runMergedAnalysis = useCallback(async (
  options: MergedAnalysisOptions
): Promise<AnalysisResults> => {
  const startTime = performance.now();

  try {
    // Validate input.
    if (options.stations.length < 2) {
      throw new Error('At least two stations are required for merged analysis');
    }

    // Instead of generating bounds externally, call generateUnifiedGrid directly.
    const grid = await generateUnifiedGrid(
      gridSize,
      options.stations.map(s => ({
        location: s.location,
        range: elosGridRange
      }))
    );

    // Compute merged visibility on the grid.
    const mergedCells = await computeMergedVisibility(
      grid,
      options.stations.map(s => ({
        location: s.location,
        elevation: (s.location.elevation ?? 0) + s.config.elevationOffset,
        range: elosGridRange
      })),
      abortControllerRef.current?.signal
    );

    // Calculate statistics.
    const visibleCells = mergedCells.filter(cell => cell.properties.fullyVisible).length;
    const totalVisibility = mergedCells.reduce((sum, cell) => sum + cell.properties.visibility, 0);

    const results = {
      cells: mergedCells,
      stats: {
        totalCells: mergedCells.length,
        visibleCells,
        averageVisibility: totalVisibility / mergedCells.length,
        analysisTime: performance.now() - startTime
      }
    };

    // Visualize results.
    await visualizeGrid(results, MAP_LAYERS.MERGED_VISIBILITY);

    return results;

  } catch (error) {
    console.error('Error in merged analysis:', error);
    throw error;
  }
}, [gridSize, computeMergedVisibility, visualizeGrid]);
  
  const analyzeFromPoint = useCallback(async (
    cells: GridCell[],
    markerOptions: AnalysisOptions['markerOptions']
  ): Promise<AnalysisResults> => {
    const startTime = performance.now();
    const results: GridCell[] = [];
    let visibleCellCount = 0;
    let totalVisibility = 0;

    // Get the elevation offset from markerConfigs
    const stationOffset = markerConfigs[markerOptions.markerType].elevationOffset;
    
    // Add offset to station's base elevation
    const stationElevation = (markerOptions.location.elevation ?? 0) + stationOffset;
    
    // Process cells in chunks
    const chunkSize = 50;
    for (let i = 0; i < cells.length; i += chunkSize) {
      const chunk = cells.slice(i, i + chunkSize);
      const processedChunk = await Promise.all(
        chunk.map(async (cell) => {
          const center = turf.center(cell.geometry);
          
          const isVisible = await checkLineOfSight(
            [markerOptions.location.lng, markerOptions.location.lat, stationElevation],
            [...center.geometry.coordinates, cell.properties.elevation ?? 0]
          );

          if (isVisible) visibleCellCount++;
          const visibility = isVisible ? 100 : 0;
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
    }

    return {
      cells: results,
      stats: {
        totalCells: cells.length,
        visibleCells: visibleCellCount,
        averageVisibility: totalVisibility / cells.length,
        analysisTime: performance.now() - startTime,
      },
    };
  }, [checkLineOfSight, markerConfigs]);

  // Main analysis function
  const runAnalysis = useCallback(async (options?: AnalysisOptions) => {
    console.log("Starting ELOS Grid Analysis", options ? "for marker" : "for flight path");
    try {
      setIsAnalyzing(true);
      setError(null);
      await new Promise(resolve => setTimeout(resolve, 100));
      abortControllerRef.current = new AbortController();
  
      if (options?.markerOptions) {
        // Marker-based analysis
        if (!map) {
          throw createError("Map is not initialized", "INVALID_INPUT");
        }
  
        const { markerType, location, range } = options.markerOptions;
        console.log(`Starting marker analysis for ${markerType}`, location);
  
        // Generate grid for marker
        const cells = await generateGrid(
          [location.lng, location.lat],
          range
        );
        console.log("Grid generated with", cells.length, "cells for marker");
  
        // Perform visibility analysis from marker point
        const AnalysisResults = await analyzeFromPoint(cells, options.markerOptions);
        console.log(`Visibility analysis completed for ${markerType} with`, AnalysisResults.stats.visibleCells, "visible cells");
  
        // Visualize results with marker-specific layer
        console.log("Visualizing results on the map...");
        await visualizeGrid(AnalysisResults, `${markerType}-grid-layer`);
        console.log("Grid visualization completed for marker");
  
        await new Promise(resolve => setTimeout(resolve, 100));
        onSuccess(AnalysisResults);
        setResults(AnalysisResults);
  
      } else {
        // Original flight path analysis
        if (!flightPath || !map) {
          throw createError("Please upload a flight plan first", "INVALID_INPUT");
        }
  
        const cacheKey = JSON.stringify({
          flightPath,
          gridSize,
          elosGridRange
        });
  
        // Check cache
        const cached = resultsCache.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
          console.log("Using cached results");
          visualizeGrid(cached.result);
          onSuccess(cached.result);
          return;
        }
  
        // Generate grid
        const cells = await generateGrid();
        console.log("Grid generated with", cells.length, "cells");
  
        // Perform visibility analysis
        const AnalysisResults = await analyzeVisibility(cells);
        console.log("Visibility analysis completed with", AnalysisResults.stats.visibleCells, "visible cells");
  
        // Cache results
        resultsCache.current.set(cacheKey, {
          timestamp: Date.now(),
          result: AnalysisResults
        });
        manageCache();

        if (!AnalysisResults || !AnalysisResults.cells) {
          throw createError("Analysis produced invalid results", "VISIBILITY_ANALYSIS");
        }
    
        console.log("Analysis result:", {
          totalCells: AnalysisResults.cells.length,
          stats: AnalysisResults.stats
        });
  
        // Visualize results
        console.log("Visualizing results on the map...");
        await visualizeGrid(AnalysisResults);
        console.log("Grid visualization completed");
  
        await new Promise(resolve => setTimeout(resolve, 100));
        if (onSuccess) {
          onSuccess(AnalysisResults);
        }
      }

    } catch (error) {
      console.error("Error in runAnalysis:", error);
      const elosError = error as ELOSError;
      setError(elosError.message); // Add this line
      if (onError) {
        onError(elosError);
      }
    } finally {
      setIsAnalyzing(false);
    }
}, [
    map,
    flightPath,
    gridSize,
    elosGridRange,
    generateGrid,
    analyzeVisibility,
    visualizeGrid,
    setResults,
    setError,
    setIsAnalyzing,
    onSuccess,
    onError
]);

useImperativeHandle(ref, () => ({
  runAnalysis,
  runMergedAnalysis,
  isAnalyzing,
}), [runAnalysis, runMergedAnalysis, isAnalyzing]);


  // Cleanup effect should be separate as well
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return null;

});

export default ELOSGridAnalysis;