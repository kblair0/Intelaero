"use client";
import React, { useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";
import { LRUCache } from 'lru-cache'

// Constants
const TILE_SIZE = 512;
const ZOOM_LEVEL = 15;
const EARTH_CIRCUMFERENCE_LAT = 111_320; // meters per degree latitude
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000; // ms

/**
 * Core interfaces for the ViewshedAnalysis system
 */
export interface ViewshedAnalysisRef {
  runAnalysis: () => Promise<void>;
  clearAnalysis: () => void;
}

export class ViewshedError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ViewshedError';
  }
}

interface ViewshedAnalysisProps {
  map: mapboxgl.Map;
  flightPlan: GeoJSON.FeatureCollection;
  maxRange: number;
  angleStep: number;
  samplingInterval: number;
  skipUnion: boolean;
  gcsLocation?: LocationData;      
  observerLocation?: LocationData; 
  repeaterLocation?: LocationData;
  viewshedLoading?: (loading: boolean) => void;
  onError?: (error: ViewshedError) => void;
  onSuccess?: () => void;
}
interface DecodedTile {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  timestamp: number;
}

interface TerrainPoint {
  lng: number;
  lat: number;
  elevation: number;
}

/**
 * LRU Cache configuration for terrain tiles
 * Limits memory usage while maintaining performance
 */
const tileCache = new LRUCache<string, DecodedTile>({
  max: 500, // Maximum number of tiles to store
  ttl: 1000 * 60 * 30, // 30 minutes (time-to-live in milliseconds)
  allowStale: false, // Optional: Whether to return stale items before they are deleted
  updateAgeOnGet: true // Updates the age of the cache item when accessed
});


/**
 * TerrainService: Handles all terrain-related operations
 */
class TerrainService {
  private static async fetchWithRetry(
    url: string, 
    attempts: number = DEFAULT_RETRY_ATTEMPTS
  ): Promise<Response> {
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) return response;
      } catch (error) {
        if (i === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, DEFAULT_RETRY_DELAY));
      }
    }
    throw new Error('Failed to fetch after ${attempts} attempts');
  }

  static async getDecodedTile(x: number, y: number): Promise<DecodedTile> {
    const tileURL = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${ZOOM_LEVEL}/${x}/${y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

    const cached = tileCache.get(tileURL);
    if (cached) return cached;

    const response = await this.fetchWithRetry(tileURL);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);

    const decodedTile = {
      data: imageData.data,
      width: TILE_SIZE,
      height: TILE_SIZE,
      timestamp: Date.now()
    };

    tileCache.set(tileURL, decodedTile);
    return decodedTile;
  }

  static async getElevation(lng: number, lat: number): Promise<number> {
    const { x, y, pixelX, pixelY } = this.calculateTileCoordinates(lng, lat);
    const decodedTile = await this.getDecodedTile(x, y);
    
    const idx = (pixelY * decodedTile.width + pixelX) * 4;
    const [r, g, b] = [
      decodedTile.data[idx],
      decodedTile.data[idx + 1],
      decodedTile.data[idx + 2]
    ];

    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  }

  private static calculateTileCoordinates(lng: number, lat: number) {
    const scale = 1 << ZOOM_LEVEL;
    const latRad = (lat * Math.PI) / 180;
    const x = Math.floor(((lng + 180) / 360) * scale);
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
    );
    
    const pixelX = Math.floor((((lng + 180) / 360) * scale - x) * TILE_SIZE);
    const pixelY = Math.floor(
      (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale - y) *
      TILE_SIZE
    );

    return { x, y, pixelX, pixelY };
  }
}

/**
 * ViewshedGeometry: Handles all geometry-related operations
 */
class ViewshedGeometry {
  static async calculateVisibilityPolygon(
    vantage: [number, number, number],
    angleStep: number,
    range: number,
    increment = 50
  ): Promise<turf.Feature<turf.Polygon>> {
    const [lng, lat, alt] = vantage;
    const groundElev = await TerrainService.getElevation(lng, lat);
    const vantageAbsoluteAlt = groundElev + alt;

    try {
      const boundaryPoints = await this.calculateBoundaryPoints(
        lng,
        lat,
        vantageAbsoluteAlt,
        angleStep,
        range,
        increment
      );

      return this.createAndValidatePolygon(boundaryPoints);
    } catch (error) {
      console.warn("Polygon creation failed:", error);
      throw error;
    }    
  }

