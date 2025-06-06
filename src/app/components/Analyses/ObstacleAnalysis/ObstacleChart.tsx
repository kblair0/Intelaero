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
 * 
 * Tips for Future Reference To avoid scale issues:
 * Use LinearScale for numerical axes like distance or time.
 * Avoid CategoryScale unless plotting discrete categories (e.g., names or dates).
 * Always log x-scale details (min, max, ticks) when debugging chart rendering issues.
 */
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { useObstacleAnalysis } from '../../../context/ObstacleAnalysisContext';
import { useFlightPlanContext } from '../../../context/FlightPlanContext';
import dynamic from 'next/dynamic';
import { TerrainChartData } from '../../../context/ObstacleAnalysisContext';

// Interface for point of interest
interface PointOfInterest {
  distance: number;
  elevation: number;
  type: string;
  clearance?: number;
}

// Props interface
interface ObstacleChartProps {
  data?: TerrainChartData;        // Optional direct data for the chart
  height?: number;                // Chart height in pixels (default: 400)
  showControls?: boolean;         // Whether to show zoom reset button (default: true)
  title?: string;                 // Optional chart title
  showLegend?: boolean;           // Whether to show chart legend (default: true)
  chartRef?: React.RefObject<any>; // Optional external chart ref
}

// Dynamically import the chart component to prevent SSR issues
const LineChart = dynamic(
  () => import('react-chartjs-2').then(mod => mod.Line),
  { ssr: false }
);

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
  
  // Track if we're on the client side
  const [isClient, setIsClient] = useState(false);
  
  // Use provided data or fall back to context data
  const displayData = data || chartData;

  // Setup Chart.js on client side only
  useEffect(() => {
    setIsClient(true);
    
    // Dynamic import and registration of Chart.js components
    const setupChart = async () => {
      try {
        const {
          Chart,
          LinearScale,
          PointElement,
          LineElement,
          Title,
          Tooltip,
          Legend,
          Filler
        } = await import('chart.js');
        
        const zoomPlugin = (await import('chartjs-plugin-zoom')).default;
        
        // Register base components
        Chart.register(
          LinearScale,
          PointElement,
          LineElement,
          Title,
          Tooltip,
          Legend,
          Filler,
          zoomPlugin
        );
        
        // Custom plugin to render waypoint markers and labels
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
        
        // Register custom plugin
        Chart.register(waypointLabelsPlugin);
      } catch (error) {
        console.error('[ObstacleChart] Failed to setup Chart.js:', error);
      }
    };
    
    setupChart();
  }, []);

  // Reset zoom when data changes
  useEffect(() => {
    if (isClient && chartRef.current?.resetZoom && displayData) {
      chartRef.current.resetZoom();
    }
  }, [displayData, chartRef, isClient]);

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

  // If we're still on the server or haven't set up Chart.js yet, show a loading placeholder
  if (!isClient) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg"
        style={{ height: `${height}px` }}
      >
        <p className="text-gray-500">Preparing chart components...</p>
      </div>
    );
  }

  // Compute dynamic x-axis max from flight plan distances
  const xAxisMax = displayData.distances.length > 0 
    ? Math.max(...displayData.distances) * 1.05 // Add 5% buffer
    : 1; // Fallback to 1 km if no distances
  console.log('[ObstacleChart] Computed X-Axis Max (km):', xAxisMax);

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
        order: 2,
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
        stepped: altitudeMode !== 'terrain' ? 'before' : false,
        tension: altitudeMode !== 'terrain' ? 0 : 0.4,
        pointRadius: altitudeMode !== 'terrain' ? 
          displayData.distances.map((_, i) => {
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
      data: displayData.pointsOfInterest.map((poi: PointOfInterest) => ({
        x: poi.distance,
        y: poi.elevation
      })),
      backgroundColor: displayData.pointsOfInterest.map((poi: PointOfInterest) => 
        poi.type === 'collision' ? 'rgba(255,0,0,0.8)' :
        poi.type === 'minimumClearance' ? 'rgba(255,165,0,0.8)' :
        poi.type === 'waypoint' ? 'rgba(0,0,255,0.8)' :
        'rgba(0,0,255,0.8)'
      ),
      borderColor: 'rgba(0,0,0,0.5)',
      borderWidth: 1,
      pointRadius: 6,
      pointStyle: (poi: PointOfInterest) => poi.type === 'waypoint' ? 'triangle' : 'circle',
      showLine: false,
      order: 0,
    });
  }

  // Log final chart dataset
  console.log('[ObstacleChart] Final Chart Dataset:', {
    labels: chartDataset.labels,
    datasets: chartDataset.datasets.map(ds => ({
      label: ds.label,
      data: ds.data
    }))
  });

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
            const flightItem = tooltipItems.find(item => 
              item.dataset.label === 'Flight Path (m)'
            );
            
            const terrainItem = tooltipItems.find(item => 
              item.dataset.label === 'Terrain Elevation (m)'
            );
            
            if (!flightItem || !terrainItem) return '';
            
            const clearance = flightItem.parsed.y - terrainItem.parsed.y;
            let footerText = `Clearance: ${clearance.toFixed(1)}m`;
            
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
        type: 'linear' as const,
        title: { 
          display: true, 
          text: 'Distance (km)' 
        },
        min: 0,
        max: xAxisMax, // Dynamically set based on flight plan distance
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
        <LineChart data={chartDataset} options={chartOptions} ref={chartRef} />
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