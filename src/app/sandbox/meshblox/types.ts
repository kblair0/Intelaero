/**
 * types.ts - Updated with Mode Management Types
 * 
 * Purpose:
 * Comprehensive TypeScript type definitions for the meshblock integration feature.
 * Now includes mode management types for the two-mode interface redesign.
 * 
 * New additions:
 * - MeshblockMode enum for explore/assess modes
 * - Updated MeshblockState to include currentMode
 * - Extended component props interfaces
 */
import { LandUseCategory, GroundRiskClass } from './utils/meshblockColors';
import * as GeoJSON from 'geojson';

/**
 * NEW: Mode type for the two-mode interface
 */
export type MeshblockMode = 'explore' | 'assess';

/**
 * Dwelling estimation ranges by land use category
 * Based on corrected ABS documentation from handoff
 */
export const DWELLING_ESTIMATES: Record<LandUseCategory, { min: number; max: number; typical: number }> = {
  [LandUseCategory.RESIDENTIAL]: { min: 30, max: 60, typical: 45 },
  [LandUseCategory.COMMERCIAL]: { min: 0, max: 0, typical: 0 },
  [LandUseCategory.INDUSTRIAL]: { min: 0, max: 0, typical: 0 },
  [LandUseCategory.PARKLAND]: { min: 0, max: 0, typical: 0 },
  [LandUseCategory.EDUCATION]: { min: 0, max: 100, typical: 20 },
  [LandUseCategory.HOSPITAL_MEDICAL]: { min: 0, max: 20, typical: 5 },
  [LandUseCategory.TRANSPORT]: { min: 0, max: 0, typical: 0 },
  [LandUseCategory.PRIMARY_PRODUCTION]: { min: 0, max: 5, typical: 1 },
  [LandUseCategory.WATER]: { min: 0, max: 0, typical: 0 },
  [LandUseCategory.OTHER]: { min: 0, max: 10, typical: 2 }
};

/**
 * Core meshblock feature interface extending GeoJSON
 * Matches ABS Meshblock API response structure
 */
export interface MeshblockFeature extends GeoJSON.Feature {
  geometry: GeoJSON.Polygon;
  properties: {
    // Core ABS fields (required from API)
    mb_code_2021: string;           // Unique 11-digit identifier
    mb_category_2021: string;       // Land use type
    area_albers_sqkm: number;       // Area in square kilometers
    sa2_name_2021: string;          // Suburb name
    state_name_2021: string;        // State name
    
    // Calculated fields (added during processing)
    estimatedDwellings?: number;
    estimatedPopulation?: number;
    populationDensity?: number;      // People per square kilometer
    intersectsFlightPath?: boolean;
    landUseCategory?: LandUseCategory;

    // Flight path analysis fields (added during intersection analysis)
    intersectionArea?: number;       // Area of intersection in km²
    intersectionRatio?: number;      // Ratio of intersection to total meshblock area
    scaledPopulation?: number; // Population * intersectionRatio
    scaledArea?: number; // Area * intersectionRatio
    
    // Analysis metadata
    processedAt?: string;           // ISO timestamp
    analysisVersion?: string;       // For cache invalidation

  };
}

/**
 * Collection of meshblock features
 */
export interface MeshblockCollection extends GeoJSON.FeatureCollection {
  features: MeshblockFeature[];
  properties?: {
    totalFeatures: number;
    requestBounds: number[];        // [west, south, east, north]
    requestZoom: number;
    fetchedAt: string;              // ISO timestamp
    source: 'abs-api';
  };
}

/**
 * ABS API response structure
 */
export interface ABSMeshblockAPIResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoJSON.Polygon;
    properties: {
      mb_code_2021: string;           // ✅ Correct
      mb_category_2021: string;       // ✅ Correct
      area_albers_sqkm: number;       // ✅ Correct  
      sa2_name_2021: string;          // ✅ Correct
      state_name_2021: string;        // ✅ Correct
    };
  }>;
  // ABS API may include additional metadata
  metadata?: {
    totalRecords?: number;
    returnedRecords?: number;
    maxRecordsExceeded?: boolean;
  };
}

