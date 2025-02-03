import React, { useEffect, useState, useCallback } from "react";
import { Line } from "react-chartjs-2";
import * as turf from "@turf/turf";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Legend,
  Tooltip,
  Filler,
} from "chart.js";
import { useObstacleAnalysis, ObstacleAnalysisOutput } from "../context/ObstacleAnalysisContext";

// Register chart components
ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Legend,
  Tooltip,
  Filler
);

interface ObstacleAssessmentProps {
  flightPlan: GeoJSON.FeatureCollection;
  map: mapboxgl.Map | null;
  onDataProcessed?: (data: ObstacleAnalysisOutput) => void;
}

const ObstacleAssessment = ({ flightPlan, map, onDataProcessed }: ObstacleAssessmentProps) => {
  const [distances, setDistances] = useState<number[]>([]);
  const [flightAltitudes, setFlightAltitudes] = useState<number[]>([]);
  const [terrainElevations, setTerrainElevations] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [waypointDistances, setWaypointDistances] = useState<number[]>([]);
  const { setAnalysisData } = useObstacleAnalysis();

  const getTerrainElevation = useCallback(async (coordinates: [number, number]): Promise<number> => {
    if (!map) return 0;

    try {
      if (!map.getSource('mapbox-dem')) {
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 15
        });

        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        // Wait for source to load
        await new Promise<void>((resolve) => {
          const checkSource = () => {
            if (map.isSourceLoaded('mapbox-dem')) {
              resolve();
            } else {
              map.once('sourcedata', checkSource);
            }
          };
          checkSource();
        });
      }

      const elevation = map.queryTerrainElevation(coordinates);
      return elevation ?? 0;
    } catch (error) {
      console.error('Error getting terrain elevation:', error);
      return 0;
    }
  }, [map]);

  const processTerrainData = useCallback(async () => {
    if (!flightPlan?.features?.length) return null;

    try {
      setError(null);

      const lineFeature = flightPlan.features.find(
        (feature) => feature.geometry.type === "LineString"
      );
      
      if (!lineFeature || lineFeature.geometry.type !== "LineString") {
        throw new Error("No valid LineString geometry found.");
      }

      const coordinates = lineFeature.geometry.coordinates as [number, number, number][];
      const flightLine = turf.lineString(coordinates.map(([lng, lat]) => [lng, lat]));
      const pathLength = turf.length(flightLine, { units: "meters" });
      const interval = 10; // meters between sampled points
      const sampledPoints: [number, number][] = [];

      for (let i = 0; i <= pathLength; i += interval) {
        const point = turf.along(flightLine, i, { units: "meters" });
        sampledPoints.push(point.geometry.coordinates as [number, number]);
      }

      const terrainElevationsArray: number[] = [];
      for (const point of sampledPoints) {
        const elevation = await getTerrainElevation(point);
        terrainElevationsArray.push(elevation);
      }

      setTerrainElevations(terrainElevationsArray);
      
      const flightAltitudesArray = coordinates.map(([, , alt]) => alt);
      const distancesArray = sampledPoints.map((_, idx) => (idx * interval) / 1000);
      
      const waypointDistancesArray: number[] = [];
      let cumulativeDistance = 0;
      for (let idx = 0; idx < coordinates.length; idx++) {
        if (idx === 0) {
          waypointDistancesArray.push(0);
        } else {
          const segment = turf.lineString([coordinates[idx - 1], coordinates[idx]]);
          const segmentLength = turf.length(segment, { units: "kilometers" });
          cumulativeDistance += segmentLength;
          waypointDistancesArray.push(cumulativeDistance);
        }
      }

      setWaypointDistances(waypointDistancesArray);
      setDistances(distancesArray);

      const interpolatedAltitudes = sampledPoints.map(([lng, lat]) => {
        const nearest = turf.nearestPointOnLine(flightLine, turf.point([lng, lat]));
        const index = nearest.properties.index;
        return coordinates[index][2];
      });

      setFlightAltitudes(interpolatedAltitudes);

      // Calculate minimum clearance height and highest obstacle
      const minimumClearance = Math.min(
        ...interpolatedAltitudes.map((alt, idx) => alt - terrainElevationsArray[idx])
      );
      const maxTerrainHeight = Math.max(...terrainElevationsArray);

      const output = {
        flightAltitudes: interpolatedAltitudes,
        terrainElevations: terrainElevationsArray,
        distances: distancesArray,
        waypointDistances: waypointDistancesArray, 
        minimumClearanceHeight: minimumClearance,
        highestObstacle: maxTerrainHeight
      };

      return output;
    } catch (error) {
      console.error('Error processing terrain data:', error);
      throw error;
    }
  }, [flightPlan, getTerrainElevation]);

  useEffect(() => {
    const handleTerrainAnalysisRequest = async () => {
      if (!flightPlan || !map) return;

      try {
        const data = await processTerrainData();
        if (data) {
          setAnalysisData(data);
          if (onDataProcessed) {
            onDataProcessed(data);
          }
        }
      } catch (error) {
        console.error('Error in terrain analysis:', error);
        setAnalysisData({
          flightAltitudes: [],
          terrainElevations: [],
          distances: [],
          minimumClearanceHeight: 0,
          highestObstacle: 0,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    };

    window.addEventListener('triggerTerrainAnalysis', handleTerrainAnalysisRequest);
    return () => {
      window.removeEventListener('triggerTerrainAnalysis', handleTerrainAnalysisRequest);
    };
  }, [flightPlan, map, processTerrainData, onDataProcessed, setAnalysisData]);

  const chartData = {
    labels: distances.map((d) => d.toFixed(2)),
    datasets: [
      {
        label: "Terrain Elevation (m)",
        data: distances.map((d, idx) => ({
          x: d,
          y: terrainElevations[idx],
        })),
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: true,
        pointRadius: 0,
      },
      {
        label: "Flight Path Altitude (m)",
        data: distances.map((d, idx) => ({
          x: d,
          y: flightAltitudes[idx],
        })),
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        fill: false,
        pointRadius: 2,
        showLine: true,
      },
    ],
  };

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
        position: 'nearest',
        callbacks: {
          title: (tooltipItems: any[]) => {
            if (!tooltipItems.length) return "";
            const xVal = tooltipItems[0].parsed.x;
            return `Distance: ${(xVal/100).toFixed(2)} km`;
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (label.includes('Terrain')) {
              return `Terrain: ${value.toFixed(1)} m`;
            } else if (label.includes('Flight')) {
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
          }
        },
      },
      annotation: {
        animations: {
          numbers: {
            properties: ['x', 'y'],
            type: 'number'
          }
        },
        annotations: {
          clearanceLine: {
            type: 'line',
            borderColor: 'rgba(128, 128, 128, 0.8)',
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
            scaleID: 'x'
          }
        }
      }
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
    // Add hover handlers
    onHover: (event: any, elements: any[], chart: any) => {
      const tooltip = chart.tooltip;
      if (tooltip?.dataPoints?.length === 2) {
        const xValue = tooltip.dataPoints[0].parsed.x;
        const yLow = tooltip.dataPoints[0].parsed.y;
        const yHigh = tooltip.dataPoints[1].parsed.y;
        
        // Update the clearance line
        const clearanceLine = chart.options.plugins.annotation.annotations.clearanceLine;
        clearanceLine.display = true;
        clearanceLine.yMin = yLow;
        clearanceLine.yMax = yHigh;
        clearanceLine.xMin = xValue;
        clearanceLine.xMax = xValue;
        
        chart.update('none');
      }
    }
  };
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default ObstacleAssessment;