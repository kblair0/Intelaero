/**
 * types.ts
 * 
 * Purpose:
 * TypeScript type definitions for the NSW Cadastre Property Boundary Overlay System.
 * Defines interfaces for property boundaries, survey marks, and all related data structures
 * following the established pattern from meshblock integration.
 * 
 * This file exports:
 * - Core property and survey mark interfaces
 * - API response structures for NSW services
 * - UI component prop types
 * - Service configuration types
 * - Enums for categorization and display modes
 * 
 * Related Files:
 * - CadastreService.ts - Uses these types for API calls
 * - CadastreDisplay.tsx - Renders features based on these interfaces
 * - PropertyPopup.tsx - Displays property data using these types
 * - CadastreContext.tsx - Manages state using these interfaces
 */

import * as GeoJSON from 'geojson';

// =============================================================================
// CORE FEATURE INTERFACES
// =============================================================================

/**
 * Core property feature interface extending GeoJSON
 * Based on NSW Cadastre API field structure
 */
export interface PropertyFeature extends GeoJSON.Feature {
  geometry: GeoJSON.Polygon;
  properties: {
    // Core NSW Cadastre fields (from API) - matching actual API response
    objectid: number;
    cadid: number;
    createdate: number;
    modifieddate: number;
    controllingauthorityoid: number;
    planoid: number;
    plannumber: number;
    planlabel: string;
    itstitlestatus: number;
    itslotid: number;
    stratumlevel: number;
    hasstratum: boolean;              // Processed from API number to boolean
    classsubtype: number;
    lotnumber: string;
    sectionnumber?: string | null;    // Can be null from API
    planlotarea?: number | null;      // Can be null from API
    planlotareaunits?: string | null; // Can be null from API
    startdate: number;
    enddate: number;
    lastupdate: number;
    msoid: number;
    centroidid?: number | null;
    shapeuuid: string;
    changetype: string;
    lotidstring: string;
    processstate?: string | null;
    urbanity: string;
    shape_Length: number;
    shape_Area: number;

    // Enhanced fields (calculated during processing)
    areaHectares?: number;            // Area converted to hectares
    areaDisplay?: string;             // Formatted area for display
    lotPlanId?: string;               // Combined lot/plan identifier
    propertyType?: PropertyType;      // Categorized property type
    
    // Display and interaction state
    isSelected?: boolean;             // Currently selected in UI
    isHighlighted?: boolean;          // Highlighted for flight path intersection
    
    // Analysis metadata
    processedAt?: string;             // ISO timestamp when processed
    dataSource: 'nsw-cadastre';      // Source identifier
  };
}

/**
 * Survey mark feature interface
 * Based on NSW Survey Mark API field structure
 */
export interface SurveyMarkFeature extends GeoJSON.Feature {
  geometry: GeoJSON.Point;
  properties: {
    // Core NSW Survey Mark fields (from API)
    trigname: string | null;          // Survey mark name/identifier (can be null)
    marktype: string;                 // Type of survey mark
    marknumber?: number;              // Mark number
    markstatus: string | null;        // Status of the mark (can be null)
    monumenttype: string;             // Physical monument type
    markalias?: string;               // Alternative name
    trigtype: string;                 // Trigonometric type
    monumentlocation: string;         // Monument location code
    
    // Coordinate information
    mgaeasting: number;               // MGA Easting coordinate
    mganorthing: number;              // MGA Northing coordinate
    mgazone: number;                  // MGA Zone
    ahdheight?: number;               // AHD height in meters
    
    // Additional metadata
    gdadate?: string;                 // GDA survey date
    gdaclass?: string;                // GDA classification
    gdaorder?: string;                // GDA order
    marksymbol: string;               // Symbol for map display
    
    // Enhanced fields
    displayName?: string;             // Display name for UI
    coordinateDisplay?: string;       // Formatted coordinates for display
    elevationDisplay?: string;        // Formatted elevation for display
    
    // Display state
    isSelected?: boolean;             // Currently selected in UI
    
    // Analysis metadata
    processedAt?: string;             // ISO timestamp when processed
    dataSource: 'nsw-survey-marks';   // Source identifier
  };
}
/**
 * Collection of property features
 */
export interface PropertyCollection extends GeoJSON.FeatureCollection {
  features: PropertyFeature[];
  properties?: {
    totalFeatures: number;
    requestBounds: number[];          // [west, south, east, north]
    requestZoom: number;
    fetchedAt: string;                // ISO timestamp
    source: 'nsw-cadastre';
  };
}

/**
 * Collection of survey mark features
 */
export interface SurveyMarkCollection extends GeoJSON.FeatureCollection {
  features: SurveyMarkFeature[];
  properties?: {
    totalFeatures: number;
    requestBounds: number[];          // [west, south, east, north]
    requestZoom: number;
    fetchedAt: string;                // ISO timestamp
    source: 'nsw-survey-marks';
  };
}

// =============================================================================
// API RESPONSE INTERFACES
// =============================================================================

/**
 * NSW Cadastre API response structure
 */
