/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "../context/LocationContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { LocationData } from "../components/Map";
import { MapRef } from "./Map";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { layerManager, MAP_LAYERS } from "./LayerManager";
// Import both the LOS check and the new profile function and types.
import { 
  checkStationToStationLOS, 
  getLOSProfile, 
  LOSProfilePoint, 
  StationLOSResult 
} from "./StationLOSAnalysis";

// Import chart components
import { Line } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

interface ELOSAnalysisCardProps {
  mapRef: React.RefObject<MapRef>;
}

const LocationDisplay = ({
  title,
  location,
}: {
  title: string;
  location?: LocationData | null;
}) => (
  <div className="mb-3 p-2 bg-gray-50 rounded">
    <h4 className="text-xs font-semibold text-gray-600">{title}</h4>
    {location ? (
      <div className="text-xs mt-1 flex flex-row gap-4 items-center">
        <p>Lat: {location.lat.toFixed(5)}</p>
        <p>Lng: {location.lng.toFixed(5)}</p>
        <p>Elev: {location.elevation?.toFixed(1)}m</p>
      </div>
    ) : (
      <p className="text-xs text-gray-400 mt-1">Not set</p>
    )}
  </div>
);

const ELOSAnalysisCard: React.FC<ELOSAnalysisCardProps> = ({ mapRef }) => {
  // Get location data from LocationContext
  const { gcsLocation, observerLocation, repeaterLocation } = useLocation();
  const { flightPlan } = useFlightPlanContext();
  const isFlightPlanLoaded =
    flightPlan !== null && Object.keys(flightPlan).length > 0;

  // Get analysis state and actions from LOSAnalysisContext
  const {
    // Configuration
    elosGridRange,
    gridSize,
    markerConfigs,
    setElosGridRange,
    setGridSize,
    setMarkerConfig,

    // Analysis State
    isAnalyzing,
    results,

    // Analysis Actions
    setIsAnalyzing,
    setError,
  } = useLOSAnalysis();

  // Global layer visibility state
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    [MAP_LAYERS.ELOS_GRID]: true,
    [MAP_LAYERS.GCS_GRID]: true,
    [MAP_LAYERS.OBSERVER_GRID]: true,
    [MAP_LAYERS.REPEATER_GRID]: true,
  });

  // State for the LOS profile data (for the graph)
  const [losProfileData, setLosProfileData] = useState<LOSProfilePoint[] | null>(null);
  const [isGraphEnlarged, setIsGraphEnlarged] = useState(false);


  // Toggle function for layers
  const toggleLayerVisibility = (layerId: string) => {
    if (!mapRef.current) return;
    layerManager.toggleLayerVisibility(layerId);
    setLayerVisibility((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));
  };

  const handleAnalyzeMarker = async (
    markerType: "gcs" | "observer" | "repeater"
  ) => {
    if (!mapRef.current) {
      setError("Map not initialized");
      return;
    }

    const locations = {
      gcs: gcsLocation,
      observer: observerLocation,
      repeater: repeaterLocation,
    };

    const location = locations[markerType];
    if (!location) {
      setError(`${markerType} location not set`);
      return;
    }

    const range = markerConfigs[markerType].gridRange;

    try {
      setIsAnalyzing(true);
      await mapRef.current.runElosAnalysis({
        markerType,
        location,
        range,
      });
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalysis = useCallback(async () => {
    if (!mapRef.current) {
      setError("Map not initialized");
      return;
    }
    console.log("ELOS Analysis Requested");
    try {
      setIsAnalyzing(true);
      setError(null);
      await mapRef.current.runElosAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [mapRef, setIsAnalyzing, setError]);

  // Handler for marker configuration updates
  const handleMarkerConfigChange = (
    markerType: "gcs" | "observer" | "repeater",
    field: "elevationOffset" | "gridRange",
    value: number
  ) => {
    setMarkerConfig(markerType, { [field]: value });
  };

  // Station to Station LOS Analysis
  // State variables to hold the selected source and target for station-to-station LOS.
  const [sourceStation, setSourceStation] = useState<"gcs" | "observer" | "repeater">("gcs");
  const [targetStation, setTargetStation] = useState<"gcs" | "observer" | "repeater">("observer");
  const [stationLOSResult, setStationLOSResult] = useState<StationLOSResult | null>(null);

  // Create a locations object for easier reference
  const stationLocations = {
    gcs: gcsLocation,
    observer: observerLocation,
    repeater: repeaterLocation
  };

  // Get available stations (ones that have been placed on the map)
  const availableStations = Object.entries(stationLocations)
    .filter(([_, location]) => location !== null)
    .map(([type]) => type as "gcs" | "observer" | "repeater");

  // Effect to set initial selections based on available stations
  useEffect(() => {
    if (availableStations.length >= 2) {
      setSourceStation(availableStations[0]);
      setTargetStation(availableStations[1]);
    } else if (availableStations.length === 1) {
      setSourceStation(availableStations[0]);
    }
  }, [availableStations.length]);

  // Handler for station-to-station LOS check.
  const handleStationLOSCheck = async () => {
    if (!mapRef.current) {
      setError("Map not initialized");
      return;
    }
  
    const map = mapRef.current.getMap();
    if (!map) {
      setError("Map instance not available");
      return;
    }
  
    const source = stationLocations[sourceStation];
    const target = stationLocations[targetStation];
  
    if (!source || !target) {
      setError(
        `Both ${sourceStation.toUpperCase()} and ${targetStation.toUpperCase()} locations must be set.`
      );
      return;
    }
  
    const sourceOffset = markerConfigs[sourceStation].elevationOffset;
    const targetOffset = markerConfigs[targetStation].elevationOffset;
  
    const effective1: [number, number, number] = [
      source.lng,
      source.lat,
      (source.elevation || 0) + sourceOffset,
    ];
    const effective2: [number, number, number] = [
      target.lng,
      target.lat,
      (target.elevation || 0) + targetOffset,
    ];
  
    // Log the effective coordinates (essential)
    console.log("[Station LOS] Effective coordinates:", effective1, effective2);
  
    try {
      const boundTerrainQuery = async (
        coords: [number, number]
      ): Promise<number> => {
        if (!map) return 0;
  
        if (!map.isSourceLoaded("mapbox-dem")) {
          await new Promise<void>((resolve) => {
            const checkSource = () => {
              if (map.isSourceLoaded("mapbox-dem")) {
                resolve();
              } else {
                map.once("sourcedata", checkSource);
              }
            };
            checkSource();
          });
        }
  
        const elevation = map.queryTerrainElevation(coords);
        return elevation ?? 0;
      };
  
      const result = await checkStationToStationLOS(
        map,
        effective1,
        effective2,
        boundTerrainQuery
      );
  
      // Log the analysis result (essential)
      console.log("[Station LOS] Analysis result:", result);
      setStationLOSResult(result);
      setError(null);
    } catch (error: any) {
      console.error("[Station LOS] Analysis error:", error);
      setError(error.message || "Station LOS check failed");
      setStationLOSResult(null);
    }
  };

  // New handler for showing the LOS profile graph.
  const handleShowLOSGraph = async () => {
    if (!mapRef.current) {
      setError("Map not initialized");
      return;
    }
    const map = mapRef.current.getMap();
    if (!map) {
      setError("Map instance not available");
      return;
    }
    const source = stationLocations[sourceStation];
    const target = stationLocations[targetStation];
  
    if (!source || !target) {
      setError(
        `Both ${sourceStation.toUpperCase()} and ${targetStation.toUpperCase()} locations must be set.`
      );
      return;
    }
  
    const sourceOffset = markerConfigs[sourceStation].elevationOffset;
    const targetOffset = markerConfigs[targetStation].elevationOffset;
  
    const effective1: [number, number, number] = [
      source.lng,
      source.lat,
      (source.elevation || 0) + sourceOffset,
    ];
    const effective2: [number, number, number] = [
      target.lng,
      target.lat,
      (target.elevation || 0) + targetOffset,
    ];
  
    // Re-use the same boundTerrainQuery function as before.
    const boundTerrainQuery = async (
      coords: [number, number]
    ): Promise<number> => {
      if (!map) return 0;
      if (!map.isSourceLoaded("mapbox-dem")) {
        await new Promise<void>((resolve) => {
          const checkSource = () => {
            if (map.isSourceLoaded("mapbox-dem")) {
              resolve();
            } else {
              map.once("sourcedata", checkSource);
            }
          };
          checkSource();
        });
      }
      const elevation = map.queryTerrainElevation(coords);
      return elevation ?? 0;
    };
  
    try {
      // Generate the LOS profile data (an array of LOSProfilePoint)
      const profile = await getLOSProfile(effective1, effective2, boundTerrainQuery);
      setLosProfileData(profile);
      setError(null);
      // **Open the modal by setting the state to true**
      setIsGraphEnlarged(true);
    } catch (error: any) {
      console.error("[LOS Graph] Error generating profile:", error);
      setError(error.message || "Failed to generate LOS profile");
      setLosProfileData(null);
    }
  };
  

  // Get station emoji and name
  const getStationDisplay = (stationType: "gcs" | "observer" | "repeater") => {
    const emojis = {
      gcs: "📡",
      observer: "🔭",
      repeater: "⚡️",
    };
    const names = {
      gcs: "GCS Station",
      observer: "Observer Station",
      repeater: "Repeater Station",
    };
    return { emoji: emojis[stationType], name: names[stationType] };
  };

  // Modified station-to-station LOS UI section
  const renderStationToStationUI = () => {
    if (availableStations.length < 2) {
      return (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-sm text-yellow-700 rounded">
          ⚠️ Place at least two stations on the map to perform station-to-station analysis.
          {availableStations.length === 1 && (
            <div className="mt-2">
              Currently placed: {getStationDisplay(availableStations[0]).emoji}{" "}
              {getStationDisplay(availableStations[0]).name}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-row gap-4">
          <button
            onClick={handleStationLOSCheck}
            className={`${
              stationLOSResult ? "flex-1" : "w-full"
            } py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed`}
            disabled={
              !stationLocations[sourceStation] ||
              !stationLocations[targetStation] ||
              sourceStation === targetStation
            }
          >
            Check Station-to-Station LOS
          </button>

          {stationLOSResult && (
            <button
              onClick={handleShowLOSGraph}
              className="flex-1 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors"
            >
              Show LOS Graph
            </button>
          )}
        </div>

        {stationLOSResult && (
          <div
            className={`p-3 rounded ${
              stationLOSResult.clear ? "bg-green-100" : "bg-red-100"
            }`}
          >
            {stationLOSResult.clear ? (
              <div className="text-green-700 flex items-center gap-2">
                <span>✓</span>
                <span>Clear line of sight between stations</span>
              </div>
            ) : (
              <div className="text-red-700">
                <div className="flex items-center gap-2">
                  <span>✗</span>
                  <span>Line of sight obstructed</span>
                </div>
                <div className="text-sm mt-1">
                  Obstruction at {stationLOSResult.obstructionDistance?.toFixed(1)}m (
                  {(stationLOSResult.obstructionFraction! * 100).toFixed(1)}% along path)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Prepare chart data if losProfileData exists.
  const chartData = losProfileData
  ? {
      labels: losProfileData.map((pt) => pt.distance.toFixed(0)),
      datasets: [
        {
          label: "Terrain Elevation",
          data: losProfileData.map((pt) => pt.terrain),
          borderColor: "rgba(75,192,192,1)",
          backgroundColor: "rgba(75,192,192,0.4)",
          fill: true,
          borderWidth: 1,
          tension: 0.1,
          pointRadius: 0,
        },
        {
          label: "LOS Altitude",
          data: losProfileData.map((pt) => pt.los),
          borderColor: "rgba(255,99,132,1)",
          backgroundColor: "rgba(255,99,132,0.2)",
          fill: false,
          borderWidth: 1,
          tension: 0.1,
          pointRadius: 0,
        },
      ],
    }
  : null;

const chartOptions = {
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: "Station-to-Station LOS Profile",
    },
    tooltip: {
      mode: "index" as const,
      intersect: false,
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: "Distance (m)",
      },
    },
    y: {
      title: {
        display: true,
        text: "Altitude (m)",
      },
    },
  },
};


  return (
    <>
      <div>
        {/* Main Analysis Section */}
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-blue-500">✈️</span>
              <span className="flex-grow">Drone LOS Analysis</span>
              {/* Toggle for Full Analysis Grid */}
              <div className="flex flex-row items-center gap-2">
                <span className="text-xs">Show/Hide</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={layerVisibility[MAP_LAYERS.ELOS_GRID]}
                    onChange={() => toggleLayerVisibility(MAP_LAYERS.ELOS_GRID)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </h2>
            <span className="text-xs text-gray-500">
              Determine which points along the flight path the drone can see
              within the selected grid range.
            </span>
          </div>

          {/* Global configuration sliders arranged side by side */}
          <div className="flex flex-row gap-4">
            {/* Grid Range Slider */}
            <div className="flex-1">
              <div className="flex justify-between text-m mb-1">
                <span>Grid Range:</span>
                <span>{elosGridRange}m</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Distance from your drone to be analysed
              </p>
              <input
                type="range"
                min="500"
                max="5000"
                value={elosGridRange}
                onChange={(e) => setElosGridRange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Global Grid Size Slider with SRTM Indication */}
            <div className="flex-1">
              <div className="flex justify-between text-m mb-1">
                <span>Grid Size:</span>
                <span>{gridSize === 30 ? '30m: SRTM' : `${gridSize}m`}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                The lower the number, the higher the fidelity
              </p>
              <input
                type="range"
                min="1"
                max="100"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {!isFlightPlanLoaded && (
            <div className="p-2 bg-yellow-100 text-yellow-700 text-xs rounded mt-2">
              ⚠️ Please load a flight plan before running the analysis.
            </div>
          )}

          <button
            onClick={handleAnalysis}
            disabled={!isFlightPlanLoaded || isAnalyzing}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              !isFlightPlanLoaded || isAnalyzing
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {isAnalyzing ? "Analyzing..." : "Run Full Analysis"}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Each square in the grid represents the local visibility of your flight path within the grid range you’ve set.
            In other words, for each square, the system calculates the percentage of your flight path—within the specified grid range—that has an unobstructed view to that square.
          </p>
        </div>

        {/* Marker Analysis Section */}
        <div className="space-y-4 mt-6">
          <h3 className="text-lg font-semibold text-gray-700 border-b mt-2 border-gray-300 pb-2">
            Station Based Line of Sight Analysis
          </h3>

          {!gcsLocation && !observerLocation && !repeaterLocation && (
            <div className="p-3 mb-3 bg-yellow-100 border border-yellow-400 text-sm text-yellow-700 rounded">
              ⚠️ To unlock 📡GCS Station/🔭Observer Station/⚡️Repeater Station
              Line of Sight analysis, drop markers on the map.
            </div>
          )}

          {/* GCS Section */}
          {gcsLocation && (
            <div className="bg-gray-50 p-4 rounded">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  <span>📡</span>
                  <h4 className="text-sm font-semibold text-blue-600">
                    GCS Station
                  </h4>
                </div>
                {/* Toggle for GCS Analysis Grid */}
                <div className="flex flex-row items-center gap-2">
                  <span className="text-xs">Show/Hide</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={layerVisibility[MAP_LAYERS.GCS_GRID]}
                      onChange={() => toggleLayerVisibility(MAP_LAYERS.GCS_GRID)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <LocationDisplay title="GCS Location" location={gcsLocation} />

              {/* Marker-specific sliders arranged side by side */}
              <div className="flex flex-row gap-4 mb-4">
                {/* Marker Grid Range */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Analysis Range:</span>
                    <span>{markerConfigs.gcs.gridRange}m</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    value={markerConfigs.gcs.gridRange}
                    onChange={(e) =>
                      handleMarkerConfigChange(
                        "gcs",
                        "gridRange",
                        Number(e.target.value)
                      )
                    }
                    className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                {/* Marker Grid Size */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Grid Size:</span>
                    <span>{gridSize}m</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Elevation Offset */}
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-gray-600">
                  Elevation Offset (m):
                </label>
                <input
                  type="number"
                  value={markerConfigs.gcs.elevationOffset}
                  onChange={(e) =>
                    handleMarkerConfigChange(
                      "gcs",
                      "elevationOffset",
                      Number(e.target.value)
                    )
                  }
                  className="w-20 px-2 py-1 text-xs border rounded"
                />
              </div>

              <button
                onClick={() => handleAnalyzeMarker("gcs")}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90"
              >
                Analyze
              </button>
            </div>
          )}

          {/* Observer Section */}
          {observerLocation && (
            <div className="bg-gray-50 p-4 rounded">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  <span>🔭</span>
                  <h4 className="text-sm font-semibold text-green-600">
                    Observer Station
                  </h4>
                </div>
                {/* Toggle for Observer Analysis Grid */}
                <div className="flex flex-row items-center gap-2">
                  <span className="text-xs">Show/Hide</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={layerVisibility[MAP_LAYERS.OBSERVER_GRID]}
                      onChange={() =>
                        toggleLayerVisibility(MAP_LAYERS.OBSERVER_GRID)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <LocationDisplay
                title="Observer Location"
                location={observerLocation}
              />

              {/* Marker-specific sliders arranged side by side */}
              <div className="flex flex-row gap-4 mb-4">
                {/* Marker Grid Range */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Analysis Range:</span>
                    <span>{markerConfigs.observer.gridRange}m</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    value={markerConfigs.observer.gridRange}
                    onChange={(e) =>
                      handleMarkerConfigChange(
                        "observer",
                        "gridRange",
                        Number(e.target.value)
                      )
                    }
                    className="w-full h-2 bg-green-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                {/* Marker Grid Size */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Grid Size:</span>
                    <span>{gridSize}m</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-full h-2 bg-green-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Elevation Offset */}
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-gray-600">
                  Elevation Offset (m):
                </label>
                <input
                  type="number"
                  value={markerConfigs.observer.elevationOffset}
                  onChange={(e) =>
                    handleMarkerConfigChange(
                      "observer",
                      "elevationOffset",
                      Number(e.target.value)
                    )
                  }
                  className="w-20 px-2 py-1 text-xs border rounded"
                />
              </div>

              <button
                onClick={() => handleAnalyzeMarker("observer")}
                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:opacity-90"
              >
                Analyze
              </button>
            </div>
          )}

          {/* Repeater Section */}
          {repeaterLocation && (
            <div className="bg-gray-50 p-4 rounded">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  <span>⚡️</span>
                  <h4 className="text-sm font-semibold text-red-600">
                    Repeater Station
                  </h4>
                </div>
                {/* Toggle for Repeater Analysis Grid */}
                <div className="flex flex-row items-center gap-2">
                  <span className="text-xs">Show/Hide</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={layerVisibility[MAP_LAYERS.REPEATER_GRID]}
                      onChange={() =>
                        toggleLayerVisibility(MAP_LAYERS.REPEATER_GRID)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <LocationDisplay
                title="Repeater Location"
                location={repeaterLocation}
              />

              {/* Marker-specific sliders arranged side by side */}
              <div className="flex flex-row gap-4 mb-4">
                {/* Marker Grid Range */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Analysis Range:</span>
                    <span>{markerConfigs.repeater.gridRange}m</span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    value={markerConfigs.repeater.gridRange}
                    onChange={(e) =>
                      handleMarkerConfigChange(
                        "repeater",
                        "gridRange",
                        Number(e.target.value)
                      )
                    }
                    className="w-full h-2 bg-red-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                {/* Marker Grid Size */}
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Grid Size:</span>
                    <span>{gridSize}m</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={gridSize}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    className="w-full h-2 bg-red-100 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Elevation Offset */}
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-gray-600">
                  Elevation Offset (m):
                </label>
                <input
                  type="number"
                  value={markerConfigs.repeater.elevationOffset}
                  onChange={(e) =>
                    handleMarkerConfigChange(
                      "repeater",
                      "elevationOffset",
                      Number(e.target.value)
                    )
                  }
                  className="w-20 px-2 py-1 text-xs border rounded"
                />
              </div>

              <button
                onClick={() => handleAnalyzeMarker("repeater")}
                className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:opacity-90"
              >
                Analyze
              </button>
            </div>
          )}

          {/* Results Display */}
          {results && results.stats && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="text-lg font-semibold mb-3">Results</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-600">Visibility</p>
                  <p className="text-lg font-medium">
                    {results.stats.visibleCells}/{results.stats.totalCells}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Average</p>
                  <p className="text-lg font-medium">
                    {results.stats.averageVisibility.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Time</p>
                  <p className="text-lg font-medium">
                    {(results.stats.analysisTime / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Station-to-Station LOS Section */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-4">
          Station-to-Station Line of Sight
        </h3>
        {renderStationToStationUI()}
      </div>

      {/* Modal for the LOS Profile Chart (only shown when user clicks "Show LOS Graph") */}
      {isGraphEnlarged && losProfileData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50"
          onClick={() => setIsGraphEnlarged(false)} // Close modal when clicking outside
        >
          <div
            className="bg-white p-4 rounded relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <button
              onClick={() => setIsGraphEnlarged(false)}
              className="absolute top-2 right-2 text-gray-700 font-bold text-xl focus:outline-none"
            >
              &times;
            </button>
            <Line data={chartData!} options={chartOptions} />
          </div>
        </div>
      )}
    </>
  );
};

export default ELOSAnalysisCard;