/**
 * MeshblockDashboard.tsx - REDESIGNED Two-Mode Interface
 * 
 * Purpose:
 * Main dashboard with clean two-mode UX:
 * 1. "Explore Area" - Visual understanding of land use and population
 * 2. "Assess Risk" - Flight analysis, iGRC calculation, and compliance
 * 
 * UX Flow:
 * - Open Dashboard → Explore Mode (map-focused, minimal panel)
 * - Load Meshblocks → Visual exploration with simple view toggle
 * - "Start Risk Assessment" → Assess Mode (progressive disclosure)
 * - Generate Report → Complete workflow
 */

'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Map,
  AlertTriangle,
  Loader,
  Info,
  Activity,
  RefreshCw,
  Eye,
  EyeOff,
  Users,
  FileText,
  X,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Target,
  Zap,
  MapPin
} from 'lucide-react';
import {
  MeshblockDashboardProps,
  ExportFormat,
  MeshblockViewMode
} from './types';
import { useMeshblockContext } from './MeshblockContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';

import { trackEventWithForm as trackEvent } from '../../components/tracking/tracking';
import MeshblockControls from './MeshblockControls';
import MeshblockFlightAnalysis from './MeshblockFlightAnalysis';
import MeshblockPopup from './MeshblockPopup';

/**
 * Mode selector component
 */
interface ModeSelectorProps {
  currentMode: 'explore' | 'assess';
  onModeChange: (mode: 'explore' | 'assess') => void;
  canAssess: boolean;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange, canAssess }) => (
  <div className="flex bg-gray-100 rounded-lg p-1">
    <button
      onClick={() => onModeChange('explore')}
      className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
        currentMode === 'explore'
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-gray-600 hover:text-gray-800'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <MapPin className="w-4 h-4" />
        Explore Area
      </div>
    </button>
    <button
      onClick={() => onModeChange('assess')}
      disabled={!canAssess}
      className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
        currentMode === 'assess'
          ? 'bg-white text-green-600 shadow-sm'
          : canAssess 
            ? 'text-gray-600 hover:text-gray-800'
            : 'text-gray-400 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <Target className="w-4 h-4" />
        Assess Risk
      </div>
    </button>
  </div>
);

/**
 * Simple stats component for explore mode
 */
interface SimpleStatsProps {
  meshblockCount: number;
  totalArea: number;
  viewMode: MeshblockViewMode;
}

const SimpleStats: React.FC<SimpleStatsProps> = ({ meshblockCount, totalArea, viewMode }) => (
  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
    <div className="grid grid-cols-2 gap-3 text-center">
      <div>
        <div className="text-lg font-bold text-blue-900">{meshblockCount.toLocaleString()}</div>
        <div className="text-xs text-blue-700">Meshblocks Loaded</div>
      </div>
      <div>
        <div className="text-lg font-bold text-purple-900">{totalArea.toFixed(1)}</div>
        <div className="text-xs text-purple-700">km² Coverage</div>
      </div>
    </div>
    <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-800 text-center">
      Viewing: <strong>{viewMode === MeshblockViewMode.LAND_USE ? 'Land Use Categories' : 'Population Density'}</strong>
    </div>
  </div>
);

/**
 * Large view mode toggle for explore mode
 */
interface ViewModeToggleProps {
  viewMode: MeshblockViewMode;
  onToggle: () => void;
  disabled?: boolean;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onToggle, disabled = false }) => {
  const isPopulation = viewMode === MeshblockViewMode.POPULATION_DENSITY;
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Map Display</label>
      <div className="relative">
        <div className="flex bg-gray-200 rounded-lg p-1 relative">
          {/* Sliding Background */}
          <div 
            className={`absolute top-1 bottom-1 w-1/2 rounded-md transition-all duration-300 ease-in-out ${
              isPopulation 
                ? 'left-1/2 bg-gradient-to-r from-green-500 to-green-600 shadow-md' 
                : 'left-1 bg-gradient-to-r from-purple-500 to-purple-600 shadow-md'
            }`}
          />
          
          {/* Land Use Button */}
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all duration-300 text-sm font-medium ${
              !isPopulation
                ? 'text-white' 
                : 'text-gray-600 hover:text-gray-800'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <MapPin className="w-4 h-4" />
            Land Use Types
          </button>
          
          {/* Population Button */}
          <button
            onClick={onToggle}
            disabled={disabled}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all duration-300 text-sm font-medium ${
              isPopulation
                ? 'text-white' 
                : 'text-gray-600 hover:text-gray-800'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <Users className="w-4 h-4" />
            Population Density
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 text-center">
        {viewMode === MeshblockViewMode.LAND_USE 
          ? 'Shows areas colored by land use category (residential, commercial, etc.)'
          : 'Shows areas colored by population density for risk assessment'
        }
      </p>
    </div>
  );
};

/**
 * Collapsible filters for explore mode
 */
interface FiltersDropdownProps {
  filters: any;
  onFiltersChange: (filters: any) => void;
  viewMode: MeshblockViewMode;
  meshblockCount: number;
}

const FiltersDropdown: React.FC<FiltersDropdownProps> = ({ 
  filters, 
  onFiltersChange, 
  viewMode,
  meshblockCount 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const hasActiveFilters = 
    (filters.landUseCategories && filters.landUseCategories.length > 0) ||
    filters.minPopulationDensity !== undefined ||
    filters.maxPopulationDensity !== undefined;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="text-gray-700">Display Filters</span>
          {hasActiveFilters && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3">
          <MeshblockControls
            viewMode={viewMode}
            onViewModeChange={() => {}} // Disabled in dropdown
            filters={filters}
            onFiltersChange={onFiltersChange}
            layersVisible={true}
            onLayersVisibleChange={() => {}}
            canActivate={true}
            loading={false}
            meshblockCount={meshblockCount}
            compact={true} // New prop to make it compact
          />
        </div>
      )}
    </div>
  );
};

