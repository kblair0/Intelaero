// src/app/components/Analyses/LOSAnalyses/UI/MergedAnalysisCard.tsx
"use client";

import React, { useState } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";

interface MergedAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

const MergedAnalysisCard: React.FC<MergedAnalysisCardProps> = ({ gridAnalysisRef }) => {
  const { gcsLocation, observerLocation, repeaterLocation } = useMarkersContext();
  const { markerConfigs, isAnalyzing, setError, setIsAnalyzing, results, setResults } = useLOSAnalysis();
  
  const availableStations = [
    { type: "gcs", location: gcsLocation, config: markerConfigs.gcs },
    { type: "observer", location: observerLocation, config: markerConfigs.observer },
    { type: "repeater", location: repeaterLocation, config: markerConfigs.repeater }
  ].filter(station => station.location !== null);

  const [localError, setLocalError] = useState<string | null>(null);

  const handleRunMergedAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    if (availableStations.length < 2) {
      setError("At least two stations are required for merged analysis");
      setLocalError("At least two stations are required for merged analysis");
      return;
    }
    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent("merged_analysis_start", {});
      const mergedResults = await gridAnalysisRef.current.runMergedAnalysis(availableStations);
      setResults(mergedResults);
      trackEvent("merged_analysis_success", {});
    } catch (err: any) {
      setError(err.message || "Merged analysis failed");
      setLocalError(err.message || "Merged analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Merged Analysis</h2>
      <p className="text-sm mb-2">
        This analysis combines visibility from all available stations.
      </p>
      <button
        onClick={handleRunMergedAnalysis}
        disabled={isAnalyzing}
        className={`w-full py-2 rounded ${
          isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {isAnalyzing ? "Analyzing..." : "Run Merged Analysis"}
      </button>
      {results && results.stats && (
        <div className="mt-4">
          <p className="text-sm">
            <strong>Visible Areas:</strong> {results.stats.visibleCells} / {results.stats.totalCells}
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

export default MergedAnalysisCard;
