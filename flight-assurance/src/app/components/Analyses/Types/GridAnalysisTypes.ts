// src/app/types/GridAnalysisTypes.ts
/**
 * GridAnalysisTypes.ts
 *
 * This file defines the core types used throughout the grid analysis system.
 * It provides a clear type foundation for all LOS (Line of Sight) analysis
 * features including flight path analysis, station-based analysis, and
 * merged visibility calculations.
 *
 * These types are used by:
 * - useGridAnalysis hook
 * - Analysis module implementations
 * - UI components displaying analysis results
 */

// Basic coordinate types
export type Coordinates2D = [number, number];
export type Coordinates3D = [number, number, number]; // [longitude, latitude, altitude]

// Grid cell representation
export interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    visibility: number; // 0-100 visibility percentage
    fullyVisible: boolean; // Whether cell has 100% visibility
    elevation?: number; // Terrain elevation in meters
    lastAnalyzed: number; // Timestamp of last analysis
  };
}

// Terrain statistics for analysis results
export interface TerrainStats {
  highestElevation: number; // Maximum terrain elevation
  lowestElevation: number; // Minimum terrain elevation
  averageElevation: number; // Average terrain elevation
  elevationDistribution: Record<string, number>; // Histogram of elevations
}

// Statistics for analysis results
export interface AnalysisStats {
  visibleCells: number;
  totalCells: number;
  averageVisibility: number;
  analysisTime: number;
  terrainStats?: {
    highestElevation: number;
    lowestElevation: number;
    averageElevation: number;
    elevationDistribution: Record<string, number>;
    sampleElevations?: number[]; // Ensure this is included
  };
}

// Complete analysis results
export interface AnalysisResults {
  cells: GridCell[]; // All analyzed cells
  stats: AnalysisStats; // Result statistics
  stationLOSResult?: StationLOSResult; // For station-to-station analysis
  flightPathVisibility?: FlightPathVisibilityResults; // For flight path visibility
  profile?: LOSProfilePoint[]; // Profile data if applicable
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