/**
 * Primary action component
 */
interface PrimaryActionProps {
  onAction: () => void;
  loading: boolean;
  layersVisible: boolean;
  actionType: 'load' | 'assess' | 'refresh';
}

const PrimaryAction: React.FC<PrimaryActionProps> = ({
  onAction,
  loading,
  layersVisible,
  actionType
}) => {
  const getButtonConfig = () => {
    switch (actionType) {
      case 'load':
        return {
          icon: <Eye className="w-5 h-5" />,
          text: 'Load Meshblocks',
          color: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
        };
      case 'assess':
        return {
          icon: <ArrowRight className="w-5 h-5" />,
          text: 'Start Risk Assessment',
          color: 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
        };
      case 'refresh':
        return {
          icon: <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />,
          text: 'Refresh Data',
          color: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
        };
    }
  };

  const config = getButtonConfig();

  return (
    <div className="text-center">
      <button
        onClick={onAction}
        disabled={loading}
        className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold text-white text-sm transition-all duration-200 shadow-lg ${
        config.color
          } ${
            loading
              ? 'opacity-50 cursor-not-allowed' 
            : 'hover:shadow-xl transform hover:scale-105'
        }`}
      >
        {loading ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            {config.icon}
            {config.text}
          </>
        )}
      </button>
    </div>
  );
};

/**
 * Enhanced error message component
 */
interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry, onDismiss }) => (
  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 rounded-lg text-sm text-red-800 mb-4 shadow-sm">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="leading-relaxed">{error}</p>
        {(onRetry || onDismiss) && (
          <div className="flex gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-1 text-red-600 hover:bg-red-100 rounded transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

/**
 * Main meshblock dashboard component with two-mode interface
 */
const MeshblockDashboard: React.FC<MeshblockDashboardProps> = ({
  onClose,
  className = ''
}) => {
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Context integration
  const {
    meshblocks,
    filteredMeshblocks,
    loading,
    error: contextError,
    viewMode,
    layersVisible,
    flightPathAnalysis,
    analysisLoading,
    aggregateStats,
    currentMode,
    toggleMeshblocks,
    setViewMode,
    setFilters,
    runFlightPathAnalysis,
    refreshData,
    setMode,
    filters,
    selectedMeshblock,
    showPopup,
    closePopup,
    showMethodologyModal,
    setShowMethodologyModal
  } = useMeshblockContext();
  
  const { flightPlan } = useFlightPlanContext();
  
  // Combine error states
  const currentError = localError || contextError;
  
  // Clear local error when context error changes
  useEffect(() => {
    if (contextError !== localError) {
      setLocalError(null);
    }
  }, [contextError, localError]);

  // Derived state
  const meshblockCount = filteredMeshblocks?.features.length || meshblocks?.features.length || 0;
  const hasFlightPlan = Boolean(flightPlan?.features?.[0]?.geometry);
  const canAssess = layersVisible && hasFlightPlan;
  const totalArea = aggregateStats?.totalArea || 0;

  /**
   * Handles showing/hiding meshblocks
   */
  const handleToggleMeshblocks = useCallback(async () => {
    trackEvent('meshblock_toggle_visibility', { panel: 'MeshblockDashboard.tsx' });
    setLocalError(null);
    
    try {
      await toggleMeshblocks();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to toggle meshblocks');
    }
  }, [toggleMeshblocks]);

  /**
   * Handles refreshing meshblock data
   */
  const handleRefresh = useCallback(async () => {
    trackEvent('meshblock_refresh_data', { panel: 'MeshblockDashboard.tsx' });
    setLocalError(null);
    
    try {
      const success = await refreshData();
      if (!success) {
        setLocalError('Failed to refresh meshblock data. Please try again.');
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Refresh failed');
    }
  }, [refreshData]);

  /**
   * Handles generating reports
   */
  const handleGenerateReport = useCallback(async () => {
    trackEvent('meshblock_generate_report', { panel: 'MeshblockDashboard.tsx' });
    
    if (!flightPathAnalysis) {
      try {
        const result = await runFlightPathAnalysis();
        if (!result) {
          setLocalError('Failed to run analysis. Ensure meshblocks and flight plan are loaded.');
        }
      } catch (error) {
        setLocalError('Analysis failed. Please try again.');
      }
    }
  }, [flightPathAnalysis, runFlightPathAnalysis]);

  /**
   * Handle view mode toggle
   */
  const handleViewModeToggle = useCallback(() => {
    const newMode = viewMode === MeshblockViewMode.LAND_USE 
      ? MeshblockViewMode.POPULATION_DENSITY 
      : MeshblockViewMode.LAND_USE;
    setViewMode(newMode);
  }, [viewMode, setViewMode]);

  /**
   * Handle mode changes
   */
  const handleModeChange = useCallback((mode: 'explore' | 'assess') => {
    setMode(mode);
    trackEvent('meshblock_mode_change', { mode });
  }, [setMode]);

  /**
   * Handle error dismissal
   */
  const handleDismissError = useCallback(() => {
    setLocalError(null);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg shadow-sm">
            <Map className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-md">Meshblock Analysis</h2>
            <p className="text-sm text-gray-600">
              Population and land use assessment
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close meshblock dashboard"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Error Message */}
      {currentError && (
        <ErrorMessage
          error={currentError}
          onRetry={currentError.includes('zoom') ? undefined : handleRefresh}
          onDismiss={handleDismissError}
        />
      )}

      {/* Mode Selector - Only show when meshblocks are loaded */}
      {layersVisible && (
        <ModeSelector
          currentMode={currentMode}
          onModeChange={handleModeChange}
          canAssess={canAssess}
        />
      )}

      {/* Content based on current mode */}
      {!layersVisible ? (
        /* Initial Load State */
        <div className="space-y-4">
          <div className="text-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full inline-flex mb-3">
              <Map className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Load Meshblock Data</h3>
            <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
              View Australian Bureau of Statistics population and land use data 
              for your area of operations.
            </p>
          </div>

          <PrimaryAction
            onAction={handleToggleMeshblocks}
            loading={loading}
            layersVisible={layersVisible}
            actionType="load"
          />
        </div>
      ) : currentMode === 'explore' ? (
        /* Explore Mode */
        <div className="space-y-4">
          {/* Simple Stats */}
          <SimpleStats
            meshblockCount={meshblockCount}
            totalArea={totalArea}
            viewMode={viewMode}
          />

          {/* Large View Mode Toggle */}
          <ViewModeToggle
            viewMode={viewMode}
            onToggle={handleViewModeToggle}
            disabled={loading}
          />

          {/* Filters Dropdown */}
          <FiltersDropdown
            filters={filters}
            onFiltersChange={setFilters}
            viewMode={viewMode}
            meshblockCount={meshblockCount}
          />

          {/* Actions */}
          <div className="space-y-3">
            {canAssess && (
              <PrimaryAction
                onAction={() => handleModeChange('assess')}
                loading={false}
                layersVisible={true}
                actionType="assess"
              />
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              <button
                onClick={handleToggleMeshblocks}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
              >
                <EyeOff className="w-4 h-4" />
                Hide
              </button>
            </div>
          </div>

          {/* Help Text */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 leading-relaxed">
              <strong>Explore Mode:</strong> Use the map to understand land use patterns and population distribution. 
              Toggle between view modes and apply filters to focus on areas of interest. 
              {canAssess 
                ? ' Ready to assess flight path risk when you are.'
                : ' Load a flight plan to enable risk assessment.'
              }
            </p>
          </div>
        </div>
      ) : (
        /* Assess Mode */
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Flight Path Risk Assessment</h3>
              <p className="text-xs text-gray-600">
                Analyse population impact and regulatory compliance
              </p>
            </div>
          </div>
          <MeshblockFlightAnalysis
            analysis={flightPathAnalysis}
            loading={analysisLoading}
            onRunAnalysis={runFlightPathAnalysis}
            onExportResults={handleGenerateReport}
            flightPathGeometry={flightPlan?.features?.[0]?.geometry as GeoJSON.LineString}
            onShowMethodology={() => setShowMethodologyModal(true)}
          />

          {/* Mode Switch */}
          <div className="pt-3 border-t border-gray-200">
            <button
              onClick={() => handleModeChange('explore')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to Explore Mode
            </button>
          </div>
        </div>
      )}

      {/* Info Section - Always visible at bottom */}
      {layersVisible && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-gray-900 text-sm">About Meshblock Data</h4>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Data from Australian Bureau of Statistics 2021 Census. Population estimates 
              calculated from dwelling counts. Always maintain visual awareness and comply 
              with aviation regulations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeshblockDashboard;