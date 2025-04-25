// PlanVerification/Cards/TerrainAnalysisCard.tsx
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
import { useAreaOpsProcessor } from "../../AO/Hooks/useAreaOpsProcessor";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";
import { useLayers } from "../../../hooks/useLayers";
import dynamic from 'next/dynamic';
import { layerManager } from "../../../services/LayerManager";

const ObstacleChartModal = dynamic(
  () => import('../../Analyses/ObstacleAnalysis/ObstacleChartModal'),
  { ssr: false }
);

const TerrainAnalysisCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan
}) => {
  // Move Hooks to the top level
  const { 
    results, 
    status: analysisStatus, 
    error: analysisError, 
    runAnalysis,
    runAOAnalysis,
    clearResults
  } = useObstacleAnalysis();
  const { map, elevationService } = useMapContext();
  const context = useAreaOfOpsContext();
  const { togglePowerlines } = useLayers();
  const { generateTerrainGrid, processAreaOfOperations, generateAOFromFlightPlan } = useAreaOpsProcessor();
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localBufferDistance, setLocalBufferDistance] = useState<number>(context?.bufferDistance ?? 500);

  useEffect(() => {
    setLocalBufferDistance(context?.bufferDistance ?? 500);
  }, [context?.bufferDistance]);

  useEffect(() => {
    setIsAnalyzing(analysisStatus === 'loading');
    if (analysisStatus === 'error' && analysisError) {
      setLocalError(analysisError);
    } else {
      setLocalError(null);
    }
  }, [analysisStatus, analysisError]);

  // Early return after Hooks
  if (!context) {
    console.error("AreaOfOpsContext is not available");
    return <div>Error: Area of Operations context not initialized</div>;
  }

  const { aoGeometry, aoTerrainGrid, bufferDistance, setBufferDistance, setAoTerrainGrid } = context;
  // ... rest of the component remains unchanged (same as provided previously)

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

  const handleResetAnalysis = () => {
    console.log("Resetting terrain analysis completely");
    trackEvent("reset_terrain_analysis", { panel: "terrainanalysis.tsx" });
    
    // Clear analysis results from context
    clearResults();
    
    // Clear the AO terrain grid from context while preserving the AO boundaries
    setAoTerrainGrid(null);
    
    // Hide terrain analysis visualization layers if map is available
    if (map) {
      // Hide and remove AO terrain grid visualization
      if (layerManager.isLayerVisible(layerManager.MAP_LAYERS.AOTERRAIN_GRID)) {
        layerManager.setLayerVisibility(layerManager.MAP_LAYERS.AOTERRAIN_GRID, false);
        layerManager.removeLayer(layerManager.MAP_LAYERS.AOTERRAIN_GRID);
      }
    }
    
    // Reset local error state
    setLocalError(null);
    
    // Reset local analyzing state
    setIsAnalyzing(false);
    
    // Close any open popups/modals
    setShowTerrainPopup(false);
  };

  const handleTogglePowerlines = () => {
    trackEvent("powerlines_add_overlay_click", { panel: "terrainanalysis.tsx" });
    trackEvent("DYBDpowerlines_add_overlay_click", { panel: "terrainanalysis.tsx" });
    togglePowerlines();
  };

  const openDetailedAnalysis = () => {
    console.log("Opening detailed terrain analysis...");
    trackEvent("view_detailed_terrain_analysis", { panel: "terrainanalysis.tsx" });
    setShowTerrainPopup(true);
  };

  const handleBufferDistanceChange = (newDistance: number) => {
    setLocalBufferDistance(newDistance);
    setBufferDistance(newDistance);
    trackEvent("ao_buffer_distance_changed", { panel: "terrainanalysis.tsx", bufferDistance: newDistance });

    if (flightPlan) {
      console.log(`Regenerating AO with buffer distance: ${newDistance}m`);
      generateAOFromFlightPlan(flightPlan, true);
    }
  };

  const getVerificationStatus = (): VerificationStatus => {
    if (analysisStatus === 'loading') return 'loading';
    if (analysisStatus === 'error') return 'error';
    
    if (!flightPlan && !aoGeometry) return 'pending';
    
    if (results && analysisStatus === 'success') {
      return getTerrainAnalysisStatus(results);
    }
    
    return 'pending';
  };

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

    if (analysisStatus === 'success' && results) {
      const isSafe = results.minimumClearance >= 0;
      const isAoOnly = !flightPlan && aoGeometry;
      
      return (
        <div>
          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Minimum Clearance:</div>
              <div className={isSafe ? "text-green-600" : "text-red-600"}>
                {results.minimumClearance.toFixed(1)}m
              </div>
              
              {!isAoOnly && (
                <>
                  <div>Critical Point:</div>
                  <div>
                    {results.criticalPointDistance !== null 
                      ? formatDistance(results.criticalPointDistance)
                      : 'N/A'}
                  </div>
                </>
              )}
              
              <div>Highest Obstacle:</div>
              <div>{results.highestObstacle.toFixed(1)}m</div>
              
              <div>Status:</div>
              <div className={isSafe ? "text-green-600" : "text-red-600"}>
                {isSafe 
                  ? isAoOnly 
                    ? "✓ Safe operational area" 
                    : "✓ Safe flight path"
                  : isAoOnly 
                    ? "✗ Terrain obstacle detected in AO" 
                    : "✗ Terrain collision detected"
                }
              </div>
              
              {isAoOnly && (
                <>
                  <div>Reference Altitude:</div>
                  <div>{results.flightAltitudes[0].toFixed(1)}m</div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            {!isAoOnly && (
              <button
                onClick={openDetailedAnalysis}
                className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
              >
                <Mountain className="w-4 h-4" />
                View Detailed Analysis
              </button>
            )}
            
            <button 
              onClick={handleTogglePowerlines}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
            >
              ⚡ Toggle Powerlines
            </button>

            <button 
              onClick={handleResetAnalysis}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset Analysis To Start Others
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="text-sm text-gray-600 mb-4">
          {hasFlightPlan && hasAOGeometry
            ? "Flight plan and Area of Operations loaded. Run analysis to check terrain."
            : hasFlightPlan
              ? "Flight plan loaded. Run analysis to check for terrain obstacles."
              : "Area of Operations defined. Run analysis to check terrain in this area."}
        </p>
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
          {hasAOGeometry && (
            <button
              onClick={async () => {
                trackEvent("run_ao_terrain_analysis", { panel: "terrainanalysis.tsx" });
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
              }}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isAnalyzing || !map || !elevationService || !hasAOGeometry}
            >
              <Mountain className="w-4 h-4" />
              {isAnalyzing ? "Analyzing..." : "Analyse Terrain In AO"}
            </button>
          )}
          <button
            onClick={handleTogglePowerlines}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
          >
            ⚡ Toggle Powerlines
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