  private static async calculateBoundaryPoints(
    lng: number,
    lat: number,
    vantageAbsoluteAlt: number,
    angleStep: number,
    range: number,
    increment: number
  ): Promise<[number, number][]> {
    const boundaryPoints: [number, number][] = [];
    let validPointFound = false;
  
    for (let angle = 0; angle < 360; angle += angleStep) {
      let lastVisible: [number, number, number] | null = null;
      let anyPointVisible = false;
  
      // Check visibility at incremental distances
      for (let distance = increment; distance <= range; distance += increment) {
        const point = this.calculatePointAtDistance(lng, lat, angle, distance);
        const terrainAlt = await TerrainService.getElevation(point[0], point[1]);
  
        // If terrain is higher than viewing position, stop this ray
        if (terrainAlt > vantageAbsoluteAlt) {
          if (lastVisible) break;
          continue;
        }
  
        lastVisible = [point[0], point[1], terrainAlt];
        anyPointVisible = true;
      }
  
      // Only add points if we found a valid visible point
      if (anyPointVisible && lastVisible) {
        validPointFound = true;
        if (
          boundaryPoints.length === 0 || // Always add the first valid point
          !this.pointsAreEqual([lastVisible[0], lastVisible[1]], 
                              [boundaryPoints[boundaryPoints.length - 1][0], 
                               boundaryPoints[boundaryPoints.length - 1][1]])
        ) {
          boundaryPoints.push([lastVisible[0], lastVisible[1]]);
        }
      }
    }

  //  console.log("Boundary points for Vantage:", {
    //  lng,
  //    lat,
  //    vantageAbsoluteAltitude: vantageAbsoluteAlt, // Calculated absolute altitude
  //    numPoints: boundaryPoints.length,
   //   points: boundaryPoints,
   //   angles: boundaryPoints.map((p, i) => ({
   //     point: i,
   //     angle: Math.atan2(p[1] - lat, p[0] - lng) * (180 / Math.PI),
   //     distance: turf.distance(turf.point([lng, lat]), turf.point(p), { units: "meters" }),
//        }))
 //   });
    
    
  
    // Only close the polygon if we found valid points
    if (validPointFound && boundaryPoints.length >= 3) {
      boundaryPoints.push([...boundaryPoints[0]]);
      return this.removeDuplicatePoints(boundaryPoints);
    }
    
    throw new ViewshedError('Insufficient visibility points to create polygon', 'INSUFFICIENT_POINTS');
  }
  

  private static calculatePointAtDistance(
    lng: number,
    lat: number,
    angle: number,
    distance: number
  ): [number, number] {
    const bearingRad = (angle * Math.PI) / 180;
    const dx = distance * Math.cos(bearingRad);
    const dy = distance * Math.sin(bearingRad);

    const earthCircumLng = EARTH_CIRCUMFERENCE_LAT * Math.cos((lat * Math.PI) / 180);
    
    return [
      lng + dx / earthCircumLng,
      lat + dy / EARTH_CIRCUMFERENCE_LAT
    ];
  }

  private static removeDuplicatePoints(points: [number, number][]): [number, number][] {
    return points.filter((point, index, self) =>
      index === 0 ||
      index === self.length - 1 ||
      !this.pointsAreEqual(point, self[index - 1])
    );
  }

  private static pointsAreEqual(p1: [number, number], p2: [number, number]): boolean {
    const precision = 1e-10;
    return Math.abs(p1[0] - p2[0]) < precision && Math.abs(p1[1] - p2[1]) < precision;
  }

  private static createAndValidatePolygon(
    points: [number, number][]
  ): turf.Feature<turf.Polygon> {
    if (points.length < 4) {
      console.warn("Insufficient points to create a polygon:", points);
      throw new Error("Polygon requires at least 4 points");
    }    
    const polygon = turf.polygon([points]);
    
    if (!turf.booleanValid(polygon)) {
      console.warn("The first polygon is invalid:", polygons[0]);
   //   const cleaned = turf.cleanCoords(polygon, { tolerance: 1e-5 });
      if (!turf.booleanValid(cleaned)) {
        throw new Error("Failed to create valid polygon after cleaning");
      }
      return cleaned;
    }
    
    return turf.simplify(polygon, { tolerance: 0.0001, highQuality: true });
  }
}

