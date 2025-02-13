// ELOSAnalysisCard.tsx
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "../context/LocationContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { LocationData } from "../components/Map";
import { MapRef } from "./Map";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { layerManager, MAP_LAYERS } from "./LayerManager";
import StationCard from "./StationCard";
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { analyzeFlightPathVisibility, addVisibilityLayer } from './flightPathVisibilityAnalysis';
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
  const isFlightPlanLoaded = flightPlan !== null && Object.keys(flightPlan).length > 0;
  const [mergedResults, setMergedResults] = useState<AnalysisResults | null>(null);   

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
    setResults,
  } = useLOSAnalysis();

  // Global layer visibility state
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({
    [MAP_LAYERS.ELOS_GRID]: true,
    [MAP_LAYERS.GCS_GRID]: true,
    [MAP_LAYERS.OBSERVER_GRID]: true,
    [MAP_LAYERS.REPEATER_GRID]: true,
    [MAP_LAYERS.MERGED_VISIBILITY]: true,
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
    
      console.log("[Station LOS] Analysis result:", result);
      setStationLOSResult(result);
      setError(null);
    
      if (!result.clear) {
        // Generate the LOS profile for the entire line.
        const profile = await getLOSProfile(effective1, effective2, boundTerrainQuery);
        // Update the obstruction segment overlay based on the profile.
        updateObstructionSegment(map, profile, effective1, effective2, 20);
      } else {
        // Remove any existing obstruction segment overlay.
        removeObstructionSegment(map);
      }
    } catch (error: any) {
      console.error("[Station LOS] Analysis error:", error);
      setError(error.message || "Station LOS check failed");
      setStationLOSResult(null);
      removeObstructionSegment(map);
    }
  };
