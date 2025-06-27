/**
 * MeshblockFlightAnalysis.tsx - FIXED Auto-run and Flight Plan Display
 * 
 * Purpose:
 * iGRC calculation interface with proper auto-run functionality and flight plan info display
 * 
 * Key Fixes:
 * 1. Consolidated auto-run logic to prevent duplicate execution
 * 2. Fixed useEffect dependencies to prevent infinite loops
 * 3. Restored flight plan altitude information display
 * 4. Fixed dropdown to show "Flight Plan" text while using actual values
 * 5. Proper state management using refs for tracking previous values
 */

'use client';
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Plane,
  Users,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Download,
  RefreshCw,
  CheckCircle,
  Activity,
  BarChart3,
  FileText,
  Zap,
  Target,
  ChevronDown,
  ChevronRight,
  Settings,
  Calculator,
  Info,
  HelpCircle
} from 'lucide-react';
import {
  MeshblockFlightAnalysisProps,
  FlightPathMeshblockAnalysis,
  LandUseCategory,
  ExportFormat
} from './types';
import { generateAnalysisSummary } from './utils/meshblockAnalysis'
import { LAND_USE_COLORS } from './utils/meshblockColors';
import { AircraftConfiguration } from './types';
import { getiGRCColor, getiGRCRiskLevel } from './utils/meshblockColors';
import { calculateGridResolution, calculateiGRCAnalysis, calculateAnalysisBuffer } from './utils/meshblockAnalysis';
import { useMeshblockContext } from './MeshblockContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import CalculationMethodologyModal from './CalculationMethodologyModal';

/**
 * Flight Plan Information Display Component
 */
interface FlightPlanInfoProps {
  flightPlanAltitudes: {
    min: number;
    max: number;
    average: number;
  } | null;
  isVisible: boolean;
}

const FlightPlanInfo: React.FC<FlightPlanInfoProps> = ({ flightPlanAltitudes, isVisible }) => {
  if (!isVisible || !flightPlanAltitudes) return null;

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Info className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-900">Flight Plan Altitude Profile</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="text-center">
          <div className="font-semibold text-blue-900">{flightPlanAltitudes.min.toFixed(0)}m</div>
          <div className="text-blue-700">Minimum</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-blue-900">{flightPlanAltitudes.average.toFixed(0)}m</div>
          <div className="text-blue-700">Average</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-blue-900">{flightPlanAltitudes.max.toFixed(0)}m</div>
          <div className="text-blue-700">Maximum</div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700">
        Using maximum altitude ({flightPlanAltitudes.max.toFixed(0)}m) for conservative analysis
      </div>
    </div>
  );
};

/**
 * Prominent iGRC Calculator and Results component
 */
interface IGRCCalculatorAndResultsProps {
  analysis: FlightPathMeshblockAnalysis;
  aircraftConfig: AircraftConfiguration | null;
  onAircraftConfigChange: (config: AircraftConfiguration) => void;
  onShowMethodology?: () => void;
}