/**
 * API request parameters for ABS Meshblock service
 */
export interface MeshblockAPIParams {
  bbox: number[];                   // [west, south, east, north]
  zoom: number;
  outFields: string[];             // Field names to fetch
  spatialRel: 'esriSpatialRelIntersects';
  returnGeometry: boolean;
  maxRecordCount?: number;         // Default 5000 as per requirements
}

/**
 * Caching structure for meshblock data
 */
export interface MeshblockCache {
  key: string;                     // Generated from bbox + zoom
  data: MeshblockCollection;
  expiresAt: number;              // Timestamp
  size: number;                   // Number of features cached
}

/**
 * View modes for meshblock visualization
 */
export enum MeshblockViewMode {
  LAND_USE = 'landUse',
  POPULATION_DENSITY = 'populationDensity'
}

/**
 * Filter options for meshblock display
 */
export interface MeshblockFilters {
  landUseCategories?: LandUseCategory[];
  minPopulationDensity?: number;
  maxPopulationDensity?: number;
  minArea?: number;               // Square kilometers
  maxArea?: number;               // Square kilometers
  states?: string[];              // Filter by state
  showIntersectingOnly?: boolean; // Only show meshblocks intersecting flight path
}

/**
 * Meshblock context state interface
 * UPDATED: Now includes currentMode for two-mode interface
 */
export interface MeshblockState {
  // Data state
  meshblocks: MeshblockCollection | null;
  loading: boolean;
  error: string | null;
  
  // View state
  viewMode: MeshblockViewMode;
  filters: MeshblockFilters;
  layersVisible: boolean;
  
  // Analysis state
  flightPathAnalysis: FlightPathMeshblockAnalysis | null;
  analysisLoading: boolean;

  // Aircraft configuration
  aircraftConfig: AircraftConfiguration | null;
  
  // Popup state
  selectedMeshblock: MeshblockFeature | null;
  showPopup: boolean;
  
  showMethodologyModal: boolean;
}

/**
 * Flight path intersection analysis results
 */
export interface FlightPathMeshblockAnalysis {
  // Basic intersection data
  intersectingMeshblocks: MeshblockFeature[];
  totalIntersectingArea: number;                    // Square kilometers
  
  // Population analysis
  totalEstimatedPopulation: number;
  averagePopulationDensity: number;
  highestDensityMeshblock: MeshblockFeature | null;
  
  // Land use breakdown
  landUseBreakdown: Record<LandUseCategory, {
    count: number;
    totalArea: number;
    estimatedPopulation: number;
  }>;

    // Population distribution by ground risk class
  populationDistribution: Record<GroundRiskClass, {
    count: number;
    totalArea: number;
    estimatedPopulation: number;
  }>;

    // iGRC analysis
  iGRCAnalysis?: iGRCAnalysis;
  
  // Risk assessment data
  riskFactors: {
    highDensityMeshblocks: MeshblockFeature[];     // >1000 people/km²
    criticalInfrastructure: MeshblockFeature[];    // Hospitals, schools
    commercialAreas: MeshblockFeature[];           // Commercial zones
  };
  
  // Metadata
  analysisDate: string;                            // ISO timestamp
  flightPathLength: number;                        // Meters
  bufferDistance: number;                          // Meters used for intersection
}

/**
 * Population density calculation options
 */
export interface PopulationCalculationOptions {
  useConservativeEstimates: boolean;               // Use min vs typical dwelling counts
  averageOccupancyRate: number;                   // People per dwelling (default 2.4)
  includeInstitutionalPopulation: boolean;        // Include hospitals, schools, etc.
}

/**
 * Meshblock service configuration
 */
