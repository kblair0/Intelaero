"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";

//premium
import { usePremium, TierLevel } from "../../../../context/PremiumContext";
import PremiumButton from "../../../UI/PremiumButton";


interface StationAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
  stationType: "gcs" | "observer" | "repeater";
}

const StationAnalysisCard: React.FC<StationAnalysisCardProps> = ({ gridAnalysisRef, stationType }) => {
  // Use markers collection instead of individual marker references
  const {
    markers,
    updateMarker,
    defaultElevationOffsets,
    setDefaultElevationOffset
  } = useMarkersContext();
  
  const { 
    markerConfigs, 
    setMarkerConfig, 
    isAnalyzing, 
    setError, 
    setIsAnalyzing, 
    results, 
    gridSize, 
    setGridSize 
  } = useLOSAnalysis();
  
  const { elevationService } = useMapContext();

  //premium checks
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
    setMarkerConfig(stationType, { gridRange: limitedValue });
  };
  
  // Filter markers of the specified type
  const typeMarkers = useMemo(() => 
    markers.filter(m => m.type === stationType), 
    [markers, stationType]
  );
  
  // State for selected marker
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  
  // State for editing default elevation offset
  const [isEditingDefault, setIsEditingDefault] = useState(false);
  const [tempDefaultOffset, setTempDefaultOffset] = useState(defaultElevationOffsets[stationType]);
  
  // Set initial selected marker when markers change
  useEffect(() => {
    if (typeMarkers.length > 0 && (!selectedMarkerId || !typeMarkers.some(m => m.id === selectedMarkerId))) {
      setSelectedMarkerId(typeMarkers[0].id);
    } else if (typeMarkers.length === 0) {
      setSelectedMarkerId('');
    }
  }, [typeMarkers, selectedMarkerId]);
  
  // Update temp default offset when the actual default changes
  useEffect(() => {
    setTempDefaultOffset(defaultElevationOffsets[stationType]);
  }, [defaultElevationOffsets, stationType]);
  
  // Get the selected marker object
  const selectedMarker = typeMarkers.find(m => m.id === selectedMarkerId);
  
  // Get layer ID for this marker
  const getLayerId = useCallback((markerId: string) => {
    const layerPrefix = 
      stationType === 'gcs' ? MAP_LAYERS.GCS_GRID :
      stationType === 'observer' ? MAP_LAYERS.OBSERVER_GRID :
      MAP_LAYERS.REPEATER_GRID;
    
    return `${layerPrefix}-${markerId}`;
  }, [stationType]);
  
  // Run station analysis
  const handleRunStationAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    
    if (!selectedMarker) {
      const errorMsg = `No ${stationType.toUpperCase()} selected for analysis`;
      setError(errorMsg);
      setLocalError(errorMsg);
      return;
    }
    
    try {
      setError(null);
      setLocalError(null);
      trackEvent("station_analysis_start", { 
        station: stationType,
        markerId: selectedMarkerId 
      });
      
      console.log(`[${new Date().toISOString()}] [StationAnalysisCard.tsx] Running analysis with:`, {
        stationType,
        location: selectedMarker.location, 
        range: markerConfigs[stationType].gridRange,
        elevationOffset: selectedMarker.elevationOffset,
        markerId: selectedMarkerId
      });

      await gridAnalysisRef.current.runStationAnalysis({
        stationType,
        location: selectedMarker.location,
        range: markerConfigs[stationType].gridRange,
        elevationOffset: selectedMarker.elevationOffset,
        markerId: selectedMarkerId
      });

      trackEvent("station_analysis_success", { 
        station: stationType,
        markerId: selectedMarkerId 
      });
    } catch (err: any) {
      console.error("Station analysis error:", err);
      setError(err.message || "Station analysis failed");
      setLocalError(err.message || "Station analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle saving the default elevation offset
  const saveDefaultElevationOffset = () => {
    if (tempDefaultOffset >= 0 && tempDefaultOffset <= 100) {
      setDefaultElevationOffset(stationType, tempDefaultOffset);
      setIsEditingDefault(false);
      trackEvent("default_elevation_updated", {
        stationType,
        newValue: tempDefaultOffset
      });
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
  
  // Helper to generate display name for a marker
  const getMarkerDisplayName = (marker: any, index: number) => {
    const displayName = getStationDisplayName();
    // Add index if there are multiple markers of this type
    const indexLabel = typeMarkers.length > 1 ? ` #${index + 1}` : '';
    
    return `${displayName}${indexLabel} (${marker.location.lat.toFixed(3)}, ${marker.location.lng.toFixed(3)}, ${marker.elevationOffset}m above ground)`;
  };

  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{getStationDisplayName()} Analysis</h2>
      </div>
      
      {typeMarkers.length === 0 ? (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
          ⚠️ Please place a {getStationDisplayName()} marker on the map to enable analysis.
        </div>
      ) : (
        <>
          {typeMarkers.length > 0 && (
            <div className="mb-3">
              <label className="block text-xs text-gray-600 mb-1">Select {getStationDisplayName()}</label>
              <select
                value={selectedMarkerId}
                onChange={(e) => setSelectedMarkerId(e.target.value)}
                className="w-full p-2 border rounded text-xs"
                disabled={isAnalyzing}
              >
                {typeMarkers.map((marker, index) => (
                  <option key={marker.id} value={marker.id}>
                    {getMarkerDisplayName(marker, index)}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-600">Adjust Grid Range (m):</label>
                <span className="text-xs text-gray-600">{markerConfigs[stationType].gridRange}m</span>
              </div>
              <input
                type="range"
                min="500"
                max={gridRangeLimits.max}
                step="100"
                value={markerConfigs[stationType].gridRange}
                onChange={handleGridRangeChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                disabled={isAnalyzing}
              />
              {tierLevel < TierLevel.COMMERCIAL && (
                <p className="text-xs text-yellow-500 mt-1">
                  Range limited to 500m. Upgrade for extended range.
                </p>
              )}
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>500m</span>
                <span>{gridRangeLimits.max}m</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-gray-600">Grid Size (m):</label>
                <span className="text-xs text-gray-600">{gridSize === 30 ? "30m: SRTM" : `${gridSize}m`}</span>
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{gridSizeLimits.min}m</span>
                <span>100m</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The lower the number, the higher the fidelity
              </p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-600">This Observer&apos;s Height (m)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={selectedMarker ? selectedMarker.elevationOffset : defaultElevationOffsets[stationType]}
                    onChange={(e) => {
                      const newOffset = Number(e.target.value);
                      if (selectedMarker) {
                        updateMarker(selectedMarker.id, { elevationOffset: newOffset });
                        trackEvent("marker_elevation_updated", {
                          stationType,
                          markerId: selectedMarker.id,
                          newValue: newOffset
                        });
                      }
                    }}
                    className="w-16 h-6 p-1 border rounded text-sm"
                    disabled={isAnalyzing || !selectedMarker}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <PremiumButton
            featureId="station_analysis"
            onClick={handleRunStationAnalysis}
            disabled={isAnalyzing || !selectedMarker}
            className={`w-full py-1 rounded mt-3 ${
              isAnalyzing || !selectedMarker
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
            }`}
          >
            {isAnalyzing ? "Analysing..." : "Run Analysis"}
          </PremiumButton>
        </>
      )}
      
      {results && results.stats && selectedMarker && (
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