"use client";

/**
 * FlightPathAnalysisCard.tsx
 * 
 * UI component for flight path analysis that enables users to:
 * - Run grid-based analysis to identify visible areas along a flight path
 * - Analyze which parts of the flight path are visible from ground stations
 * - Toggle visibility layers on/off
 * - Configure analysis parameters
 */

import React, { useState, useEffect, useCallback } from "react";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";
import { useMarkersContext } from "../../../../context/MarkerContext";
// Import premium context for feature access
import { usePremium, TierLevel } from "../../../../context/PremiumContext";
import PremiumButton from "../../../UI/PremiumButton";


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
    setElosGridRange,
    progress,
    samplingResolution,
    setSamplingResolution
  } = useLOSAnalysis();
  
  // Use markers collection from context
  const { markers } = useMarkersContext();
  const { elevationService, map } = useMapContext();
  
  const [localError, setLocalError] = useState<string | null>(null);
  
  // States for layer visibility toggles
  const [showGridLayer, setShowGridLayer] = useState<boolean>(true);
  const [showVisibilityLayer, setShowVisibilityLayer] = useState<boolean>(true);
  
  // Keep track of which markers to include in visibility analysis
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<string[]>([]);

  //Premium Implementation
  const { tierLevel, getParameterLimits } = usePremium();
  // Get premium tier limits for parameters
  const gridRangeLimits = getParameterLimits('gridRange');
  const gridSizeLimits = getParameterLimits('gridSize');

  // Create handlers for each slider to enforce limits
  const handleGridSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    // Apply tier-based minimum limit
    const limitedValue = Math.max(newValue, gridSizeLimits.min);
    setGridSize(limitedValue);
  };

  const handleGridRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    // Apply tier-based maximum limit
    const limitedValue = Math.min(newValue, gridRangeLimits.max);
    setElosGridRange(limitedValue);
  };

  useEffect(() => {
    // Update toggle state when new results arrive
    if (results?.flightPathVisibility) {
      setShowVisibilityLayer(layerManager.isLayerVisible(MAP_LAYERS.FLIGHT_PATH_VISIBILITY));
    }
  }, [results]);

  // Initialize selected markers when available markers change
  useEffect(() => {
    // Default to selecting all available markers
    setSelectedMarkerIds(markers.map(marker => marker.id));
  }, [markers]);

  // Handle marker selection changes
  const handleMarkerSelectionChange = useCallback((markerId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedMarkerIds(prev => [...prev, markerId]);
    } else {
      setSelectedMarkerIds(prev => prev.filter(id => id !== markerId));
    }
  }, []);

  // Get selected markers for analysis
  const selectedMarkers = markers.filter(marker => 
    selectedMarkerIds.includes(marker.id)
  );

  // Run grid-based flight path analysis
  const handleRunGridAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      const errorMsg = "Analysis controller not initialized";
      setError(errorMsg);
      setLocalError(errorMsg);
      return;
    }
    
    try {
      setError(null);
      setLocalError(null);
      setIsAnalyzing(true);
      
      trackEvent("flight_path_analysis_start", {
        gridSize,
        analysisRange: elosGridRange,
        usingElevationService: !!elevationService,
        analysisType: "grid"
      });

      // Call the controller to run the analysis
      await gridAnalysisRef.current.runFlightPathAnalysis();

      trackEvent("flight_path_analysis_success", {
        gridSize,
        analysisRange: elosGridRange,
        usingElevationService: !!elevationService,
        analysisType: "grid"
      });
    } catch (err: any) {
      console.error("Flight path analysis error:", err);
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
      const errorMsg = "Analysis controller not initialized";
      setError(errorMsg);
      setLocalError(errorMsg);
      return;
    }

    // Verify we have at least one marker selected
    if (selectedMarkers.length === 0) {
      const errorMsg = "At least one station (GCS, Observer, or Repeater) must be selected for analysis";
      setError(errorMsg);
      setLocalError(errorMsg);
      return;
    }

    try {
      setError(null);
      setLocalError(null);
      setIsAnalyzing(true);
      
      trackEvent("flight_path_visibility_analysis_start", {
        markerCount: selectedMarkers.length,
        markerIds: selectedMarkerIds,
        usingElevationService: !!elevationService
      });

      // Call the controller to run the visibility analysis with selected marker IDs
      await gridAnalysisRef.current.runFlightPathVisibilityAnalysis({
        sampleInterval: 10, // 10 meter intervals
        showLayer: showVisibilityLayer,
        markerIds: selectedMarkerIds
      });

      trackEvent("flight_path_visibility_analysis_success", {
        markerCount: selectedMarkers.length,
        markerIds: selectedMarkerIds,
        usingElevationService: !!elevationService
      });
    } catch (err: any) {
      console.error("Flight path visibility analysis error:", err);
      setError(err.message || "Flight path visibility analysis failed");
      setLocalError(err.message || "Flight path visibility analysis failed");

      trackEvent("flight_path_visibility_analysis_error", {
        error: err.message,
        markerCount: selectedMarkers.length,
        markerIds: selectedMarkerIds,
        usingElevationService: !!elevationService
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get display name for a marker, including index if multiple of same type exist
  const getMarkerDisplayName = useCallback((marker: any) => {
    const typeName = {
      'gcs': 'GCS',
      'observer': 'Observer',
      'repeater': 'Repeater'
    }[marker.type];
    
    // Count markers of this type
    const typeMarkers = markers.filter(m => m.type === marker.type);
    
    // Add index if multiple markers of this type
    if (typeMarkers.length > 1) {
      const index = typeMarkers.findIndex(m => m.id === marker.id);
      return `${typeName} #${index + 1}`;
    }
    
    return typeName;
  }, [markers]);

  // Update layer visibility state when toggling layers
  const toggleGridLayerVisibility = useCallback(() => {
    layerManager.toggleLayerVisibility(MAP_LAYERS.ELOS_GRID);
  }, []);

const toggleVisibilityLayerVisibility = useCallback(() => {
  const newVisibility = !showVisibilityLayer;
  setShowVisibilityLayer(newVisibility);
  
  // Ensure layer exists before trying to toggle it
  if (hasVisibilityResults) {
    layerManager.setLayerVisibility(MAP_LAYERS.FLIGHT_PATH_VISIBILITY, newVisibility);
  }
}, [showVisibilityLayer, results]);

  // Listen for layer visibility changes
  useEffect(() => {
    const unsubscribe = layerManager.addEventListener((event, layerId) => {
      if (
        (layerId === MAP_LAYERS.ELOS_GRID || layerId === MAP_LAYERS.FLIGHT_PATH_VISIBILITY) &&
        (event === "visibilityChange" || event === "layerAdded")
      ) {
        // Update UI toggle states based on actual layer visibility
        if (layerId === MAP_LAYERS.ELOS_GRID) {
          setShowGridLayer(layerManager.isLayerVisible(layerId));
        } else if (layerId === MAP_LAYERS.FLIGHT_PATH_VISIBILITY) {
          setShowVisibilityLayer(layerManager.isLayerVisible(layerId));
        }
      }
    });

    return () => {
      unsubscribe(); // Clean up listener
    };
  }, []);

  // Handle abort of running analysis
  const handleAbortAnalysis = useCallback(() => {
    if (gridAnalysisRef.current && isAnalyzing) {
      gridAnalysisRef.current.abortAnalysis();
      setIsAnalyzing(false);
      setLocalError("Analysis aborted by user");
    }
  }, [gridAnalysisRef, isAnalyzing, setIsAnalyzing]);

  // Check if flight path visibility analysis results are available
  const hasVisibilityResults = results?.flightPathVisibility !== undefined;
  
  // Check if grid analysis results are available
  const hasGridResults = results?.cells?.length > 0;

  return (
    <div className="p-3 bg-white rounded shadow mb-4">
      <div className="mb-3">
        <h3 className="font-medium text-sm mb-2">Terrain Visibility Analysis</h3>
      </div>

      {/* Grid Analysis Section */}
      <div className="border-t border-gray-200 pt-3 mb-3">
        <p className="text-xs mb-2">This analysis shows which ground areas with the analysis range are visible from the flight path.</p>
        
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-600">Show Grid Layer</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showGridLayer}
              onChange={toggleGridLayerVisibility}
              disabled={!hasGridResults}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        <div className="mb-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-gray-600">Analysis Range:</label>
            <span className="text-xs text-gray-600">{elosGridRange}m</span>
          </div>
          <input
            type="range"
            min="500"
            max={gridRangeLimits.max}
            step="100"
            value={elosGridRange}
            onChange={handleGridRangeChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isAnalyzing}
          />
          {tierLevel < TierLevel.COMMERCIAL && (
            <p className="text-xs text-yellow-500 mt-1">
              Range limited to 500m. Upgrade for extended range.
            </p>
          )}
          <p className="text-xs text-gray-500">
            Only considers terrain within this distance of the flight path
          </p>
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
            min={gridSizeLimits.min}
            max="100"
            step="1"
            value={gridSize}
            onChange={handleGridSizeChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            disabled={isAnalyzing}
          />
          {tierLevel < TierLevel.COMMERCIAL && (
            <p className="text-xs text-yellow-500 mt-1">
              Minimum {gridSizeLimits.min}m grid size. Upgrade for higher resolution.
            </p>
          )}
          <p className="text-xs text-gray-500">The lower the number, the higher the fidelity</p>
        </div>

        <div className="mb-3">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-600">Flight Path Sampling:</label>
          <span className="text-xs text-gray-600">
            {samplingResolution}m
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="50"
          step="5"
          value={samplingResolution}
          onChange={(e) => setSamplingResolution(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          disabled={isAnalyzing}
        />
        <p className="text-xs text-gray-500">
          Distance between samples along the flight path. Lower values give more accurate results but take longer.
        </p>
      </div>
        
        <PremiumButton
          featureId="flight_path_analysis"
          onClick={handleRunGridAnalysis}
          disabled={isAnalyzing}
          className={`w-full py-1 rounded ${
            isAnalyzing ? "bg-gray-300 text-sm cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
          }`}
        >
          {isAnalyzing && progress > 0 && progress < 100
            ? `Analysing... ${progress.toFixed(0)}%`
            : isAnalyzing 
              ? "Analysing..."
              : "Run Grid Analysis"
          }
        </PremiumButton>
      </div>

      {/* Flight Path Visibility Section */}
      <div className="border-t border-gray-200 pt-3 mb-3">
        <h4 className="text-sm font-medium mb-2">Flight Path to Observer/Comms Visibilty</h4>
        <p className="text-xs mb-3">
          This analysis shows which parts of the flight path are visible from selected stations.
          Green sections are visible, red dashed sections are not visible from any station.
        </p>
        
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-600">Show Path Layer</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showVisibilityLayer}
              onChange={toggleVisibilityLayerVisibility}
              disabled={!hasVisibilityResults}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        {/* Marker selection for visibility analysis */}
        {markers.length > 0 ? (
          <div className="mb-3 border rounded p-2 bg-gray-50">
            <p className="text-xs font-medium mb-1">Select stations to include in analysis:</p>
            {markers.map((marker) => (
              <div key={marker.id} className="flex items-center mb-1">
                <input
                  type="checkbox"
                  id={`vis-marker-${marker.id}`}
                  checked={selectedMarkerIds.includes(marker.id)}
                  onChange={(e) => handleMarkerSelectionChange(marker.id, e.target.checked)}
                  className="mr-2"
                  disabled={isAnalyzing}
                />
                <label htmlFor={`vis-marker-${marker.id}`} className="text-xs">
                  {getMarkerDisplayName(marker)}
                </label>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-3 text-xs text-amber-600">
            Place at least one station (GCS, Observer, or Repeater) on the map to perform this analysis.
          </div>
        )}

        <PremiumButton
          featureId="flight_path_analysis" // Using the same feature ID since it's part of the same analysis
          onClick={handleRunVisibilityAnalysis}
          disabled={isAnalyzing || selectedMarkers.length === 0}
          className={`w-full py-1 rounded ${
            isAnalyzing || selectedMarkers.length === 0 
              ? "bg-gray-300 text-sm cursor-not-allowed" 
              : "bg-green-500 hover:bg-green-600 text-sm text-white"
          }`}
        >
          {isAnalyzing && progress > 0 && progress < 100
            ? `Analysing... ${progress.toFixed(0)}%`
            : isAnalyzing 
              ? "Analysing..."
              : "Run Path Visibility Analysis"
          }
        </PremiumButton>      
      </div>
      
      {/* Analysis in Progress */}
      {isAnalyzing && (
        <div className="mt-2 mb-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-600">{progress.toFixed(0)}% Complete</span>
            <button
              onClick={handleAbortAnalysis}
              className="text-xs text-red-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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

      {/* Error Display */}
      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default FlightPathAnalysisCard;