// Merged Analysis
  const handleMergedAnalysis = async () => {
    if (!mapRef.current) {
      setError("Map not initialized");
      return;
    }
  
    try {
      setIsAnalyzing(true);
      setError(null);
  
      // Get available stations with their configurations
      const stations = [
        { type: 'gcs' as const, location: gcsLocation, config: markerConfigs.gcs },
        { type: 'observer' as const, location: observerLocation, config: markerConfigs.observer },
        { type: 'repeater' as const, location: repeaterLocation, config: markerConfigs.repeater }
      ].filter(s => s.location !== null);
  
      // Run merged analysis
      const results = await mapRef.current.runElosAnalysis({
        mergedAnalysis: true,
        stations
      });
  
      setMergedResults(results);
  
    } catch (error) {
      console.error('Merged analysis error:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  
  //  handler for showing the LOS profile graph.
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

  // Station-to-station LOS UI section
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
        {/* Drop-down selectors for Source and Target Stations */}
        <div className="flex flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Source Station</label>
            <select
              value={sourceStation}
              onChange={(e) =>
                setSourceStation(e.target.value as "gcs" | "observer" | "repeater")
              }
              className="w-full p-2 border rounded text-sm"
            >
              {availableStations.map((station) => {
                const { emoji, name } = getStationDisplay(station);
                return (
                  <option key={station} value={station}>
                    {emoji} {name}
                  </option>
                );
              })}
            </select>
          </div>
  
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Target Station</label>
            <select
              value={targetStation}
              onChange={(e) =>
                setTargetStation(e.target.value as "gcs" | "observer" | "repeater")
              }
              className="w-full p-2 border rounded text-sm"
            >
              {availableStations
                .filter((station) => station !== sourceStation)
                .map((station) => {
                  const { emoji, name } = getStationDisplay(station);
                  return (
                    <option key={station} value={station}>
                      {emoji} {name}
                    </option>
                  );
                })}
            </select>
          </div>
        </div>
  
        {/* Existing buttons for analysis */}
        <div className="flex flex-row gap-4">
          <button
            onClick={handleStationLOSCheck}
            className={`${
              stationLOSResult ? "flex-1" : "w-full"
            } py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed`}
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
  
        {/* Results display remains here */}
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


  const handleFlightPathVisibility = async () => {
    if (!mapRef.current || !flightPlan) {
      setError("Map or flight plan not initialized");
      return;
    }

    // Get all station locations from context
    const stationLocations = {
      gcs: gcsLocation,
      observer: observerLocation,
      repeater: repeaterLocation
    };

    // Check if at least one station is placed
    const hasStations = Object.values(stationLocations).some(location => location !== null);
    if (!hasStations) {
      setError("Please place at least one station on the map");
      return;
    }

    try {
      setIsAnalyzing(true);

      // Run the visibility analysis
      const result = await analyzeFlightPathVisibility(
        mapRef.current.getMap()!,
        flightPlan,
        stationLocations,
        markerConfigs
      );

      // Add the visibility layer to the map
      addVisibilityLayer(mapRef.current.getMap()!, result.segments);

      // Store the results in state
      const visibleCells = Math.round(result.stats.visibleLength);
      const totalCells = Math.round(result.stats.totalLength);
      
      setResults({
        cells: [], // Keep existing cells if any
        stats: {
          visibleCells: Math.round(result.stats.visibleLength),
          totalCells: Math.round(result.stats.totalLength),
          averageVisibility: result.stats.coveragePercentage,
          analysisTime: result.stats.analysisTime
        },
        flightPathVisibility: {
          visibleLength: result.stats.visibleLength,
          totalLength: result.stats.totalLength,
          coveragePercentage: result.stats.coveragePercentage
        }
      });

      // Log the coverage statistics
      console.log("Flight Path Visibility Analysis Results:", {
        totalLength: `${(result.stats.totalLength / 1000).toFixed(2)} km`,
        visibleLength: `${(result.stats.visibleLength / 1000).toFixed(2)} km`,
        coveragePercentage: `${result.stats.coveragePercentage.toFixed(1)}%`,
        analysisTime: `${(result.stats.analysisTime / 1000).toFixed(2)} seconds`
      });

    } catch (error) {
      console.error("Flight path visibility analysis failed:", error);
      setError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

/**
 * Scans the LOS profile and returns the first and last indices where the obstruction occurs.
 * A point is considered obstructed if its terrain elevation exceeds the LOS altitude.
 */
// Assuming LOSProfilePoint is defined as in your StationLOSAnalysis module
const findObstructedSegment = (profile: LOSProfilePoint[]): { startIndex: number; endIndex: number } | null => {
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i].terrain > profile[i].los) {
      if (startIndex === -1) {
        startIndex = i;
      }
      endIndex = i;
    }
  }
  if (startIndex === -1 || endIndex === -1) {
    return null;
  }
  // If only one sample is obstructed and there is room to expand,
  // set the end index to the next sample to create a minimal segment.
  if (startIndex === endIndex && profile.length > startIndex + 1) {
    endIndex = startIndex + 1;
  }
  return { startIndex, endIndex };
};


/**
 * Creates or updates a GeoJSON source and fill layer representing the obstructed segment.
 * It takes the LOS profile, the two effective coordinates, and buffers the line between
 * the first and last obstructed samples.
 */
const updateObstructionSegment = (
  map: mapboxgl.Map,
  profile: LOSProfilePoint[],
  effective1: [number, number, number],
  effective2: [number, number, number],
  bufferWidth: number = 20 // buffer in meters; adjust as needed
): void => {
  const segment = findObstructedSegment(profile);
  if (!segment) return; // No obstructed segment found.
  
  const totalSamples = profile.length - 1;
  const fractionStart = segment.startIndex / totalSamples;
  const fractionEnd = segment.endIndex / totalSamples;

  // Interpolation helper
  const interpolate = (fraction: number, start: [number, number, number], end: [number, number, number]): [number, number] => {
    return [
      start[0] + fraction * (end[0] - start[0]),
      start[1] + fraction * (end[1] - start[1]),
    ];
  };

  const coordStart = interpolate(fractionStart, effective1, effective2);
  const coordEnd = interpolate(fractionEnd, effective1, effective2);

  // Create a line between the start and end of the obstructed segment.
  const segmentLine = turf.lineString([coordStart, coordEnd]);
  // Buffer the line to create a polygon.
  const segmentPolygon = turf.buffer(segmentLine, bufferWidth, { units: 'meters' });

  const sourceId = 'obstruction-segment-source';
  const layerId = 'obstruction-segment-layer';

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(segmentPolygon);
  } else {
    map.addSource(sourceId, {
      type: 'geojson',
      data: segmentPolygon,
    });
    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      layout: {},
      paint: {
        'fill-color': '#ff0000',  // Red fill
        'fill-opacity': 0.3,      // Semi-transparent
      },
    });
  }
};

const removeObstructionSegment = (map: mapboxgl.Map): void => {
  const sourceId = 'obstruction-segment-source';
  const layerId = 'obstruction-segment-layer';
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
};