/**
 * MapLayerManager: Handles all map layer operations
 */
class MapLayerManager {
  private map: mapboxgl.Map;

  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  clearViewshedLayers(): void {
    const style = this.map.getStyle();
    const layerIds = style.layers?.map(l => l.id) || [];
    
    layerIds
      .filter(id => id.includes("drone-coverage"))
      .forEach(id => {
        const sourceId = this.map.getLayer(id)?.source;
        if (sourceId && typeof sourceId === "string") {
          this.map.removeLayer(id);
          if (this.map.getSource(sourceId)) {
            this.map.removeSource(sourceId);
          }
        }
      });
  }

  addViewshedLayer(
    polygon: turf.Feature<turf.Polygon>,
    index?: number
  ): void {
    const sourceId = index !== undefined ? 
      `drone-coverage-${index}` : 
      "drone-coverage-union";
    
    const layerId = index !== undefined ? 
      `drone-coverage-layer-${index}` : 
      "drone-coverage-layer-union";

    this.map.addSource(sourceId, {
      type: "geojson",
      data: polygon as GeoJSON.Feature<GeoJSON.Geometry>
    });

    this.map.addLayer({
      id: layerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#00FF00",
        "fill-opacity": 0.3
      }
    });
  }
}

/**
 * Enhanced ViewshedAnalysis component with improved error handling and validation
 */
