import React, {} from "react";
// import { useLocation } from "../context/MarkerContext"; this is now import { useMarkersContext } from '../context/MarkerContext'; this file need updating for this.

import { useMarkersContext } from '../context/MarkerContext';
import { LocationData } from "../components/Map";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

interface StationCardProps {
  stationType: "gcs" | "observer" | "repeater";
  location: LocationData;
  markerConfig: {
    gridRange: number;
    // elevationOffset is no longer used from props
  };
  onChangeConfig: (field: "gridRange", value: number) => void;
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
  // Retrieve elevation offsets and their setters from LocationContext
  const {
    gcsElevationOffset,
    setGcsElevationOffset,
    observerElevationOffset,
    setObserverElevationOffset,
    repeaterElevationOffset,
    setRepeaterElevationOffset,
  } = useMarkersContext();

  // Determine the correct elevation offset based on station type
  const elevationOffset =
    stationType === "gcs"
      ? gcsElevationOffset
      : stationType === "observer"
      ? observerElevationOffset
      : repeaterElevationOffset;

  // Map station type to its corresponding setter
  const setElevationOffset =
    stationType === "gcs"
      ? setGcsElevationOffset
      : stationType === "observer"
      ? setObserverElevationOffset
      : setRepeaterElevationOffset;

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

  const colors: Record<typeof stationType, string> = {
    gcs: "blue",
    observer: "green",
    repeater: "red",
  };

  // Handle analyze with tracking
  const handleAnalyzeWithTracking = () => {
    trackEvent(`${stationType}_station_analysis_click`, { 
      panel: "station_analysis", 
      station_type: stationType,
      range: markerConfig.gridRange,
      elevation_offset: elevationOffset,
      location: `${location.lat.toFixed(3)},${location.lng.toFixed(3)}`
    });
    onAnalyze();
  };


  return (
    <article className="bg-white p-2 rounded shadow flex flex-col gap-2 w-full text-xs">
      {/* Header Section */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-base" aria-hidden="true">
            {icons[stationType]}
          </span>
          <h2 className={`font-semibold text-${colors[stationType]}-600`}>
            {titles[stationType]}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline">Show</span>
          <label className="toggle-switch" aria-label="Toggle layer visibility">
            <input
              type="checkbox"
              checked={layerVisibility}
              onChange={toggleLayerVisibility}
              className="h-3 w-3"
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </header>
  
      {/* Location Info */}
      <div className="flex items-center">
        <strong className="mr-1">Loc:</strong>
        {location ? (
          <span>
            {location.lat.toFixed(3)}, {location.lng.toFixed(3)} |{" "}
            {location.elevation?.toFixed(0)}m
          </span>
        ) : (
          <span className="text-gray-400">Not set</span>
        )}
      </div>
  
      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Range Control */}
        <div className="flex-1">
          <label htmlFor={`range-${stationType}`} className="flex justify-between">
            <span>Range:</span>
            <span>{markerConfig.gridRange}m</span>
          </label>
          <input
            id={`range-${stationType}`}
            type="range"
            min="500"
            max="5000"
            step="50"
            value={markerConfig.gridRange}
            onChange={(e) => onChangeConfig("gridRange", Number(e.target.value))}
            className="w-full h-1 bg-gray-200 rounded"
          />
        </div>
  
        {/* Elevation Offset Control */}
        <div className="w-20">
          <label htmlFor={`elev-${stationType}`} className="flex justify-between">
            <span>Elev:</span>
            <span>{elevationOffset}m</span>
          </label>
          <input
            id={`elev-${stationType}`}
            type="number"
            value={elevationOffset}
            onChange={(e) => setElevationOffset(Number(e.target.value))}
            className="w-full border rounded h-5 p-0 !text-[12px] leading-tight"
          />
        </div>
  
        {/* Analyze Button */}
        <button onClick={handleAnalyzeWithTracking}>Analyze</button>

      </div>
    </article>
  );
};

export default StationCard;