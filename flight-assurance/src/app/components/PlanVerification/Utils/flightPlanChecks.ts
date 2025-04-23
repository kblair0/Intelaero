/**
 * PlanVerification/Utils/flightPlanChecks.ts
 * 
 * Purpose:
 * Utility functions for validating flight plans and extracting flight information.
 * Provides standalone functions that can be used by any component that needs
 * to analyze flight plan data.
 * 
 * Related Components:
 * - BasicChecksCard: Uses these utilities for flight plan validation
 * - Any component that needs to validate or extract flight plan information
 */

import { WaypointCoordinate } from './types';
import { FlightPlanData } from '@/app/context/FlightPlanContext';

/**
 * Checks for waypoints with zero altitude
 * @param flightPlan The flight plan to check
 * @returns Array of waypoint coordinates with zero altitude
 */
export function findZeroAltitudePoints(flightPlan: FlightPlanData | null): WaypointCoordinate[] {
  if (!flightPlan) return [];

  const zeroPoints: WaypointCoordinate[] = [];
  
  flightPlan.features.forEach((feature) => {
    feature.geometry.coordinates.forEach((coord: number[], index: number) => {
      if (coord[2] === 0) {
        zeroPoints.push({ coord, index });
      }
    });
  });

  return zeroPoints;
}

/**
 * Checks for duplicate waypoints in a flight plan
 * @param flightPlan The flight plan to check
 * @returns Array of duplicate waypoint coordinates
 */
export function findDuplicateWaypoints(flightPlan: FlightPlanData | null): WaypointCoordinate[] {
  if (!flightPlan) return [];

  const duplicates: WaypointCoordinate[] = [];
  
  flightPlan.features.forEach((feature) => {
    const seen = new Set<string>();
    
    feature.geometry.coordinates.forEach((coord: number[], index: number) => {
      const key = coord.join(",");
      if (seen.has(key)) {
        duplicates.push({ coord, index });
      }
      seen.add(key);
    });
  });

  return duplicates;
}

/**
 * Checks for KMZ-specific takeoff height issues
 * @param flightPlan The flight plan to check
 * @returns Warning message or null if no issues
 */
export function checkKmzTakeoffSafety(flightPlan: FlightPlanData | null): string | null {
  if (!flightPlan) return null;

  // Check if this is a KMZ file
  const isKmz = flightPlan.properties?.metadata?.distance !== undefined;
  
  if (isKmz) {
    const mode = flightPlan.features[0]?.properties?.waypoints?.[0]?.altitudeMode;
    const takeoffHeight = (flightPlan.properties?.config as { takeoffHeight?: number } | undefined)?.takeoffHeight || 0;
    const homeAltitude = flightPlan.properties?.homePosition?.altitude || 0;
    
    if ((mode === "terrain" || mode === "relative") && takeoffHeight === 0 && homeAltitude === 0) {
      return "Warning: Takeoff security height missing in terrain or relative mission; home altitude is 0m.";
    }
  }
  
  return null;
}

/**
 * Gets the height mode information from the flight plan
 * @param flightPlan The flight plan to check
 * @returns Object containing mode, display name, and validity flag
 */
export function getHeightModeInfo(flightPlan: FlightPlanData | null): { 
  mode: string; 
  display: string;
  isValid: boolean;
} {
  if (!flightPlan) {
    return { mode: "unknown", display: "Unknown Height Mode", isValid: false };
  }

  const heightMode: string = 
    flightPlan.features[0]?.properties?.waypoints?.[0]?.altitudeMode ?? "unknown";
  
  const heightModeMap: Record<string, string> = {
    "terrain": "Terrain Following (10m Fidelity Shown)",
    "relative": "Relative To Start Point",
    "absolute": "Absolute (Set AMSL Altitudes)",
    "unknown": "Unknown Height Mode"
  };
  
  const heightModeDisplay = heightModeMap[heightMode] || heightModeMap.unknown;

  return { 
    mode: heightMode, 
    display: heightModeDisplay,
    isValid: heightMode !== "unknown"
  };
}

/**
 * Extracts coordinates from a flight plan for use in UI or analysis
 * @param flightPlan The flight plan
 * @returns Array of coordinates with indices
 */
export function extractWaypointCoordinates(flightPlan: FlightPlanData | null): WaypointCoordinate[] {
  if (!flightPlan) return [];
  
  const coordinates: WaypointCoordinate[] = [];
  
  flightPlan.features.forEach((feature) => {
    feature.geometry.coordinates.forEach((coord: number[], index: number) => {
      coordinates.push({ coord, index });
    });
  });
  
  return coordinates;
}