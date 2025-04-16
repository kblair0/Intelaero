"use client";

import React, { useState } from "react";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";

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

  return (
    <div className="p-3 bg-white rounded shadow mb-4">
      <h2 className="text-sm font-semibold mb-2">Flight Path Analysis</h2>
      
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
        {isAnalyzing ? "Analyzing..." : "Run Flight Path Analysis"}
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
