/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Line } from "react-chartjs-2";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
import zoomPlugin from "chartjs-plugin-zoom";
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
import * as turf from "@turf/turf";

// Custom plugin to render waypoint markers and labels at the chart bottom
const waypointLabelsPlugin = {
  id: "waypointLabelsPlugin",
  afterDraw: (chart: any, args: any, options: any) => {
    const { ctx, chartArea: { bottom }, scales: { x } } = chart;
    if (!options?.waypoints) return;
    
    ctx.save();
    ctx.font = options.font || "10px sans-serif";
    ctx.fillStyle = options.textColor || "#000";
    ctx.textAlign = options.textAlign || "center";
    ctx.textBaseline = options.textBaseline || "bottom";

    const markerHeight = options.markerHeight || 10;
    const labelOffset = options.labelOffset || 5;

    options.waypoints.forEach((wp: any) => {
      const xPos = x.getPixelForValue(wp.value);
      ctx.beginPath();
      ctx.moveTo(xPos, bottom);
      ctx.lineTo(xPos, bottom - markerHeight);
      ctx.strokeStyle = options.lineColor || "rgba(0,0,0,0.6)";
      ctx.lineWidth = options.lineWidth || 1;
      ctx.stroke();
      ctx.fillText(wp.label, xPos, bottom - markerHeight - labelOffset);
    });
    ctx.restore();
  },
};

// Register ChartJS components and plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
  waypointLabelsPlugin
);

interface TerrainClearancePopupProps {
  onClose: () => void;
}

const TerrainClearancePopup: React.FC<TerrainClearancePopupProps> = ({ onClose }) => {
  const chartRef = useRef<any>(null);
  const { analysisData } = useObstacleAnalysis();
  const { flightPlan } = useFlightPlanContext();

  // Cleanup effect for chart instance
  useEffect(() => {
    // Capture the current chart instance at the time the effect runs
    const chartInstance = chartRef.current;

    // Cleanup function
    return () => {
      if (chartInstance) {
        try {
          chartInstance.options.onHover = () => {};
          chartInstance.stop();
          chartInstance.destroy();
        } catch (error) {
          console.error("Error destroying chart:", error);
        }
      }
    };
  }, []); // Empty dependency array since this is a one-time setup/cleanup

  // Handle popup closure with chart cleanup
  const handleClose = () => {
    const chartInstance = chartRef.current;
    if (chartInstance) {
      try {
        chartInstance.options.onHover = () => {};
        chartInstance.stop();
        chartInstance.destroy();
      } catch (error) {
        console.error("Error during chart cleanup:", error);
      }
    }
    onClose();
  };

  // Early return if required data is missing
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

  // Calculate distance of minimum terrain clearance
  const getMinClearanceDistance = (): number | null => {
    const clearances = analysisData.flightAltitudes.map(
      (alt, idx) => alt - analysisData.terrainElevations[idx]
    );
    const minClearance = Math.min(...clearances);
    const index = clearances.indexOf(minClearance);
    return analysisData.distances[index];
  };

  // Prepare chart data for terrain and flight path
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

  // Calculate waypoint positions from flight plan coordinates
  const originalCoords = flightPlan.features?.[0]?.properties?.originalCoordinates || [];
  let cumulativeDistance = 0;
  const waypoints = originalCoords.map((coord: any, idx: number) => {
    if (idx > 0) {
      cumulativeDistance += turf.distance(
        originalCoords[idx - 1],
        coord,
        { units: "kilometers" }
      );
    }
    return {
      value: cumulativeDistance * 100,
      label: `WP ${idx + 1}`,
    };
  });

  // Configure chart options including plugins
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
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x" as const,
        },
        pan: {
          enabled: true,
          mode: "x" as const,
        },
      },
      waypointLabelsPlugin: {
        waypoints,
        font: "10px sans-serif",
        textColor: "#000",
        textAlign: "center",
        textBaseline: "bottom",
        lineColor: "rgba(0,0,0,0.6)",
        lineWidth: 1,
        markerHeight: 10,
        labelOffset: 5,
      },
    },
    scales: {
      x: { title: { display: true, text: "Distance (km)" } },
      y: { title: { display: true, text: "Elevation (m)" } },
    },
  };

  // Render popup via portal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-4xl max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">Terrain Clearance Analysis</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            Close
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">Use mouse wheel to zoom, drag to pan.</p>

        <div className="mb-4" style={{ height: "400px" }}>
          <Line data={chartData} options={chartOptions} ref={chartRef} />
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Flight Plan Statistics</h3>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Total Distance:</span>
            <span>{flightPlan.totalDistance ? flightPlan.totalDistance.toFixed(2) : "N/A"} km</span>
          </div>
        </div>

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