const ViewshedAnalysis = forwardRef<ViewshedAnalysisRef, ViewshedAnalysisProps>(
  ({ 
    map, 
    flightPlan, 
    maxRange, 
    angleStep, 
    samplingInterval, 
    skipUnion,
    viewshedLoading,
    gcsLocation,
    observerLocation,
    repeaterLocation,
    onError,
    onSuccess 
  }, ref) => {
    const [loading, setLoading] = useState(false);
    
    const mapManager = useMemo(() => new MapLayerManager(map), [map]);

    // Validate input parameters
    const validateInputs = useCallback(() => {
      if (!map) {
        throw new ViewshedError('Map instance is required', 'INVALID_MAP');
      }
      if (!flightPlan?.features?.length) {
        throw new ViewshedError('Flight plan is required and must contain features', 'INVALID_FLIGHT_PLAN');
      }
      if (maxRange <= 0) {
        throw new ViewshedError('Max range must be greater than 0', 'INVALID_RANGE');
      }
      if (angleStep <= 0 || angleStep >= 360) {
        throw new ViewshedError('Angle step must be between 0 and 360 degrees', 'INVALID_ANGLE');
      }
      if (samplingInterval <= 0) {
        throw new ViewshedError('Sampling interval must be greater than 0', 'INVALID_INTERVAL');
      }
    }, [map, flightPlan, maxRange, angleStep, samplingInterval]);

    const getSamplePointsWithAltitudes = useCallback((
      lineFeature: GeoJSON.Feature,
      flightAltitudes: number[]
    ): turf.Feature<turf.Point>[] => {
      try {
        if (!lineFeature.geometry || lineFeature.geometry.type !== "LineString") {
          throw new ViewshedError("Invalid line feature geometry", "INVALID_GEOMETRY");
        }
    
        const line = turf.lineString((lineFeature.geometry as turf.LineString).coordinates);
        const length = turf.length(line, { units: "meters" });
    
        const points: turf.Feature<turf.Point>[] = [];
        const coordinates = (lineFeature.geometry as turf.LineString).coordinates;
    
        // Loop through distances and assign altitude based on flight plan segments
        for (let dist = 0; dist <= length; dist += samplingInterval) {
          const point = turf.along(line, dist, { units: "meters" });
    
          // Find the segment in the flight plan for the current distance
          let segmentIndex = 0;
          for (let i = 1; i < coordinates.length; i++) {
            const segmentStart = turf.distance(turf.point(coordinates[0]), turf.point(coordinates[i - 1]), { units: "meters" });
            const segmentEnd = turf.distance(turf.point(coordinates[0]), turf.point(coordinates[i]), { units: "meters" });
    
            if (dist >= segmentStart && dist <= segmentEnd) {
              segmentIndex = i - 1;
              break;
            }
          }
    
          // Assign the altitude for the segment
          const altitude = flightAltitudes[segmentIndex];
          point.geometry.coordinates[2] = altitude; // Set altitude from flight plan
          points.push(point);
        }
    
        return points;
      } catch (error) {
        if (error instanceof ViewshedError) throw error;
        throw new ViewshedError('Failed to generate sample points', 'SAMPLE_POINTS_ERROR');
      }
    }, [samplingInterval]);
    
    

    const handleViewshedAnalysis = async () => {
      try {
        console.log('Starting viewshed analysis');
        console.log('Input parameters:', { maxRange, angleStep, samplingInterval });
        console.log('Flight plan:', flightPlan);
        
        // Validate inputs first
        validateInputs();
    
        const defaultElevation = 0;
        
        const processLocation = (loc?: LocationData) => {
          if (!loc) return null;
          const processed = {
            ...loc,
            elevation: loc.elevation ?? defaultElevation
          };
          console.log('Processing location:', { original: loc, processed });
          return processed;
        };
      
        const gcs = processLocation(gcsLocation);
        const observer = processLocation(observerLocation);
        const repeater = processLocation(repeaterLocation);
    
        const lineFeature = flightPlan.features.find(
          f => f.geometry.type === "LineString"
        );
        
        if (!lineFeature) {
          throw new ViewshedError("No LineString found in flightPlan", 'NO_LINESTRING');
        }
    
        // Get sample points with error handling
        const samplePoints = getSamplePointsWithAltitudes(lineFeature, flightPlan.features[0].properties.altitudes);
        console.log("Sample points with interpolated altitudes:", samplePoints.map(p => p.geometry.coordinates));

        const normalizePointAltitude = async (point: turf.Feature<turf.Point>): Promise<[number, number, number]> => {
          const [lng, lat, elevation] = point.geometry.coordinates;
          if (elevation !== undefined && elevation > 0) return [lng, lat, elevation];
        
          // Default to terrain elevation if no flight altitude
          const terrainElevation = await TerrainService.getElevation(lng, lat);
          return [lng, lat, terrainElevation];
        };
        

        if (!samplePoints.length) {
          throw new ViewshedError('No sample points generated', 'NO_SAMPLE_POINTS');
        }

        const coveragePolygons: turf.Feature<turf.Polygon>[] = [];
        
        // Process each sample point with error tracking
        for (let i = 0; i < samplePoints.length; i++) {
          try {
            const point = samplePoints[i];
            const coords = point.geometry.coordinates;
            const vantage: [number, number, number] = [
              coords[0],
              coords[1],
              coords[2] || 0
            ];
            
          //  console.log('Processing vantage point:', {
           //   index: i,
           //   coordinates: vantage,
           //   totalPoints: samplePoints.length
          //  });

            // Debug terrain elevation
            const terrainElevation = await TerrainService.getElevation(coords[0], coords[1]);

        
            const polygon = await ViewshedGeometry.calculateVisibilityPolygon(
              vantage,
              angleStep,
              maxRange,
              50
            );
            
            if (!polygon) {
              console.warn(`Failed to generate polygon for point ${i}`);
              continue;
            }
            
            if (polygon) {
              coveragePolygons.push(polygon);
            } else {
              console.warn(`Skipping invalid polygon for point ${i}`);
            }
            

          } catch (error) {
            console.warn(`Error processing point ${i}:`, error);
            // Continue with other points
          }
        }

        if (!coveragePolygons.length) {
          throw new ViewshedError('No valid polygons generated', 'NO_VALID_POLYGONS');
        }
    
        return coveragePolygons;
      } catch (error) {
        if (error instanceof ViewshedError) throw error;
        throw new ViewshedError(
          'Failed to calculate viewshed analysis',
          'CALCULATION_ERROR'
        );
      }
    };

    const runAnalysis = async () => {
      setLoading(true);
      viewshedLoading?.(true);

      try {
        mapManager.clearViewshedLayers();
        const polygons = await handleViewshedAnalysis();

        if (!polygons?.length) {
          throw new ViewshedError('No viewshed polygons generated', 'NO_POLYGONS');
        }

        if (skipUnion) {
          polygons.forEach((poly, idx) => {
            if (!turf.booleanValid(poly)) {
              console.warn(`Skipping invalid polygon at index ${idx}:`, poly);
              return; // Skip invalid polygons
            }
            mapManager.addViewshedLayer(poly, idx);
          });
        } else {
          let union = polygons[0]; // Start with the first polygon
          if (!turf.booleanValid(union)) {
            console.warn('Initial polygon is invalid. Attempting to clean:', union);
            union = turf.cleanCoords(union); // Attempt to clean the polygon
            if (!turf.booleanValid(union)) {
              throw new ViewshedError('Failed to clean initial polygon', 'INVALID_POLYGON');
            }
          }
        
          for (let i = 1; i < polygons.length; i++) {
            try {
              // Check if union is empty or malformed
              if (!union || !union.geometry || union.geometry.coordinates.length === 0) {
                console.error(`Union geometry is empty or invalid. Skipping further processing.`);
                break; // Stop processing as union is corrupted
              }
        
              // Check if current polygon is empty or malformed
              if (!polygons[i] || !polygons[i].geometry || polygons[i].geometry.coordinates.length === 0) {
                console.warn(`Polygon ${i} geometry is empty or invalid. Skipping.`);
                continue;
              }

                  // Log the full GeoJSON of union and the current polygon
              console.log(`Union geometry before polygon ${i}:`, JSON.stringify(union, null, 2));
              console.log(`Polygon ${i} geometry:`, JSON.stringify(polygons[i], null, 2));

              console.log(`Processing polygon ${i}:`, {
                valid: turf.booleanValid(polygons[i]),
                coordinatesCount: polygons[i]?.geometry?.coordinates?.flat(Infinity).length || 0,
                boundingBox: turf.bbox(polygons[i]),
              });
        
              // Existing cleaning logic
              if (!turf.booleanValid(polygons[i])) {
                console.warn(`Polygon ${i} is invalid. Attempting to clean.`);
                polygons[i] = turf.cleanCoords(polygons[i]);
                if (!turf.booleanValid(polygons[i])) {
                  console.error(`Polygon ${i} is irreparable. Skipping.`);
                  continue;
                }
              }
        
              // Simplify geometries conservatively to avoid precision issues
   //           union = turf.simplify(union, { tolerance: 0.00001, highQuality: true });
    //          polygons[i] = turf.simplify(polygons[i], { tolerance: 0.0001, highQuality: true });
        
              console.log(`Simplified union and polygon ${i} geometries.`);
        
              // Check for actual overlap using turf.intersect()
              const intersection = turf.intersect(union, polygons[i]);
              if (!intersection) {
                console.warn(`Polygon ${i} does not overlap with the current union. Skipping.`);
                continue;
              }

              console.log(`Attempting to union polygon ${i}.`);
              const result = turf.union(union, polygons[i]);
        
              if (!result) {
                throw new ViewshedError('Union operation failed', 'UNION_FAILED');
              }
              union = result;
              console.log(`Union successful with polygon ${i}.`);
            } catch (error) {
              console.warn(`Union operation failed at index ${i}:`, error.message);
              console.warn(`Skipping problematic polygon ${i}.`);
              continue;
            }
          }
        
          mapManager.addViewshedLayer(union);
        }

        
        onSuccess?.();
      } catch (error) {
        console.error('Viewshed analysis failed:', error);
        if (error instanceof ViewshedError) {
          onError?.(error);
        } else {
          onError?.(new ViewshedError('Unknown error during viewshed analysis', 'UNKNOWN_ERROR'));
        }
      } finally {
        setLoading(false);
        viewshedLoading?.(false);
      }
    };

    useImperativeHandle(ref, () => ({
      runAnalysis,
      clearAnalysis: () => mapManager.clearViewshedLayers()
    }));

    return null;
  }
);

// Add display name for React DevTools
ViewshedAnalysis.displayName = "ViewshedAnalysis";

// Export the component and its types
export type { ViewshedAnalysisProps, ViewshedAnalysisRef };
export default ViewshedAnalysis;