/**
 * index.ts
 * 
 * Purpose:
 * Export barrel for the meshblock integration feature. Provides clean, organized
 * imports for all meshblock components, utilities, and types. Facilitates tree
 * shaking for unused components and maintains clean dependency structure.
 * 
 * This file exports:
 * - Main components (Dashboard, Controls, Analysis, Popup)
 * - Context and hooks for state management
 * - Service functions for data fetching
 * - Utility functions for analysis and styling
 * - TypeScript types and interfaces
 * - Constants and configuration
 * 
 * Usage Examples:
 * import { MeshblockDashboard, useMeshblockContext } from '@/sandbox/meshblocks';
 * import { fetchMeshblockLayers, MeshblockService } from '@/sandbox/meshblocks/services';
 * import { MeshblockFeature, LandUseCategory } from '@/sandbox/meshblocks/types';
 * 
 * Dependencies:
 * - All meshblock feature files and components
 * 
 * Related Files:
 * - All files in the meshblocks directory structure
 * - External components importing meshblock functionality
 */

// =============================================================================
// MAIN COMPONENTS
// =============================================================================

/**
 * Primary UI Components
 * Main user-facing components for meshblock visualization and interaction
 */
export { default as MeshblockDashboard } from './MeshblockDashboard';
export { default as MeshblockControls } from './MeshblockControls';
export { default as MeshblockFlightAnalysis } from './MeshblockFlightAnalysis';
export { default as MeshblockPopup } from './MeshblockPopup';

// =============================================================================
// CONTEXT AND HOOKS
// =============================================================================

/**
 * State Management
 * Context providers and hooks for meshblock state management
 */
export { 
  MeshblockProvider, 
  useMeshblockContext,
  useMeshblockData,
  useFlightPathAnalysis
} from './MeshblockContext';

// =============================================================================
// SERVICES AND DATA FETCHING
// =============================================================================

/**
 * Data Services
 * Functions for fetching and processing meshblock data from external APIs
 */
export { 
  fetchMeshblockLayers,
  clearMeshblockCache,
  getMeshblockCacheStats
} from './MeshblockService';

// =============================================================================
// ANALYSIS UTILITIES
// =============================================================================

/**
 * Analysis Functions
 * Core analysis functions for population calculations and flight path analysis
 */
export {
  analyzeFlightPathIntersections,
  performFlightPathAnalysis,
  calculateAggregateStatistics,
  filterMeshblocksByCriteria,
  generateAnalysisSummary,
  AnalysisPerformanceMonitor
} from './utils/meshblockAnalysis';

// =============================================================================
// STYLING AND COLORS
// =============================================================================

/**
 * Color and Styling Utilities
 * Functions and constants for meshblock visualization styling
 */
export {
  createLandUseColorExpression,
  createPopulationDensityColorExpression,
  createStrokeColorExpression,
  adjustColorOpacity,
  getMeshblockColor,
  createLegendData,
  calculateContrastRatio,
  validateAccessibility,
  getIntersectionHighlightColor,
  getZoomDependentStyling,
  POPULATION_DENSITY_BREAKPOINTS,
  ENHANCED_LAND_USE_COLORS,
  ZOOM_DEPENDENT_STYLING
} from './utils/meshblockColors';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * TypeScript Types
 * All type definitions, interfaces, and enums for meshblock functionality
 */

// Core data types
export type {
  MeshblockFeature,
  MeshblockCollection,
  ABSMeshblockAPIResponse,
  FlightPathMeshblockAnalysis,
  MeshblockState,
  MeshblockCache,
  MeshblockError,
  PopulationCalculationOptions,
  MeshblockServiceConfig,
  MeshblockPerformanceMetrics
} from './types';

// Component prop types
export type {
  MeshblockControlsProps,
  MeshblockPopupProps,
  MeshblockFlightAnalysisProps,
  MeshblockDashboardProps
} from './types';

// Configuration and options types
export type {
  MeshblockAPIParams,
  MeshblockFilters,
  ExportOptions
} from './types';

// Enums
export {
  LandUseCategory,
  MeshblockViewMode,
  MeshblockErrorType,
  ExportFormat
} from './types';

// Constants
export {
  LAND_USE_COLORS,
  DWELLING_ESTIMATES
} from './types';

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

/**
 * Commonly Used Combinations
 * Pre-configured exports for common use cases
 */