const IGRCCalculatorAndResults: React.FC<IGRCCalculatorAndResultsProps> = ({
  analysis, 
  aircraftConfig, 
  onAircraftConfigChange,
  onShowMethodology
}) => {
  const { flightPlan } = useFlightPlanContext();
  
  // Extract flight plan altitudes
  const flightPlanAltitudes = useMemo(() => {
    if (!flightPlan?.features?.[0]?.geometry?.coordinates) return null;
    
    const altitudes = flightPlan.features[0].geometry.coordinates.map(coord => coord[2]);
    return {
      max: Math.max(...altitudes),
      average: altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length,
      min: Math.min(...altitudes)
    };
  }, [flightPlan]);

  const [localConfig, setLocalConfig] = useState<AircraftConfiguration>(
    aircraftConfig || {
      type: 'multi-copter',
      maxDimension: 3,
      maxSpeed: 35,
      operationType: 'VLOS',
      sizeCategory: 3,
      operationAltitudeAGL: 120
    }
  );

  // Track altitude source for display purposes
  const [altitudeSource, setAltitudeSource] = useState<'custom' | 'preset' | 'flightplan'>('preset');
  const [customAltitude, setCustomAltitude] = useState<string>('');

  const updateConfig = (updates: Partial<AircraftConfiguration>) => {
    const newConfig = { ...localConfig, ...updates };
    // Auto-calculate size category
    newConfig.sizeCategory = newConfig.maxDimension <= 1 ? 1 :
                            newConfig.maxDimension <= 3 ? 3 :
                            newConfig.maxDimension <= 8 ? 8 :
                            newConfig.maxDimension <= 20 ? 20 : 40;
    setLocalConfig(newConfig);
    onAircraftConfigChange(newConfig);
  };

  // Calculate iGRC if we have config
  const igrcAnalysis = useMemo(() => {
    try {
      return calculateiGRCAnalysis(analysis.populationDistribution, analysis.intersectingMeshblocks, localConfig);
    } catch (error) {
      return null;
    }
  }, [analysis.populationDistribution, analysis.intersectingMeshblocks, localConfig]);

  // Handle altitude selection changes
  const handleAltitudeChange = (value: string) => {
    if (value === 'custom') {
      setAltitudeSource('custom');
    } else if (value === 'flightplan') {
      setAltitudeSource('flightplan');
      if (flightPlanAltitudes) {
        updateConfig({ operationAltitudeAGL: flightPlanAltitudes.max });
      }
    } else {
      setAltitudeSource('preset');
      updateConfig({ operationAltitudeAGL: parseFloat(value) });
    }
  };

  // Get display value for altitude dropdown
  const getAltitudeDisplayValue = () => {
    if (altitudeSource === 'custom') return 'custom';
    if (altitudeSource === 'flightplan') return 'flightplan';
    return localConfig.operationAltitudeAGL?.toString() || '120';
  };

  return (
    <div className="space-y-4">
      {/* Hero Section - iGRC Calculator */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
            <Calculator className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">iGRC Calculator</h3>
            <p className="text-xs text-gray-600">Configure aircraft and get matrix results</p>
          </div>
          {onShowMethodology && (
            <button
              onClick={onShowMethodology}
              className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
              title="How is this calculated?"
            >
              <HelpCircle className="w-4 h-4 text-blue-600" />
            </button>
          )}
        </div>

        {/* Aircraft Configuration Grid */}
        <div className="grid grid-cols-1 gap-2 mb-4">
          {/* Aircraft Size */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Aircraft Size</label>
            <select
              value={localConfig.maxDimension}
              onChange={(e) => updateConfig({ maxDimension: parseFloat(e.target.value) })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>Small (&lt;1m)</option>
              <option value={3}>Medium (&lt;3m)</option>
              <option value={8}>Large (&lt;8m)</option>
              <option value={20}>Very Large (&lt;20m)</option>
              <option value={40}>Jumbo (&lt;40m)</option>
            </select>
          </div>
          
          {/* Operation Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Operation Type</label>
            <select
              value={localConfig.operationType}
              onChange={(e) => updateConfig({ operationType: e.target.value as 'VLOS' | 'BVLOS' })}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="VLOS">VLOS</option>
              <option value="BVLOS">BVLOS</option>
            </select>
          </div>

          {/* Altitude Configuration */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Operation Altitude AGL
            </label>
            <select
              value={getAltitudeDisplayValue()}
              onChange={(e) => handleAltitudeChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="120">&gt;120m (Default)</option>
              <option value="305">&gt;305m</option>
              <option value="762">&gt;762m</option>
              <option value="1524">&gt;1524m</option>
              <option value="3048">&gt;3048m</option>
              <option value="6096">&gt;6096m</option>
              {flightPlanAltitudes && (
                <option value="flightplan">
                  Flight Plan Max: {flightPlanAltitudes.max.toFixed(0)}m
                </option>
              )}
              <option value="custom">Custom altitude...</option>
            </select>
            
            {/* Flight Plan Information */}
            <FlightPlanInfo 
              flightPlanAltitudes={flightPlanAltitudes}
              isVisible={altitudeSource === 'flightplan'}
            />
            
            {/* Custom altitude input */}
            {altitudeSource === 'custom' && (
              <div className="mt-2">
                <input
                  type="number"
                  placeholder="Altitude in meters AGL"
                  value={customAltitude}
                  onChange={(e) => {
                    setCustomAltitude(e.target.value);
                    const altitude = parseFloat(e.target.value) || 120;
                    updateConfig({ operationAltitudeAGL: altitude });
                  }}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* iGRC Results Display */}
        {igrcAnalysis && (
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Route iGRC Breakdown
            </h4>
            
            {/* Route breakdown by risk class */}
            <div className="space-y-3">
              {Object.entries(igrcAnalysis.byGroundRiskClass)
                .filter(([_, data]) => (data as any).meshblockCount > 0)
                .sort(([_, a], [__, b]) => (b as any).area - (a as any).area)
                .map(([riskClass, data]) => {
                  const typedData = data as any;
                  const percentage = ((typedData.area / analysis.totalIntersectingArea) * 100).toFixed(1);
                  const distance = (typedData.area * analysis.flightPathLength / analysis.totalIntersectingArea / 1000).toFixed(1);
                  
                  return (
                    <div key={riskClass} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span 
                          className="px-1 py-1 rounded-lg text-xs font-bold text-white min-w-[40px] text-center"
                          style={{ backgroundColor: getiGRCColor(typedData.iGRCValue) }}
                        >
                          iGRC {typedData.iGRCValue}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900 text-xs">{riskClass}</div>
                          <div className="text-xs text-gray-600">{typedData.meshblockCount} areas</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{percentage}%</div>
                        <div className="text-xs text-gray-600">{distance}km of route</div>
                      </div>
                    </div>
                  );
                })}
            </div>
            
            {/* Summary */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Maximum iGRC on Route:</span>
                <span 
                  className="px-3 py-1 rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: getiGRCColor(igrcAnalysis.overallRange.max) }}
                >
                  iGRC {igrcAnalysis.overallRange.max}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Supporting population and area statistics
 */
interface SupportingStatsProps {
  analysis: FlightPathMeshblockAnalysis;
}

const SupportingStats: React.FC<SupportingStatsProps> = ({ analysis }) => {
  return (
    <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="text-center">
        <div className="text-lg font-bold text-blue-600">
          {analysis.totalIntersectingArea > 0 
            ? Math.round(analysis.totalEstimatedPopulation / analysis.totalIntersectingArea).toLocaleString()
            : '0'
          }
        </div>
        <div className="text-xs text-gray-600">Avg Density</div>
        <div className="text-xs text-gray-500">people/km²</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-green-600">{analysis.totalEstimatedPopulation.toLocaleString()}</div>
        <div className="text-xs text-gray-600">Est. Population</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-purple-600">{analysis.totalIntersectingArea.toFixed(1)}</div>
        <div className="text-xs text-gray-600">Area (km²)</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-orange-600">{(analysis.flightPathLength / 1000).toFixed(1)}</div>
        <div className="text-xs text-gray-600">Flight Distance (km)</div>
      </div>
    </div>
  );
};

/**
 * Enhanced Land Use Distribution - for detailed analysis
 */
interface EnhancedLandUseBreakdownProps {
  breakdown: FlightPathMeshblockAnalysis['landUseBreakdown'];
  totalMeshblocks: number;
  totalPopulation: number;
}

const EnhancedLandUseBreakdown: React.FC<EnhancedLandUseBreakdownProps> = ({ 
  breakdown, 
  totalMeshblocks, 
  totalPopulation 
}) => {
  const sortedEntries = Object.entries(breakdown)
    .filter(([_, data]) => data.count > 0)
    .sort(([_, a], [__, b]) => b.count - a.count);

  return (
    <div className="space-y-3">
      {sortedEntries.map(([category, data], index) => {
        const percentage = totalMeshblocks > 0 ? (data.count / totalMeshblocks) * 100 : 0;
        const popPercentage = totalPopulation > 0 ? (data.estimatedPopulation / totalPopulation) * 100 : 0;
        
        return (
          <div
            key={category}
            className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-sm transition-shadow"
          >
            {/* Category Header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: LAND_USE_COLORS[category as LandUseCategory] }}
              />
              <span className="font-medium text-gray-900 text-sm flex-1">{category}</span>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                {percentage.toFixed(1)}%
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="text-center">
                <div className="font-semibold text-gray-900">{data.count}</div>
                <div className="text-gray-600">Areas</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">{data.totalArea.toFixed(1)}</div>
                <div className="text-gray-600">km²</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900">
                  {data.estimatedPopulation > 1000 
                    ? `${(data.estimatedPopulation / 1000).toFixed(1)}k` 
                    : data.estimatedPopulation.toLocaleString()
                  }
                </div>
                <div className="text-gray-600">People</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Progressive disclosure collapsible section
 */
interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  badge,
  defaultExpanded = false,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-blue-600">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900 text-sm">{title}</h4>
              {badge && (
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
          </div>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Export and actions component
 */
interface ExportActionsProps {
  onExport: (format: ExportFormat) => void;
  onRerun: () => void;
  onShowMethodology: () => void;
  loading?: boolean;
}

const ExportActions: React.FC<ExportActionsProps> = ({ 
  onExport, 
  onRerun, 
  onShowMethodology,
  loading = false 
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Download className="w-5 h-5 text-green-600" />
        <h4 className="font-medium text-gray-900">Export for Paperwork</h4>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onExport(ExportFormat.PDF_REPORT)}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          PDF Report
        </button>
        <button
          onClick={() => onExport(ExportFormat.CSV)}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          CSV Data
        </button>
      </div>
      
      <div className="flex justify-between">
        <button
          onClick={onRerun}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-run Analysis
        </button>
      </div>
      
      <div className="flex justify-between text-xs text-gray-500">
        <button onClick={() => onExport(ExportFormat.JSON)} className="hover:text-gray-700 underline">
          Export JSON
        </button>
        <button onClick={() => onExport(ExportFormat.GEOJSON)} className="hover:text-gray-700 underline">
          Export GeoJSON
        </button>
      </div>
    </div>
  );
};

/**
 * Main flight analysis component with consolidated auto-run functionality
 */
const MeshblockFlightAnalysis: React.FC<MeshblockFlightAnalysisProps> = ({
  analysis,
  loading,
  onRunAnalysis,
  onExportResults,
  flightPathGeometry,
  onShowMethodology
}) => {
  const [exportLoading, setExportLoading] = useState(false);
  
  // Get aircraft configuration from context
  const { aircraftConfig, setAircraftConfig } = useMeshblockContext();
  const [autoRun, setAutoRun] = useState(true);
  
  // FIXED: Use refs to track previous values without triggering re-renders
  const previousConfigRef = useRef<string>('');
  const isFirstRenderRef = useRef(true);

  // FIXED: Consolidated auto-run logic - single useEffect
  useEffect(() => {
    // Skip on first render to avoid running analysis on component mount
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    // Only run if we have all required data and auto-run is enabled
    if (!aircraftConfig || !analysis || loading) return;
    
    // Create hash of current config
    const currentConfigHash = `${aircraftConfig.maxDimension}-${aircraftConfig.operationType}-${aircraftConfig.operationAltitudeAGL}`;
    
    // Only run if config actually changed
    if (currentConfigHash !== previousConfigRef.current && previousConfigRef.current !== '') {
      console.log('[MeshblockFlightAnalysis] Config changed, auto-running analysis...', {
        oldHash: previousConfigRef.current,
        newHash: currentConfigHash,
        config: aircraftConfig
      });
      
      // Schedule analysis with delay to avoid rapid-fire updates
      const timeoutId = setTimeout(() => {
        onRunAnalysis();
      }, 500);
      
      // Cleanup function
      return () => clearTimeout(timeoutId);
    }
    
    // Update ref after comparison
    previousConfigRef.current = currentConfigHash;
    
  }, [aircraftConfig?.maxDimension, aircraftConfig?.operationType, aircraftConfig?.operationAltitudeAGL, onRunAnalysis]); 
  // Handle export with loading state
  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportLoading(true);
    try {
      await onExportResults();
      console.log(`Exporting analysis in ${format} format`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExportLoading(false);
    }
  }, [onExportResults]);

  if (!flightPathGeometry) {
    return (
      <div className="text-center py-8">
        <div className="p-4 bg-yellow-100 rounded-full inline-flex mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-600" />
        </div>
        <h3 className="font-semibold text-gray-900 mb-2">No Flight Plan Available</h3>
        <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
          Load a flight plan to calculate iGRC values and analyse population impact.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Start Analysis */}
      {!loading && !analysis && (
        <div className="text-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full inline-flex mb-3">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-md text-gray-900 mb-2">Calculate iGRC Values</h3>
          <p className="text-xs text-gray-600 mb-4 max-w-md mx-auto">
            Generate iGRC matrix results for your flight route using CASA SORA 2.0 methodology.
          </p>
          
          <button
            onClick={onRunAnalysis}
            className="inline-flex items-center text-sm gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Calculator className="w-5 h-5" />
            Start iGRC Analysis
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Calculating iGRC Values</h3>
          <p className="text-sm text-gray-600">Processing route and population data...</p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Main iGRC Calculator and Results */}
          <IGRCCalculatorAndResults
            analysis={analysis}
            aircraftConfig={aircraftConfig}
            onAircraftConfigChange={setAircraftConfig}
            onShowMethodology={onShowMethodology}
          />

          {/* Supporting Statistics */}
          <SupportingStats analysis={analysis} />

          {/* Progressive Disclosure Sections */}
          <div className="space-y-4">
            <CollapsibleSection
              title="Land Use Distribution"
              subtitle="Detailed breakdown by area type"
              icon={<BarChart3 className="w-5 h-5" />}
              badge={`${Object.keys(analysis.landUseBreakdown).length} types`}
            >
              <EnhancedLandUseBreakdown
                breakdown={analysis.landUseBreakdown}
                totalMeshblocks={analysis.intersectingMeshblocks.length}
                totalPopulation={analysis.totalEstimatedPopulation}
              />
            </CollapsibleSection>

            <CollapsibleSection
              title="Technical Analysis Details"
              subtitle="Buffer calculations and methodology"
              icon={<Settings className="w-5 h-5" />}
              badge="Technical"
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">Analysis Buffer</div>
                    <div className="text-gray-600">{analysis.bufferDistance}m radius</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Flight Distance</div>
                    <div className="text-gray-600">{(analysis.flightPathLength / 1000).toFixed(2)}km</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Average Density</div>
                    <div className="text-gray-600">{analysis.averagePopulationDensity.toFixed(1)} people/km²</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Analysis Date</div>
                    <div className="text-gray-600">{new Date(analysis.analysisDate).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* Export and Actions */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <ExportActions
              onExport={handleExport}
              onRerun={onRunAnalysis}
              onShowMethodology={onShowMethodology}
              loading={exportLoading || loading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MeshblockFlightAnalysis;