export interface NSWCadastreAPIResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoJSON.Polygon;
    properties: {
      objectid: number;
      cadid: number;
      createdate: number;
      modifieddate: number;
      controllingauthorityoid: number;
      planoid: number;
      plannumber: number;
      planlabel: string;
      itstitlestatus: number;
      itslotid: number;
      stratumlevel: number;
      hasstratum: number;              // API returns as number, convert to boolean
      classsubtype: number;
      lotnumber: string;
      sectionnumber?: string | null;
      planlotarea?: number | null;
      planlotareaunits?: string | null;
      startdate: number;
      enddate: number;
      lastupdate: number;
      msoid: number;
      centroidid?: number | null;
      shapeuuid: string;
      changetype: string;
      lotidstring: string;
      processstate?: string | null;
      urbanity: string;
      shape_Length: number;
      shape_Area: number;
    };
  }>;
  // API may include additional metadata
  metadata?: {
    totalRecords?: number;
    returnedRecords?: number;
    maxRecordsExceeded?: boolean;
  };
  exceededTransferLimit?: boolean;
}

/**
 * NSW Survey Mark API response structure
 */
export interface NSWSurveyMarkAPIResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoJSON.Point;
    properties: {
      trigname: string;
      marktype: string;
      marknumber?: number;
      markstatus: string;
      monumenttype: string;
      markalias?: string;
      trigtype: string;
      monumentlocation: string;
      mgaeasting: number;
      mganorthing: number;
      mgazone: number;
      ahdheight?: number;
      gdadate?: string;
      gdaclass?: string;
      gdaorder?: string;
      marksymbol: string;
    };
  }>;
  metadata?: {
    totalRecords?: number;
    returnedRecords?: number;
    maxRecordsExceeded?: boolean;
  };
}

// =============================================================================
// ENUMS AND CONSTANTS
// =============================================================================

/**
 * Property types derived from plan and lot characteristics
 */
export enum PropertyType {
  RESIDENTIAL_LOT = 'Residential Lot',
  COMMERCIAL_LOT = 'Commercial Lot',
  INDUSTRIAL_LOT = 'Industrial Lot',
  RURAL_LOT = 'Rural Lot',
  ROAD_RESERVE = 'Road Reserve',
  CROWN_LAND = 'Crown Land',
  WATER_FEATURE = 'Water Feature',
  STRATA_UNIT = 'Strata Unit',
  COMMUNITY_TITLE = 'Community Title',
  OTHER = 'Other'
}

/**
 * Display modes for the cadastre overlay
 */
export enum CadastreViewMode {
  PROPERTIES_ONLY = 'properties',
  SURVEY_MARKS_ONLY = 'surveymarks',
  BOTH = 'both'
}

/**
 * Survey mark types for filtering and display
 */
export enum SurveyMarkType {
  TRIGONOMETRIC = 'Trigonometric',
  TRAVERSE = 'Traverse', 
  BENCHMARK = 'Benchmark',
  BOUNDARY = 'Boundary',
  REFERENCE = 'Reference',
  CONTROL = 'Control',
  OTHER = 'Other'
}

// =============================================================================
// STATE MANAGEMENT INTERFACES
// =============================================================================

/**
 * Main context state for cadastre overlay
 */
export interface CadastreState {
  // Data state
  properties: PropertyCollection | null;
  surveyMarks: SurveyMarkCollection | null;
  loading: boolean;
  error: string | null;
  
  // View state
  viewMode: CadastreViewMode;
  layersVisible: boolean;
  
  // Popup state
  selectedProperty: PropertyFeature | null;
  selectedSurveyMark: SurveyMarkFeature | null;
  showPopup: boolean;
}

/**
 * Filter options for display
 */
export interface CadastreFilters {
  // Property filters
  propertyTypes?: PropertyType[];
  minArea?: number;                   // Square meters
  maxArea?: number;                   // Square meters
  planNumbers?: number[];             // Specific plan numbers
  
  // Survey mark filters
  markTypes?: SurveyMarkType[];
  markStatuses?: string[];            // Active, Destroyed, etc.
  
  // Spatial filters
  showIntersectingOnly?: boolean;     // Only show features intersecting AO
}

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

/**
 * Configuration for cadastre services
 */
export interface CadastreServiceConfig {
  cadastreApiUrl: string;
  surveyMarkApiUrl: string;
  maxRecordsPerRequest: number;
  cacheExpiryMinutes: number;
  maxCacheSize: number;
  retryAttempts: number;
  retryDelayMs: number;
}

/**
 * Cache structure for cadastre data
 */
export interface CadastreCache {
  key: string;
  properties?: PropertyCollection;
  surveyMarks?: SurveyMarkCollection;
  expiresAt: number;
  size: number;                       // Total features cached
}

// =============================================================================
// COMPONENT PROP INTERFACES
// =============================================================================

/**
 * Props for the main cadastre dashboard
 */
export interface CadastreDashboardProps {
  onClose?: () => void;
  className?: string;
}

/**
 * Props for the property popup component
 */
export interface PropertyPopupProps {
  property?: PropertyFeature;
  surveyMark?: SurveyMarkFeature;
  onClose: () => void;
}

