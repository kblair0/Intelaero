// src/app/components/Analyses/Types/GridAnalysisTypes.ts
/**
 * GridAnalysisTypes.ts
 *
 * UNIFIED type definitions for the grid analysis system.
 * This file consolidates all types to prevent conflicts between
 * Area of Operations (AO) and Line of Sight (LOS) analysis systems.
 *
 * These types are used by:
 * - useGridAnalysis hook
 * - Analysis module implementations  
 * - UI components displaying analysis results
 * - Area of Operations terrain grids
 * - LayerManager for map display
 */

// Basic coordinate types
export type Coordinates2D = [number, number];
export type Coordinates3D = [number, number, number]; // [longitude, latitude, altitude]

// UNIFIED Grid cell representation - works for both AO and Analysis systems
export interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    // Core analysis properties (required for LOS analysis)
    visibility: number; // 0-100 visibility percentage
    fullyVisible: boolean; // Whether cell has 100% visibility
    lastAnalyzed: number; // Timestamp of last analysis
    
    // Terrain properties (required for AO compatibility)
    elevation: number; // Terrain elevation in meters (NOT optional - required for AO)
    
    // Additional analysis properties
    visibleStationCount?: number; // ADDED: Number of stations that can see this cell
    
    // Flexible additional properties
    [key: string]: any;
  };
}

// Terrain statistics for analysis results
export interface TerrainStats {
  highestElevation: number; // Maximum terrain elevation
  lowestElevation: number; // Minimum terrain elevation
  averageElevation: number; // Average terrain elevation
  elevationDistribution: Record<string, number>; // Histogram of elevations
  sampleElevations?: number[]; // Sample elevations for detailed analysis
}

// Statistics for analysis results
export interface AnalysisStats {
  visibleCells: number;
  totalCells: number;
  averageVisibility: number;
  analysisTime: number;
  terrainStats?: TerrainStats; // Terrain statistics if available
}

// FIXED: Complete analysis results with all missing properties
export interface AnalysisResults {
  cells: GridCell[]; // All analyzed cells
  stats: AnalysisStats; // Result statistics
  stationLOSResult?: StationLOSResult; // For station-to-station analysis
  flightPathVisibility?: FlightPathVisibilityResults; // For flight path visibility
  profile?: LOSProfilePoint[]; // Profile data if applicable
  
  // FIXED: Direct terrain analysis properties (accessed by GridAnalysisController)
  highestElevation?: number; // Maximum elevation found
  lowestElevation?: number; // Minimum elevation found
  averageElevation?: number; // Average elevation
  elevationDistribution?: Record<string, number>; // Elevation histogram
  elevations?: number[]; // Array of sample elevations
}

// Station-to-station LOS result
export interface StationLOSResult {
  clear: boolean; // Whether LOS is clear between stations
  obstructionFraction?: number; // Where along the line the obstruction occurs (0-1)
  obstructionDistance?: number; // Distance to obstruction in meters
}

// Flight path visibility results
export interface FlightPathVisibilityResults {
  visibleLength: number; // Length of visible flight path (meters)
  totalLength: number; // Total flight path length (meters)
  coveragePercentage: number; // Percentage of flight path with visibility
  stationStats?: Record<string, number>; // Per-station visibility stats
}

// Profile point for LOS elevation profile
export interface LOSProfilePoint {
  distance: number; // Distance along the line (meters)
  terrain: number; // Terrain elevation (meters)
  los: number; // Line of Sight elevation (meters)
}

// Analysis options
export interface AnalysisOptions {
  cellSize?: number; // Size of grid cells in meters
  sampleDistance?: number; // Distance between samples in meters
  maxRange?: number; // Maximum analysis range in meters
}

// Marker type enum
export type MarkerType = 'gcs' | 'observer' | 'repeater';

// Station visibility configuration
export interface StationConfig {
  type: MarkerType;
  location: LocationData;
  range: number;
  elevationOffset: number;
}

// Location data (matching existing LocationData)
export interface LocationData {
  lng: number;
  lat: number;
  elevation: number | null;
}

// Analysis types
export enum AnalysisType {
  FLIGHT_PATH = 'flight_path',
  STATION = 'station',
  MERGED = 'merged',
  STATION_TO_STATION = 'station_to_station',
  FLIGHT_PATH_VISIBILITY = 'flight_path_visibility',
  TERRAIN = 'terrain' // Added new terrain analysis type
}

// HELPER FUNCTIONS for backward compatibility

/**
 * Converts AO-style GridCell to unified GridCell format
 * Used when AO system passes terrain grids to analysis system
 */
export function convertAOCellToAnalysisCell(aoCell: {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    elevation: number;
    [key: string]: any;
  };
}): GridCell {
  return {
    id: aoCell.id,
    geometry: aoCell.geometry,
    properties: {
      // Set default analysis values
      visibility: 0,
      fullyVisible: false,
      lastAnalyzed: Date.now(),
      // Copy elevation from AO cell (now required, not optional)
      elevation: aoCell.properties.elevation,
      // Copy any additional properties
      ...aoCell.properties
    }
  };
}

/**
 * Converts unified GridCell back to AO-style format
 * Used when analysis system returns data to AO system
 */
export function convertAnalysisCellToAOCell(analysisCell: GridCell): {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    elevation: number;
    [key: string]: any;
  };
} {
  return {
    id: analysisCell.id,
    geometry: analysisCell.geometry,
    properties: {
      elevation: analysisCell.properties.elevation,
      // Copy additional properties except analysis-specific ones
      ...Object.fromEntries(
        Object.entries(analysisCell.properties).filter(
          ([key]) => !['visibility', 'fullyVisible', 'lastAnalyzed', 'visibleStationCount'].includes(key)
        )
      )
    }
  };
}

/**
 * Creates a new GridCell with default analysis properties
 * Used when generating fresh grid cells for analysis
 */
export function createGridCell(
  id: string,
  geometry: GeoJSON.Polygon,
  elevation: number,
  additionalProperties: Record<string, any> = {}
): GridCell {
  return {
    id,
    geometry,
    properties: {
      visibility: 0,
      fullyVisible: false,
      lastAnalyzed: Date.now(),
      elevation,
      ...additionalProperties
    }
  };
}