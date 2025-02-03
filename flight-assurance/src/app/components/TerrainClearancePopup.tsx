"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Line } from "react-chartjs-2";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
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

// Register the required chart components (if not already registered globally)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TerrainClearancePopupProps {
  onClose: () => void;
}

const TerrainClearancePopup: React.FC<TerrainClearancePopupProps> = ({ onClose }) => {
  // Retrieve the obstacle analysis data from context
  const { analysisData } = useObstacleAnalysis();

  // If there is no analysis data yet, you can return a fallback (or null)
  if (!analysisData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6">
          <p>No analysis data yet...</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // Prepare the data for the chart using the analysisData from context
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

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return "";
            const xVal = tooltipItems[0].parsed.x;
            return `Distance: ${xVal} km`;
          },
          footer: (tooltipItems: any[]) => {
            if (tooltipItems.length === 2) {
              const terrainElevation = tooltipItems[0].parsed.y;
              const flightAltitude = tooltipItems[1].parsed.y;
              const clearance = flightAltitude - terrainElevation;
              return `Clearance: ${clearance.toFixed(2)} m`;
            }
            return "";
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
  };

  // Render the popup as a portal attached to document.body.
  // The popup is a full‑screen fixed overlay with a semi‑transparent background.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-4xl max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Terrain Clearance Analysis</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            Close
          </button>
        </div>
        <div className="mb-4">
          <Line data={chartData} options={chartOptions} />
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Flight Plan Statistics</h3>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Minimum Clearance Height:</span>
            <span>{analysisData.minimumClearanceHeight.toFixed(2)} m</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>Highest Terrain Altitude:</span>
            <span>{analysisData.highestObstacle.toFixed(2)} m</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TerrainClearancePopup;
