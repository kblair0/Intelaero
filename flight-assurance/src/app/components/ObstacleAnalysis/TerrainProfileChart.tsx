/**
 * TerrainProfileChart.tsx
 * 
 * Purpose:
 * This component renders a chart visualizing the terrain profile and flight path,
 * showing terrain elevation, flight altitude, waypoints, and points of interest
 * (e.g., minimum clearance, collisions). It supports interactive features like
 * zooming, panning, and tooltips.
 * 
 * Related Files:
 * - ObstacleAnalysisContext.tsx: Provides analysis data via useObstacleAnalysis
 * - useFlightPathSampling.ts: Generates sample points for the chart
 * - ObstacleAnalysisDashboard.tsx: Uses this chart in the dashboard UI
 * 
 * Dependencies:
 * - react-chartjs-2: For rendering the line chart
 * - chart.js: Core charting library
 * - chartjs-plugin-zoom: For zoom and pan functionality
 */

import React, { useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { useObstacleAnalysis } from '../../context/ObstacleAnalysisContext';
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
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

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
  zoomPlugin
);

/**
 * Custom plugin to render waypoint markers and labels at the chart bottom
 */
const waypointLabelsPlugin = {
  id: 'waypointLabelsPlugin',
  afterDraw: (chart: any, args: any, options: any) => {
    if (!options?.waypoints?.length) return;
    
    const { ctx, chartArea: { bottom }, scales: { x } } = chart;
    ctx.save();
    
    const markerHeight = options.markerHeight || 10;
    const labelOffset = options.labelOffset || 5;
    
    ctx.font = options.font || "10px sans-serif";
    ctx.fillStyle = options.textColor || "#000";
    ctx.textAlign = options.textAlign || "center";
    ctx.textBaseline = options.textBaseline || "bottom";
    
    options.waypoints.forEach((wp: any) => {
      const xPos = x.getPixelForValue(wp.value);
      
      // Draw marker line
      ctx.beginPath();
      ctx.moveTo(xPos, bottom);
      ctx.lineTo(xPos, bottom - markerHeight);
      ctx.strokeStyle = options.lineColor || "rgba(0,0,0,0.6)";
      ctx.lineWidth = options.lineWidth || 1;
      ctx.stroke();
      
      // Draw label
      ctx.fillText(wp.label, xPos, bottom - markerHeight - labelOffset);
    });
    
    ctx.restore();
  }
};

// Register the custom plugin
ChartJS.register(waypointLabelsPlugin);

interface TerrainProfileChartProps {
  height?: number; // Chart height in pixels (default: 400)
  showControls?: boolean; // Whether to show zoom reset button (default: true)
}

/**
 * Renders a terrain profile chart with flight path and points of interest
 * @param props - Component props
 * @returns JSX.Element
 */
const TerrainProfileChart: React.FC<TerrainProfileChartProps> = ({ 
  height = 400,
  showControls = true
}) => {
  const chartRef = useRef<any>(null);
  const { results, status } = useObstacleAnalysis();

  // Reset zoom when results change
  useEffect(() => {
    if (chartRef.current?.resetZoom && results) {
      chartRef.current.resetZoom();
    }
  }, [results]);

  // Display loading state during analysis
  if (status === 'loading') {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-gray-500">Loading terrain analysis...</p>
      </div>
    );
  }

  // Display error state if analysis fails
  if (status === 'error') {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-red-500">Error loading terrain analysis.</p>
      </div>
    );
  }

  // Check if results and required data are available
  if (!results || !results.samplePoints || results.samplePoints.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-gray-500">No terrain analysis data available.</p>
      </div>
    );
  }

  // Prepare waypoints for the plugin, safely handling pointsOfInterest
  const waypoints = results.pointsOfInterest
    ? results.pointsOfInterest
        .filter((poi: { type: string }) => poi.type === 'waypoint')
        .map((poi: { distanceFromStart: number }, index: number) => ({
          value: poi.distanceFromStart / 1000, // Convert to km for display
          label: `WP ${index + 1}`
        }))
    : [];

  // Prepare chart data for terrain, flight path, and points of interest
  const chartData = {
    labels: results.samplePoints.map(point => 
      (point.distanceFromStart / 1000).toFixed(2)
    ),
    datasets: [
      {
        label: "Terrain Elevation (m)",
        data: results.samplePoints.map(point => ({
          x: point.distanceFromStart / 1000, // Convert to km
          y: point.terrainElevation
        })),
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        fill: true,
        pointRadius: 0,
        order: 2, // Lower order = drawn later (on top)
      },
      {
        label: "Flight Path (m)",
        data: results.samplePoints.map(point => ({
          x: point.distanceFromStart / 1000, // Convert to km
          y: point.flightElevation
        })),
        borderColor: "rgba(255,99,132,1)",
        borderWidth: 2,
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: false,
        pointRadius: 0,
        order: 1,
      },
      // Points of interest dataset (minimum clearance, collisions, waypoints)
      {
        label: "Points of Interest",
        data: results.pointsOfInterest.map(poi => ({
          x: poi.distanceFromStart / 1000, // Convert to km
          y: poi.position[2]
        })),
        backgroundColor: results.pointsOfInterest.map(poi => 
          poi.type === 'collision' ? 'rgba(255,0,0,0.8)' :
          poi.type === 'minimumClearance' ? 'rgba(255,165,0,0.8)' :
          'rgba(0,0,255,0.8)'
        ),
        borderColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        pointRadius: 6,
        pointStyle: 'circle',
        showLine: false,
        order: 0,
      }
    ]
  };

  // Chart options for interactivity and display
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return '';
            return `Distance: ${tooltipItems[0].parsed.x.toFixed(2)} km`;
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            
            if (label === 'Points of Interest') {
              const poiIndex = context.dataIndex;
              const poi = results.pointsOfInterest[poiIndex];
              if (poi.type === 'collision') {
                return `Collision: ${value.toFixed(1)}m (${poi.clearance?.toFixed(1)}m below terrain)`;
              } else if (poi.type === 'minimumClearance') {
                return `Min Clearance: ${poi.clearance?.toFixed(1)}m above terrain`;
              } else {
                return `Waypoint: ${value.toFixed(1)}m (flight altitude)`;
              }
            }
            
            return `${label}: ${value.toFixed(1)}m`;
          },
          footer: (tooltipItems: any[]) => {
            // Find flight path and terrain items
            const flightItem = tooltipItems.find(item => 
              item.dataset.label === 'Flight Path (m)'
            );
            
            const terrainItem = tooltipItems.find(item => 
              item.dataset.label === 'Terrain Elevation (m)'
            );
            
            if (!flightItem || !terrainItem) return '';
            
            const clearance = flightItem.parsed.y - terrainItem.parsed.y;
            return `Clearance: ${clearance.toFixed(1)}m`;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
        },
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x' as const,
        }
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
      x: { 
        title: { 
          display: true, 
          text: 'Distance (km)' 
        } 
      },
      y: { 
        title: { 
          display: true, 
          text: 'Elevation (m)' 
        } 
      }
    },
  };

  return (
    <div className="terrain-profile-chart">
      <div style={{ height: `${height}px` }}>
        <Line data={chartData} options={chartOptions} ref={chartRef} />
      </div>
      
      {showControls && (
        <div className="chart-controls mt-2 flex justify-end gap-2">
          <button 
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            onClick={() => chartRef.current?.resetZoom()}
          >
            Reset Zoom
          </button>
        </div>
      )}
    </div>
  );
};

export default TerrainProfileChart;