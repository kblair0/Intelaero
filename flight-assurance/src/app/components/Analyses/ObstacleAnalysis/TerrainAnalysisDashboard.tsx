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
 * - Focuses on three main obstacle analysis types
 * - Uses a clear, non-collapsible section layout
 * 
 * Related Files:
 * - ChecklistContext.tsx: Provides state and steps for guided workflow
 * - FlightPlanContext.tsx: Provides flight plan data
 * - AreaOfOpsContext.tsx: Provides area of operations data
 * - ObstacleAnalysisContext.tsx: Provides terrain analysis functionality
 */

import React, { useState, useEffect } from 'react';
import { useChecklistContext } from '../../../context/ChecklistContext';
import { useFlightPlanContext } from '../../../context/FlightPlanContext';
import { useAreaOfOpsContext } from '../../../context/AreaOfOpsContext';
import { useObstacleAnalysis } from '../../../context/ObstacleAnalysisContext';
import { useLayers } from '../../../hooks/useLayers';
import { useAreaOpsProcessor } from '../../AO/Hooks/useAreaOpsProcessor';
import { trackEventWithForm as trackEvent } from '../../tracking/tracking';
import { 
  Mountain, 
  Plane, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Signal,
  Loader
} from 'lucide-react';

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
  isLoading
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
              Analyzing...
            </span>
          ) : buttonText}
        </button>
      </div>
    </div>
  );
};

const TerrainAnalysisDashboard: React.FC<TerrainAnalysisDashboardProps> = ({ onClose }) => {
  // Track focused section (from checklist guidance)
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const { 
    checks, 
    guidedTarget, 
    completeCheck 
  } = useChecklistContext();
  
  const { flightPlan } = useFlightPlanContext();
  const { aoGeometry, aoTerrainGrid } = useAreaOfOpsContext();
  const { runAOAnalysis, status: analysisStatus } = useObstacleAnalysis();
  const { togglePowerlines } = useLayers();
  const { generateTerrainGrid } = useAreaOpsProcessor();
  
  // Update analyzing state based on analysis status
  useEffect(() => {
    setIsAnalyzing(analysisStatus === 'loading');
  }, [analysisStatus]);
  
  // Track which checklist actions should focus sections
  useEffect(() => {
    if (guidedTarget) {
      const { action } = guidedTarget;
      
      // Map actions to sections
      const actionToSection: Record<string, string> = {
        analyseTerrainInAO: 'terrainProfile',
        togglePowerlines: 'powerline',
        toggleAirspace: 'airspace'
      };
      
      const section = actionToSection[action];
      if (section) {
        setFocusedSection(section);
      }
    }
  }, [guidedTarget]);

  /**
   * Handles running terrain analysis for Area of Operations
   */
  const handleRunAOAnalysis = async () => {
    trackEvent("run_ao_terrain_analysis", { panel: "TerrainAnalysisDashboard.tsx" });
    setIsAnalyzing(true);
    setLocalError(null);
    
    try {
      let terrainGrid = aoTerrainGrid;
      
      if (!terrainGrid || terrainGrid.length === 0) {
        console.log("Generating AO terrain grid before analysis");
        terrainGrid = await generateTerrainGrid();
      }
      
      if (terrainGrid && terrainGrid.length > 0) {
        console.log("Running AO analysis with grid:", terrainGrid.length, "cells");
        
        // Complete checklist item if available
        const checkId = checks.find(c => 
          c.group === 'terrainProfile' && 
          c.status === 'pending'
        )?.id;
        
        if (checkId) completeCheck(checkId);
        
        await runAOAnalysis(terrainGrid);
      } else {
        console.error("Failed to generate terrain grid:", terrainGrid);
        throw new Error("No terrain grid available for analysis");
      }
    } catch (error) {
      console.error("AO terrain analysis error:", error);
      setLocalError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Handles toggling powerlines layer
   */
  const handleTogglePowerlines = () => {
    trackEvent("powerlines_add_overlay_click", { panel: "TerrainAnalysisDashboard.tsx" });
    trackEvent("DYBDpowerlines_add_overlay_click", { panel: "TerrainAnalysisDashboard.tsx" });
    
    // Complete checklist item if available
    const checkId = checks.find(c => 
      c.group === 'powerline' && 
      c.status === 'pending'
    )?.id;
    
    if (checkId) completeCheck(checkId);
    
    togglePowerlines();
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
      
      <div className="space-y-4">
        {/* Terrain Profile Analysis Section */}
        <AnalysisSection
          title="Terrain Profile Analysis"
          description="Analyse terrain elevation across your operating area."
          icon={<Mountain className="w-4 h-4" />}
          buttonText="Analyse Terrain in AO"
          onButtonClick={handleRunAOAnalysis}
          checklistGroupId="terrainProfile"
          prerequisitesMet={!!aoGeometry}
          prerequisitesMessage={!aoGeometry ? "Please define an operating area first" : undefined}
          isLoading={isAnalyzing}
        />
        
        {/* Powerline Analysis Section */}
        <AnalysisSection
          title="Powerline Analysis"
          description="Show LV and HV powerlines in your operating area."
          icon={<Zap className="w-4 h-4" />}
          buttonText="Show Powerlines"
          onButtonClick={handleTogglePowerlines}
          checklistGroupId="powerline"
          prerequisitesMet={true} // Always available
        />
        
        {/* Airspace Analysis Section */}
        <AnalysisSection
          title="Airspace Analysis"
          description="View airspace information in your operating area."
          icon={<Plane className="w-4 h-4" />}
          buttonText="Show Airspace"
          onButtonClick={() => {
            // Simulate completing a checklist item
            const checkId = checks.find(c => 
              c.group === 'airspace' && 
              c.status === 'pending'
            )?.id;
            
            if (checkId) completeCheck(checkId);
            
            console.log("Show airspace data");
          }}
          checklistGroupId="airspace"
          prerequisitesMet={true} // Always available
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