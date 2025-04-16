// src/app/components/Analyses/LOSAnalyses/UI/StationLOSAnalysisCard.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import type { GridAnalysisRef } from "../../../../services/GridAnalysis/GridAnalysisController";
import { StationLOSResult, LOSProfilePoint } from "../../../StationLOSAnalysis";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { Line } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

interface StationLOSAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

const StationLOSAnalysisCard: React.FC<StationLOSAnalysisCardProps> = ({ gridAnalysisRef }) => {
  const {
    gcsLocation,
    observerLocation,
    repeaterLocation,
    gcsElevationOffset,
    observerElevationOffset,
    repeaterElevationOffset
  } = useMarkersContext();
  const { isAnalyzing, setError, setIsAnalyzing } = useLOSAnalysis();

  const [sourceStation, setSourceStation] = useState<"gcs" | "observer" | "repeater">("gcs");
  const [targetStation, setTargetStation] = useState<"gcs" | "observer" | "repeater">("observer");
  const [stationLOSResult, setStationLOSResult] = useState<StationLOSResult | null>(null);
  const [losProfileData, setLosProfileData] = useState<LOSProfilePoint[] | null>(null);
  const [isGraphEnlarged, setIsGraphEnlarged] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const stationLocations = {
    gcs: gcsLocation,
    observer: observerLocation,
    repeater: repeaterLocation
  };

  const availableStations = Object.entries(stationLocations)
    .filter(([_, loc]) => loc !== null)
    .map(([type]) => type as "gcs" | "observer" | "repeater");

  useEffect(() => {
    if (availableStations.length >= 2) {
      setSourceStation(availableStations[0]);
      setTargetStation(availableStations[1]);
    } else if (availableStations.length === 1) {
      setSourceStation(availableStations[0]);
    }
  }, [availableStations]);

  const handleRunStationLOS = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
    const source = stationLocations[sourceStation];
    const target = stationLocations[targetStation];
    if (!source || !target) {
      setError(`Both ${sourceStation.toUpperCase()} and ${targetStation.toUpperCase()} locations must be set.`);
      setLocalError(`Both ${sourceStation.toUpperCase()} and ${targetStation.toUpperCase()} locations must be set.`);
      return;
    }
    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent("station_to_station_los_start", { source: sourceStation, target: targetStation });
      const losData = await gridAnalysisRef.current.checkStationToStationLOS(sourceStation, targetStation);
      setStationLOSResult(losData.result);
    } catch (err: any) {
      setError(err.message || "Station LOS analysis failed");
      setLocalError(err.message || "Station LOS analysis failed");
      setStationLOSResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // For demonstration purposes we generate a dummy LOS profile if LOS is obstructed.
  const handleShowLOSGraph = async () => {
    if (!stationLOSResult || stationLOSResult.clear) {
      setError("LOS is clear—no graph to display");
      return;
    }
    const dummyProfile = [
      { distance: 0, terrain: 50, los: 60 },
      { distance: 100, terrain: 55, los: 58 },
      { distance: 200, terrain: 60, los: 56 },
      { distance: 300, terrain: 65, los: 54 }
    ];
    setLosProfileData(dummyProfile);
    setIsGraphEnlarged(true);
  };

  const getStationDisplay = (station: "gcs" | "observer" | "repeater") => {
    const emojis = { gcs: "📡", observer: "🔭", repeater: "⚡️" };
    const names = { gcs: "GCS Station", observer: "Observer Station", repeater: "Repeater Station" };
    return { emoji: emojis[station], name: names[station] };
  };

  const chartData = losProfileData
    ? {
        labels: losProfileData.map(pt => pt.distance.toFixed(0)),
        datasets: [
          {
            label: "Terrain Elevation",
            data: losProfileData.map(pt => pt.terrain),
            borderColor: "rgba(75,192,192,1)",
            backgroundColor: "rgba(75,192,192,0.4)",
            fill: true,
            borderWidth: 1,
            tension: 0.1,
            pointRadius: 0,
          },
          {
            label: "LOS Altitude",
            data: losProfileData.map(pt => pt.los),
            borderColor: "rgba(255,99,132,1)",
            backgroundColor: "rgba(255,99,132,0.2)",
            fill: false,
            borderWidth: 1,
            tension: 0.1,
            pointRadius: 0,
          }
        ]
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: { boxWidth: 12, font: { size: 10 }, padding: 8 }
      }
    },
    scales: {
      x: { title: { display: true, text: "Distance (m)" } },
      y: { title: { display: true, text: "Elevation (m)" } }
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow mb-4">
      <h2 className="text-lg font-semibold mb-2">Station-to-Station LOS Analysis</h2>
      <div className="mb-2">
        <div className="flex flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Source Station</label>
            <select
              value={sourceStation}
              onChange={(e) => setSourceStation(e.target.value as "gcs" | "observer" | "repeater")}
              className="w-full p-2 border rounded text-xs"
            >
              {availableStations.map(station => {
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
              onChange={(e) => setTargetStation(e.target.value as "gcs" | "observer" | "repeater")}
              className="w-full p-2 border rounded text-xs"
            >
              {availableStations.filter(station => station !== sourceStation).map(station => {
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
      </div>
      <button
        onClick={() => {
          trackEvent("station_los_check_click", { source: sourceStation, target: targetStation });
          handleRunStationLOS();
        }}
        disabled={isAnalyzing || sourceStation === targetStation || availableStations.length < 2}
        className={`w-full py-2 rounded ${
          isAnalyzing ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {isAnalyzing ? "Analyzing..." : "Check LOS"}
      </button>
      {stationLOSResult && (
        <div className="mt-4">
          {stationLOSResult.clear ? (
            <p className="text-green-600 text-sm">Clear line of sight between stations.</p>
          ) : (
            <div className="text-red-600 text-sm">
              <p>LOS obstructed.</p>
              <p>
                Obstruction at {stationLOSResult.obstructionDistance?.toFixed(1)} m (
                {(stationLOSResult.obstructionFraction! * 100).toFixed(1)}% along path)
              </p>
              <button
                onClick={handleShowLOSGraph}
                className="mt-2 py-1 px-2 bg-indigo-500 text-white rounded text-xs"
              >
                Show LOS Graph
              </button>
            </div>
          )}
        </div>
      )}
      {isGraphEnlarged && losProfileData && (
        <div className="mt-4 p-2 bg-white rounded shadow">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">LOS Profile Graph</h4>
            <button
              onClick={() => setIsGraphEnlarged(false)}
              className="text-xs text-blue-500 hover:underline"
            >
              Close
            </button>
          </div>
          <div className="relative" style={{ height: "200px" }}>
            {chartData && <Line data={chartData} options={chartOptions} />}
          </div>
        </div>
      )}
      {localError && <div className="mt-2 text-xs text-red-500">{localError}</div>}
    </div>
  );
};

export default StationLOSAnalysisCard;
