// src/app/components/Analyses/LOSAnalyses/UI/FlightPathAnalysisCard.tsx
"use client";

import React, { useState } from "react";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";

interface FlightPathAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

const FlightPathAnalysisCard: React.FC<FlightPathAnalysisCardProps> = ({ gridAnalysisRef }) => {
  const { isAnalyzing, results, setError, setIsAnalyzing } = useLOSAnalysis();
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
    <div className="p-4 bg-white rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Flight Path Analysis</h2>
      <button
        onClick={handleRunAnalysis}
        disabled={isAnalyzing}
        className={`w-full py-2 rounded ${
          isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {isAnalyzing ? "Analyzing..." : "Run Flight Path Analysis"}
      </button>
      {results && results.stats && (
        <div className="mt-4">
          <p className="text-sm">
            <strong>Visible Cells:</strong> {results.stats.visibleCells} / {results.stats.totalCells}
          </p>
          <p className="text-sm">
            <strong>Average Visibility:</strong> {results.stats.averageVisibility.toFixed(1)}%
          </p>
          <p className="text-sm">
            <strong>Analysis Time:</strong> {(results.stats.analysisTime / 1000).toFixed(1)}s
          </p>
        </div>
      )}
      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default FlightPathAnalysisCard;
