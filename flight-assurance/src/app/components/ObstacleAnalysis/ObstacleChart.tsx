/**
 * ObstacleChart.tsx
 * 
 * Purpose:
 * A reusable chart component for visualizing terrain and flight path data.
 * Provides a consistent visualization across different parts of the application.
 * 
 * Related Files:
 * - ObstacleAnalysisContext.tsx: Provides chart data via context
 * - ObstacleChartModal.tsx: Uses this component in a modal popup
 * - ObstacleAnalysisDashboard.tsx: Uses this component in dashboard view
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
import { TerrainChartData } from '../../context/ObstacleAnalysisContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';

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

interface PointOfInterestContext {
  context?: {
    type: string;
  };
}

/**
 * Custom plugin to render waypoint markers and labels
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
      const xPos = x.getPixelForValue(wp.distance);
      
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

interface ObstacleChartProps {
  data?: TerrainChartData;     // Optional direct data for the chart
  height?: number;             // Chart height in pixels (default: 400)
  showControls?: boolean;      // Whether to show zoom reset button (default: true)
  title?: string;              // Optional chart title
  showLegend?: boolean;        // Whether to show chart legend (default: true)
  chartRef?: React.RefObject<any>; // Optional external chart ref
}

/**
 * Renders a terrain profile chart with flight path and waypoints
 */
const ObstacleChart: React.FC<ObstacleChartProps> = ({ 
  data,
  height = 400,
  showControls = true,
  title,
  showLegend = true,
  chartRef: externalChartRef,
}) => {
  const internalChartRef = useRef<any>(null);
  const chartRef = externalChartRef || internalChartRef;
  const { chartData, status } = useObstacleAnalysis();
  const { flightPlan } = useFlightPlanContext();
  const altitudeMode = flightPlan?.features?.[0]?.properties?.waypoints?.[0]?.altitudeMode ?? 'absolute';

  // Use provided data or fall back to context data
  const displayData = data || chartData;

  // Reset zoom when data changes
  useEffect(() => {
    if (chartRef.current?.resetZoom && displayData) {
      chartRef.current.resetZoom();
    }
  }, [displayData, chartRef]);

  // Display loading state
  if (!displayData && status === 'loading') {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-gray-500">Loading terrain analysis...</p>
      </div>
    );
  }

  // Display error state
  if (!displayData && status === 'error') {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-red-500">Error loading terrain analysis.</p>
      </div>
    );
  }

  // If no data is available, show placeholder
  if (!displayData) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-gray-500">No terrain analysis data available.</p>
      </div>
    );
  }

// Prepare chart data
const chartDataset = {
  labels: displayData.distances.map(d => d.toFixed(2)),
  datasets: [
    {
      label: "Terrain Elevation (m)",
      data: displayData.distances.map((d, i) => ({
        x: d,
        y: displayData.terrainElevations[i]
      })),
      borderColor: "rgba(75,192,192,1)",
      backgroundColor: "rgba(75,192,192,0.2)",
      fill: true,
      pointRadius: 0,
      order: 2, // Lower order = drawn later (on top)
    },
    {
      label: "Flight Path (m)",
      data: displayData.distances.map((d, i) => ({
        x: d,
        y: displayData.flightAltitudes[i]
      })),
      borderColor: "rgba(255,99,132,1)",
      borderWidth: 2,
      backgroundColor: "rgba(255,99,132,0.2)",
      fill: false,
      // For absolute/relative modes, use stepped segments to emphasize the direct lines between waypoints
      // For terrain mode, keep smooth curves
      stepped: altitudeMode !== 'terrain' ? 'before' : false,
      tension: altitudeMode !== 'terrain' ? 0 : 0.4,
      // For absolute/relative modes, emphasize waypoints with dots
      pointRadius: altitudeMode !== 'terrain' ? 
        displayData.distances.map((_, i) => {
          // Check if this point is a waypoint
          return displayData.waypoints?.some(wp => Math.abs(wp.distance - displayData.distances[i]) < 0.01) ? 4 : 0;
        }) : 0,
      order: 1,
    }
  ]
};

// Add points of interest dataset if we have any
if (displayData.pointsOfInterest?.length) {
  chartDataset.datasets.push({
    label: "Points of Interest",
    data: displayData.pointsOfInterest.map(poi => ({
      x: poi.distance,
      y: poi.elevation
    })),
    backgroundColor: displayData.pointsOfInterest.map(poi => 
      poi.type === 'collision' ? 'rgba(255,0,0,0.8)' :
      poi.type === 'minimumClearance' ? 'rgba(255,165,0,0.8)' :
      poi.type === 'waypoint' ? 'rgba(0,0,255,0.8)' :
      'rgba(0,0,255,0.8)'
    ),
    borderColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    pointRadius: 6,
    pointStyle: (poi: PointOfInterestContext) => poi.context?.type === 'waypoint' ? 'triangle' : 'circle',
    showLine: false,
    order: 0,
  });
}

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: !!title,
        text: title || '',
      },
      legend: {
        display: showLegend,
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return '';
            const xVal = parseFloat(tooltipItems[0].label);
            return `Distance: ${xVal.toFixed(2)} km`;
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            
            if (label === 'Points of Interest' && displayData.pointsOfInterest) {
              const poiIndex = context.dataIndex;
              const poi = displayData.pointsOfInterest[poiIndex];
              if (poi.type === 'collision') {
                return `Collision: ${value.toFixed(1)}m (${poi.clearance?.toFixed(1)}m below terrain)`;
              } else if (poi.type === 'minimumClearance') {
                return `Min Clearance: ${poi.clearance?.toFixed(1)}m above terrain`;
              } else if (poi.type === 'waypoint') {
                return `Waypoint: ${value.toFixed(1)}m (flight altitude)`;
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
            let footerText = `Clearance: ${clearance.toFixed(1)}m`;
            
            // Add altitude mode info
            if (altitudeMode === 'absolute') {
              footerText += ' (Absolute Mode)';
            } else if (altitudeMode === 'relative') {
              footerText += ' (Relative Mode)';
            } else if (altitudeMode === 'terrain') {
              footerText += ' (Terrain-Following Mode)';
            }
            
            return footerText;
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
        waypoints: displayData.waypoints || [],
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
    <div className="obstacle-chart">
      <div style={{ height: `${height}px` }}>
        <Line data={chartDataset} options={chartOptions} ref={chartRef} />
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

export default ObstacleChart;