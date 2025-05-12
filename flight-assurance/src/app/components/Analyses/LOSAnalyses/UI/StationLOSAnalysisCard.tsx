"use client";

import React, { useState, useEffect } from "react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { useLOSAnalysis } from "../../../../context/LOSAnalysisContext";
import { useMapContext } from "../../../../context/mapcontext";
import type { GridAnalysisRef } from "../../Services/GridAnalysis/GridAnalysisController";
import { StationLOSResult, LOSProfilePoint } from "../../Types/GridAnalysisTypes";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";
import { Line } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

interface StationLOSAnalysisCardProps {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

const StationLOSAnalysisCard: React.FC<StationLOSAnalysisCardProps> = ({ gridAnalysisRef }) => {
  // Use markers collection instead of individual marker references
  const { markers } = useMarkersContext();
  const { isAnalyzing, setError, setIsAnalyzing } = useLOSAnalysis();
  const { elevationService } = useMapContext();
  
  // State for selected marker IDs instead of marker types
  const [sourceMarkerId, setSourceMarkerId] = useState<string>("");
  const [targetMarkerId, setTargetMarkerId] = useState<string>("");
  
  const [stationLOSResult, setStationLOSResult] = useState<StationLOSResult | null>(null);
  const [losProfileData, setLosProfileData] = useState<LOSProfilePoint[] | null>(null);
  const [isGraphEnlarged, setIsGraphEnlarged] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Group markers by type for easier access
  const markersByType = {
    gcs: markers.filter(m => m.type === 'gcs'),
    observer: markers.filter(m => m.type === 'observer'),
    repeater: markers.filter(m => m.type === 'repeater')
  };

  // Get all available markers
  const availableMarkers = markers.length > 0 ? markers : [];

  // Set initial marker selections when markers change
  useEffect(() => {
    if (availableMarkers.length >= 2) {
      setSourceMarkerId(availableMarkers[0].id);
      setTargetMarkerId(availableMarkers[1].id);
    } else if (availableMarkers.length === 1) {
      setSourceMarkerId(availableMarkers[0].id);
      setTargetMarkerId(""); // Clear target if we don't have enough markers
    } else {
      setSourceMarkerId("");
      setTargetMarkerId("");
    }
  }, [availableMarkers]);

  const handleRunStationLOS = async () => {
    if (!gridAnalysisRef.current) {
      setError("Analysis controller not initialized");
      setLocalError("Analysis controller not initialized");
      return;
    }
  
    // Find the selected source and target markers
    const sourceMarker = markers.find(m => m.id === sourceMarkerId);
    const targetMarker = markers.find(m => m.id === targetMarkerId);
    
    if (!sourceMarker || !targetMarker) {
      const errMsg = "Both source and target markers must be selected.";
      setError(errMsg);
      setLocalError(errMsg);
      return;
    }
  
    try {
      setError(null);
      setLocalError(null);
      
      trackEvent("station_to_station_los_start", { 
        sourceType: sourceMarker.type, 
        targetType: targetMarker.type,
        sourceId: sourceMarkerId,
        targetId: targetMarkerId 
      });

      // Use marker IDs for the station-to-station LOS check
      const losData = await gridAnalysisRef.current.checkStationToStationLOS(
        sourceMarkerId, 
        targetMarkerId
      );

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

  const getStationDisplay = (stationType: "gcs" | "observer" | "repeater") => {
    const emojis = { gcs: "📡", observer: "🔭", repeater: "⚡️" };
    const names = { gcs: "GCS Station", observer: "Observer Station", repeater: "Repeater Station" };
    return { emoji: emojis[stationType], name: names[stationType] };
  };

  // Get a descriptive name for a marker, including its index if there are multiples of same type
  const getMarkerDisplayName = (marker: any) => {
    const { emoji, name } = getStationDisplay(marker.type);
    const markersOfSameType = markersByType[marker.type];
    const markerIndex = markersOfSameType.findIndex(m => m.id === marker.id);
    
    // If there are multiple markers of this type, add an index
    const indexLabel = markersOfSameType.length > 1 ? ` #${markerIndex + 1}` : '';
    
    return `${emoji} ${name}${indexLabel}`;
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

  // Determine if we have enough markers to run an analysis
  const hasEnoughMarkers = availableMarkers.length >= 2;
  
  // Get the source and target marker objects
  const sourceMarker = markers.find(m => m.id === sourceMarkerId);
  const targetMarker = markers.find(m => m.id === targetMarkerId);
  
  // Determine if source and target are valid and different
  const isValidSelection = sourceMarker && targetMarker && sourceMarker.id !== targetMarker.id;

  //debugging
  useEffect(() => {
    console.log('Profile data received:', {
      hasData: !!losProfileData,
      pointCount: losProfileData?.length,
      samplePoints: losProfileData?.slice(0, 3)
    });
  }, [losProfileData]);

  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <p className="text-xs mb-2">Check the direct line of sight between any two stations.</p>
      
      {!hasEnoughMarkers ? (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded mb-2">
          ⚠️ Please place at least two markers on the map to enable station-to-station LOS analysis.
        </div>
      ) : (
        <div className="mb-2">
          <div className="flex flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Source Station</label>
              <select
                value={sourceMarkerId}
                onChange={(e) => setSourceMarkerId(e.target.value)}
                className="w-full p-2 border rounded text-xs"
                disabled={isAnalyzing || availableMarkers.length < 2}
              >
                <option value="" disabled>Select source station</option>
                {availableMarkers.map(marker => (
                  <option key={marker.id} value={marker.id}>
                    {getMarkerDisplayName(marker)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Target Station</label>
              <select
                value={targetMarkerId}
                onChange={(e) => setTargetMarkerId(e.target.value)}
                className="w-full p-2 border rounded text-xs"
                disabled={isAnalyzing || availableMarkers.length < 2}
              >
                <option value="" disabled>Select target station</option>
                {availableMarkers
                  .filter(marker => marker.id !== sourceMarkerId)
                  .map(marker => (
                    <option key={marker.id} value={marker.id}>
                      {getMarkerDisplayName(marker)}
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
        </div>
      )}
      
      <button
        onClick={() => {
          trackEvent("station_los_check_click", { 
            sourceId: sourceMarkerId, 
            targetId: targetMarkerId,
            sourceType: sourceMarker?.type,
            targetType: targetMarker?.type
          });
          handleRunStationLOS();
        }}
        disabled={isAnalyzing || !isValidSelection}
        className={`w-full py-1 text-sm rounded mt-3 ${
          isAnalyzing || !isValidSelection
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