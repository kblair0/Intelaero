/**
 * MeshblockContext.tsx - Updated with Mode State Management
 * 
 * Key Changes:
 * 1. Added currentMode state ('explore' | 'assess')
 * 2. Added setMode action function
 * 3. Updated context interface to include mode management
 * 4. Maintained all existing functionality
 */

'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useMapContext } from '../../context/mapcontext';
import { useAreaOfOpsContext } from '../../context/AreaOfOpsContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import {
  MeshblockState,
  MeshblockCollection,
  MeshblockFeature,
  MeshblockViewMode,
  MeshblockFilters,
  FlightPathMeshblockAnalysis,
  MeshblockError,
  MeshblockErrorType,
  AircraftConfiguration,
  iGRCAnalysis
} from './types';

import { 
  fetchMeshblockLayers, 
  getMeshblockCacheStats,
  FetchMeshblockLayersResult
} from './MeshblockService';
import { 
  performFlightPathAnalysis, 
  filterMeshblocksByCriteria,
  calculateAggregateStatistics,
  AnalysisPerformanceMonitor 
} from './utils/meshblockAnalysis';

import { MAP_LAYERS } from '../../services/LayerManager';

/**
 * Mode type for the two-mode interface
 */
export type MeshblockMode = 'explore' | 'assess';

/**
 * Context interface defining available state and actions
 */
interface MeshblockContextType extends MeshblockState {
  // Mode management
  currentMode: MeshblockMode;
  setMode: (mode: MeshblockMode) => void;
  
  // Actions
  toggleMeshblocks: () => Promise<boolean>;
  setViewMode: (mode: MeshblockViewMode) => void;
  setFilters: (filters: Partial<MeshblockFilters>) => void;
  runFlightPathAnalysis: () => Promise<FlightPathMeshblockAnalysis | null>;
  clearMeshblocks: () => void;
  refreshData: () => Promise<boolean>;

  selectMeshblock: (meshblock: MeshblockFeature | null) => void;
  closePopup: () => void;
  setAircraftConfig: (config: AircraftConfiguration) => void;

  //  Methodology modal state
  showMethodologyModal: boolean;
  setShowMethodologyModal: (show: boolean) => void;
  
  // Computed values
  filteredMeshblocks: MeshblockCollection | null;
  aggregateStats: ReturnType<typeof calculateAggregateStatistics> | null;
  cacheStats: ReturnType<typeof getMeshblockCacheStats>;
  
  // Performance monitoring
  lastAnalysisPerformance: {totalTime: number; checkpoints: any[]} | null;
}

// Create the context
const MeshblockContext = createContext<MeshblockContextType | undefined>(undefined);

/**
 * Initial state for the meshblock context
 */
const initialState: MeshblockState = {
  // Data state
  meshblocks: null,
  loading: false,
  error: null,
  
  // View state
  viewMode: MeshblockViewMode.LAND_USE,
  filters: {},
  layersVisible: false,
  
  // Analysis state
  flightPathAnalysis: null,
  analysisLoading: false,

  selectedMeshblock: null,
  showPopup: false,

  // Methodology modal state
  showMethodologyModal: false,
  
  // Aircraft configuration
  aircraftConfig: null
};

/**
 * Creates a structured error with timestamp
 */
function createError(type: MeshblockErrorType, message: string, details?: any): MeshblockError {
  return {
    type,
    message,
    details,
    retryable: type === MeshblockErrorType.NETWORK_ERROR || type === MeshblockErrorType.API_ERROR,
    timestamp: new Date().toISOString()
  };
}

/**
 * MeshblockProvider component that wraps the application with meshblock state
 */
export const MeshblockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Local state
  const [state, setState] = useState<MeshblockState>(initialState);
  const [lastAnalysisPerformance, setLastAnalysisPerformance] = useState<{totalTime: number; checkpoints: any[]} | null>(null);
  
  // NEW: Mode state
  const [currentMode, setCurrentMode] = useState<MeshblockMode>('explore');
  
  // Consume existing contexts
  const { map, setLayerVisibility } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { flightPlan } = useFlightPlanContext();
  
/**
 * NEW: Mode management function
 */
const setMode = useCallback((mode: MeshblockMode) => {
  setCurrentMode(mode);
  
  // Auto-switch to population view when entering assess mode
  if (mode === 'assess') {
    setViewMode(MeshblockViewMode.POPULATION_DENSITY);
  }
}, []);

  /**
   * Select a meshblock and show popup
   */
  const selectMeshblock = useCallback((meshblock: MeshblockFeature | null) => {
    setState(prev => {
      const newState = {
        ...prev,
        selectedMeshblock: meshblock,
        showPopup: !!meshblock
      };
      return newState;
    });
  }, []);

  /**
   * Close the popup
   */
  const closePopup = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedMeshblock: null,
      showPopup: false
    }));
  }, []);

  /**
   * Updates aircraft configuration
   */
  const setAircraftConfig = useCallback((config: AircraftConfiguration) => {
    // Auto-calculate size category
    const sizeCategory = (config.maxDimension <= 1 ? 1 :
                       config.maxDimension <= 3 ? 3 :
                       config.maxDimension <= 8 ? 8 :
                       config.maxDimension <= 20 ? 20 : 40) as 1 | 3 | 8 | 20 | 40;
    
    const updatedConfig = { ...config, sizeCategory };
    
    setState(prev => ({
      ...prev,
      aircraftConfig: updatedConfig
    }));
  }, []);

  /**
 * Shows/hides methodology modal
 */
