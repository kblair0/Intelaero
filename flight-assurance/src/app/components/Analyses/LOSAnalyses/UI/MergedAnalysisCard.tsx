"use client";

import { useState, useEffect } from "react";
import { layerManager, MAP_LAYERS } from "../../../../services/LayerManager";
import distance from "@turf/distance";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { LocationData } from "../../../../types/LocationData";
import { AnalysisResults } from "../../../../context/LOSAnalysisContext";

interface MergedAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

interface Station {
  type: "gcs" | "observer" | "repeater";
  location: LocationData;
  range: number;
  elevationOffset: number;
}

const MergedAnalysisCard: React.FC<MergedAnalysisCardProps> = ({ gridAnalysisRef }) => {
  const {
    gcsLocation,
    observerLocation,
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset,
  } = useMarkersContext();
  const { markerConfigs, isAnalyzing, setError, setIsAnalyzing, results, setResults } = useLOSAnalysis();
  const { elevationService } = useMapContext();

  const availableStations: Station[] = [
    {
      type: "gcs",
      location: gcsLocation,
      range: markerConfigs.gcs.gridRange,
      elevationOffset: gcsElevationOffset,
    },
    {
      type: "observer",
      location: observerLocation,
      range: markerConfigs.observer.gridRange,
      elevationOffset: observerElevationOffset,
    },
    {
      type: "repeater",
      location: repeaterLocation,
      range: markerConfigs.repeater.gridRange,
      elevationOffset: repeaterElevationOffset,
    },
  ].filter((station): station is Station => station.location !== null);

  const computedStations: Station[] =
    availableStations.length >= 2
      ? availableStations.map((station) => {
          let maxDistance = 0;
          availableStations.forEach((otherStation) => {
            if (station.type !== otherStation.type) {
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
      : availableStations;

  const [localError, setLocalError] = useState<string | null>(null);

  const handleRunMergedAnalysis = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    if (computedStations.length < 2) {
      setError("At least two stations are required for merged analysis");
      setLocalError("At least two stations are required for merged analysis");
      return;
    }
    try {
      
      setError(null);
      setLocalError(null);
      trackEvent("merged_analysis_start", {
        stations: computedStations.map((s) => ({
          type: s.type,
          range: s.range,
          elevationOffset: s.elevationOffset,
        })),
      });

      const mergedResults: AnalysisResults = await gridAnalysisRef.current.runMergedAnalysis(computedStations);
      setResults(mergedResults);
      trackEvent("merged_analysis_success", {
        stations: computedStations.map((s) => ({
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

  const getStationDisplayName = (type: string) => {
    switch (type) {
      case "gcs":
        return "GCS Station";
      case "observer":
        return "Observer Station";
      case "repeater":
        return "Repeater Station";
      default:
        return type;
    }
  };

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
        This analysis combines visibility from all available stations.
      </p>
      {computedStations.length < 2 ? (
        <div className="p-2 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
          ⚠️ Please place at least two station markers (GCS, Observer, or Repeater) on the map to enable merged analysis.
          {computedStations.length === 1 && (
            <p className="mt-1">
              Currently placed: {getStationDisplayName(computedStations[0].type)}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs">
            <p>
              <strong>Available Stations (computed grid ranges):</strong>
            </p>
            {computedStations.map((station) => (
              <p key={station.type} className="ml-2">
                - {getStationDisplayName(station.type)}: (
                {station.location.lat.toFixed(3)}, {station.location.lng.toFixed(3)}, {(station.location.elevation ?? 0).toFixed(1)}m)
                , Range: {station.range}m, Elevation Offset: {station.elevationOffset}m
              </p>
            ))}
          </div>
          <button
            onClick={handleRunMergedAnalysis}
            disabled={isAnalyzing || computedStations.length < 2}
            className={`w-full py-1 rounded mt-3 ${
              isAnalyzing || computedStations.length < 2
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white text-sm"
            }`}
          >
            {isAnalyzing ? "Analysing..." : "Run Merged Analysis"}
          </button>
        </>
      )}
      {results && results.stats && computedStations.length >= 2 && (
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