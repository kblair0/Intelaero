"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";

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
  const getLayerId = (markerId: string) => {
    const layerPrefix = 
      stationType === 'gcs' ? MAP_LAYERS.GCS_GRID :
      stationType === 'observer' ? MAP_LAYERS.OBSERVER_GRID :
      MAP_LAYERS.REPEATER_GRID;
    
    return `${layerPrefix}-${markerId}`;
  };
  
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

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  // Listen for layer visibility changes
  useEffect(() => {
    const unsubscribe = layerManager.addEventListener((event, layerId) => {
      // Check if this is a layer for any marker of our type
      if (selectedMarkerId && 
         (layerId === getLayerId(selectedMarkerId) || layerId.startsWith(MAP_LAYERS.GCS_GRID) || 
          layerId.startsWith(MAP_LAYERS.OBSERVER_GRID) || layerId.startsWith(MAP_LAYERS.REPEATER_GRID)) &&
         (event === "visibilityChange" || event === "layerAdded")
      ) {
        forceUpdate();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [selectedMarkerId]);

  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{getStationDisplayName()} Analysis</h2>
        {selectedMarker && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Show/Hide</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={layerManager.isLayerVisible(getLayerId(selectedMarkerId))}
                onChange={() => layerManager.toggleLayerVisibility(getLayerId(selectedMarkerId))}
                disabled={isAnalyzing}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        )}
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
                max="5000"
                step="100"
                value={markerConfigs[stationType].gridRange}
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
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-600">This Observers' Height (m)</label>
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
          
          <button
            onClick={handleRunStationAnalysis}
            disabled={isAnalyzing || !selectedMarker}
            className={`w-full py-1 rounded mt-3 ${
              isAnalyzing || !selectedMarker
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-sm text-white"
            }`}
          >
            {isAnalyzing ? "Analysing..." : "Run Analysis"}
          </button>
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