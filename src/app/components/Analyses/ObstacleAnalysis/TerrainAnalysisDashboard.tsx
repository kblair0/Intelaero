/**
 * TerrainAnalysisDashboard.tsx - Enhanced Visual Design
 * 
 * Purpose:
 * A streamlined dashboard for obstacle-related analyses, presenting simple
 * buttons for each analysis type that integrate with the checklist workflow.
 * 
 * Visual Enhancements:
 * - Modern card design with gradients and improved shadows
 * - Enhanced visual hierarchy and spacing
 * - Better color coding for different states
 * - Improved button designs and hover effects
 * - Consistent with compact design theme
 * 
 * Related Files:
 * - ChecklistContext.tsx: Provides state and steps for guided workflow
 * - FlightPlanContext.tsx: Provides flight plan data
 * - AreaOfOpsContext.tsx: Provides area of operations data
 * - ObstacleAnalysisContext.tsx: Provides terrain analysis functionality
 * - BYDAService.ts: Provides DBYD data fetching
 */

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useChecklistContext } from '../../../context/ChecklistContext';
import { useFlightPlanContext } from '../../../context/FlightPlanContext';
import { useAreaOfOpsContext } from '../../../context/AreaOfOpsContext';
import { useLayers } from '../../../hooks/useLayers';
import { useAreaOpsProcessor } from '../../AO/Hooks/useAreaOpsProcessor';
import { trackEventWithForm as trackEvent } from '../../tracking/tracking';
import { useAnalysisController } from "../../../context/AnalysisControllerContext";
import { 
  Mountain, 
  Plane, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Signal,
  Loader,
  Move,
  Trees,
  Info
} from 'lucide-react';
import PremiumButton from '../../UI/PremiumButton';
import { usePremium, FeatureId } from '../../../context/PremiumContext';
import { layerManager, MAP_LAYERS } from '../../../services/LayerManager';
import { GridCell } from '../Types/GridAnalysisTypes';

import { useMapContext } from '../../../context/mapcontext';
import { useTreeHeightContext } from '../../../context/TreeHeightContext';



interface TerrainAnalysisDashboardProps {
  onClose?: () => void;
}

export interface TerrainAnalysisDashboardRef {
  runAnalysis: () => Promise<boolean>;
}

/**
 * Enhanced analysis section with modern visual design
 */
interface AnalysisSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  buttonText: string;
  onButtonClick: () => void;
  checklistGroupId?: string;
  prerequisitesMet: boolean;
  prerequisitesMessage?: string;
  isLoading?: boolean;
  featureId: FeatureId;
  terrainOpacity?: number;
  onTerrainOpacityChange?: (opacity: number) => void;
  isAnalyzing?: boolean;
  aoTerrainGrid?: GridCell[] | null;
  
  // ADD THESE NEW OPTIONAL PROPS:
  secondButtonText?: string;
  onSecondButtonClick?: () => void;
  isSecondButtonLoading?: boolean;
  showSecondButton?: boolean;
  secondButtonFeatureId?: FeatureId;
}

/**
 * Enhanced powerline analysis section with modern design
 */
interface PowerlineAnalysisSectionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  hvButtonText: string;
  localButtonText: string;
  onHVButtonClick: () => void;
  onLocalButtonClick: () => void;
  hvChecklistGroupId: string;
  localChecklistGroupId: string;
  prerequisitesMet: boolean;
  prerequisitesMessage?: string;
  isHVLoading?: boolean;
  isLocalLoading?: boolean;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  title,
  description,
  icon,
  buttonText,
  onButtonClick,
  checklistGroupId,
  prerequisitesMet,
  prerequisitesMessage,
  isLoading,
  featureId,
  terrainOpacity,
  onTerrainOpacityChange,
  isAnalyzing,
  aoTerrainGrid,
  
  // ADD THESE NEW PROPS:
  secondButtonText,
  onSecondButtonClick,
  isSecondButtonLoading,
  showSecondButton,
  secondButtonFeatureId
}) => {
  const { checks } = useChecklistContext();
  
  // Check if any checklist items for this section are pending
  const hasPendingChecks = checklistGroupId 
    ? checks.some(check => 
        check.group === checklistGroupId && 
        check.status === 'pending')
    : false;
    
  // Check if all checklist items for this section are completed
  const isCompleted = checklistGroupId
    ? checks.some(check => 
        check.group === checklistGroupId) && 
      !checks.some(check => 
        check.group === checklistGroupId && 
        check.status === 'pending')
    : false;

  return (
    <div className={`
      bg-white rounded-xl p-4 border-2 shadow-sm hover:shadow-md transition-all duration-200
      ${hasPendingChecks ? 'border-l-4 border-yellow-400 bg-gradient-to-r from-yellow-50 to-white' : ''}
      ${isCompleted ? 'border-l-4 border-green-400 bg-gradient-to-r from-green-50 to-white' : 'border-gray-200'}
    `}>
      <div className="flex items-start mb-4">
        <div className={`
          flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl mr-3 shadow-sm transition-all duration-200
          ${isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' : 
            hasPendingChecks ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white' : 
            'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600'}
        `}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      
      {!prerequisitesMet && prerequisitesMessage && (
        <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800 leading-relaxed">{prerequisitesMessage}</p>
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {featureId ? (
          <PremiumButton 
            featureId={featureId}
            onClick={onButtonClick}
            disabled={!prerequisitesMet || isLoading}
            className={`
              w-full py-2 px-2 rounded-lg text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]
              ${prerequisitesMet 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Loading...
              </span>
            ) : buttonText}
          </PremiumButton>
        ) : (
          <button 
            className={`
              w-full py-2 px-2 rounded-lg text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]
              ${prerequisitesMet 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
            onClick={onButtonClick}
            disabled={!prerequisitesMet || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                Loading...
              </span>
            ) : buttonText}
          </button>
        )}

          {/* ADD THIS SECOND BUTTON LOGIC: */}
  {showSecondButton && secondButtonText && onSecondButtonClick && (
    secondButtonFeatureId ? (
      <PremiumButton 
        featureId={secondButtonFeatureId}
        onClick={onSecondButtonClick}
        disabled={!prerequisitesMet || isSecondButtonLoading}
        className={`
          w-full py-2 px-2 rounded-lg text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]
          ${prerequisitesMet 
            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
            : 'bg-gray-300 cursor-not-allowed'}
        `}
      >
        {isSecondButtonLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader className="w-4 h-4 animate-spin" />
            Loading...
          </span>
        ) : secondButtonText}
      </PremiumButton>
    ) : (
      <button 
        className={`
          w-full py-2 px-2 rounded-lg text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]
          ${prerequisitesMet 
            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
            : 'bg-gray-300 cursor-not-allowed'}
        `}
        onClick={onSecondButtonClick}
        disabled={!prerequisitesMet || isSecondButtonLoading}
      >
        {isSecondButtonLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader className="w-4 h-4 animate-spin" />
            Loading...
          </span>
        ) : secondButtonText}
      </button>
    )
  )}
        
        {/* Enhanced opacity slider for Terrain Profile Analysis */}
        {title === "Terrain Profile Analysis" && terrainOpacity !== undefined && onTerrainOpacityChange && aoTerrainGrid && aoTerrainGrid.length > 0 && (
          <div className="mt-3 p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
            <label htmlFor="terrain-opacity-slider" className="text-xs text-gray-700 flex justify-between items-center mb-2">
              <span className="font-medium">Terrain Opacity:</span>
              <span className="font-semibold text-blue-600">{Math.round(terrainOpacity * 100)}%</span>
            </label>
            <input
              id="terrain-opacity-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={terrainOpacity}
              onChange={(e) => onTerrainOpacityChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              disabled={isAnalyzing || !layerManager.isLayerVisible(MAP_LAYERS.AOTERRAIN_GRID)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const PowerlineAnalysisSection: React.FC<PowerlineAnalysisSectionProps> = ({
  title,
  description,
  icon,
  hvButtonText,
  localButtonText,
  onHVButtonClick,
  onLocalButtonClick,
  hvChecklistGroupId,
  localChecklistGroupId,
  prerequisitesMet,
  prerequisitesMessage,
  isHVLoading,
  isLocalLoading
}) => {
  const { checks } = useChecklistContext();
  
  const hasPendingChecks = [hvChecklistGroupId, localChecklistGroupId].some(groupId =>
    checks.some(check => check.group === groupId && check.status === 'pending')
  );
  
  const isCompleted = [hvChecklistGroupId, localChecklistGroupId].every(groupId =>
    checks.some(check => check.group === groupId) &&
    !checks.some(check => check.group === groupId && check.status === 'pending')
  );

  return (
    <div className={`
      bg-white rounded-xl p-4 border-2 shadow-sm hover:shadow-md transition-all duration-200
      ${hasPendingChecks ? 'border-l-4 border-yellow-400 bg-gradient-to-r from-yellow-50 to-white' : ''}
      ${isCompleted ? 'border-l-4 border-green-400 bg-gradient-to-r from-green-50 to-white' : 'border-gray-200'}
    `}>
      <div className="flex items-start mb-4">
        <div className={`
          flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl mr-3 shadow-sm transition-all duration-200
          ${isCompleted ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' : 
            hasPendingChecks ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white' : 
            'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600'}
        `}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">{title}</h3>
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      
      {!prerequisitesMet && prerequisitesMessage && (
        <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800 leading-relaxed">{prerequisitesMessage}</p>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        <PremiumButton 
          featureId="hv_powerlines"
          className={`
            w-full py-2 px-2 rounded-lg text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]
            ${prerequisitesMet 
              ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700' 
              : 'bg-gray-300 cursor-not-allowed'}
          `}
          onClick={onHVButtonClick}
          disabled={!prerequisitesMet || isHVLoading}
        >
          {isHVLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              Loading...
            </span>
          ) : hvButtonText}
        </PremiumButton>
        <PremiumButton 
          featureId="local_powerlines"
          onClick={onLocalButtonClick}
          disabled={!prerequisitesMet || isLocalLoading}
          className={`
            w-full py-2 px-2 rounded-lg text-white text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]
            ${prerequisitesMet 
              ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
              : 'bg-gray-300 cursor-not-allowed'}
          `}
        >
          {isLocalLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader className="w-4 h-4 animate-spin" />
              Loading...
            </span>
          ) : localButtonText}
        </PremiumButton>
      </div>
    </div>
  );
};

/**
 * Enhanced AO Buffer Section Component 
 */
interface AOBufferSectionProps {
  bufferDistance: number;
  onBufferDistanceChange: (distance: number) => void;
  hasFlightPlan: boolean;
  isAnalyzing: boolean;
}

const AOBufferSection: React.FC<AOBufferSectionProps> = ({
  bufferDistance,
  onBufferDistanceChange,
  hasFlightPlan,
  isAnalyzing
}) => {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start mb-4">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl mr-3 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 shadow-sm">
          <Move className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900">Area of Operations Buffer</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Adjust the safety margin around your flight path or operating area
          </p>
        </div>
      </div>
      
      {!hasFlightPlan && (
        <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-800 leading-relaxed">
              No flight plan loaded. Buffer will apply to manually defined areas.
            </p>
          </div>
        </div>
      )}
      
      <div className="p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
        <label htmlFor="ao-buffer-slider" className="text-sm text-gray-700 flex justify-between items-center mb-3">
          <span className="font-medium">Buffer Distance:</span>
          <span className="font-semibold text-blue-600">{bufferDistance}m</span>
        </label>
        <input
          id="ao-buffer-slider"
          type="range"
          min="100"
          max="2000"
          step="50"
          value={bufferDistance}
          onChange={(e) => onBufferDistanceChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          disabled={isAnalyzing}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>100m</span>
          <span>500m</span>
          <span>1000m</span>
          <span>2000m</span>
        </div>
      </div>
    </div>
  );
};

// Simple info icon component
const InfoIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

const TerrainAnalysisDashboard = forwardRef<TerrainAnalysisDashboardRef, TerrainAnalysisDashboardProps>(
  ({ onClose }, ref) => {
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [isLoadingHV, setIsLoadingHV] = useState(false);
  const [isLoadingDBYD, setIsLoadingDBYD] = useState(false);
  const [isLoadingAirspace, setIsLoadingAirspace] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localBufferDistance, setLocalBufferDistance] = useState<number>(500);
  const { gridAnalysisRef } = useAnalysisController();

  // Terrain layer opacity state
  const [terrainOpacity, setTerrainOpacity] = useState<number>(0.7);
  const { map } = useMapContext();
  const { 
  queryTreeHeightsInAO, 
  isQuerying: isTreeQuerying, 
  toggleTreeHeights, 
  isVisible,
  error: treeHeightError 
  } = useTreeHeightContext();

  const handleQueryTreeHeights = async () => {
    trackEvent("tree_heights_area_query", { panel: "TerrainAnalysisDashboard.tsx" });
    
    try {
      await queryTreeHeightsInAO();
      // Success message will be shown by the modal itself
      setSuccessMessage(`Tree height analysis completed successfully`);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to query tree heights");
    }
  };
 
  const { 
    checks, 
    guidedTarget, 
    completeCheck 
  } = useChecklistContext();
  
  const { flightPlan } = useFlightPlanContext();
  const { 
    aoGeometry, 
    aoTerrainGrid, 
    bufferDistance, 
    setBufferDistance,
    analyzeTerrainElevation, 
    isAnalyzing: aoIsAnalyzing,
    analysisProgress: aoAnalysisProgress,
    analysisError: aoAnalysisError,
    terrainAnalysisResult
  } = useAreaOfOpsContext();

  const { togglePowerlines, toggleDBYDPowerlines, toggleAirspace } = useLayers();
  const { generateTerrainGrid, generateAOFromFlightPlan } = useAreaOpsProcessor();

  const [localAnalyzing, setLocalAnalyzing] = useState(false);
  const isAnalyzing = aoIsAnalyzing || localAnalyzing;

  
  useEffect(() => {
    if (guidedTarget) {
      const { action } = guidedTarget;
      
      const actionToSection: Record<string, string> = {
        analyseTerrainInAO: 'terrainProfile',
        togglePowerlines: 'powerline',
        toggleDBYDPowerlines: 'powerline',
        toggleAirspace: 'airspace'
      };
      
      const section = actionToSection[action];
      if (section) {
        setFocusedSection(section);
      }
    }
  }, [guidedTarget]);

  useEffect(() => {
    setLocalBufferDistance(bufferDistance ?? 500);
  }, [bufferDistance]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /**
   * Updates buffer distance and regenerates AO
   * @param newDistance - New buffer distance in meters
   */
  const handleBufferDistanceChange = (newDistance: number) => {
    setLocalBufferDistance(newDistance);
    setBufferDistance(newDistance);
    trackEvent("ao_buffer_distance_changed", { 
      panel: "TerrainAnalysisDashboard.tsx", 
      bufferDistance: newDistance 
    });

    if (flightPlan) {
      console.log(`Regenerating AO with buffer distance: ${newDistance}m`);
      generateAOFromFlightPlan(flightPlan, true, newDistance); // Pass newDistance directly
    }
  };

  /**
   * Handles running terrain analysis for Area of Operations
   * Uses GridAnalysisController when available, falls back to context method
   * With improved error handling to recover from stack overflows
   */
  const handleRunAOAnalysis = async () => {
    trackEvent("run_ao_terrain_analysis", { panel: "TerrainAnalysisDashboard.tsx" });
    setLocalError(null);
    setSuccessMessage(null);
    setLocalAnalyzing(true);
    
    try {
      let terrainGrid = aoTerrainGrid;
      if (!terrainGrid || terrainGrid.length === 0) {
        try {
          terrainGrid = await generateTerrainGrid();
          if (!terrainGrid || terrainGrid.length === 0) {
            throw new Error("Failed to generate terrain grid");
          }
        } catch (gridError) {
          console.error("Grid generation error:", gridError);
          throw new Error("Failed to generate terrain grid. Please try again with a smaller buffer if the problem persists.");
        }
      }
      
      console.log(`Running analysis on ${terrainGrid.length} grid cells`);
      
      const checkId = checks.find(c => c.group === 'terrainProfile' && c.status === 'pending')?.id;
      if (checkId) completeCheck(checkId);
      
      if (gridAnalysisRef.current) {
        console.log("Using GridAnalysisController for terrain analysis");
        try {
          const results = await gridAnalysisRef.current.analyzeTerrainGrid(
            terrainGrid,
            {
              referenceAltitude: 120,
              onProgress: (progress: number) => {},
              timeout: 20000
            }
          );
          
          setSuccessMessage("Terrain analysis complete");
          return true;
        } catch (controllerError) {
          console.error("GridAnalysisController error:", controllerError);
          
          if (controllerError instanceof Error && 
              (controllerError.message.includes("Maximum call stack size") || 
              controllerError.message.includes("timeout"))) {
            
            console.log("Attempting to continue with results despite visualization error");
            
            if (terrainAnalysisResult) {
              setSuccessMessage("Analysis complete, but visualization limited due to area size");
              return true;
            }
            
            console.log("Falling back to context method after controller visualization failure");
          } else {
            throw controllerError;
          }
        }
      }
      
      console.log("Using context method for terrain analysis");
      try {
        const result = await analyzeTerrainElevation(120);
        
        if (result) {
          setSuccessMessage("Terrain analysis complete");
        } else if (aoGeometry) {
          setSuccessMessage("Terrain visualization complete");
        } else {
          throw new Error("Analysis failed to produce results");
        }
        
        return true;
      } catch (contextError) {
        console.error("Context method error:", contextError);
        
        if (contextError instanceof Error && contextError.message.includes("Maximum call stack size")) {
          if (terrainAnalysisResult) {
            setSuccessMessage("Analysis complete, but visualization limited due to area size");
            return true;
          }
        }
        
        throw contextError;
      }
    } catch (error) {
      let errorMessage = "Unknown error during analysis";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes("Maximum call stack size exceeded")) {
          errorMessage = "Visualization failed due to area size, but analysis may have succeeded. Click 'Reset and Try Again' to retry the visualization.";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Analysis timed out. The area may be too large to process. Try with a smaller buffer.";
        }
      }
      
      setLocalError(errorMessage);
      return false;
    } finally {
      setLocalAnalyzing(false);
    }
  };

    useImperativeHandle(ref, () => ({
    runAnalysis: async (): Promise<boolean> => {
      console.log('[TerrainAnalysisDashboard] Programmatic analysis triggered');
      try {
        return await handleRunAOAnalysis();
      } catch (error) {
        console.error('[TerrainAnalysisDashboard] Programmatic analysis failed:', error);
        return false;
      }
    }
  }), [handleRunAOAnalysis]);

      /**
   * Reset analysis state to recover from errors
   */
  const handleResetAnalysis = () => {
    trackEvent("reset_terrain_analysis", { panel: "TerrainAnalysisDashboard.tsx" });
    setLocalError(null);
    setSuccessMessage(null);
    
    setLocalAnalyzing(false);
    setIsLoadingHV(false);
    setIsLoadingDBYD(false);
    setIsLoadingAirspace(false);
    
    layerManager.removeLayer(MAP_LAYERS.AOTERRAIN_GRID);
    
    console.log("Terrain analysis reset, ready to try again");
    
    setSuccessMessage("Analysis reset. You can now try again.");
  };

  const handleTerrainOpacityChange = (opacity: number) => {
    setTerrainOpacity(opacity);
    const success = layerManager.updateLayerOpacity(MAP_LAYERS.AOTERRAIN_GRID, opacity);
    if (success) {
      trackEvent("terrain_opacity_changed", { 
        panel: "TerrainAnalysisDashboard.tsx", 
        opacity 
      });
    }
  };
  /**
   * Handles toggling HV powerlines layer
   */
  const handleTogglePowerlines = () => {
    trackEvent("powerlines_add_overlay_click", { panel: "TerrainAnalysisDashboard.tsx" });
    setIsLoadingHV(true);
    setLocalError(null);
    setSuccessMessage(null);
    
    try {
      const checkId = checks.find(c => 
        c.group === 'hvPowerline' && 
        c.status === 'pending'
      )?.id;
      
      if (checkId) completeCheck(checkId);
      
      togglePowerlines();
      setSuccessMessage("HV Powerlines toggled. Check map for visibility.");
    } catch (error) {
      console.error("HV powerlines toggle error:", error);
      setLocalError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingHV(false);
    }
  };

  /**
   * Handles toggling DBYD powerlines layer
   */
  const handleToggleDBYDPowerlines = async () => {
    trackEvent("DYBDpowerlines_add_overlay_click", { panel: "TerrainAnalysisDashboard.tsx" });
    setIsLoadingDBYD(true);
    setLocalError(null);
    setSuccessMessage(null);
    
    try {
      const checkId = checks.find(c => 
        c.group === 'localPowerline' && 
        c.status === 'pending'
      )?.id;
      
      if (checkId) completeCheck(checkId);
      
      const success = await toggleDBYDPowerlines();
      if (!success) {
        throw new Error("Failed to fetch or toggle DBYD powerlines");
      }
      setSuccessMessage("Local Powerlines toggled. Check map for visibility.");
    } catch (error) {
      console.error("DBYD powerlines toggle error:", error);
      setLocalError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingDBYD(false);
    }
  };

  /**
   * Handles toggling airspace layers
   */
  const handleToggleAirspace = () => {
    trackEvent("airspace_add_overlay_click", { panel: "TerrainAnalysisDashboard.tsx" });
    setIsLoadingAirspace(true);
    setLocalError(null);
    setSuccessMessage(null);
    
    try {
      const checkId = checks.find(c => 
        c.group === 'airspace' && 
        c.status === 'pending'
      )?.id;
      
      if (checkId) completeCheck(checkId);
      
      toggleAirspace();
      setSuccessMessage("Airspace toggled. Check map for visibility.");
    } catch (error) {
      console.error("Airspace toggle error:", error);
      setLocalError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoadingAirspace(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm">
            <Mountain className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900 text-sm">Terrain & Obstacle Analysis</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Analyse terrain features and obstacles for your flight operations
        </p>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        )}
      </div>
      
      {/* Enhanced Error Message */}
      {localError && (
        <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 rounded-lg text-sm text-red-800 mb-4 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">{localError}</p>
          </div>
        </div>
      )}

      {localError && (
        <button 
          className="w-full py-3 px-4 mb-4 rounded-lg text-white text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]"
          onClick={handleResetAnalysis}
          disabled={isAnalyzing}
        >
          Reset and Try Again
        </button>
      )}
      
      {/* Enhanced Success Message */}
      {successMessage && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 rounded-lg text-sm text-green-800 mb-4 shadow-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">{successMessage}</p>
          </div>
        </div>
      )}
      
      {flightPlan && (
        <AOBufferSection 
          bufferDistance={localBufferDistance}
          onBufferDistanceChange={handleBufferDistanceChange}
          hasFlightPlan={true}
          isAnalyzing={isAnalyzing}
        />
      )}
      
      <div className="space-y-4">
        {/* Terrain Profile Analysis Section */}
        <AnalysisSection
          title="Terrain Profile Analysis"
          description="Analyse terrain elevation across your operating area."
          icon={<Mountain className="w-5 h-5" />}
          buttonText="Analyse Terrain Profile in AO"
          onButtonClick={handleRunAOAnalysis}
          checklistGroupId="terrainProfile"
          prerequisitesMet={!!aoGeometry}
          prerequisitesMessage={!aoGeometry ? "Please define an operating area first" : undefined}
          isLoading={isAnalyzing}
          featureId="terrain_analysis"
          terrainOpacity={terrainOpacity}
          onTerrainOpacityChange={handleTerrainOpacityChange}
          isAnalyzing={isAnalyzing}
          aoTerrainGrid={aoTerrainGrid}
        />
        
        {/* Powerline Analysis Section with Two Buttons */}
        <PowerlineAnalysisSection
          title="Powerline Analysis"
          description="Show high-voltage (HV) or Dial Before You Dig (DBYD) powerlines in your operating area."
          icon={<Zap className="w-5 h-5" />}
          hvButtonText="Show HV Powerlines"
          localButtonText="Show Local Powerlines"
          onHVButtonClick={handleTogglePowerlines}
          onLocalButtonClick={handleToggleDBYDPowerlines}
          hvChecklistGroupId="hvPowerline"
          localChecklistGroupId="localPowerline"
          prerequisitesMet={!!aoGeometry}
          prerequisitesMessage={!aoGeometry ? "Please define an operating area first" : undefined}
          isHVLoading={isLoadingHV}
          isLocalLoading={isLoadingDBYD}
        />

        {/* Tree Heights Analysis Section - ENHANCED DEBUG */}
        <div className="space-y-2">
        <AnalysisSection
          title="Tree Heights"
          description="Display tree heights within the Area of Operations."
          icon={<Trees className="w-5 h-5" />}
          buttonText={isVisible ? "Hide Tree Heights" : "Show Tree Heights"}
          onButtonClick={toggleTreeHeights}
          prerequisitesMet={true} // No prerequisites needed
          featureId="tree_heights"
         
          // ADD SECOND BUTTON PROPS:
          secondButtonText="Query Tree Heights in AO"
          onSecondButtonClick={handleQueryTreeHeights}
          isSecondButtonLoading={isTreeQuerying}
          showSecondButton={!!aoGeometry}
          secondButtonFeatureId="tree_heights"
        />
        
      </div>
        
        {/* Airspace Analysis Section */}
        <AnalysisSection
          title="Airspace Analysis"
          description="View airspace information in your operating area."
          icon={<Plane className="w-5 h-5" />}
          buttonText="Show Airspace"
          onButtonClick={handleToggleAirspace}
          checklistGroupId="airspace"
          prerequisitesMet={true}
          isLoading={isLoadingAirspace}
          featureId="airspace_analysis"
        />
      </div>
      
      {/* Enhanced Footer Info */}
      <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-700 leading-relaxed">
            Terrain analysis is based on available digital elevation models. While accurate for general planning, 
            always maintain visual awareness during flight operations and comply with regulations.
          </p>
        </div>
      </div>
    </div>
  );
});
TerrainAnalysisDashboard.displayName = 'TerrainAnalysisDashboard';

export default TerrainAnalysisDashboard;