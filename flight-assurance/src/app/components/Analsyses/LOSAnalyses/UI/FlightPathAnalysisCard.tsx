//src/app/components/Analsyses/LOSAnalyses/UI/FlightPathAnalysisCard.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";

interface FlightPathAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

const FlightPathAnalysisCard: React.FC<FlightPathAnalysisCardProps> = ({ gridAnalysisRef }) => {
  const {
    isAnalyzing,
    results,
    setError,
    setIsAnalyzing,
    gridSize,
    elosGridRange,
    setGridSize,
    setElosGridRange
  } = useLOSAnalysis();
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent("flight_path_analysis_start", {});
      await gridAnalysisRef.current.runFlightPathAnalysis();
      trackEvent("flight_path_analysis_success", {});
    } catch (err: any) {
      setError(err.message || "Flight path analysis failed");
      setLocalError(err.message || "Flight path analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  
  useEffect(() => {
    const unsubscribe = layerManager.addEventListener((event, layerId) => {
      if (
        layerId === MAP_LAYERS.ELOS_GRID &&
        (event === "visibilityChange" || event === "layerAdded")
      ) {
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className="p-3 bg-white rounded shadow mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-600">Show/Hide</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={layerManager.isLayerVisible(MAP_LAYERS.ELOS_GRID)}
            onChange={() => layerManager.toggleLayerVisibility(MAP_LAYERS.ELOS_GRID)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      <p className="text-xs mb-2">This analysis shows the ground features visible along the flight path within the specific analysis range.</p>
      {/* Slider for Analysis Range (Grid Range) */}
      <div className="mb-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-600">Analysis Range:</label>
          <span className="text-xs text-gray-600">{elosGridRange}m</span>
        </div>
        <input
          type="range"
          min="500"
          max="5000"
          step="100"
          value={elosGridRange}
          onChange={(e) => setElosGridRange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={isAnalyzing}
        />
      </div>
      
      {/* Slider for Grid Size */}
      <div className="mb-2">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-600">Grid Size:</label>
          <span className="text-xs text-gray-600">
            {gridSize === 30 ? "30m: SRTM" : `${gridSize}m`}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500">The lower the number, the higher the fidelity</p>
      </div>

      <button
        onClick={handleRunAnalysis}
        disabled={isAnalyzing}
        className={`w-full py-1 rounded ${
          isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
        }`}
      >
        {isAnalyzing ? "Analysing..." : "Run Flight Path Analysis"}
      </button>

      {results && results.stats && (
        <div className="mt-4">
          <p className="text-xs">
            <strong>Visible Cells:</strong> {results.stats.visibleCells} / {results.stats.totalCells}
          </p>
          <p className="text-xs">
            <strong>Average Visibility:</strong> {results.stats.averageVisibility.toFixed(1)}%
          </p>
          <p className="text-xs">
            <strong>Analysis Time:</strong> {(results.stats.analysisTime / 1000).toFixed(1)}s
          </p>
        </div>
      )}
      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default FlightPathAnalysisCard;
