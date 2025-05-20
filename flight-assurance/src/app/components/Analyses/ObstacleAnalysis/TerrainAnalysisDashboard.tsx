/**
 * TerrainAnalysisDashboard.tsx
 * 
 * Purpose:
 * A streamlined dashboard for obstacle-related analyses, presenting simple
 * buttons for each analysis type that integrate with the checklist workflow.
 * 
 * This component:
 * - Provides direct button access to obstacle analysis features
 * - Integrates with the checklist system
 * - Manages the Area of Operations buffer distance
 * - Includes terrain profile, powerline (HV and DBYD), and airspace analysis
 * - Uses a clear, non-collapsible section layout
 * 
 * Related Files:
 * - ChecklistContext.tsx: Provides state and steps for guided workflow
 * - FlightPlanContext.tsx: Provides flight plan data
 * - AreaOfOpsContext.tsx: Provides area of operations data
 * - ObstacleAnalysisContext.tsx: Provides terrain analysis functionality
 * - BYDAService.ts: Provides DBYD data fetching
 */

import React, { useState, useEffect } from 'react';
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
  Move
} from 'lucide-react';

import PremiumButton from '../../UI/PremiumButton';
import { usePremium, FeatureId } from '../../../context/PremiumContext';
import { layerManager } from '../../../services/LayerManager';


interface TerrainAnalysisDashboardProps {
  onClose?: () => void;
}

