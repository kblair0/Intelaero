/**
 * CadastreContext.tsx
 * 
 * Purpose:
 * Context provider for NSW Cadastre property boundary and survey mark state management.
 * Handles data loading, layer visibility, user interactions, and error states 
 * following the established meshblock context pattern.
 * 
 * Key Features:
 * - Manages property and survey mark data state
 * - Handles layer visibility and view mode switching
 * - Provides popup state for property/survey mark selection
 * - Integrates with existing map, area of operations, and flight plan contexts
 * - Implements caching and performance monitoring
 * 
 * Related Files:
 * - types.ts - Type definitions for all interfaces
 * - CadastreService.ts - API calls and data processing
 * - CadastreDashboard.tsx - UI component consuming this context 
 * - CadastreDisplay.tsx - Map layer component using this context
 */

'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useMapContext } from '../../context/mapcontext';
import { useAreaOfOpsContext } from '../../context/AreaOfOpsContext';
import {
  CadastreState,
  PropertyCollection,
  SurveyMarkCollection,
  PropertyFeature,
  SurveyMarkFeature,
  CadastreViewMode,
  CadastreFilters,
  CadastreError,
  CadastreErrorType
} from './cadastre-types';

import { 
  fetchCadastreLayers, 
  getCadastreCacheStats,
  updateCadastreLayers,
  removeCadastreClickHandlers
} from './CadastreService';

import { MAP_LAYERS } from '../../services/LayerManager';

/**
 * Context interface defining available state and actions
 */
interface CadastreContextType extends CadastreState {
  // Actions
  toggleCadastre: () => Promise<boolean>;
  setViewMode: (mode: CadastreViewMode) => void;
  selectProperty: (property: PropertyFeature | null) => void;
  selectSurveyMark: (surveyMark: SurveyMarkFeature | null) => void;
  closePopup: () => void;
  clearCadastre: () => void;
  refreshData: () => Promise<boolean>;
  
  // Computed values
  cacheStats: ReturnType<typeof getCadastreCacheStats>;
  totalFeatureCount: number;
}

// Create the context
const CadastreContext = createContext<CadastreContextType | undefined>(undefined);

/**
 * Initial state for the cadastre context
 */
const initialState: CadastreState = {
  // Data state
  properties: null,
  surveyMarks: null,
  loading: false,
  error: null,
  
  // View state
  viewMode: CadastreViewMode.BOTH,
  layersVisible: false,
  
  // Popup state
  selectedProperty: null,
  selectedSurveyMark: null,
  showPopup: false
};

/**
 * Creates a structured error with timestamp
 */
function createError(type: CadastreErrorType, message: string, details?: any): CadastreError {
  return {
    type,
    message,
    details,
    retryable: type === CadastreErrorType.NETWORK_ERROR || type === CadastreErrorType.API_ERROR,
    timestamp: new Date().toISOString()
  };
}

/**
 * CadastreProvider component that wraps the application with cadastre state
 */
