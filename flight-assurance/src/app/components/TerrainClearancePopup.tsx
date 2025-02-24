/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Line } from "react-chartjs-2";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
import annotationPlugin from "chartjs-plugin-annotation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { CheckCircle, XCircle } from "lucide-react";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import * as turf from "@turf/turf"; // <-- Added to compute distances

// Register the required chart components (if not already registered globally)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin // Register annotation plugin
);

interface TerrainClearancePopupProps {
  onClose: () => void;
}

const TerrainClearancePopup: React.FC<TerrainClearancePopupProps> = ({ onClose }) => {
  // Retrieve obstacle analysis data (for altitude, clearance, etc.)
  const { analysisData } = useObstacleAnalysis();
  // Retrieve the processed flight plan (which now includes waypointDistances, totalDistance, etc.)
  const { flightPlan } = useFlightPlanContext();

  // Fallback: if either analysis data or flight plan is missing, show a simple message.
  if (!analysisData || !flightPlan) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6">
          <p>No analysis or flight plan data available.</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // Helper function remains unchanged (it uses analysisData for clearance computations)
  const getMinClearanceDistance = (): number | null => {
    const clearances = analysisData.flightAltitudes.map(
      (alt, idx) => alt - analysisData.terrainElevations[idx]
    );
    const minClearance = Math.min(...clearances);
    const index = clearances.indexOf(minClearance);
    return analysisData.distances[index];
  };

  // Prepare chart data using the analysisData fields.
  const chartData = {
    labels: analysisData.distances.map((d) => d.toFixed(2)),
    datasets: [
      {
        label: "Terrain Elevation (m)",
        data: analysisData.terrainElevations,
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        fill: true,
        pointRadius: 0,
      },
      {
        label: "Flight Path Altitude (m)",
        data: analysisData.flightAltitudes,
        borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: false,
        pointRadius: 2,
        showLine: true,
      },
    ],
  };

  // Update: Use the originalCoordinates to compute cumulative distances
  const originalCoords = flightPlan.features?.[0]?.properties?.originalCoordinates || [];
  let cumulativeDistance = 0;
  const waypointAnnotations = originalCoords.map((coord, idx) => {
    if (idx > 0) {
      cumulativeDistance += turf.distance(originalCoords[idx - 1], coord, { units: "kilometers" });
    }
    const waypoint = flightPlan.features?.[0]?.properties?.waypoints?.[idx];
    const labelContent = waypoint
      ? `WP ${idx + 1}: ${waypoint.altitudeMode} (${waypoint.originalAltitude} m)`
      : `WP ${idx + 1}`;
    return {
      [`waypoint_${idx}`]: {
        type: "line",
        mode: "vertical",
        scaleID: "x",
        value: cumulativeDistance * 100,
        borderColor: "rgba(0, 0, 0, 0.6)",
        borderWidth: 1,
        label: {
          enabled: true,
          content: labelContent,
          position: "center",
          rotation: -90,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "#fff",
          font: { size: 10 },
        },
      },
    };
  }).reduce((acc, cur) => ({ ...acc, ...cur }), {});

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
      },
      tooltip: {
        enabled: true,
        position: "nearest",
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
          ...waypointAnnotations,
          clearanceLine: {
            type: "line",
            borderColor: "rgba(128, 128, 128, 0.8)",
            borderWidth: 2,
            display: false,
            enter: (ctx: any) => {
              if (ctx.chart.tooltip?.dataPoints?.length === 2) {
                return true;
              }
              return false;
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-4xl max-h-full overflow-y-auto">
        {/* Popup Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Terrain Clearance Analysis</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 focus:outline-none">
            Close
          </button>
        </div>

        {/* Chart Section */}
        <div className="mb-4">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Flight Plan Statistics Section */}
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Flight Plan Statistics</h3>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Total Distance:</span>
            <span>{flightPlan.totalDistance ? flightPlan.totalDistance.toFixed(2) : "N/A"} km</span>
          </div>
        </div>

        {/* Terrain Clearance Verification Section */}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Terrain Clearance Verification</h3>
          {analysisData.minimumClearanceHeight >= 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle />
              <span>Clearance is safe (no terrain hit).</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle />
              <span>Clearance below ground: {analysisData.minimumClearanceHeight.toFixed(2)} m</span>
            </div>
          )}
          <div className="text-sm text-gray-700 mt-2">
            <div>
              <strong>Minimum Clearance:</strong> {analysisData.minimumClearanceHeight.toFixed(2)} m
            </div>
            {analysisData.flightAltitudes &&
              analysisData.terrainElevations &&
              analysisData.distances && (
                <div>
                  <strong>Closest Approach:</strong> {getMinClearanceDistance()?.toFixed(2)} km along the route
                </div>
              )}
            {analysisData.minimumClearanceHeight < 0 && (
              <div className="text-sm text-red-600">
                The flight path intersects the terrain. Please adjust your plan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TerrainClearancePopup;