/**
 * Simple analysis section with a button
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
}

/**
 * Powerline analysis section with two buttons (HV and DBYD)
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
  featureId
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
      bg-white rounded-lg p-4 border border-gray-200
      ${hasPendingChecks ? 'border-l-4 border-yellow-300' : ''}
      ${isCompleted ? 'border-l-4 border-green-300' : ''}
    `}>
      <div className="flex items-start mb-3">
        <div className={`
          flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3
          ${isCompleted ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}
          ${hasPendingChecks ? 'bg-yellow-50 text-yellow-600' : ''}
        `}>
          {icon}
        </div>
        <div>
          <div className="flex items-center">
            <h3 className="font-medium text-sm text-gray-900">{title}</h3>
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-500 ml-2" />}
          </div>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      
      {!prerequisitesMet && prerequisitesMessage && (
        <div className="mb-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
          <AlertTriangle className="inline-block w-4 h-4 mr-1" />
          {prerequisitesMessage}
        </div>
      )}
      
      <div className="mt-3">
        {featureId ? (
          // Use PremiumButton if featureId is provided
          <PremiumButton 
            featureId={featureId}
            onClick={onButtonClick}
            disabled={!prerequisitesMet || isLoading}
            className={`
              w-full py-2 px-4 rounded text-white text-xs font-medium
              ${prerequisitesMet 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </span>
            ) : buttonText}
          </PremiumButton>
        ) : (
          // Use regular button if no featureId is provided (free features)
          <button 
            className={`
              w-full py-2 px-4 rounded text-white text-xs font-medium
              ${prerequisitesMet 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
            onClick={onButtonClick}
            disabled={!prerequisitesMet || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </span>
            ) : buttonText}
          </button>
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
  
  // Check if any checklist items for either HV or Local are pending
  const hasPendingChecks = [hvChecklistGroupId, localChecklistGroupId].some(groupId =>
    checks.some(check => check.group === groupId && check.status === 'pending')
  );
  
  // Check if all checklist items for both HV and Local are completed
  const isCompleted = [hvChecklistGroupId, localChecklistGroupId].every(groupId =>
    checks.some(check => check.group === groupId) &&
    !checks.some(check => check.group === groupId && check.status === 'pending')
  );

  return (
    <div className={`
      bg-white rounded-lg p-4 border border-gray-200
      ${hasPendingChecks ? 'border-l-4 border-yellow-300' : ''}
      ${isCompleted ? 'border-l-4 border-green-300' : ''}
    `}>
      <div className="flex items-start mb-3">
        <div className={`
          flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3
          ${isCompleted ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}
          ${hasPendingChecks ? 'bg-yellow-50 text-yellow-600' : ''}
        `}>
          {icon}
        </div>
        <div>
          <div className="flex items-center">
            <h3 className="font-medium text-sm text-gray-900">{title}</h3>
            {isCompleted && <CheckCircle className="w-4 h-4 text-green-500 ml-2" />}
          </div>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      
      {!prerequisitesMet && prerequisitesMessage && (
        <div className="mb-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
          <AlertTriangle className="inline-block w-4 h-4 mr-1" />
          {prerequisitesMessage}
        </div>
      )}
      
      <div className="mt-3 flex flex-col gap-2">
          <PremiumButton 
            featureId="hv_powerlines"
            className={`
              py-2 px-4 rounded text-white text-xs font-medium
              ${prerequisitesMet 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
            onClick={onHVButtonClick}
            disabled={!prerequisitesMet || isHVLoading}
          >
            {isHVLoading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </span>
            ) : hvButtonText}
          </PremiumButton>
          <PremiumButton 
            featureId="local_powerlines"
            onClick={onLocalButtonClick}
            disabled={!prerequisitesMet || isLocalLoading}
            className={`
              py-2 px-4 rounded text-white text-xs font-medium
              ${prerequisitesMet 
                ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-gray-300 cursor-not-allowed'}
            `}
          >
            {isLocalLoading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </span>
            ) : localButtonText}
          </PremiumButton>
      </div>
    </div>
  );
};

/**
 * AO Buffer Section Component 
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
    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
      <div className="flex items-start mb-3">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3 bg-blue-50 text-blue-600">
          <Move className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-medium text-sm text-gray-900">Area of Operations Buffer</h3>
          <p className="text-xs text-gray-500 mt-1">
            Adjust the safety margin around your flight path or operating area
          </p>
        </div>
      </div>
      
      {!hasFlightPlan && (
        <div className="mb-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
          <AlertTriangle className="inline-block w-4 h-4 mr-1" />
          No flight plan loaded. Buffer will apply to manually defined areas.
        </div>
      )}
      
      <div className="mt-3">
        <label htmlFor="ao-buffer-slider" className="text-sm text-gray-700 flex justify-between">
          <span>Buffer Distance:</span>
          <span className="font-medium">{bufferDistance}m</span>
        </label>
        <input
          id="ao-buffer-slider"
          type="range"
          min="100"
          max="2000"
          step="50"
          value={bufferDistance}
          onChange={(e) => onBufferDistanceChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
          disabled={isAnalyzing}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
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

const TerrainAnalysisDashboard: React.FC<TerrainAnalysisDashboardProps> = ({ onClose }) => {
  // Track focused section (from checklist guidance)
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [isLoadingHV, setIsLoadingHV] = useState(false);
  const [isLoadingDBYD, setIsLoadingDBYD] = useState(false);
  const [isLoadingAirspace, setIsLoadingAirspace] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [localBufferDistance, setLocalBufferDistance] = useState<number>(500);
  const { gridAnalysisRef } = useAnalysisController();
 
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
  // Combine context analyzing state with local analyzing state
  const isAnalyzing = aoIsAnalyzing || localAnalyzing;
  
  // Track which checklist actions should focus sections
  useEffect(() => {
    if (guidedTarget) {
      const { action } = guidedTarget;
      
      // Map actions to sections
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

  // Sync local buffer distance with context
  useEffect(() => {
    setLocalBufferDistance(bufferDistance ?? 500);
  }, [bufferDistance]);

  // Clear success message after 3 seconds
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
      generateAOFromFlightPlan(flightPlan, true);
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
      // Generate grid if needed (keep this part)
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
      
      // Complete checklist item
      const checkId = checks.find(c => c.group === 'terrainProfile' && c.status === 'pending')?.id;
      if (checkId) completeCheck(checkId);
      
      // Try using GridAnalysisController first
      if (gridAnalysisRef.current) {
        console.log("Using GridAnalysisController for terrain analysis");
        try {
          const results = await gridAnalysisRef.current.analyzeTerrainGrid(
            terrainGrid,
            {
              referenceAltitude: 120, // Default value - could be configurable
              onProgress: (progress) => {
                // Handle progress updates if needed
              },
              // Add timeout to prevent hanging
              timeout: 20000 // 20sec timeout
            }
          );
          
          // Check if visualization succeeded but we still have analysis results
          setSuccessMessage("Terrain analysis complete");
          return true;
        } catch (controllerError) {
          console.error("GridAnalysisController error:", controllerError);
          
          // Special handling for stack overflow or timeout errors
          if (controllerError instanceof Error && 
              (controllerError.message.includes("Maximum call stack size") || 
              controllerError.message.includes("timeout"))) {
            
            // Visualization might have failed but analysis could still succeed
            console.log("Attempting to continue with results despite visualization error");
            
            // Check if we got analysis results despite the visualization error
            if (terrainAnalysisResult) {
              setSuccessMessage("Analysis complete, but visualization limited due to area size");
              return true;
            }
            
            // If we have no results, try the context method as fallback
            console.log("Falling back to context method after controller visualization failure");
          } else {
            // For other errors, just rethrow
            throw controllerError;
          }
        }
      }
      
      // Fall back to the AreaOfOpsContext method
      console.log("Using context method for terrain analysis");
      try {
        const result = await analyzeTerrainElevation(120);
        
        // Set appropriate success message
        if (result) {
          setSuccessMessage("Terrain analysis complete");
        } else if (aoGeometry) {
          // If visualization worked but detailed analysis failed
          setSuccessMessage("Terrain visualization complete");
        } else {
          throw new Error("Analysis failed to produce results");
        }
        
        return true;
      } catch (contextError) {
        console.error("Context method error:", contextError);
        
        // Special handling for visualization errors
        if (contextError instanceof Error && contextError.message.includes("Maximum call stack size")) {
          // We might still have useful information in terrainAnalysisResult
          if (terrainAnalysisResult) {
            setSuccessMessage("Analysis complete, but visualization limited due to area size");
            return true;
          }
        }
        
        throw contextError;
      }
    } catch (error) {
      // Improved error handling with more helpful messages
      let errorMessage = "Unknown error during analysis";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more helpful messages for common errors
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

      /**
   * Reset analysis state to recover from errors
   */
  const handleResetAnalysis = () => {
    trackEvent("reset_terrain_analysis", { panel: "TerrainAnalysisDashboard.tsx" });
    setLocalError(null);
    setSuccessMessage(null);
    
    // Reset local state
    setLocalAnalyzing(false);
    setIsLoadingHV(false);
    setIsLoadingDBYD(false);
    setIsLoadingAirspace(false);
    
    // Remove terrain grid visualization but keep the data
    layerManager.removeLayer(layerManager.MAP_LAYERS.AOTERRAIN_GRID);
    
    console.log("Terrain analysis reset, ready to try again");
    
    // Optional: Notify user
    setSuccessMessage("Analysis reset. You can now try again.");
    
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
      // Complete checklist item if available
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
      // Complete checklist item if available
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
      // Complete checklist item if available
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
    <div className="space-y-4 p-1">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
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
      
      {localError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
          <AlertTriangle className="inline-block w-4 h-4 mr-1" />
          {localError}
        </div>
      )}

      {localError && (
        <button 
          className="w-full py-2 px-4 mb-4 rounded text-white text-xs font-medium bg-blue-500 hover:bg-blue-600"
          onClick={handleResetAnalysis}
          disabled={isAnalyzing}
        >
          Reset and Try Again
        </button>
      )}
      
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 mb-4">
          <CheckCircle className="inline-block w-4 h-4 mr-1" />
          {successMessage}
        </div>
      )}
      
      {/* Added AO Buffer Section */}
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
          icon={<Mountain className="w-4 h-4" />}
          buttonText="Analyse Terrain Profile in AO"
          onButtonClick={handleRunAOAnalysis}
          checklistGroupId="terrainProfile"
          prerequisitesMet={!!aoGeometry}
          prerequisitesMessage={!aoGeometry ? "Please define an operating area first" : undefined}
          isLoading={isAnalyzing}
          featureId="terrain_analysis"
        />
        
        {/* Powerline Analysis Section with Two Buttons */}
        <PowerlineAnalysisSection
          title="Powerline Analysis"
          description="Show high-voltage (HV) or Dial Before You Dig (DBYD) powerlines in your operating area."
          icon={<Zap className="w-4 h-4" />}
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
        
        {/* Airspace Analysis Section */}
        <AnalysisSection
          title="Airspace Analysis"
          description="View airspace information in your operating area."
          icon={<Plane className="w-4 h-4" />}
          buttonText="Show Airspace"
          onButtonClick={handleToggleAirspace}
          checklistGroupId="airspace"
          prerequisitesMet={true}
          isLoading={isLoadingAirspace}
          featureId="airspace_analysis"
        />
      </div>
      
      <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
        <div className="flex items-start gap-2">
          <Signal className="w-4 h-4 text-gray-500 mt-0.5" />
          <p>
            Terrain analysis is based on available digital elevation models. While accurate for general planning, 
            always maintain visual awareness during flight operations and comply with regulations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TerrainAnalysisDashboard;