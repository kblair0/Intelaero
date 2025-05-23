"use client";

import { useState, useEffect,  useCallback, useMemo } from "react";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";
import distance from "@turf/distance";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { LocationData } from "../../../../types/LocationData";
import { AnalysisResults } from "../../../../context/LOSAnalysisContext";
//premium
import { usePremium, TierLevel } from "../../../../context/PremiumContext";
import PremiumButton from "../../../UI/PremiumButton";


interface MergedAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

interface Station {
  id: string;
  type: "gcs" | "observer" | "repeater";
  location: LocationData;
  range: number;
  elevationOffset: number;
}

const MergedAnalysisCard: React.FC<MergedAnalysisCardProps> = ({ gridAnalysisRef }) => {
  // Use markers collection instead of individual references
  const { markers, defaultElevationOffsets } = useMarkersContext();
  const { markerConfigs, isAnalyzing, setError, setIsAnalyzing, results, setResults } = useLOSAnalysis();
  const { elevationService } = useMapContext();

  //premium checks
  const { tierLevel, getParameterLimits } = usePremium();

  // Get the station count limits
  const stationCountLimits = getParameterLimits('stationCount');

  // Add a helper to check if the user is allowed to have multiple stations
  const isLimitedByTier = tierLevel < TierLevel.COMMERCIAL;

  // Create available stations from all markers - using useMemo to prevent recreation on every render
  const availableStations = useMemo(() => markers.map(marker => ({
    id: marker.id,
    type: marker.type,
    location: marker.location,
    range: markerConfigs[marker.type].gridRange,
    elevationOffset: marker.elevationOffset,
  })), [markers, markerConfigs]);

  // Compute station ranges based on distances between markers - also memoized
  const computedStations = useMemo(() => 
    availableStations.length >= 2
      ? availableStations.map((station) => {
          let maxDistance = 0;
          availableStations.forEach((otherStation) => {
            if (station.id !== otherStation.id) {
              const d = distance(
                [station.location.lng, station.location.lat],
                [otherStation.location.lng, otherStation.location.lat],
                { units: "meters" }
              );
              if (d > maxDistance) {
                maxDistance = d;
              }
            }
          });
          return { ...station, range: Math.round(maxDistance) };
        })
      : availableStations,
    [availableStations]
  );

  // Keep track of which markers to include in the analysis
  const [selectedMarkerIds, setSelectedMarkerIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // Initialize selected markers when available markers change - with proper dependency tracking
  useEffect(() => {
    // The key fix: Use a stable reference by getting the IDs first
    const markerIds = availableStations.map(station => station.id);
    
    // Only update if we have different IDs than currently selected
    if (JSON.stringify(markerIds.sort()) !== JSON.stringify([...selectedMarkerIds].sort())) {
      setSelectedMarkerIds(markerIds);
    }
}, [availableStations, selectedMarkerIds]);

  const handleMarkerSelectionChange = (markerId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedMarkerIds(prev => [...prev, markerId]);
    } else {
      setSelectedMarkerIds(prev => prev.filter(id => id !== markerId));
    }
  };

  // Filter stations based on selection - memoized to prevent recreation on every render
  const selectedStations = useMemo(() => 
    computedStations.filter(station => selectedMarkerIds.includes(station.id)),
    [computedStations, selectedMarkerIds]
  );
    // Determine if user can perform merged analysis (premium) (needs at least 2 stations)
  const canRunMergedAnalysis = tierLevel >= TierLevel.COMMERCIAL && selectedStations.length >= 2;

  const handleRunMergedAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    
    if (selectedStations.length < 2) {
      setError("At least two stations are required for merged analysis");
      setLocalError("At least two stations are required for merged analysis");
      return;
    }
    
    try {
      setError(null);
      setLocalError(null);
      trackEvent("merged_analysis_start", {
        stations: selectedStations.map((s) => ({
          id: s.id,
          type: s.type,
          range: s.range,
          elevationOffset: s.elevationOffset,
        })),
      });

      const mergedResults: AnalysisResults = await gridAnalysisRef.current.runMergedAnalysis({
        stations: selectedStations
      });
      
      setResults(mergedResults);
      
      trackEvent("merged_analysis_success", {
        stations: selectedStations.map((s) => ({
          id: s.id,
          type: s.type,
          range: s.range,
          elevationOffset: s.elevationOffset,
        })),
      });
    } catch (err: any) {
      setError(err.message || "Merged analysis failed");
      setLocalError(err.message || "Merged analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get display name for a station - memoized to prevent function recreation on every render
  const getStationDisplayName = useCallback((station: Station) => {
    const baseNames = {
      "gcs": "GCS Station",
      "observer": "Observer Station",
      "repeater": "Repeater Station"
    };
    
    // Count how many markers of this type exist
    const typeMarkers = availableStations.filter(s => s.type === station.type);
    
    // If multiple markers of this type, add index
    if (typeMarkers.length > 1) {
      const index = typeMarkers.findIndex(s => s.id === station.id);
      return `${baseNames[station.type]} #${index + 1}`;
    }
    
    return baseNames[station.type];
  }, [availableStations]);

  // Layer visibility listener - no issues here
  useEffect(() => {
    const unsubscribe = layerManager.addEventListener((event, layerId) => {
      if (
        layerId === MAP_LAYERS.MERGED_VISIBILITY &&
        (event === "visibilityChange" || event === "layerAdded")
      ) {
        // No additional action needed here
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-gray-600">Show/Hide</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={layerManager.isLayerVisible(MAP_LAYERS.MERGED_VISIBILITY)}
            onChange={() => layerManager.toggleLayerVisibility(MAP_LAYERS.MERGED_VISIBILITY)}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      <p className="text-xs mb-2">
        This analysis combines visibility from selected stations.
      </p>
        {availableStations.length < 2 ? (
          <div className="p-2 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
            ⚠️ Please place at least two markers (GCS, Observer, or Repeater) on the map to enable merged analysis.
            {availableStations.length === 1 && (
              <p className="mt-1">
                Currently placed: {getStationDisplayName(availableStations[0])}
              </p>
            )}
          </div>
        ) : (
          <>
          {/* If limited by tier, show warning */}
          {isLimitedByTier && (
            <div className="p-2 mb-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
              ⚠️ Merged analysis requires the Commercial tier. With your current tier, you can only use {stationCountLimits.max} station.
            </div>
          )}
          <div className="mb-3 border rounded p-2 bg-gray-50">
            <p className="text-xs font-medium mb-1">Select stations to include:</p>
            {availableStations.map((station) => (
              <div key={station.id} className="flex items-center mb-1">
                <input
                  type="checkbox"
                  id={`station-${station.id}`}
                  checked={selectedMarkerIds.includes(station.id)}
                  onChange={(e) => handleMarkerSelectionChange(station.id, e.target.checked)}
                  className="mr-2"
                  disabled={isAnalyzing}
                />
                <label htmlFor={`station-${station.id}`} className="text-xs">
                  {getStationDisplayName(station)}
                </label>
              </div>
            ))}
          </div>

          <div className="mb-2 text-xs">
            <p>
              <strong>Available Stations (computed grid ranges):</strong>
            </p>
            {selectedStations.map((station) => (
              <p key={station.id} className="ml-2">
                - {getStationDisplayName(station)}: (
                {station.location.lat.toFixed(3)}, {station.location.lng.toFixed(3)}, {(station.location.elevation ?? 0).toFixed(1)}m)
                , Range: {station.range}m, Elevation Offset: {station.elevationOffset}m
                {station.elevationOffset === defaultElevationOffsets[station.type] ? ' (default)' : ''}
              </p>
            ))}
          </div>
          <PremiumButton
            featureId="merged_analysis"
            onClick={handleRunMergedAnalysis}
            disabled={isAnalyzing || selectedStations.length < 2}
            className={`w-full py-1 rounded mt-3 ${
              isAnalyzing || selectedStations.length < 2
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white text-sm"
            }`}
          >
            {isAnalyzing ? "Analysing..." : "Run Merged Analysis"}
          </PremiumButton>
        </>
      )}
      {results && results.stats && selectedStations.length >= 2 && (
        <div className="mt-4">
          <p className="text-xs">
            <strong>Visible Areas:</strong> {results.stats.visibleCells} / {results.stats.totalCells}
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

export default MergedAnalysisCard;