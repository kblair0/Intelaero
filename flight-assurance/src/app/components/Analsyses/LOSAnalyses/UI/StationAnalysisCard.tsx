"use client";

import React, { useState, useEffect } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";

interface StationAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
  stationType: "gcs" | "observer" | "repeater";
}

const StationAnalysisCard: React.FC<StationAnalysisCardProps> = ({ gridAnalysisRef, stationType }) => {
  const {
    gcsLocation,
    observerLocation,
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset,
    setGcsElevationOffset,
    setObserverElevationOffset,
    setRepeaterElevationOffset,
  } = useMarkersContext();
  const { markerConfigs, setMarkerConfig, isAnalyzing, setError, setIsAnalyzing, results, gridSize, setGridSize } =
    useLOSAnalysis();


  const stations = {
    gcs: {
      location: gcsLocation,
      config: markerConfigs.gcs,
      elevationOffset: gcsElevationOffset,
      setElevationOffset: setGcsElevationOffset,
      layerId: MAP_LAYERS.GCS_GRID,
    },
    observer: {
      location: observerLocation,
      config: markerConfigs.observer,
      elevationOffset: observerElevationOffset,
      setElevationOffset: setObserverElevationOffset,
      layerId: MAP_LAYERS.OBSERVER_GRID,
    },
    repeater: {
      location: repeaterLocation,
      config: markerConfigs.repeater,
      elevationOffset: repeaterElevationOffset,
      setElevationOffset: setRepeaterElevationOffset,
      layerId: MAP_LAYERS.REPEATER_GRID,
    },
  };
  const station = stations[stationType];
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleLayerVisibility = () => {
    layerManager.toggleLayerVisibility(station.layerId);
    setLayerVisibility((prev) => !prev);
  };

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  useEffect(() => {
    const unsubscribe = layerManager.addEventListener((event, layerId) => {
      if (
        layerId === station.layerId &&
        (event === "visibilityChange" || event === "layerAdded")
      ) {
        forceUpdate();
      }
    });
    return unsubscribe;
  }, [station.layerId]);
  

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
        range: station.config.gridRange,
        elevationOffset: station.elevationOffset,
      });
      trackEvent("station_analysis_success", { station: stationType });
    } catch (err: any) {
      setError(err.message || "Station analysis failed");
      setLocalError(err.message || "Station analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStationDisplayName = () => {
    switch (stationType) {
      case "gcs":
        return "GCS";
      case "observer":
        return "Observer";
      case "repeater":
        return "Repeater";
      default:
        return stationType.toUpperCase();
    }
  };

  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{getStationDisplayName()} Analysis</h2>
        {station.location && layerManager.isLayerVisible(station.layerId) !== undefined && (

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Show/Hide</span>
            <label className="toggle-switch">
            <input
                type="checkbox"
                checked={layerManager.isLayerVisible(station.layerId)}
                onChange={() => layerManager.toggleLayerVisibility(station.layerId)}
                disabled={isAnalyzing}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        )}
      </div>
      {!station.location ? (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
          ⚠️ Please place a {getStationDisplayName()} marker on the map to enable analysis.
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs">
            <p>
              <strong>Location:</strong>{" "}
              {station.location
                ? `${station.location.lat.toFixed(3)}, ${station.location.lng.toFixed(3)}`
                : "Not set"}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-600">Adjust Grid Range (m):</label>
                <span className="text-xs text-gray-600">{station.config.gridRange}m</span>
              </div>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={station.config.gridRange}
                onChange={(e) => setMarkerConfig(stationType, { gridRange: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={isAnalyzing}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>500m</span>
                <span>5000m</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-600">Grid Size (m):</label>
                <span className="text-xs text-gray-600">{gridSize === 30 ? "30m: SRTM" : `${gridSize}m`}</span>
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1m</span>
                <span>100m</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The lower the number, the higher the fidelity
              </p>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Elevation Offset (m)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={station.elevationOffset}
                  onChange={(e) => station.setElevationOffset(Number(e.target.value))}
                  className="w-16 h-6 p-1 border rounded text-sm"
                  disabled={isAnalyzing}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Height of the station above ground (0-100m)
              </p>
            </div>
          </div>
          <button
            onClick={handleRunStationAnalysis}
            disabled={isAnalyzing || !station.location}
            className={`w-full py-1 rounded mt-3 ${
              isAnalyzing || !station.location
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
            }`}
          >
            {isAnalyzing ? "Analysing..." : "Run Analysis"}
          </button>
        </>
      )}
      {results && results.stats && station.location && (
        <div className="mt-4">
          <p className="text-xs">
            <strong>Visible Cells:</strong> {results.stats.visibleCells} /{" "}
            {results.stats.totalCells}
          </p>
          <p className="text-xs">
            <strong>Avg Visibility:</strong> {results.stats.averageVisibility.toFixed(1)}%
          </p>
          <p className="text-xs">
            <strong>Time:</strong> {(results.stats.analysisTime / 1000).toFixed(1)}s
          </p>
        </div>
      )}
      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default StationAnalysisCard;