// Complete meshblock integration bundle
export const MeshblockIntegration = {
  Dashboard: MeshblockDashboard,
  Provider: MeshblockProvider,
  useContext: useMeshblockContext,
  fetchLayers: fetchMeshblockLayers
} as const;

// Analysis toolkit
export const MeshblockAnalysisKit = {
  performAnalysis: performFlightPathAnalysis,
  generateSummary: generateAnalysisSummary,
  calculateStats: calculateAggregateStatistics,
  PerformanceMonitor: AnalysisPerformanceMonitor
} as const;

// Styling toolkit
export const MeshblockStylingKit = {
  getLandUseExpression: createLandUseColorExpression,
  getPopulationExpression: createPopulationDensityColorExpression,
  getColor: getMeshblockColor,
  createLegend: createLegendData,
  validateAccessibility
} as const;

// =============================================================================
// VERSION AND METADATA
// =============================================================================

/**
 * Feature Metadata
 * Version information and feature configuration for the meshblock integration
 */
export const MESHBLOCK_FEATURE_INFO = {
  version: '1.0.0',
  name: 'ABS Meshblock Integration',
  description: 'Australian Bureau of Statistics meshblock data visualization and analysis',
  apiSource: 'https://asgs.linked.fsdf.org.au/dataset/asgsed3/collections/MB',
  dataYear: 2021,
  lastUpdated: new Date().toISOString(),
  
  // Feature capabilities
  capabilities: {
    landUseVisualization: true,
    populationDensityVisualization: true,
    flightPathAnalysis: true,
    exportFunctionality: true,
    caching: true,
    performanceMonitoring: true
  },
  
  // Performance characteristics
  performance: {
    maxMeshblocksPerRequest: 5000,
    cacheExpiryMinutes: 60,
    maxCacheEntries: 50,
    minZoomLevel: 13
  },
  
  // Integration points
  integrations: {
    layerManager: true,
    areaOfOperations: true,
    flightPlan: true,
    sandbox: true
  }
} as const;

// =============================================================================
// DEVELOPMENT UTILITIES
// =============================================================================

/**
 * Development and Debugging Utilities
 * Helper functions for development, testing, and debugging
 */

// Cache management for development
export const DevUtils = {
  clearCache: clearMeshblockCache,
  getCacheStats: getMeshblockCacheStats,
  
  // Performance monitoring
  createPerformanceMonitor: () => new AnalysisPerformanceMonitor(),
  
  // Validation helpers
  validateMeshblockFeature: (feature: any): feature is MeshblockFeature => {
    return (
      feature &&
      feature.type === 'Feature' &&
      feature.geometry &&
      feature.geometry.type === 'Polygon' &&
      feature.properties &&
      typeof feature.properties.mb_code_2021 === 'string' &&
      typeof feature.properties.area_albers_sqkm === 'number'
    );
  },
  
  // Color validation
  validateColorAccessibility: validateAccessibility,


// =============================================================================
// TYPE GUARDS AND UTILITIES
// =============================================================================

/**
 * Type Guard Functions
 * Runtime type checking utilities for TypeScript safety
 */

export const TypeGuards = {
  isMeshblockFeature: (obj: any): obj is MeshblockFeature => 
    DevUtils.validateMeshblockFeature(obj),
    
  isMeshblockCollection: (obj: any): obj is MeshblockCollection =>
    obj &&
    obj.type === 'FeatureCollection' &&
    Array.isArray(obj.features) &&
    obj.features.every(DevUtils.validateMeshblockFeature),
    
  isFlightPathAnalysis: (obj: any): obj is FlightPathMeshblockAnalysis =>
    obj &&
    Array.isArray(obj.intersectingMeshblocks) &&
    typeof obj.totalEstimatedPopulation === 'number' &&
    typeof obj.analysisDate === 'string' &&
    obj.landUseBreakdown &&
    obj.riskFactors,
    
  isValidLandUseCategory: (value: string): value is LandUseCategory =>
    Object.values(LandUseCategory).includes(value as LandUseCategory),
    
  isValidViewMode: (value: string): value is MeshblockViewMode =>
    Object.values(MeshblockViewMode).includes(value as MeshblockViewMode)
} as const;

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

/**
 * Default Export
 * Main dashboard component as default export for primary use case
 */
export default MeshblockDashboard;