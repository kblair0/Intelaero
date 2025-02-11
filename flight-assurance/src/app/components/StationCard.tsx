"use client";

import React from "react";
import { LocationData } from "../components/Map";

interface StationCardProps {
  stationType: "gcs" | "observer" | "repeater";
  location: LocationData;
  markerConfig: {
    gridRange: number;
    elevationOffset: number;
  };
  onChangeConfig: (field: "gridRange" | "elevationOffset", value: number) => void;
  onAnalyze: () => void;
  layerVisibility: boolean;
  toggleLayerVisibility: () => void;
}

const StationCard: React.FC<StationCardProps> = ({
  stationType,
  location,
  markerConfig,
  onChangeConfig,
  onAnalyze,
  layerVisibility,
  toggleLayerVisibility,
}) => {
  // Define icons, titles, and color schemes for each station type.
  const icons: Record<typeof stationType, string> = {
    gcs: "📡",
    observer: "🔭",
    repeater: "⚡️",
  };

  const titles: Record<typeof stationType, string> = {
    gcs: "GCS Station",
    observer: "Observer Station",
    repeater: "Repeater Station",
  };

  // Customize colors as needed.
  const colors: Record<typeof stationType, string> = {
    gcs: "blue",
    observer: "green",
    repeater: "red",
  };

  return (
    <div className="bg-white p-2 rounded shadow flex flex-col gap-2 max-w-xs">
      {/* Header */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="text-lg">{icons[stationType]}</span>
          <span className={`text-sm font-semibold text-${colors[stationType]}-600`}>
            {titles[stationType]}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-gray-500">Show/Hide</span>
          {/* Updated Toggle Markup */}
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={layerVisibility}
              onChange={toggleLayerVisibility}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {/* Location Display */}
      <div className="text-xs">
        {location ? (
          <div className="flex flex-col gap-1 text-gray-700">
            <span>Lat: {location.lat.toFixed(5)}</span>
            <span>Lng: {location.lng.toFixed(5)}</span>
            <span>Elev: {location.elevation?.toFixed(1)}m</span>
          </div>
        ) : (
          <span className="text-gray-400">Not set</span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2">
        {/* Grid Range */}
        <div>
          <div className="flex justify-between text-xs">
            <span>Range:</span>
            <span>{markerConfig.gridRange}m</span>
          </div>
          <input
            type="range"
            min="500"
            max="5000"
            step="50"
            value={markerConfig.gridRange}
            onChange={(e) =>
              onChangeConfig("gridRange", Number(e.target.value))
            }
            className="w-full h-2 bg-gray-200 rounded cursor-pointer"
          />
        </div>

        {/* Elevation Offset */}
        <div>
          <div className="flex justify-between text-xs">
            <span>Elev Offset:</span>
          </div>
          <input
            type="number"
            value={markerConfig.elevationOffset}
            onChange={(e) =>
              onChangeConfig("elevationOffset", Number(e.target.value))
            }
            className="w-full border rounded px-1 py-0.5 text-xs"
          />
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={onAnalyze}
        className={`py-1 rounded text-xs text-white bg-${colors[stationType]}-500 hover:bg-${colors[stationType]}-600`}
      >
        Analyze
      </button>
    </div>
  );
};

export default StationCard;
