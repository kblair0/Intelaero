"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
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
  const { elevationService } = useMapContext();
  
  // Use useMemo to create a stable stations object that only updates when the underlying data changes
  const stations = useMemo(() => ({
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
  }), [
    gcsLocation, observerLocation, repeaterLocation,
    gcsElevationOffset, observerElevationOffset, repeaterElevationOffset,
    markerConfigs,
    setGcsElevationOffset, setObserverElevationOffset, setRepeaterElevationOffset
  ]);
  
  const station = stations[stationType];
  const [localError, setLocalError] = useState<string | null>(null);
  
  //logging the context values
  useEffect(() => {
    console.log(`[${new Date().toISOString()}] [StationAnalysisCard.tsx] MarkersContext:`, { 
      gcsLocation, 
      observerLocation, 
      repeaterLocation 
    });
    console.log(`[${new Date().toISOString()}] [StationAnalysisCard.tsx] Running station analysis, stationType:`, stationType);
    console.log(`[${new Date().toISOString()}] [StationAnalysisCard.tsx] Station data:`, station);
  }, [gcsLocation, observerLocation, repeaterLocation, station, stationType]);

  const handleRunStationAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    
    // Directly access the location for the specific station type to avoid race conditions
    let stationLocation;
    if (stationType === "gcs") {
      stationLocation = gcsLocation;
    } else if (stationType === "observer") {
      stationLocation = observerLocation;
    } else if (stationType === "repeater") {
      stationLocation = repeaterLocation;
    }
    
    if (!stationLocation || typeof stationLocation.lng !== 'number' || typeof stationLocation.lat !== 'number') {
      const errorMsg = `${stationType.toUpperCase()} location not set or invalid`;
      setError(errorMsg);
      setLocalError(errorMsg);
      console.log(`[${new Date().toISOString()}] [StationAnalysisCard.tsx] Invalid location for ${stationType}:`, stationLocation);
      return;
    }
    
    try {
      setError(null);
      setLocalError(null);

      if (elevationService) {
        try {
          await elevationService.ensureTerrainReady();
        } catch (e) {
          console.warn("Failed to ensure terrain readiness, continuing anyway:", e);
        }
      }

      trackEvent("station_analysis_start", { station: stationType });
      
      console.log(`[${new Date().toISOString()}] [StationAnalysisCard.tsx] Running analysis with:`, {
        stationType,
        location: stationLocation, 
        range: station.config.gridRange,
        elevationOffset: station.elevationOffset
      });

      await gridAnalysisRef.current.runStationAnalysis({
        stationType,
        location: stationLocation,
        range: station.config.gridRange,
        elevationOffset: station.elevationOffset,
      });

      trackEvent("station_analysis_success", { station: stationType });
    } catch (err: any) {
      console.error("Station analysis error:", err);
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
    }
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
    return () => {
      unsubscribe();
    };
  }, [station.layerId]);
  
  // Determine the current station location for the specific type
  const currentLocation = 
    stationType === "gcs" ? gcsLocation :
    stationType === "observer" ? observerLocation :
    repeaterLocation;

  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{getStationDisplayName()} Analysis</h2>
        {currentLocation && layerManager.isLayerVisible(station.layerId) !== undefined && (
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
      {!currentLocation ? (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
          ⚠️ Please place a {getStationDisplayName()} marker on the map to enable analysis.
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs">
            <p>
              <strong>Location:</strong>{" "}
              {currentLocation
                ? `${currentLocation.lat.toFixed(3)}, ${currentLocation.lng.toFixed(3)}`
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
            disabled={isAnalyzing || !currentLocation}
            className={`w-full py-1 rounded mt-3 ${
              isAnalyzing || !currentLocation
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
            }`}
          >
            {isAnalyzing ? "Analysing..." : "Run Analysis"}
          </button>
        </>
      )}
      {results && results.stats && currentLocation && (
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