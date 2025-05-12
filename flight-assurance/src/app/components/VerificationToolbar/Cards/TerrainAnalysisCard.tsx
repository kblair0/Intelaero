/**
 * TerrainAnalysisCard.tsx
 * 
 * Purpose: Provides a verification interface for terrain obstacle analysis
 * Displays analysis status and controls for running terrain analysis
 * Integrates with TerrainAnalysisDashboard via MapSidePanel in page.tsx
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
import { getTerrainAnalysisStatus } from "../Utils/terrainAnalysis";
import { useAreaOpsProcessor } from "../../AO/Hooks/useAreaOpsProcessor";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";
import dynamic from 'next/dynamic';
import { layerManager } from "../../../services/LayerManager";

// Dynamic imports for performance optimization
const ObstacleChartModal = dynamic(
  () => import('../../Analyses/ObstacleAnalysis/ObstacleChartModal'),
  { ssr: false }
);
const TerrainAnalysisDashboard = dynamic(
  () => import('../../Analyses/ObstacleAnalysis/TerrainAnalysisDashboard'),
  { ssr: false }
);

const TerrainAnalysisCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan,
  onTogglePanel
}) => {
  // Hooks for context and state management
  const { 
    results, 
    status: analysisStatus, 
    error: analysisError, 
    runAnalysis,
    clearResults
  } = useObstacleAnalysis();
  const { map, elevationService } = useMapContext();
  const context = useAreaOfOpsContext();
  const { generateAOFromFlightPlan } = useAreaOpsProcessor();
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localBufferDistance, setLocalBufferDistance] = useState<number>(context?.bufferDistance ?? 500);

  // Sync local buffer distance with context
  useEffect(() => {
    setLocalBufferDistance(context?.bufferDistance ?? 500);
  }, [context?.bufferDistance]);

  // Update analyzing state and error handling
  useEffect(() => {
    setIsAnalyzing(analysisStatus === 'loading');
    setLocalError(analysisStatus === 'error' && analysisError ? analysisError : null);
  }, [analysisStatus, analysisError]);

  // Early return if context is unavailable
  if (!context) {
    console.error("AreaOfOpsContext is not available");
    return <div>Error: Area of Operations context not initialized</div>;
  }

  const { aoGeometry, setBufferDistance, setAoTerrainGrid } = context;

  /**
   * Runs terrain obstacle analysis for the flight plan
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
   * Opens detailed terrain analysis popup
   */
  const openDetailedAnalysis = () => {
    console.log("Opening detailed terrain analysis...");
    trackEvent("view_detailed_terrain_analysis", { panel: "terrainanalysis.tsx" });
    setShowTerrainPopup(true);
  };

  /**
   * Toggles the terrain analysis side panel via parent
   */
  const handleToggleSidePanel = () => {
    console.log("Toggling terrain side panel");
    trackEvent("toggle_terrain_side_panel", { panel: "terrainanalysis.tsx" });
    onTogglePanel?.("terrain");
  };

  /**
   * Updates buffer distance and regenerates AO
   * @param newDistance - New buffer distance in meters
   */
  const handleBufferDistanceChange = (newDistance: number) => {
    setLocalBufferDistance(newDistance);
    setBufferDistance(newDistance);
    trackEvent("ao_buffer_distance_changed", { panel: "terrainanalysis.tsx", bufferDistance: newDistance });

    if (flightPlan) {
      console.log(`Regenerating AO with buffer distance: ${newDistance}m`);
      generateAOFromFlightPlan(flightPlan, true);
    }
  };

  /**
   * Determines the verification status based on analysis results
   * @returns Verification status
   */
  const getVerificationStatus = (): VerificationStatus => {
    if (analysisStatus === 'loading') return 'loading';
    if (analysisStatus === 'error') return 'error';
    
    if (!flightPlan && !aoGeometry) return 'pending';
    
    if (results && analysisStatus === 'success') {
      return getTerrainAnalysisStatus(results);
    }
    
    return 'pending';
  };

  /**
   * Renders the card content based on state
   * @returns JSX for card content
   */
  const getCardContent = () => {
    const hasAOGeometry = aoGeometry && aoGeometry.features.length > 0;
    const hasFlightPlan = !!flightPlan;

    if (!hasFlightPlan && !hasAOGeometry) {
      return (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Upload a flight plan or define an Area of Operations to begin analysis.
          </p>
        </div>
      );
    }

    if (analysisStatus === 'loading') {
      return (
        <div className="flex items-center gap-2 p-2 text-blue-700">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing terrain obstacles...</span>
        </div>
      );
    }

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

    return (
      <div>
        {hasFlightPlan && (
          <div className="mb-4">
            <label htmlFor="ao-buffer-slider" className="text-sm text-gray-600">
              AO Buffer Distance: {localBufferDistance}m
            </label>
            <input
              id="ao-buffer-slider"
              type="range"
              min="100"
              max="2000"
              step="50"
              value={localBufferDistance}
              onChange={(e) => handleBufferDistanceChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={!flightPlan || isAnalyzing}
            />
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          {hasFlightPlan && (
            <button
              onClick={handleRunAnalysis}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isAnalyzing || !map || !elevationService || !flightPlan || !flightPlan.properties?.processed}
            >
              <Mountain className="w-4 h-4" />
              {isAnalyzing ? "Analyzing..." : "Analyse Terrain Obstacles"}
            </button>
          )}
          <button
            onClick={handleToggleSidePanel}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            <Mountain className="w-4 h-4" />
            Open Terrain Dashboard
          </button>
        </div>
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
              <h3 className="font-medium text-gray-900">Terrain Analysis Tools</h3>
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
            <p className="text-sm text-gray-500">Analyse terrain and hazards</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          {getCardContent()}
        </div>
      )}
      
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