const renderMergedAnalysisSection = () => {
  const availableStations = [
    gcsLocation && 'gcs',
    observerLocation && 'observer',
    repeaterLocation && 'repeater'
  ].filter(Boolean) as Array<'gcs' | 'observer' | 'repeater'>;

  return (
<div className="mt-4 ml-2 p-4 bg-gray-50 rounded border-l-2 border-accentGold shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-m font-semibold">Merged Visibility Analysis</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs">Show/Hide</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              style={{ height: "6px" }}
              checked={layerVisibility[MAP_LAYERS.MERGED_VISIBILITY]}
              onChange={() => toggleLayerVisibility(MAP_LAYERS.MERGED_VISIBILITY)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      {availableStations.length < 2 ? (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-sm text-yellow-700 rounded">
          ⚠️ Place at least two stations on the map to perform merged visibility analysis.
          {availableStations.length === 1 && (
            <div className="mt-2">
              Currently placed: {getStationDisplay(availableStations[0]).emoji}{" "}
              {getStationDisplay(availableStations[0]).name}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-2">
              Analyse combined visibility from all placed stations, showing areas visible
              to at least one station.
            </p>
            
            {/* Grid Range/Size Control */}
            <div className="flex flex-row gap-4 mt-4">
              {/* Analysis Range Slider */}
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Analysis Range:</span>
                  <span>{elosGridRange}m</span>
                </div>
                <input
                  type="range"
                  style={{ height: "6px" }}
                  min="500"
                  max="2500"
                  step="50"
                  value={elosGridRange}
                  onChange={(e) => setElosGridRange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  disabled={isAnalyzing}
                />
              </div>

              {/* Grid Size Slider */}
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Grid Size:</span>
                  <span>{gridSize === 30 ? '30m: SRTM' : `${gridSize}m`}</span>
                </div>
                <input
                  type="range"
                  style={{ height: "6px" }}
                  min="1"
                  max="100"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>


          {/* Analysis Button */}
          <button
            onClick={handleMergedAnalysis}
            disabled={isAnalyzing}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              isAnalyzing
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {isAnalyzing ? "Analyzing..." : "Run Merged Analysis"}
          </button>

          {/* Results Display */}
          {mergedResults?.stats && (
            <div className="mt-4 p-4 bg-white rounded shadow-sm">
              <h4 className="text-m font-semibold mb-3">Merged Visibility Analysis Results</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-600">Visible Areas</p>
                  <p className="text-lg font-medium">
                    {mergedResults.stats.visibleCells}/{mergedResults.stats.totalCells}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Average Visibility</p>
                  <p className="text-lg font-medium">
                    {mergedResults.stats.averageVisibility.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Analysis Time</p>
                  <p className="text-lg font-medium">
                    {(mergedResults.stats.analysisTime / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

  return (
    <>
      <div>
        {/* Main Analysis Section */}
        <div className="space-y-4 border-l-2 p-2 border-accentGold shadow-sm">

        <div className="flex flex-col space-y-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <span className="text-blue-500 text-base">✈️</span>
            <span className="flex-grow">Drone LOS Analysis</span>
            {/* Toggle for Full Analysis Grid */}
            <div className="flex flex-row items-center gap-2">
              <span className="text-xs">Show/Hide</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  style={{ height: "6px" }}
                  checked={layerVisibility[MAP_LAYERS.ELOS_GRID]}
                  onChange={() => toggleLayerVisibility(MAP_LAYERS.ELOS_GRID)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </h2>
          <span className="text-xs text-gray-500">
            Determine which points along the flight path the drone can see within the selected grid range.
          </span>
        </div>


          {/* Global configuration sliders arranged side by side */}
          <div className="flex flex-row gap-4 mt-4">
            {/* Grid Range Slider */}
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span>Analysis Range:</span>
                <span>{elosGridRange}m</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Distance from your drone to be analysed
              </p>
              <input
                type="range"
                style={{ height: "6px" }}
                min="500"
                max="5000"
                value={elosGridRange}
                onChange={(e) => setElosGridRange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Global Grid Size Slider */}
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span>Grid Size:</span>
                <span>{gridSize === 30 ? '30m: SRTM' : `${gridSize}m`}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                The lower the number, the higher the fidelity
              </p>
              <input
                type="range"
                style={{ height: "6px" }}
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
            className={`w-full py-2 rounded-lg text-m font-medium transition-colors ${
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



          {/* Results Display */}
          {results && results.stats && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="text-m font-semibold mb-3">Drone LOS Analysis Results</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-600">Visibility</p>
                  <p className="text-m font-medium">
                    {results.stats.visibleCells}/{results.stats.totalCells}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Average</p>
                  <p className="text-m font-medium">
                    {results.stats.averageVisibility.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Time</p>
                  <p className="text-m font-medium">
                    {(results.stats.analysisTime / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Station Marker LOS Sections */}
      <div className="mt-6 bg-gray-50 rounded border-l-2 border-accentGold shadow-sm">

        <div>
          {/* Parent Header for the Entire Marker/Station Card Analysis Section */}
          <h3 className="text-base ml-2 font-semibold mb-2">
            Station Based LOS Analysis
          </h3>
          <p className="text-xs ml-2 text-gray-500">
            Determine the LOS of your stations to the surrounding area. Don't forget to include their elevation. </p>

          {/* --- Station Based LOS Analysis Sub-section --- */}
          <div className="mt-4 ml-2 p-4 bg-gray-50 rounded border-l-2 border-accentGold shadow-sm">
          
            {!gcsLocation && !observerLocation && !repeaterLocation && (
              <div className="p-3 mb-3 bg-yellow-100 border border-yellow-400 text-sm text-yellow-700 rounded">
                ⚠️ To unlock 📡GCS Station/🔭Observer Station/⚡️Repeater Station Line of Sight analysis, drop markers on the map.
              </div>
            )}
            <div className="flex flex-col gap-4 w-full">
              {gcsLocation && (
                <StationCard
                  stationType="gcs"
                  location={gcsLocation}
                  markerConfig={markerConfigs.gcs}
                  onChangeConfig={(field, value) =>
                    setMarkerConfig("gcs", { [field]: value })
                  }
                  onAnalyze={() => handleAnalyzeMarker("gcs")}
                  layerVisibility={layerVisibility[MAP_LAYERS.GCS_GRID]}
                  toggleLayerVisibility={() => toggleLayerVisibility(MAP_LAYERS.GCS_GRID)}
                />
              )}
              {observerLocation && (
                <StationCard
                  stationType="observer"
                  location={observerLocation}
                  markerConfig={markerConfigs.observer}
                  onChangeConfig={(field, value) =>
                    setMarkerConfig("observer", { [field]: value })
                  }
                  onAnalyze={() => handleAnalyzeMarker("observer")}
                  layerVisibility={layerVisibility[MAP_LAYERS.OBSERVER_GRID]}
                  toggleLayerVisibility={() => toggleLayerVisibility(MAP_LAYERS.OBSERVER_GRID)}
                />
              )}
              {repeaterLocation && (
                <StationCard
                  stationType="repeater"
                  location={repeaterLocation}
                  markerConfig={markerConfigs.repeater}
                  onChangeConfig={(field, value) =>
                    setMarkerConfig("repeater", { [field]: value })
                  }
                  onAnalyze={() => handleAnalyzeMarker("repeater")}
                  layerVisibility={layerVisibility[MAP_LAYERS.REPEATER_GRID]}
                  toggleLayerVisibility={() => toggleLayerVisibility(MAP_LAYERS.REPEATER_GRID)}
                />
              )}
            </div>
          </div>

          {/* --- Merged Analysis Sub-section --- */}
          <div className="mb-6">
            {renderMergedAnalysisSection()}
          </div>

          {/* --- Flight Path Visibility Analysis Sub-section --- */}
          <div className="mt-4 ml-2 p-4 bg-gray-50 rounded border-l-2 border-accentGold shadow-sm">
            <h4 className="text-m font-semibold mb-2">
              Flight Path Visibility Analysis
            </h4>
            <button
              onClick={handleFlightPathVisibility}
              disabled={!isFlightPlanLoaded || isAnalyzing}
              className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                (!isFlightPlanLoaded || isAnalyzing)
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600 text-white"
              }`}
            >
              {isAnalyzing
                ? "Analyzing..."
                : "Check Visibility from All Stations"}
            </button>
            {results?.stats && (
              <div className="mt-4 p-4 bg-white rounded shadow-sm">
                <h4 className="text-sm font-semibold mb-3">
                  Flight Path Visibility Results
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600">Coverage</p>
                    <p className="text-m font-medium">
                      {(results.stats.averageVisibility).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Visible Length</p>
                    <p className="text-m font-medium">
                      {(results.stats.visibleCells / 1000).toFixed(2)} km
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Analysis Time</p>
                    <p className="text-m font-medium">
                      {(results.stats.analysisTime / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* --- Station-to-Station LOS Sub-section --- */}
          <div className="mt-4 ml-2 p-4 bg-gray-50 rounded border-l-2 border-accentGold shadow-sm">
          <h4 className="text-m font-semibold mb-2">
              Station-to-Station Line of Sight
            </h4>
            {renderStationToStationUI()}
          </div>
        </div>
      </div>


    </div>
    </>
  );
};

export default ELOSAnalysisCard;