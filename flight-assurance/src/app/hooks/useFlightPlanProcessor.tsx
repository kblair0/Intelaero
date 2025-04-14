"use client";
import { useCallback, useState, useEffect } from 'react';
import * as turf from '@turf/turf';
import { FlightPlanData, WaypointData } from '../context/FlightPlanContext';

/**
 * Custom hook for processing flight plans
 * Handles terrain queries, distance calculations, and altitude resolutions
 */
export const useFlightPlanProcessor = () => {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Query terrain elevation at given coordinates
   * Includes fallback mechanism with retry capability
   */
  const queryTerrainElevation = useCallback(async (
    map: mapboxgl.Map,
    coordinates: [number, number],
    retryCount = 3
  ): Promise<number> => {
    try {
      const elevation = map.queryTerrainElevation(coordinates);
      if (elevation !== null && elevation !== undefined) {
        return elevation;
      }
      throw new Error("Invalid elevation value");
    } catch (error) {
      console.warn("Primary terrain query failed, trying fallback:", error);
      if (retryCount > 0) {
        try {
          const fallbackElevation = await fetchTerrainElevation(coordinates[0], coordinates[1]);
          return fallbackElevation;
        } catch (fallbackError) {
          if (retryCount > 1) {
            console.warn("Fallback failed, retrying:", fallbackError);
            return queryTerrainElevation(map, coordinates, retryCount - 1);
          }
          throw fallbackError;
        }
      }
      throw error;
    }
  }, []);

  /**
   * Densify a segment of flight coordinates in terrain mode.
   * Takes an array of coordinates and samples points every 10 meters along the segment.
   */
  const densifyTerrainSegment = useCallback(async (
    map: mapboxgl.Map,
    segmentCoords: [number, number, number][]
  ): Promise<[number, number, number][]> => {
    if (segmentCoords.length < 2) return segmentCoords;
    
    // Build a 2D LineString (ignoring altitude)
    const coords2D = segmentCoords.map(coord => [coord[0], coord[1]]);
    const line = turf.lineString(coords2D);
    
    // Compute cumulative distances along the segment in meters
    const cumDistances: number[] = [0];
    for (let i = 1; i < segmentCoords.length; i++) {
      const segmentDist = turf.distance(segmentCoords[i - 1], segmentCoords[i], { units: "meters" });
      cumDistances.push(cumDistances[i - 1] + segmentDist);
    }
    const totalLength = cumDistances[cumDistances.length - 1];
    
    const densified: [number, number, number][] = [];
    // Sample every 10 meters along the line
    for (let d = 0; d <= totalLength; d += 10) {
      const pt = turf.along(line, d, { units: "meters" });
      const [lon, lat] = pt.geometry.coordinates;
      
      // Interpolate the raw offset from segmentCoords (these are raw AGL values for terrain mode)
      let interpOffset = segmentCoords[0][2]; // default to the first point's offset
      if (d <= cumDistances[0]) {
        interpOffset = segmentCoords[0][2];
      } else if (d >= cumDistances[cumDistances.length - 1]) {
        interpOffset = segmentCoords[segmentCoords.length - 1][2];
      } else {
        for (let i = 0; i < cumDistances.length - 1; i++) {
          if (d >= cumDistances[i] && d <= cumDistances[i + 1]) {
            const fraction = (d - cumDistances[i]) / (cumDistances[i + 1] - cumDistances[i]);
            interpOffset = segmentCoords[i][2] + fraction * (segmentCoords[i + 1][2] - segmentCoords[i][2]);
            break;
          }
        }
      }
      
      // Query the current terrain elevation at this location and add the raw offset to compute the absolute altitude
      const terrainElev = await queryTerrainElevation(map, [lon, lat]);
      const resolvedAlt = terrainElev + interpOffset;
      densified.push([lon, lat, resolvedAlt]);
    }
    return densified;
  }, [queryTerrainElevation]);

  /**
   * Process a flight plan to resolve altitudes and calculate distances
   * Handles different altitude modes (terrain, relative, absolute)
   */
  const processFlightPlan = useCallback(async (
    map: mapboxgl.Map,
    flightPlan: FlightPlanData
  ): Promise<FlightPlanData> => {
    if (!flightPlan || flightPlan.properties?.processed) {
      return flightPlan;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      // Make a deep copy of the flight plan to avoid mutation
      const newPlan: FlightPlanData = structuredClone(flightPlan);
      const coordinates = newPlan.features[0].geometry.coordinates;
      
      // Query terrain elevation at home position
      const homeTerrainElev = await queryTerrainElevation(map, [
        newPlan.properties.homePosition.longitude,
        newPlan.properties.homePosition.latitude,
      ]);

      // Helper function to resolve altitude based on mode
      const resolveAltitude = async (
        wp: WaypointData,
        coord: [number, number, number],
        homeElev: number
      ): Promise<number> => {
        const [lon, lat, origAlt] = coord;
        const terrainElev = wp.altitudeMode === "terrain" || wp.altitudeMode === "relative" 
          ? await queryTerrainElevation(map, [lon, lat]) 
          : homeElev;
        
        switch (wp.altitudeMode) {
          case "terrain": return terrainElev + origAlt;
          case "relative": return terrainElev + origAlt;
          case "absolute": return origAlt;
          default: return origAlt;
        }
      };

      // Process waypoints and coordinates
      const waypoints = newPlan.features[0].properties.waypoints;
      const segments: { waypoint: typeof waypoints[0]; coordinate: [number, number, number] }[][] = [];
      let currentSegment: { waypoint: typeof waypoints[0]; coordinate: [number, number, number] }[] = [];

      // Group waypoints by altitude mode to process segments appropriately
      waypoints.forEach(wp => {
        const coord = newPlan.features[0].geometry.coordinates[wp.index];
        if (!coord) return;
        
        const item = { waypoint: wp, coordinate: coord };
        
        if (currentSegment.length && wp.altitudeMode !== currentSegment[currentSegment.length - 1].waypoint.altitudeMode) {
          segments.push(currentSegment);
          currentSegment = [item];
        } else {
          currentSegment.push(item);
        }
      });
      
      if (currentSegment.length) segments.push(currentSegment);

      const processedCoords: [number, number, number][] = [];
      const originalCoords: [number, number, number][] = [];

      // Process each segment based on its altitude mode
      for (const segment of segments) {
        const coords = segment.map(item => item.coordinate);
        
        if (segment[0].waypoint.altitudeMode === "terrain") {
          // For terrain mode, densify the path to follow terrain more closely
          const densified = await densifyTerrainSegment(map, coords);
          processedCoords.push(...densified);
          
          for (const { waypoint, coordinate } of segment) {
            const resolvedAlt = await resolveAltitude(waypoint, coordinate, homeTerrainElev);
            originalCoords.push([coordinate[0], coordinate[1], resolvedAlt]);
          }
        } else {
          // For absolute or relative modes, just resolve the altitudes
          for (const { waypoint, coordinate } of segment) {
            const resolvedAlt = await resolveAltitude(waypoint, coordinate, homeTerrainElev);
            const newCoord = [coordinate[0], coordinate[1], resolvedAlt] as [number, number, number];
            processedCoords.push(newCoord);
            originalCoords.push(newCoord);
          }
        }
      }

      // Calculate distances between waypoints
      let totalDistance = 0;
      const waypointDistances = [0];
      
      for (let i = 1; i < processedCoords.length; i++) {
        const segmentLine = turf.lineString([
          processedCoords[i - 1].slice(0, 2), 
          processedCoords[i].slice(0, 2)
        ]);
        totalDistance += turf.length(segmentLine, { units: "kilometers" });
        waypointDistances.push(totalDistance);
      }

      // Update flight plan with processed data
      newPlan.properties.homePosition.altitude = await resolveAltitude(
        waypoints[0], 
        coordinates[0], 
        homeTerrainElev
      );
      newPlan.properties.totalDistance = totalDistance;
      newPlan.properties.processed = true;
      newPlan.features[0].geometry.coordinates = processedCoords;
      newPlan.features[0].properties.originalCoordinates = originalCoords;
      newPlan.waypointDistances = waypointDistances;

      setIsProcessing(false);
      return newPlan;
    } catch (error) {
      setIsProcessing(false);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError("Failed to process flight plan: " + errorMessage);
      throw error;
    }
  }, [densifyTerrainSegment, queryTerrainElevation]);

  /**
   * Fetch terrain elevation from Mapbox API as fallback
   */
  async function fetchTerrainElevation(lng: number, lat: number): Promise<number> {
    try {
      const tileSize = 512;
      const zoom = 15;
      const scale = Math.pow(2, zoom);
  
      const latRad = (lat * Math.PI) / 180;
      const tileX = Math.floor(((lng + 180) / 360) * scale);
      const tileY = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
      );
  
      const pixelX = Math.floor((((lng + 180) / 360) * scale - tileX) * tileSize);
      const pixelY = Math.floor(
        (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale - tileY) * tileSize
      );
  
      const tileURL = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
      const response = await fetch(tileURL);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
  
      const canvas = document.createElement("canvas");
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Failed to create canvas context");
  
      context.drawImage(imageBitmap, 0, 0);
      const imageData = context.getImageData(0, 0, tileSize, tileSize);
  
      const idx = (pixelY * tileSize + pixelX) * 4;
      const [r, g, b] = [
        imageData.data[idx],
        imageData.data[idx + 1],
        imageData.data[idx + 2],
      ];
  
      return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
    } catch (error) {
      console.error("RGB elevation error:", error);
      return 0;
    }
  }

  return {
    processFlightPlan,
    queryTerrainElevation,
    densifyTerrainSegment,
    isProcessing,
    error,
    setError
  };
};