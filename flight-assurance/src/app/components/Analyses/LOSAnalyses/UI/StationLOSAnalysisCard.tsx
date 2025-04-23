"use client";

import React, { useState, useEffect } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
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
  const { elevationService } = useMapContext();
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
      const errMsg = `Both ${sourceStation.toUpperCase()} and ${targetStation.toUpperCase()} locations must be set.`;
      setError(errMsg);
      setLocalError(errMsg);
      return;
    }
  
    try {
      
      setError(null);
      setLocalError(null);
      trackEvent("station_to_station_los_start", { source: sourceStation, target: targetStation });

      const losData = await gridAnalysisRef.current.checkStationToStationLOS(sourceStation, targetStation);

      setStationLOSResult(losData.result);
      setLosProfileData(losData.profile);

      if (!losData.result.clear && losData.profile?.length) {
        setIsGraphEnlarged(true);
      }
    } catch (err: any) {
      const msg = err.message || "Station LOS analysis failed";
      setError(msg);
      setLocalError(msg);
      setStationLOSResult(null);
      setLosProfileData(null);
    } finally {
      setIsAnalyzing(false);
    }
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
    <div className="bg-white rounded shadow p-3 mb-4">
      <p className="text-xs mb-2">Check the direct line of sight between any two stations.</p>
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
        className={`w-full py-1 text-sm rounded mt-3 ${
          isAnalyzing || sourceStation === targetStation || availableStations.length < 2
            ? "bg-gray-300 cursor-not-allowed"
            : "bg-blue-500 hover:bg-blue-600 text-white text-sm"
        }`}
      >
        {isAnalyzing ? "Analysing..." : "Check LOS"}
      </button>
      {stationLOSResult && (
        <div className="mt-4">
          {stationLOSResult.clear ? (
            <p className="text-green-600 text-xs">✅ Clear line of sight between stations.</p>
          ) : (
            <div className="p-2 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
              ⚠️ LOS obstructed. Obstruction at <strong>{stationLOSResult.obstructionDistance?.toFixed(1)} m</strong> (
              {(stationLOSResult.obstructionFraction! * 100).toFixed(1)}% along path)
              <div className="mt-2">
                <button
                  onClick={() => setIsGraphEnlarged(true)}
                  className="py-1 px-2 bg-indigo-500 text-white rounded text-xs"
                >
                  Show LOS Graph
                </button>
              </div>
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