const setShowMethodologyModal = useCallback((show: boolean) => {
  setState(prev => ({
    ...prev,
    showMethodologyModal: show
  }));
}, []);

  /**
   * Toggles meshblock layer visibility and loads data if needed
   */
  const toggleMeshblocks = useCallback(async (): Promise<boolean> => {
    if (!map) {
      setState(prev => ({
        ...prev,
        error: createError(MeshblockErrorType.API_ERROR, 'Map not initialized').message
      }));
      return false;
    }
    
    if (!aoGeometry) {
      setState(prev => ({
        ...prev,
        error: createError(
          MeshblockErrorType.GEOMETRY_ERROR,
          'No Area of Operations defined. Please create an operating area first.'
        ).message
      }));
      return false;
    }
    
    // If already visible, properly hide the map layers
    if (state.layersVisible) {
      try {
        // Hide the actual map layers
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_LANDUSE)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_LANDUSE, 'visibility', 'none');
        }
        if (map.getLayer(MAP_LAYERS.MESHBLOCK_POPULATION)) {
          map.setLayoutProperty(MAP_LAYERS.MESHBLOCK_POPULATION, 'visibility', 'none');
        }
        
        // Remove click handlers
        const { removeMeshblockClickHandlers } = await import('./MeshblockService');
        removeMeshblockClickHandlers(map);
        
        // Update state to reflect hidden layers
        setState(prev => ({ 
          ...prev, 
          layersVisible: false,
          selectedMeshblock: null,
          showPopup: false
        }));
        
        // Update UI layer visibility
        setLayerVisibility(MAP_LAYERS.MESHBLOCK_LANDUSE, false);
        setLayerVisibility(MAP_LAYERS.MESHBLOCK_POPULATION, false);
        
        // Reset to explore mode when hiding
        setCurrentMode('explore');
        
        return true;
      } catch (error) {
        console.error('[MeshblockContext] Error hiding meshblock layers:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to hide meshblock layers'
        }));
        return false;
      }
    }
    
    // Load data if layers are not visible
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result: FetchMeshblockLayersResult = await fetchMeshblockLayers(
        map, 
        aoGeometry, 
        setLayerVisibility, 
        selectMeshblock
      );
      
      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          loading: false,
          layersVisible: true,
          meshblocks: result.data!,
          error: null
        }));
        
        // Start in explore mode when loading
        setCurrentMode('explore');
        
        return true;
      } else {
        const errorMessage = result.error || 'Failed to fetch meshblock data';
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
        error: createError(MeshblockErrorType.API_ERROR, errorMessage).message
      }));
      
      return false;
    }
  }, [map, aoGeometry, state.layersVisible, setLayerVisibility, selectMeshblock]);

  /**
   * Sets the current view mode (land use or population density)
   */
  const setViewMode = useCallback((mode: MeshblockViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);
  
  /**
   * Updates filter criteria
    */
  const setFilters = useCallback((newFilters: Partial<MeshblockFilters>) => {
    setState(prev => ({
      ...prev,
      filters: Object.keys(newFilters).length === 0 ? {} : { ...prev.filters, ...newFilters }
    }));
    }, []);
  
  /**
   * Runs flight path intersection analysis
   */
  const runFlightPathAnalysis = useCallback(async (): Promise<FlightPathMeshblockAnalysis | null> => {
    if (!state.meshblocks || !flightPlan?.features?.[0]?.geometry) {
      const errorMessage = createError(
        MeshblockErrorType.ANALYSIS_ERROR,
        'Missing data for analysis. Ensure meshblocks and flight plan are loaded.'
      ).message;
      console.error('[MeshblockContext] Analysis failed:', errorMessage);
      setState(prev => ({
        ...prev,
        error: errorMessage
      }));
      return null;
    }

    // ENSURE aircraft config has altitude before analysis
    if (!state.aircraftConfig) {
      setState(prev => ({
        ...prev,
        aircraftConfig: {
          type: 'multi-copter',
          maxDimension: 1,
          maxSpeed: 35,
          operationType: 'VLOS',
          sizeCategory: 3 as 1 | 3 | 8 | 20 | 40,
          operationAltitudeAGL: 120 // Default altitude
        }
      }));
    }

    setState(prev => ({ ...prev, analysisLoading: true, error: null }));

    const monitor = new AnalysisPerformanceMonitor();
    monitor.start();

    try {
      monitor.checkpoint('Analysis started');
      const flightGeometry = flightPlan.features[0].geometry as GeoJSON.LineString;
      
      // Use current or default altitude
      const altitudeAGL = state.aircraftConfig?.operationAltitudeAGL || 120;
      
      const analysis = performFlightPathAnalysis(
        state.meshblocks,
        flightGeometry,
        altitudeAGL
      );

      monitor.checkpoint('Analysis completed');
      const performance = monitor.finish();
      setLastAnalysisPerformance(performance);

      setState(prev => ({
        ...prev,
        flightPathAnalysis: analysis,
        analysisLoading: false
      }));
      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
      console.error('[MeshblockContext] Analysis error:', errorMessage, error);
      setState(prev => ({
        ...prev,
        analysisLoading: false,
        error: createError(MeshblockErrorType.ANALYSIS_ERROR, errorMessage).message
      }));
      return null;
    }
  }, [state.meshblocks, flightPlan, state.aircraftConfig]);
  
  /**
   * Clears meshblock data and resets state
   */
  const clearMeshblocks = useCallback(() => {
    setState(prev => ({
      ...prev,
      meshblocks: null,
      layersVisible: false,
      flightPathAnalysis: null,
      error: null
    }));
    // Reset to explore mode when clearing
    setCurrentMode('explore');
  }, []);
  
  /**
   * Refreshes meshblock data from the API
   */
  const refreshData = useCallback(async (): Promise<boolean> => {
    if (!map || !aoGeometry) {
      return false;
    }
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Clear existing data first
      setState(prev => ({ ...prev, meshblocks: null, flightPathAnalysis: null }));
      
      const result: FetchMeshblockLayersResult = await fetchMeshblockLayers(
        map, 
        aoGeometry, 
        setLayerVisibility, 
        selectMeshblock
      );
      
      if (result.success && result.data) {
        setState(prev => ({
          ...prev,
          loading: false,
          layersVisible: true,
          meshblocks: result.data!
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
        error: createError(MeshblockErrorType.API_ERROR, errorMessage).message
      }));
      return false;
    }
  }, [map, aoGeometry, setLayerVisibility, selectMeshblock]);
  
  // Computed values with proper debugging
  const filteredMeshblocks = state.meshblocks 
    ? (() => {
        const filtered = filterMeshblocksByCriteria(state.meshblocks, state.filters);
        return filtered;
      })()
    : null;
  
  const aggregateStats = state.meshblocks 
    ? calculateAggregateStatistics(state.meshblocks)
    : null;
  
  const cacheStats = getMeshblockCacheStats();

  // Update map layers when filteredMeshblocks changes
  useEffect(() => {
    // Only update if we have a map, layers are visible, and we have filtered data
    if (!map || !state.layersVisible) {
      return;
    }

    // Import and call the update function
    const updateLayers = async () => {
      try {
        const { updateMeshblockLayers } = await import('./MeshblockService');
        const success = await updateMeshblockLayers(map, filteredMeshblocks, state.viewMode);
        
        if (success) {
          // Success
        } else {
          console.warn('[MeshblockContext] Failed to update map layers');
        }
      } catch (error) {
        console.error('[MeshblockContext] Error updating map layers:', error);
      }
    };

    updateLayers();
  }, [map, filteredMeshblocks, state.viewMode, state.layersVisible]);

  
  // Context value
  const contextValue: MeshblockContextType = {
    // State
    ...state,
    
    // NEW: Mode state
    currentMode,
    setMode,
    
    // Actions
    toggleMeshblocks,
    setViewMode,
    setFilters,
    runFlightPathAnalysis,
    clearMeshblocks,
    refreshData,
    selectMeshblock,
    closePopup,
    setAircraftConfig,

    setShowMethodologyModal,
    
    // Computed values
    filteredMeshblocks,
    aggregateStats,
    cacheStats,
    
    // Performance monitoring
    lastAnalysisPerformance
  };
  
  return (
    <MeshblockContext.Provider value={contextValue}>
      {children}
    </MeshblockContext.Provider>
  );
};

