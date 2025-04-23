"use client";

import React, { useState, useEffect } from "react";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";
import { useMarkersContext } from "../../../../context/MarkerContext";

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
  const { 
    gcsLocation, 
    observerLocation, 
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset
  } = useMarkersContext();
  const { elevationService, map } = useMapContext();
  const [localError, setLocalError] = useState<string | null>(null);
  const [showVisibilityLayer, setShowVisibilityLayer] = useState<boolean>(true);

  // Track which analysis types are available
  const [analysisTypes, setAnalysisTypes] = useState({
    gridAnalysis: true,
    visibilityAnalysis: true
  });

  // Run grid-based flight path analysis
  const handleRunGridAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    try {
      console.log(`[${new Date().toISOString()}] [flightpathanalysis] Setting isAnalyzing to true`);
      
      setError(null);
      setLocalError(null);
      trackEvent("flight_path_analysis_start", {
        gridSize,
        analysisRange: elosGridRange,
        usingElevationService: !!elevationService,
        analysisType: "grid"
      });

      await gridAnalysisRef.current.runFlightPathAnalysis();

      trackEvent("flight_path_analysis_success", {
        gridSize,
        analysisRange: elosGridRange,
        usingElevationService: !!elevationService,
        analysisType: "grid"
      });
    } catch (err: any) {
      setError(err.message || "Flight path analysis failed");
      setLocalError(err.message || "Flight path analysis failed");

      trackEvent("flight_path_analysis_error", {
        error: err.message,
        gridSize,
        analysisRange: elosGridRange,
        usingElevationService: !!elevationService,
        analysisType: "grid"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run flight path visibility analysis (line of sight along path)
  const handleRunVisibilityAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }

    // Verify we have at least one station placed
    const availableStations = [
      { type: 'gcs', location: gcsLocation, elevationOffset: gcsElevationOffset },
      { type: 'observer', location: observerLocation, elevationOffset: observerElevationOffset },
      { type: 'repeater', location: repeaterLocation, elevationOffset: repeaterElevationOffset }
    ].filter(station => station.location !== null);

    if (availableStations.length === 0) {
      setError("At least one station (GCS, Observer, or Repeater) must be placed on the map");
      setLocalError("At least one station (GCS, Observer, or Repeater) must be placed on the map");
      return;
    }

    try {
      console.log(`[${new Date().toISOString()}] [flightpathanalysis] Setting isAnalyzing to true for visibility analysis`);
      
      setError(null);
      setLocalError(null);
      trackEvent("flight_path_visibility_analysis_start", {
        stations: availableStations.length,
        usingElevationService: !!elevationService,
      });

      await gridAnalysisRef.current.runFlightPathVisibilityAnalysis({
        sampleInterval: 10, // 10 meter intervals
        showLayer: showVisibilityLayer
      });

      trackEvent("flight_path_visibility_analysis_success", {
        stations: availableStations.length,
        usingElevationService: !!elevationService,
      });
    } catch (err: any) {
      setError(err.message || "Flight path visibility analysis failed");
      setLocalError(err.message || "Flight path visibility analysis failed");

      trackEvent("flight_path_visibility_analysis_error", {
        error: err.message,
        stations: availableStations.length,
        usingElevationService: !!elevationService,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = layerManager.addEventListener((event, layerId) => {
      if (
        (layerId === MAP_LAYERS.ELOS_GRID || layerId === MAP_LAYERS.FLIGHT_PATH_VISIBILITY) &&
        (event === "visibilityChange" || event === "layerAdded")
      ) {
        // Update UI if needed
      }
    });

    return () => {
      unsubscribe(); // Call unsubscribe, discard boolean return value
    };
  }, []);

  // Check if flight path visibility analysis results are available
  const hasVisibilityResults = results?.flightPathVisibility !== undefined;

  return (
    <div className="p-3 bg-white rounded shadow mb-4">
      <div className="mb-3">
        <h3 className="font-medium text-gray-900 mb-2">Flight Path Analysis</h3>
        <p className="text-xs text-gray-600 mb-3">
          Analyze visibility along the flight path and identify areas with potential communication issues.
        </p>
      </div>

      {/* Grid Analysis Settings */}
      <div className="border-t border-gray-200 pt-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-600">Grid Visibility</span>
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
        <div className="mb-3">
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
          onClick={handleRunGridAnalysis}
          disabled={isAnalyzing}
          className={`w-full py-1 rounded ${
            isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
          }`}
        >
          {isAnalyzing ? "Analysing..." : "Run Grid Analysis"}
        </button>
      </div>

      {/* Flight Path Visibility Analysis Settings */}
      <div className="border-t border-gray-200 pt-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-600">Path Visibility</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={layerManager.isLayerVisible(MAP_LAYERS.FLIGHT_PATH_VISIBILITY)}
              onChange={() => layerManager.toggleLayerVisibility(MAP_LAYERS.FLIGHT_PATH_VISIBILITY)}
              disabled={!hasVisibilityResults}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <p className="text-xs mb-3">
          This analysis shows which parts of the flight path are visible from ground stations.
          Green sections are visible, red dashed sections are not visible from any station.
        </p>
        <button
          onClick={handleRunVisibilityAnalysis}
          disabled={isAnalyzing}
          className={`w-full py-1 rounded ${
            isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600 text-sm text-white"
          }`}
        >
          {isAnalyzing ? "Analysing..." : "Run Path Visibility Analysis"}
        </button>
      </div>

      {/* Grid Analysis Results */}
      {results && results.stats && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Grid Analysis Results</h4>
          <div className="bg-gray-50 p-2 rounded text-xs">
            <p><strong>Visible Cells:</strong> {results.stats.visibleCells} / {results.stats.totalCells}</p>
            <p><strong>Average Visibility:</strong> {results.stats.averageVisibility.toFixed(1)}%</p>
            <p><strong>Analysis Time:</strong> {(results.stats.analysisTime / 1000).toFixed(1)}s</p>
          </div>
        </div>
      )}

      {/* Flight Path Visibility Results */}
      {results && results.flightPathVisibility && (
        <div className="border-t border-gray-200 pt-3 mt-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Path Visibility Results</h4>
          <div className="bg-gray-50 p-2 rounded text-xs">
            <p>
              <strong>Visible Length:</strong> {(results.flightPathVisibility.visibleLength / 1000).toFixed(2)} km / {(results.flightPathVisibility.totalLength / 1000).toFixed(2)} km
            </p>
            <p>
              <strong>Coverage:</strong> {results.flightPathVisibility.coveragePercentage.toFixed(1)}%
            </p>
            
            {/* Per-station coverage details (if available) */}
            {results.flightPathVisibility.stationStats && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="font-medium mb-1">Station Coverage:</p>
                <ul className="space-y-1">
                  {results.flightPathVisibility.stationStats.map((stat, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{stat.stationType.toUpperCase()}:</span>
                      <span>{stat.coveragePercentage.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default FlightPathAnalysisCard;