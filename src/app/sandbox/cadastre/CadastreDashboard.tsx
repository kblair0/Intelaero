/**
 * CadastreDashboard.tsx
 * 
 * Purpose:
 * Main dashboard component for NSW Cadastre property boundary and survey mark visualization.
 * Provides simple, clean interface for loading, viewing, and interacting with cadastre data
 * following the established meshblock dashboard pattern.
 * 
 * Key Features:
 * - Toggle cadastre layer visibility
 * - Switch between view modes (properties only, survey marks only, both)
 * - Display data statistics and status
 * - Handle loading states and errors
 * - Refresh and clear data functionality
 * 
 * Related Files:
 * - CadastreContext.tsx - State management and data operations
 * - types.ts - Type definitions for props and data structures
 * - CadastreService.ts - Data fetching and processing
 * - PropertyPopup.tsx - Property detail popup component
 */

'use client';
import React, { useState, useCallback } from 'react';
import {
  Map,
  MapPin,
  Eye,
  EyeOff,
  Loader,
  RefreshCw,
  X,
  AlertTriangle,
  Info,
  Building,
  Navigation,
  BarChart3,
  Settings
} from 'lucide-react';
import {
  CadastreDashboardProps,
  CadastreViewMode
} from './cadastre-types';
import { useCadastreContext } from './CadastreContext';
import { trackEventWithForm as trackEvent } from '../../components/tracking/tracking';

/**
 * View mode selector component
 */
interface ViewModeSelectorProps {
  viewMode: CadastreViewMode;
  onViewModeChange: (mode: CadastreViewMode) => void;
  disabled?: boolean;
}

const ViewModeSelector: React.FC<ViewModeSelectorProps> = ({ 
  viewMode, 
  onViewModeChange, 
  disabled = false 
}) => {
  const modes = [
    { 
      value: CadastreViewMode.PROPERTIES_ONLY, 
      label: 'Properties Only', 
      icon: <Building className="w-4 h-4" />,
      description: 'Show property boundaries only'
    },
    { 
      value: CadastreViewMode.SURVEY_MARKS_ONLY, 
      label: 'Survey Marks Only', 
      icon: <Navigation className="w-4 h-4" />,
      description: 'Show survey control marks only'
    },
    { 
      value: CadastreViewMode.BOTH, 
      label: 'Both', 
      icon: <Map className="w-4 h-4" />,
      description: 'Show properties and survey marks'
    }
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Display Mode</label>
      <div className="space-y-1">
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onViewModeChange(mode.value)}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
              viewMode === mode.value
                ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`p-1 rounded ${
              viewMode === mode.value ? 'bg-blue-200' : 'bg-gray-100'
            }`}>
              {mode.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{mode.label}</div>
              <div className="text-xs opacity-75">{mode.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Stats display component
 */
interface StatsDisplayProps {
  propertyCount: number;
  surveyMarkCount: number;
  viewMode: CadastreViewMode;
  loading: boolean;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ 
  propertyCount, 
  surveyMarkCount, 
  viewMode,
  loading 
}) => {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center justify-center gap-2">
          <Loader className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm text-blue-700">Loading cadastre data...</span>
        </div>
      </div>
    );
  }

  const showProperties = viewMode === CadastreViewMode.PROPERTIES_ONLY || viewMode === CadastreViewMode.BOTH;
  const showSurveyMarks = viewMode === CadastreViewMode.SURVEY_MARKS_ONLY || viewMode === CadastreViewMode.BOTH;

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <BarChart3 className="w-4 h-4 text-green-600" />
          Data Loaded
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {showProperties && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-700">Properties:</span>
              </div>
              <span className="text-sm font-bold text-green-800">
                {propertyCount.toLocaleString()}
              </span>
            </div>
          )}
          
          {showSurveyMarks && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-3 h-3 text-blue-600" />
                <span className="text-xs text-gray-700">Survey Marks:</span>
              </div>
              <span className="text-sm font-bold text-blue-800">
                {surveyMarkCount.toLocaleString()}
              </span>
            </div>
          )}
        </div>
        
        <div className="pt-1 border-t border-green-200">
          <div className="text-xs text-green-700 text-center">
            Total: <strong>{(propertyCount + surveyMarkCount).toLocaleString()}</strong> features
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Error message component
 */
interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, onRetry, onDismiss }) => (
  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 rounded-lg text-sm text-red-800 shadow-sm">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="leading-relaxed">{error}</p>
        {(onRetry || onDismiss) && (
          <div className="flex gap-2 mt-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-2 py-1 text-red-600 hover:bg-red-100 rounded transition-colors text-xs"
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
 * Main cadastre dashboard component
 */
const CadastreDashboard: React.FC<CadastreDashboardProps> = ({
  onClose,
  className = ''
}) => {
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Context integration
  const {
    properties,
    surveyMarks,
    loading,
    error: contextError,
    viewMode,
    layersVisible,
    totalFeatureCount,
    toggleCadastre,
    setViewMode,
    refreshData,
    clearCadastre
  } = useCadastreContext();
  
  // Combine error states
  const currentError = localError || contextError;
  
  // Derived state
  const propertyCount = properties?.features.length || 0;
  const surveyMarkCount = surveyMarks?.features.length || 0;

  /**
   * Handles showing/hiding cadastre layers
   */
  const handleToggleCadastre = useCallback(async () => {
    trackEvent('cadastre_toggle_visibility', { panel: 'CadastreDashboard.tsx' });
    setLocalError(null);
    
    try {
      await toggleCadastre();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to toggle cadastre layers');
    }
  }, [toggleCadastre]);

  /**
   * Handles refreshing cadastre data
   */
  const handleRefresh = useCallback(async () => {
    trackEvent('cadastre_refresh_data', { panel: 'CadastreDashboard.tsx' });
    setLocalError(null);
    
    try {
      const success = await refreshData();
      if (!success) {
        setLocalError('Failed to refresh cadastre data. Please try again.');
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Refresh failed');
    }
  }, [refreshData]);

  /**
   * Handles view mode changes
   */
  const handleViewModeChange = useCallback((mode: CadastreViewMode) => {
    setViewMode(mode);
    trackEvent('cadastre_view_mode_change', { mode });
  }, [setViewMode]);

  /**
   * Handle error dismissal
   */
  const handleDismissError = useCallback(() => {
    setLocalError(null);
  }, []);

  /**
   * Handle clear data
   */
  const handleClearData = useCallback(() => {
    clearCadastre();
    trackEvent('cadastre_clear_data', { panel: 'CadastreDashboard.tsx' });
  }, [clearCadastre]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg shadow-sm">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-md">NSW Cadastre</h2>
            <p className="text-sm text-gray-600">
              Property boundaries and survey marks
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close cadastre dashboard"
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

      {/* Main Content */}
      {!layersVisible ? (
        /* Initial Load State */
        <div className="space-y-4">
          <div className="text-center bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
            <div className="p-2 bg-gradient-to-br from-green-500 to-blue-600 rounded-full inline-flex mb-3">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Load Cadastre Data</h3>
            <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
              View NSW property boundaries and survey marks for your area of operations.
              Data from the NSW Digital Cadastral Database.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={handleToggleCadastre}
              disabled={loading}
              className={`inline-flex items-center gap-3 px-6 py-3 rounded-lg font-semibold text-white text-sm transition-all duration-200 shadow-lg ${
                'bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700'
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
                  <Eye className="w-5 h-5" />
                  Load Cadastre Data
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Working Tools - When data is loaded */
        <div className="space-y-4">
          {/* Stats Display */}
          <StatsDisplay
            propertyCount={propertyCount}
            surveyMarkCount={surveyMarkCount}
            viewMode={viewMode}
            loading={loading}
          />

          {/* View Mode Selector */}
          <ViewModeSelector
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            disabled={loading}
          />

          {/* Action Buttons */}
          <div className="space-y-2">
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
                onClick={handleToggleCadastre}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
              >
                <EyeOff className="w-4 h-4" />
                Hide
              </button>
            </div>
            
            <button
              onClick={handleClearData}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4" />
              Clear Data
            </button>
          </div>

          {/* Help Text */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 leading-relaxed">
              <strong>Cadastre Visualization:</strong> Click on property boundaries or survey marks 
              to view detailed information. Use view mode selector to choose what data to display. 
              Property boundaries show lot/plan details, survey marks show control point information.
            </p>
          </div>
        </div>
      )}

      {/* Info Section - Always visible at bottom */}
      {layersVisible && (
        <div className="bg-gradient-to-r from-gray-50 to-green-50 rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2"> 
              <Info className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-gray-900 text-sm">About Cadastre Data</h4>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Data from NSW Digital Cadastral Database (DCDB). Property boundaries are current 
              land titles. Survey marks are geodetic control points. For official purposes, 
              always verify with current survey and title documents.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastreDashboard;