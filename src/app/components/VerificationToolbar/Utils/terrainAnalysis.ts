/**
 * verificationtoolbar/Utils/terrainAnalysis.ts
 * 
 * Purpose:
 * Utilities for terrain analysis and elevation data processing.
 * Integrates with ElevationService for terrain data and provides helpers
 * for processing and visualizing terrain analysis results.
 * 
 * Related Components:
 * - TerrainAnalysisCard: Uses these utilities to display terrain results
 * - ToolsDashboard: May use for coordinating analysis
 */

import { ElevationService } from '@/app/services/ElevationService';
import { TerrainAnalysisResult } from './types';
import { ObstacleAnalysisResult } from '@/app/context/ObstacleAnalysisContext';

/**
 * Gets the minimum clearance distance from analysis results
 * @param results The terrain analysis results object
 * @returns Minimum clearance distance in meters, or null if no results
 */
export function findMinClearanceDistance(results: ObstacleAnalysisResult | null): number | null {
  if (!results) return null;
  
  const clearances = results.flightAltitudes.map(
    (alt: number, idx: number) => alt - results.terrainElevations[idx]
  );
  
  const minClearance = Math.min(...clearances);
  const index = clearances.indexOf(minClearance);
  
  return results.distances[index];
}

/**
 * Extracts key terrain analysis metrics from obstacle analysis results
 * @param results The obstacle analysis results
 * @returns Simplified terrain analysis result or null if no data
 */
export function extractTerrainAnalysisResults(
  results: ObstacleAnalysisResult | null
): TerrainAnalysisResult | null {
  if (!results) return null;
  
  return {
    minimumClearance: results.minimumClearance,
    criticalPointDistance: results.criticalPointDistance,
    highestObstacle: results.highestObstacle,
    hasCollision: results.minimumClearance < 0
  };
}

/**
 * Determines the status of terrain analysis based on results
 * @param results The terrain analysis results
 * @returns Status indicating safety level
 */
export function getTerrainAnalysisStatus(
  results: ObstacleAnalysisResult | null
): 'success' | 'error' | 'warning' | 'pending' {
  if (!results) return 'pending';
  
  // If we have minimum clearance data
  if (results.minimumClearance !== undefined) {
    // Check if there's a collision (negative clearance)
    if (results.minimumClearance < 0) {
      return 'error';
    }
    
    // Low clearance warning (less than 5 meters)
    if (results.minimumClearance < 5) {
      return 'warning';
    }
    
    return 'success';
  }
  
  return 'pending';
}

/**
 * Formats distance for display
 * @param distance Distance in meters
 * @param decimals Number of decimal places
 * @returns Formatted distance string with units
 */
export function formatDistance(distance: number | null, decimals: number = 2): string {
  if (distance === null || distance === undefined) return 'N/A';
  
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(decimals)} km`;
  }
  
  return `${distance.toFixed(decimals)} m`;
}

/**
 * Preloads terrain data for a flight path to improve analysis performance
 * @param elevationService The elevation service instance
 * @param coordinates Array of 3D coordinates defining the flight path
 * @returns Promise that resolves when preloading is complete
 */
export async function preloadTerrainData(
  elevationService: ElevationService | undefined,
  coordinates: [number, number, number][]
): Promise<void> {
  if (!elevationService || !coordinates.length) {
    return;
  }
  
  try {
    await elevationService.ensureTerrainReady();
    await elevationService.preloadArea(coordinates);
  } catch (error) {
    console.warn('Failed to preload terrain data:', error);
  }
}