/**
 * Props for the cadastre display (map layer) component
 */
export interface CadastreDisplayProps {
  // No props needed - uses context
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Error types for cadastre operations
 */
export enum CadastreErrorType {
  API_ERROR = 'api_error',
  NETWORK_ERROR = 'network_error', 
  PARSING_ERROR = 'parsing_error',
  CACHE_ERROR = 'cache_error',
  GEOMETRY_ERROR = 'geometry_error',
  ZOOM_LEVEL_ERROR = 'zoom_level_error'
}

/**
 * Structured error information
 */
export interface CadastreError {
  type: CadastreErrorType;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * API request parameters
 */
export interface CadastreAPIParams {
  bbox: number[];                     // [west, south, east, north]
  outFields: string[];               // Field names to fetch
  spatialRel: 'esriSpatialRelIntersects';
  returnGeometry: boolean;
  maxRecordCount?: number;
  f: 'geojson';
}

/**
 * Service response wrapper
 */
export interface CadastreServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default service configuration
 */
export const DEFAULT_CADASTRE_CONFIG: CadastreServiceConfig = {
  cadastreApiUrl: 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Cadastre/MapServer/9',
  surveyMarkApiUrl: 'https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Survey_Mark/MapServer/0',
  maxRecordsPerRequest: 1000,
  cacheExpiryMinutes: 60,
  maxCacheSize: 20,
  retryAttempts: 3,
  retryDelayMs: 1000
};

/**
 * Required fields for property queries
 */
export const REQUIRED_PROPERTY_FIELDS = [
  'planlabel',      // Plan label (DP number)
  'lotnumber',      // Lot number  
  'planlotarea',    // Lot area in square meters
  'sectionnumber',  // Section number (if applicable)
  'hasstratum',     // Boolean: has stratum levels
  'classsubtype',   // Property classification
  'urbanity',       // Urban/Rural classification
  'cadid',          // Cadastral ID
  'plannumber',     // Plan number
  'objectid',       // Object ID for queries
  'lotidstring',    // Formatted lot identifier (e.g., "1//DP628553")
  'shape_Area',     // Calculated area from geometry
  'shape_Length'    // Calculated perimeter from geometry
];

export const REQUIRED_SURVEY_MARK_FIELDS = [
  'marktype',       // Survey mark type
  'trigtype',       // Trigonometric station type  
  'mgaeasting',     // MGA Easting coordinate
  'mganorthing',    // MGA Northing coordinate
  'ahdheight',      // AHD Height
  'trigname',       // Mark identifier (correct field name)
  'marknumber',     // Mark number
  'markstatus',     // Mark status
  'monumenttype',   // Monument type
  'marksymbol',     // Symbol for display
  'OBJECTID'        // Object ID
];

/**
 * Color scheme for property types
 */
export const PROPERTY_TYPE_COLORS: Record<PropertyType, string> = {
  [PropertyType.RESIDENTIAL_LOT]: '#4CAF50',     // Green
  [PropertyType.COMMERCIAL_LOT]: '#2196F3',      // Blue  
  [PropertyType.INDUSTRIAL_LOT]: '#FF9800',      // Orange
  [PropertyType.RURAL_LOT]: '#8BC34A',           // Light Green
  [PropertyType.ROAD_RESERVE]: '#9E9E9E',        // Gray
  [PropertyType.CROWN_LAND]: '#795548',          // Brown
  [PropertyType.WATER_FEATURE]: '#00BCD4',       // Cyan
  [PropertyType.STRATA_UNIT]: '#E91E63',         // Pink
  [PropertyType.COMMUNITY_TITLE]: '#9C27B0',     // Purple
  [PropertyType.OTHER]: '#607D8B'                // Blue Gray
};

/**
 * Survey mark symbol colors
 */
export const SURVEY_MARK_COLORS: Record<string, string> = {
  'Trigonometric': '#F44336',    // Red
  'Traverse': '#FF9800',         // Orange
  'Benchmark': '#4CAF50',        // Green
  'Boundary': '#2196F3',         // Blue
  'Reference': '#9C27B0',        // Purple
  'Control': '#FF5722',          // Deep Orange
  'Other': '#607D8B'             // Blue Gray
};

// =============================================================================
// VERSION INFO
// =============================================================================

/**
 * Feature metadata
 */
export const CADASTRE_FEATURE_INFO = {
  version: '1.0.0',
  name: 'NSW Cadastre Property Boundary Overlay',
  description: 'Property boundaries and survey marks from NSW Digital Cadastral Database',
  apiSource: 'NSW Spatial Services',
  dataAuthority: 'Department of Customer Service NSW',
  lastUpdated: new Date().toISOString(),
  
  capabilities: {
    propertyBoundaries: true,
    surveyMarks: true,
    propertyInformation: true,
    spatialAnalysis: true,
    caching: true
  },
  
  performance: {
    maxPropertiesPerRequest: 1000,
    maxSurveyMarksPerRequest: 1000,
    cacheExpiryMinutes: 60,
    maxCacheEntries: 20,
    minZoomLevel: 15                 // Prevent excessive data loading
  }
} as const;