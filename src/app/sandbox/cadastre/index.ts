/**
 * index.ts
 * 
 * Purpose:
 * Export barrel for the NSW Cadastre Property Boundary Overlay System.
 * Simplified version to avoid circular dependencies and runtime errors.
 */

// =============================================================================
// MAIN COMPONENTS
// =============================================================================
export { default as CadastreDashboard } from './CadastreDashboard';
export { default as PropertyPopup } from './PropertyPopup';
export { default as CadastreDisplay } from './CadastreDisplay';

// =============================================================================
// CONTEXT AND HOOKS
// =============================================================================
export { 
  CadastreProvider, 
  useCadastreContext,
  useCadastreData,
  useCadastreVisibility,
  useCadastreSelection
} from './CadastreContext';

// =============================================================================
// SERVICES
// =============================================================================
export { 
  fetchCadastreLayers,
  updateCadastreLayers,
  addCadastreClickHandlers,
  removeCadastreClickHandlers,
  clearCadastreCache,
  getCadastreCacheStats,
  generateCacheKey,
  getCachedData
} from './CadastreService';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

// Core data types
export type {
  PropertyFeature,
  SurveyMarkFeature,
  PropertyCollection,
  SurveyMarkCollection,
  NSWCadastreAPIResponse,
  NSWSurveyMarkAPIResponse,
  CadastreState,
  CadastreCache,
  CadastreError,
  CadastreServiceConfig,
  CadastreAPIParams,
  CadastreServiceResponse,
  CadastreFilters,
  CadastreDashboardProps,
  PropertyPopupProps,
  CadastreDisplayProps
} from './cadastre-types';

// Enums
export {
  PropertyType,
  CadastreViewMode,
  SurveyMarkType,
  CadastreErrorType
} from './cadastre-types';

// Constants
export {
  DEFAULT_CADASTRE_CONFIG,
  REQUIRED_PROPERTY_FIELDS,
  REQUIRED_SURVEY_MARK_FIELDS,
  PROPERTY_TYPE_COLORS,
  SURVEY_MARK_COLORS,
  CADASTRE_FEATURE_INFO
} from './cadastre-types';

// =============================================================================
// DEFAULT EXPORT
// =============================================================================
export { default } from './CadastreDashboard';