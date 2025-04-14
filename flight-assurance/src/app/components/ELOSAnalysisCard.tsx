// ELOSAnalysisCard.tsx
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Info } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
// import { useLocation } from "../context/MarkerContext"; this is now import { useMarkersContext } from '../context/MarkerContext'; this file need updating for this.

import { useMarkersContext } from '../context/MarkerContext';


import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import type { MapRef } from "../types/MapTypes";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { layerManager, MAP_LAYERS } from "../services/LayerManager";
import StationCard from "./StationCard";
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { analyzeFlightPathVisibility, addVisibilityLayer } from './flightPathVisibilityAnalysis';
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

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

interface LocationData {
  lat: number;
  lng: number;
  elevation: number | null;
}

interface MarkerConfig {
  gridRange: number;
  elevationOffset: number;
  [key: string]: any;
}

interface AnalysisResults {
  cells: any[];
  stats: {
    visibleCells: number;
    totalCells: number;
    averageVisibility: number;
    analysisTime: number;
  };
  flightPathVisibility?: {
    visibleLength: number;
    totalLength: number;
    coveragePercentage: number;
  };
}

const ELOSAnalysisCard: React.FC<ELOSAnalysisCardProps> = ({ mapRef }) => {
  // Get location data from LocationContext
  const { 
    gcsLocation, 
    observerLocation, 
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset 
  } = useMarkersContext();
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
  }, [availableStations]);
  

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
    
    const sourceOffset = (() => {
      switch (sourceStation) {
        case 'gcs': return gcsElevationOffset;
        case 'observer': return observerElevationOffset;
        case 'repeater': return repeaterElevationOffset;
        default: throw new Error(`Unknown station type: ${sourceStation}`);
      }
    })();
    const targetOffset = (() => {
      switch (targetStation) {
        case 'gcs': return gcsElevationOffset;
        case 'observer': return observerElevationOffset;
        case 'repeater': return repeaterElevationOffset;
        default: throw new Error(`Unknown station type: ${targetStation}`);
      }
    })();
    
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
      ].filter((s): s is (
        | { type: "gcs"; location: LocationData; config: MarkerConfig }
        | { type: "observer"; location: LocationData; config: MarkerConfig }
        | { type: "repeater"; location: LocationData; config: MarkerConfig }
      ) => s.location !== null);
      
      
  
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
  
    const sourceOffset = (() => {
      switch (sourceStation) {
        case 'gcs': return gcsElevationOffset;
        case 'observer': return observerElevationOffset;
        case 'repeater': return repeaterElevationOffset;
        default: throw new Error(`Unknown station type: ${sourceStation}`);
      }
    })();
    const targetOffset = (() => {
      switch (targetStation) {
        case 'gcs': return gcsElevationOffset;
        case 'observer': return observerElevationOffset;
        case 'repeater': return repeaterElevationOffset;
        default: throw new Error(`Unknown station type: ${targetStation}`);
      }
    })();
  
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
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
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
              className="w-full p-2 border rounded text-xs"
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
              className="w-full p-2 border rounded text-xs"
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
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              trackEvent("station_los_check_click", {
                panel: "ELOSAnalysisCard.tsx",
                source: sourceStation,
                target: targetStation
              });
              handleStationLOSCheck();
            }}
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
              onClick={() => {
                trackEvent("show_los_graph_click", { 
                  panel: "ELOSAnalysisCard.tsx",
                  source: sourceStation,
                  target: targetStation,
                  result: stationLOSResult.clear ? "clear" : "obstructed"
                });
                handleShowLOSGraph();
              }}
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
              <div className="text-green-700 text-sm flex items-center gap-2">
                <span>✓</span>
                <span>Clear line of sight between stations</span>
              </div>
            ) : (
              <div className="text-red-700 text-sm">
                <div className="flex items-center gap-2">
                  <span>✗</span>
                  <span>Line of sight obstructed</span>
                </div>
                <div className="text-xs mt-1">
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
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          boxWidth: 12,
          font: { size: 10 },
          padding: 8,
        },
      },
      tooltip: {
        enabled: true,
        position: "nearest" as const,
        callbacks: {
          title: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return "";
            const xVal = tooltipItems[0].parsed.x;
            return `Distance: ${(xVal / 100).toFixed(2)} km`;
          },
          label: (context: any) => {
            const label = context.dataset.label || "";
            const value = context.parsed.y;
            if (label.includes("Terrain")) {
              return `Terrain: ${value.toFixed(1)} m`;
            } else if (label.includes("Flight")) {
              return `Flight: ${value.toFixed(1)} m`;
            }
            return `${label}: ${value.toFixed(1)} m`;
          },
          footer: (tooltipItems: any[]) => {
            if (tooltipItems.length === 2) {
              const terrainElevation = tooltipItems[0].parsed.y;
              const flightAltitude = tooltipItems[1].parsed.y;
              const clearance = flightAltitude - terrainElevation;
              return `Clearance: ${clearance.toFixed(1)} m`;
            }
            return "";
          },
        },
      },
      annotation: {
        animations: {
          numbers: {
            properties: ["x", "y"],
            type: "number",
          },
        },
        annotations: {
          clearanceLine: {
            type: "line" as const,
            borderColor: "rgba(128, 128, 128, 0.8)",
            borderWidth: 2,
            display: false,
            enter: (ctx: any) => {
              return ctx.chart.tooltip?.dataPoints?.length === 2;
            },
            leave: () => false,
            value: (ctx: any) => {
              const tooltip = ctx.chart.tooltip;
              if (tooltip?.dataPoints?.length === 2) {
                return tooltip.dataPoints[0].parsed.x;
              }
              return 0;
            },
            scaleID: "x",
          },
        },
      },
    },
    layout: {
      padding: 0, // Remove extra padding around the chart
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Distance (km)",
        },
      },
      y: {
        title: {
          display: true,
          text: "Elevation (m)",
        },
      },
    },
    onHover: (event: any, elements: any[], chart: any) => {
      const tooltip = chart.tooltip;
      if (tooltip?.dataPoints?.length === 2) {
        const xValue = tooltip.dataPoints[0].parsed.x;
        const yLow = tooltip.dataPoints[0].parsed.y;
        const yHigh = tooltip.dataPoints[1].parsed.y;
  
        // Update the clearance line annotation
        const clearanceLine = chart.options.plugins.annotation.annotations.clearanceLine;
        clearanceLine.display = true;
        clearanceLine.yMin = yLow;
        clearanceLine.yMax = yHigh;
        clearanceLine.xMin = xValue;
        clearanceLine.xMax = xValue;
  
        chart.update("none");
      }
    },
  };
  
  
  const handleFlightPathVisibility = async () => {
    if (!mapRef.current || !flightPlan) {
      setError("Map or flight plan not initialized");
      return;
    }
  
    const stationLocations = {
      gcs: gcsLocation,
      observer: observerLocation,
      repeater: repeaterLocation
    };
  
    const hasStations = Object.values(stationLocations).some(location => location !== null);
    if (!hasStations) {
      setError("Please place at least one station on the map");
      return;
    }
  
    const elevationOffsets = {
      gcs: gcsElevationOffset,
      observer: observerElevationOffset,
      repeater: repeaterElevationOffset
    };
  
    try {
      setIsAnalyzing(true);
      const result = await analyzeFlightPathVisibility(
        mapRef.current.getMap()!,
        flightPlan,
        stationLocations,
        elevationOffsets
      );
  
      addVisibilityLayer(mapRef.current.getMap()!, result.segments!);
  
      setResults({
        cells: [],
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
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
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
          <div className="flex items-center gap-1 mt-2">
          <Info className="w-10 h-10 text-gray-500" />
            <p className="text-xs text-gray-600 mb-2">
              This tool shows the combined visibility from all placed stations, showing areas visible
              to at least one station.
            </p>
          </div>
            
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
                  max="5000"
                  step="100"
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
            onClick={() => {
              trackEvent("merged_analysis_click", { panel: "ELOSAnalysisCard.tsx" });
              handleMergedAnalysis();
            }}
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
            <div className="mt-4 p-4 bg-white gap-2 rounded shadow-sm">
              <h4 className="text-m font-semibold mb-3">Merged Visibility Analysis Results</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-600">Visible Areas</p>
                  <p className="text-xs font-medium">
                    {mergedResults.stats.visibleCells}/{mergedResults.stats.totalCells}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Average Visibility</p>
                  <p className="text-xs font-medium">
                    {mergedResults.stats.averageVisibility.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Analysis Time</p>
                  <p className="text-xs font-medium">
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
              <div className="flex justify-between text-sm mb-1">
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
              <div className="flex justify-between text-sm mb-1">
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
            onClick={() => {
              trackEvent("elos_full_analysis_click", { panel: "ELOSAnalysisCard.tsx" });
              handleAnalysis();
            }}
            disabled={!isFlightPlanLoaded || isAnalyzing}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              !isFlightPlanLoaded || isAnalyzing
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {isAnalyzing ? "Analyzing..." : "Run Full Analysis"}
          </button>
          
          <div className="flex items-center gap-1 mt-2">
            <Info className="w-12 h-12 text-gray-500" />
            <p className="text-xs text-gray-500">
              This tool allows you to determine where to put your GCS, observer and repeater stations to ensure LOS with your drone.
            </p>
          </div>
          {/* Results Display */}
          {results && results.stats && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <h3 className="text-m font-semibold mb-3">Drone LOS Analysis Results</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-600">Visibility</p>
                  <p className="text-xs font-medium">
                    {results.stats.visibleCells}/{results.stats.totalCells}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Average</p>
                  <p className="text-xs font-medium">
                    {results.stats.averageVisibility.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Time</p>
                  <p className="text-xs font-medium">
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
          <div className="flex items-center gap-1 mx-2">
            <Info className="w-10 h-10 text-gray-500" />
            <p className="text-xs ml-2 text-gray-500">
            This tool shows the LOS of your stations to the surrounding area. Don&apos;t forget to include their elevation. </p>
          </div>

          {/* --- Station Based LOS Analysis Sub-section --- */}
          <div className="mt-4 ml-2 p-4 bg-gray-50 rounded border-l-2 border-accentGold shadow-sm">
          
            {!gcsLocation && !observerLocation && !repeaterLocation && (
              <div className="p-3 mb-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
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
              onClick={() => {
                trackEvent("flight_path_visibility_click", { panel: "ELOSAnalysisCard.tsx" });
                handleFlightPathVisibility();
              }}
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

              {/* Warning message when no station is placed */}
              {(!gcsLocation && !observerLocation && !repeaterLocation) && (
                <div className="mt-2 p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
                  ⚠️ Place at least one station on the map to perform Flight Path Visibility Analysis.
                </div>
              )}
            {results?.stats && (
              <div className="mt-4 p-4 bg-white rounded shadow-sm">
                <h4 className="text-sm font-semibold mb-3">
                  Flight Path Visibility Results
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600">Coverage</p>
                    <p className="text-xs font-medium">
                      {(results.stats.averageVisibility).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Visible Length</p>
                    <p className="text-xs font-medium">
                      {(results.stats.visibleCells / 1000).toFixed(2)} km
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Analysis Time</p>
                    <p className="text-xs font-medium">
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

          {/* Conditionally render the LOS Profile Graph above the buttons */}
          {isGraphEnlarged && losProfileData && (
            <div className="mb-4 p-2 bg-white rounded shadow-md">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">LOS Profile Graph</h4>
                <button
                  onClick={() => setIsGraphEnlarged(false)}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Close
                </button>
              </div>
              {/* Fixed height container for the chart */}
              <div className="relative" style={{ height: "200px" }}>
              <Line data={chartData!} options={chartOptions} />
              </div>
            </div>
          )}
            {/* Render the station-to-station UI */}
            {renderStationToStationUI()}
          </div>

        </div>
      </div>

    </div>
    </>
  );
};

export default ELOSAnalysisCard;