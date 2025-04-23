/**
 * PlanVerification/Cards/TerrainAnalysisCard.tsx
 * 
 * Purpose:
 * Provides terrain obstacle analysis for flight plans.
 * This component wraps the existing ObstacleAnalysisDashboard with a simplified interface
 * for the verification dashboard.
 * 
 * This component:
 * - Handles terrain analysis initiation
 * - Manages terrain analysis modal display
 * - Provides summary data of terrain clearance
 * - Integrates with existing obstacle analysis functionality
 * 
 * Related Components:
 * - PlanVerificationDashboard: Renders this as a verification card
 * - ObstacleAnalysisDashboard: The main analysis component wrapped by this card
 * - ObstacleAnalysisContext: Provides analysis functionality and results
 */
'use client';
import React, { useState, useEffect } from "react";
import { 
  Mountain, 
  Loader, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { useObstacleAnalysis } from "../../../context/ObstacleAnalysisContext";
import { useMapContext } from "../../../context/mapcontext";
import { useAreaOfOpsContext } from "../../../context/AreaOfOpsContext";
import { VerificationCardProps, VerificationStatus } from "../Utils/types";
import { formatDistance, getTerrainAnalysisStatus } from "../Utils/terrainAnalysis";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";
import { useLayers } from "../../../hooks/useLayers";
import dynamic from 'next/dynamic';

// Dynamically import only the modal component
const ObstacleChartModal = dynamic(
    () => import('../../Analyses/ObstacleAnalysis/ObstacleChartModal'),
    { ssr: false }
  );
  
/**
 * Provides terrain obstacle analysis
 */
const TerrainAnalysisCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan
}) => {
  const { 
    results, 
    status: analysisStatus, 
    error: analysisError, 
    runAnalysis, 
    clearResults
  } = useObstacleAnalysis();
  const { map, elevationService } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { togglePowerlines } = useLayers();
  
  // Local state
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Update analyzing state based on context status
  useEffect(() => {
    setIsAnalyzing(analysisStatus === 'loading');
    
    if (analysisStatus === 'error' && analysisError) {
      setLocalError(analysisError);
    } else {
      setLocalError(null);
    }
  }, [analysisStatus, analysisError]);

  /**
   * Handles running terrain analysis
   */
  const handleRunAnalysis = () => {
    console.log("Attempting obstacle analysis with:", {
      map: !!map,
      elevationService: !!elevationService,
      flightPlan: !!flightPlan,
      isProcessed: flightPlan?.properties?.processed,
      status: analysisStatus,
    });
    
    if (!map || !elevationService || !flightPlan || !flightPlan.properties?.processed) {
      const errorMessage = "Cannot run analysis: missing prerequisites";
      console.error(errorMessage, {
        map: !!map,
        elevationService: !!elevationService,
        flightPlan: !!flightPlan,
        isProcessed: flightPlan?.properties?.processed,
      });
      setLocalError(errorMessage);
      return;
    }
    
    trackEvent("run_obstacle_analysis", { panel: "terrainanalysis.tsx" });
    console.log("Status before analysis:", analysisStatus);
    runAnalysis();
  };

  /**
   * Handles toggling powerlines layer
   */
  const handleTogglePowerlines = () => {
    trackEvent("powerlines_add_overlay_click", { panel: "terrainanalysis.tsx" });
    trackEvent("DYBDpowerlines_add_overlay_click", { panel: "terrainanalysis.tsx" });
    togglePowerlines();
  };

  /**
   * Opens the detailed terrain analysis modal
   */
  const openDetailedAnalysis = () => {
    console.log("Opening detailed terrain analysis...");
    trackEvent("view_detailed_terrain_analysis", { panel: "terrainanalysis.tsx" });
    setShowTerrainPopup(true);
  };

  /**
   * Get the verification status based on analysis results
   */
  const getVerificationStatus = (): VerificationStatus => {
    if (analysisStatus === 'loading') return 'loading';
    if (analysisStatus === 'error') return 'error';
    
    if (!flightPlan && !aoGeometry) return 'pending';
    
    // If we have results, determine status based on clearance
    if (results && analysisStatus === 'success') {
      return getTerrainAnalysisStatus(results);
    }
    
    // Otherwise show pending
    return 'pending';
  };
  
  // Get card content based on analysis state
  const getCardContent = () => {
    const hasAOGeometry = aoGeometry && aoGeometry.features.length > 0;
    const hasFlightPlan = !!flightPlan;
    
    // No flight plan or AO case
    if (!hasFlightPlan && !hasAOGeometry) {
      return (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Upload a flight plan or define an Area of Operations to begin analysis.
          </p>
        </div>
      );
    }
    
    // AO-only case
    if (!hasFlightPlan && hasAOGeometry) {
      return (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Area of Operations defined. Run analysis to check terrain in this area.
          </p>
          <button
            onClick={() => {
              trackEvent("run_ao_terrain_analysis", { panel: "terrainanalysis.tsx" });
              setIsAnalyzing(true);
              
              // Implementation of AO processing would go here
              // This would typically call a function from useAreaOpsProcessor
              
              setTimeout(() => {
                setIsAnalyzing(false);
                console.log("AO terrain analysis complete");
              }, 1000);
            }}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isAnalyzing || !map || !elevationService || !hasAOGeometry}
          >
            <Mountain className="w-4 h-4" />
            {isAnalyzing ? "Analyzing..." : "Analyse Terrain In AO"}
          </button>
        </div>
      );
    }
    
    // Flight plan with no analysis run yet
    if (analysisStatus === 'idle' && hasFlightPlan) {
      return (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Flight plan loaded. Run analysis to check for terrain obstacles.
          </p>
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleRunAnalysis} 
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={analysisStatus === 'loading' || !map || !elevationService || !flightPlan || !flightPlan.properties?.processed}
            >
              <Mountain className="w-4 h-4" />
              {analysisStatus === 'loading' ? 'Analyzing...' : 'Analyse Terrain Obstacles'}
            </button>
            <button 
              onClick={handleTogglePowerlines}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
            >
              ⚡ Toggle Powerlines
            </button>
          </div>
        </div>
      );
    }
    
    // Analysis is loading
    if (analysisStatus === 'loading') {
      return (
        <div className="flex items-center gap-2 p-2 text-blue-700">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing terrain obstacles...</span>
        </div>
      );
    }
    
    // Analysis error
    if (analysisStatus === 'error') {
      return (
        <div>
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
            <p>Error analyzing terrain: {localError || "Unknown error"}</p>
          </div>
          <button 
            onClick={() => {
              console.log("Retrying obstacle analysis...");
              trackEvent("retry_obstacle_analysis", { panel: "terrainanalysis.tsx" });
              runAnalysis();
            }} 
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Analysis
          </button>
        </div>
      );
    }
    
    // Analysis complete with results
    if (analysisStatus === 'success' && results) {
      const isSafe = results.minimumClearance >= 0;
      
      return (
        <div>
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Minimum Clearance:</div>
              <div className={isSafe ? "text-green-600" : "text-red-600"}>
                {results.minimumClearance.toFixed(1)}m
              </div>
              
              <div>Critical Point:</div>
              <div>
                {results.criticalPointDistance !== null 
                  ? formatDistance(results.criticalPointDistance)
                  : 'N/A'}
              </div>
              
              <div>Highest Obstacle:</div>
              <div>{results.highestObstacle.toFixed(1)}m</div>
              
              <div>Status:</div>
              <div className={isSafe ? "text-green-600" : "text-red-600"}>
                {isSafe ? "✓ Safe flight path" : "✗ Terrain collision detected"}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <button
              onClick={openDetailedAnalysis}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
            >
              <Mountain className="w-4 h-4" />
              View Detailed Analysis
            </button>
            
            <button 
              onClick={handleTogglePowerlines}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
            >
              ⚡ Toggle Powerlines
            </button>
          </div>
        </div>
      );
    }
    
    // Default fallback
    return (
      <div>
        <p className="text-sm text-gray-600">
          Ready to analyze terrain. Click the button below to start.
        </p>
        <button 
          onClick={handleRunAnalysis}
          className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
        >
          <Mountain className="w-4 h-4" />
          Run Analysis
        </button>
      </div>
    );
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {getVerificationStatus() === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
          {getVerificationStatus() === "error" && <XCircle className="w-5 h-5 text-red-500" />}
          {getVerificationStatus() === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          {getVerificationStatus() === "loading" && <Loader className="w-5 h-5 text-blue-500 animate-spin" />}
          {getVerificationStatus() === "pending" && <Mountain className="w-5 h-5 text-gray-400" />}
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Terrain Analysis</h3>
              <a
                href="https://youtu.be/H1JveIqB_v4"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex gap-1 items-center"
                aria-label="Watch YouTube guide for Terrain Analysis"
              >
                <svg
                  className="w-5 h-5 text-red-600 hover:text-red-700 transition-colors"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.5 6.2c-.3-1.1-1.1-2-2.2-2.3C19.1 3.5 12 3.5 12 3.5s-7.1 0-9.3.4c-1.1.3-1.9 1.2-2.2 2.3C.5 8.4.5 12 .5 12s0 3.6.4 5.8c.3 1.1 1.1 2 2.2 2.3 2.2.4 9.3.4 9.3.4s7.1 0 9.3-.4c-1.1-.3 1.9-1.2 2.2-2.3.4-2.2.4-5.8.4-5.8s0-3.6-.4-5.8zM9.8 15.5V8.5l6.2 3.5-6.2 3.5z" />
                </svg>
                <span className="text-xs text-red-600 hover:text-red-700 transition-colors">Guide</span>
              </a>
            </div>
            <p className="text-sm text-gray-500">Analyze terrain clearance for the flight plan</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          {getCardContent()}
        </div>
      )}
      
      {/* Terrain Analysis Modal */}
      {showTerrainPopup && results && (
        <ObstacleChartModal 
          onClose={() => {
            setShowTerrainPopup(false);
            setIsAnalyzing(false);
          }}
          title="Detailed Terrain Analysis"
        />
      )}
    </div>
  );
};

export default TerrainAnalysisCard;