/**
 * Hook to consume the MeshblockContext
 * Throws error if used outside of MeshblockProvider
 */
export const useMeshblockContext = (): MeshblockContextType => {
  const context = useContext(MeshblockContext);
  if (!context) {
    throw new Error('useMeshblockContext must be used within a MeshblockProvider');
  }
  return context;
};

/**
 * Hook for meshblock data with automatic loading
 * Convenience hook that handles common patterns
 */
export const useMeshblockData = () => {
  const context = useMeshblockContext();
  return {
    meshblocks: context.filteredMeshblocks,
    loading: context.loading,
    error: context.error,
    refresh: context.refreshData
  };
};

/**
 * Hook for flight path analysis with memoization
 */
export const useFlightPathAnalysis = () => {
  const context = useMeshblockContext();
  
  const runAnalysis = useCallback(async () => {
    if (context.analysisLoading) {
      console.warn('[useFlightPathAnalysis] Analysis already in progress');
      return context.flightPathAnalysis;
    }
    
    return await context.runFlightPathAnalysis();
  }, [context.runFlightPathAnalysis, context.analysisLoading, context.flightPathAnalysis]);
  
  return {
    analysis: context.flightPathAnalysis,
    loading: context.analysisLoading,
    runAnalysis,
    performance: context.lastAnalysisPerformance
  };
};