export interface MeshblockServiceConfig {
  apiUrl: string;
  maxRecordsPerRequest: number;
  cacheExpiryMinutes: number;
  maxCacheSize: number;                           // Number of cache entries
  retryAttempts: number;
  retryDelayMs: number;
}

/**
 * Error types for meshblock operations
 */
export enum MeshblockErrorType {
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error',
  PARSING_ERROR = 'parsing_error',
  CACHE_ERROR = 'cache_error',
  ANALYSIS_ERROR = 'analysis_error',
  ZOOM_LEVEL_ERROR = 'zoom_level_error',
  GEOMETRY_ERROR = 'geometry_error'
}

/**
 * Structured error information
 */
export interface MeshblockError {
  type: MeshblockErrorType;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

/**
 * Component props interfaces
 * UPDATED: Extended to support compact mode
 */

export interface MeshblockControlsProps {
  viewMode: MeshblockViewMode;
  onViewModeChange: (mode: MeshblockViewMode) => void;
  filters: MeshblockFilters;
  onFiltersChange: (filters: MeshblockFilters) => void;
  layersVisible: boolean;
  onLayersVisibleChange: (visible: boolean) => void;
  canActivate: boolean;
  loading: boolean;
  meshblockCount: number;
  compact?: boolean; // NEW: For simplified display in dropdowns
}

export interface MeshblockPopupProps {
  meshblock: MeshblockFeature;
  viewMode: MeshblockViewMode;
  onClose: () => void;
  includeAnalysisData?: boolean;
}

export interface MeshblockFlightAnalysisProps {
  analysis: FlightPathMeshblockAnalysis | null;
  loading: boolean;
  onRunAnalysis: () => Promise<void>;
  onExportResults: () => void;
  flightPathGeometry: GeoJSON.LineString | null;
  onShowMethodology?: () => void;
}

export interface MeshblockDashboardProps {
  onClose?: () => void;
  className?: string;
}

/**
 * Performance monitoring interface
 */
export interface MeshblockPerformanceMetrics {
  apiCallDuration: number;        // Milliseconds
  processingDuration: number;     // Milliseconds
  renderDuration: number;         // Milliseconds
  memoryUsage: number;           // Bytes
  featuresProcessed: number;
  cacheHitRate: number;          // Percentage
}

/**
 * Export format options for analysis results
 */
export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  GEOJSON = 'geojson',
  PDF_REPORT = 'pdf'
}

export interface ExportOptions {
  format: ExportFormat;
  includeGeometry: boolean;
  includeAnalysis: boolean;
  includeMetadata: boolean;
  filename?: string;
}

/**
 * Aircraft configuration for iGRC calculation
 */
export interface AircraftConfiguration {
  type: 'fixed-wing' | 'rotorcraft' | 'multi-copter';
  maxDimension: number;           // meters (wingspan/blade diameter/tip-to-tip)
  maxSpeed: number;               // m/s
  operationType: 'VLOS' | 'BVLOS';
  sizeCategory: 1 | 3 | 8 | 20 | 40; // Auto-calculated from maxDimension
  operationAltitudeAGL?: number;  // meters Above Ground Level
}

/**
 * iGRC analysis results
 */
export interface iGRCAnalysis {
  byGroundRiskClass: Record<GroundRiskClass, {
    iGRCValue: number;
    riskLevel: 'low' | 'medium' | 'high' | 'very-high';
    meshblockCount: number;
    area: number;
    population: number;
  }>;
  overallRange: {
    min: number;
    max: number;
  };
  highestRiskAreas: MeshblockFeature[];
  recommendations: string[];
}

// Re-export commonly used types for convenience
export type { GeoJSON } from 'geojson';
// Re-export ground risk classes from meshblockColors  
export { LandUseCategory, GroundRiskClass, getGroundRiskClass, getGroundRiskClassName, getGroundRiskClassColor } from './utils/meshblockColors';