export const CadastreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Local state
  const [state, setState] = useState<CadastreState>(initialState);
  
  // Consume existing contexts
  const { map, setLayerVisibility } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  
  /**
   * Select a property and show popup
   */
  const selectProperty = useCallback((property: PropertyFeature | null) => {
    setState(prev => ({
      ...prev,
      selectedProperty: property,
      selectedSurveyMark: null, // Clear survey mark selection
      showPopup: !!property
    }));
  }, []);

  /**
   * Select a survey mark and show popup
   */
  const selectSurveyMark = useCallback((surveyMark: SurveyMarkFeature | null) => {
    setState(prev => ({
      ...prev,
      selectedSurveyMark: surveyMark,
      selectedProperty: null, // Clear property selection
      showPopup: !!surveyMark
    }));
  }, []);

  /**
   * Close the popup
   */
  const closePopup = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedProperty: null,
      selectedSurveyMark: null,
      showPopup: false
    }));
  }, []);

  /**
   * Toggles cadastre layer visibility and loads data if needed
   */
  const toggleCadastre = useCallback(async (): Promise<boolean> => {
    if (!map) {
      setState(prev => ({
        ...prev,
        error: createError(CadastreErrorType.API_ERROR, 'Map not initialized').message
      }));
      return false;
    }
    
    if (!aoGeometry) {
      setState(prev => ({
        ...prev,
        error: createError(
          CadastreErrorType.GEOMETRY_ERROR,
          'No Area of Operations defined. Please create an operating area first.'
        ).message
      }));
      return false;
    }
    
    // If already visible, properly hide the map layers
    if (state.layersVisible) {
      try {
        // Hide the actual map layers
        if (map.getLayer(MAP_LAYERS.CADASTRE_PROPERTIES)) {
          map.setLayoutProperty(MAP_LAYERS.CADASTRE_PROPERTIES, 'visibility', 'none');
        }
        if (map.getLayer(MAP_LAYERS.CADASTRE_PROPERTIES_FILL)) {
          map.setLayoutProperty(MAP_LAYERS.CADASTRE_PROPERTIES_FILL, 'visibility', 'none');
        }
        if (map.getLayer(MAP_LAYERS.CADASTRE_SURVEY_MARKS)) {
          map.setLayoutProperty(MAP_LAYERS.CADASTRE_SURVEY_MARKS, 'visibility', 'none');
        }
        
        // Remove click handlers
        removeCadastreClickHandlers(map);
        
        // Update state to reflect hidden layers
        setState(prev => ({ 
          ...prev, 
          layersVisible: false,
          selectedProperty: null,
          selectedSurveyMark: null,
          showPopup: false
        }));
        
        // Update UI layer visibility
        setLayerVisibility(MAP_LAYERS.CADASTRE_PROPERTIES, false);
        setLayerVisibility(MAP_LAYERS.CADASTRE_SURVEY_MARKS, false);
        
        return true;
      } catch (error) {
        console.error('[CadastreContext] Error hiding cadastre layers:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to hide cadastre layers'
        }));
        return false;
      }
    }
    
    // Load data if layers are not visible
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await fetchCadastreLayers(
        map, 
        aoGeometry, 
        setLayerVisibility, 
        selectProperty,
        selectSurveyMark,
        state.viewMode
      );
      
      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          loading: false,
          layersVisible: true,
          properties: result.data!.properties || null,
          surveyMarks: result.data!.surveyMarks || null,
          error: null
        }));
        
        return true;
      } else {
        const errorMessage = result.error || 'Failed to fetch cadastre data';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }));
        
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        loading: false,
        error: createError(CadastreErrorType.API_ERROR, errorMessage).message
      }));
      
      return false;
    }
  }, [map, aoGeometry, state.layersVisible, state.viewMode, setLayerVisibility, selectProperty, selectSurveyMark]);

  /**
   * Sets the current view mode and updates map layers
   */
  const setViewMode = useCallback((mode: CadastreViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));
    
    // Update map layers if they're currently visible
    if (map && state.layersVisible) {
      updateCadastreLayers(map, state.properties, state.surveyMarks, mode);
    }
  }, [map, state.layersVisible, state.properties, state.surveyMarks]);
  
  /**
   * Clears cadastre data and resets state
   */
  const clearCadastre = useCallback(() => {
    setState(prev => ({
      ...prev,
      properties: null,
      surveyMarks: null,
      layersVisible: false,
      selectedProperty: null,
      selectedSurveyMark: null,
      showPopup: false,
      error: null
    }));
  }, []);
  
  /**
   * Refreshes cadastre data from the API
   */
  const refreshData = useCallback(async (): Promise<boolean> => {
    if (!map || !aoGeometry) {
      return false;
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Clear existing data first
      setState(prev => ({ 
        ...prev, 
        properties: null, 
        surveyMarks: null,
        selectedProperty: null,
        selectedSurveyMark: null,
        showPopup: false
      }));
      
      const result = await fetchCadastreLayers(
        map, 
        aoGeometry, 
        setLayerVisibility, 
        selectProperty,
        selectSurveyMark,
        state.viewMode
      );
      
      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          loading: false,
          layersVisible: true,
          properties: result.data!.properties || null,
          surveyMarks: result.data!.surveyMarks || null
        }));
        
        return true;
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.error || 'Refresh failed'
        }));
        
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Refresh failed';
      setState(prev => ({
        ...prev,
        loading: false,
        error: createError(CadastreErrorType.API_ERROR, errorMessage).message
      }));
      return false;
    }
  }, [map, aoGeometry, state.viewMode, setLayerVisibility, selectProperty, selectSurveyMark]);
  
  // Computed values
  const cacheStats = getCadastreCacheStats();
  const totalFeatureCount = (state.properties?.features.length || 0) + (state.surveyMarks?.features.length || 0);

  // Update map layers when view mode changes
  useEffect(() => {
    if (map && state.layersVisible && (state.properties || state.surveyMarks)) {
      updateCadastreLayers(map, state.properties, state.surveyMarks, state.viewMode);
    }
  }, [map, state.layersVisible, state.properties, state.surveyMarks, state.viewMode]);
  
  // Context value
  const contextValue: CadastreContextType = {
    // State
    ...state,
    
    // Actions
    toggleCadastre,
    setViewMode,
    selectProperty,
    selectSurveyMark,
    closePopup,
    clearCadastre,
    refreshData,
    
    // Computed values
    cacheStats,
    totalFeatureCount
  };
  
  return (
    <CadastreContext.Provider value={contextValue}>
      {children}
    </CadastreContext.Provider>
  );
};

/**
 * Hook to consume the CadastreContext
 * Throws error if used outside of CadastreProvider
 */
export const useCadastreContext = (): CadastreContextType => {
  const context = useContext(CadastreContext);
  if (!context) {
    throw new Error('useCadastreContext must be used within a CadastreProvider');
  }
  return context;
};

/**
 * Hook for cadastre data with automatic loading
 * Convenience hook that handles common patterns
 */
export const useCadastreData = () => {
  const context = useCadastreContext();
  return {
    properties: context.properties,
    surveyMarks: context.surveyMarks,
    loading: context.loading,
    error: context.error,
    refresh: context.refreshData,
    totalFeatures: context.totalFeatureCount
  };
};

/**
 * Hook for cadastre layer visibility management
 */
export const useCadastreVisibility = () => {
  const context = useCadastreContext();
  
  const toggleVisibility = useCallback(async () => {
    if (context.loading) {
      console.warn('[useCadastreVisibility] Toggle already in progress');
      return context.layersVisible;
    }
    
    return await context.toggleCadastre();
  }, [context.toggleCadastre, context.loading, context.layersVisible]);
  
  return {
    visible: context.layersVisible,
    loading: context.loading,
    toggleVisibility,
    viewMode: context.viewMode,
    setViewMode: context.setViewMode
  };
};

/**
 * Hook for property and survey mark selection
 */
export const useCadastreSelection = () => {
  const context = useCadastreContext();
  
  return {
    selectedProperty: context.selectedProperty,
    selectedSurveyMark: context.selectedSurveyMark,
    showPopup: context.showPopup,
    selectProperty: context.selectProperty,
    selectSurveyMark: context.selectSurveyMark,
    closePopup: context.closePopup
  };
};