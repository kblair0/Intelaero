// src/app/components/Analyses/LOSAnalyses/UI/StationAnalysisCard.tsx
"use client";

import React, { useState } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";

interface StationAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
  stationType: "gcs" | "observer" | "repeater";
}

const StationAnalysisCard: React.FC<StationAnalysisCardProps> = ({ gridAnalysisRef, stationType }) => {
  const { gcsLocation, observerLocation, repeaterLocation } = useMarkersContext();
  const { markerConfigs, setMarkerConfig, isAnalyzing, setError, setIsAnalyzing, results } = useLOSAnalysis();

  const stations = {
    gcs: { location: gcsLocation, config: markerConfigs.gcs },
    observer: { location: observerLocation, config: markerConfigs.observer },
    repeater: { location: repeaterLocation, config: markerConfigs.repeater }
  };
  const station = stations[stationType];
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRunStationAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    if (!station.location) {
      setError(`${stationType.toUpperCase()} location not set`);
      setLocalError(`${stationType.toUpperCase()} location not set`);
      return;
    }
    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent("station_analysis_start", { station: stationType });
      await gridAnalysisRef.current.runStationAnalysis({
        stationType,
        location: station.location,
        range: station.config.gridRange
      });
      trackEvent("station_analysis_success", { station: stationType });
    } catch (err: any) {
      setError(err.message || "Station analysis failed");
      setLocalError(err.message || "Station analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">{stationType.toUpperCase()} Station Analysis</h2>
      <div className="mb-2 text-sm">
        <p>
          <strong>Location:</strong>{" "}
          {station.location ? `${station.location.lat.toFixed(3)}, ${station.location.lng.toFixed(3)}` : "Not set"}
        </p>
        <p>
          <strong>Grid Range:</strong> {station.config.gridRange}m
        </p>
      </div>
      <div className="mb-2">
        <label className="text-xs">Adjust Grid Range:</label>
        <input
          type="range"
          min="500"
          max="5000"
          step="100"
          value={station.config.gridRange}
          onChange={(e) => setMarkerConfig(stationType, { gridRange: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <button
        onClick={handleRunStationAnalysis}
        disabled={isAnalyzing}
        className={`w-full py-2 rounded ${
          isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {isAnalyzing ? "Analyzing..." : "Run Analysis"}
      </button>
      {results && results.stats && (
        <div className="mt-4">
          <p className="text-sm">
            <strong>Visible Cells:</strong> {results.stats.visibleCells} / {results.stats.totalCells}
          </p>
          <p className="text-sm">
            <strong>Avg Visibility:</strong> {results.stats.averageVisibility.toFixed(1)}%
          </p>
          <p className="text-sm">
            <strong>Time:</strong> {(results.stats.analysisTime / 1000).toFixed(1)}s
          </p>
        </div>
      )}
      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default StationAnalysisCard;
