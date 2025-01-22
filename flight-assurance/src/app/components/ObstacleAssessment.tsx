import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import mapboxgl from 'mapbox-gl';
import * as turf from "@turf/turf";
import { MapRef } from "./Map";
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
  map: MapRef;
  onDataProcessed: (data: {
    flightAltitudes: number[];
    terrainElevations: number[];
    distances: number[];
  }) => void;
}

const ObstacleAssessment: React.FC<ObstacleAssessmentProps> = ({
  flightPlan,
  map,
  onDataProcessed,
}) => {
  const [distances, setDistances] = useState<number[]>([]);
  const [flightAltitudes, setFlightAltitudes] = useState<number[]>([]);
  const [terrainElevations, setTerrainElevations] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [waypointDistances, setWaypointDistances] = useState<number[]>([]);

  const getTerrainElevation = async (coordinates: [number, number]): Promise<number> => {
    const mapInstance = map.getMap();
    if (!mapInstance) {
      console.error('Map instance not available');
      return 0;
    }

    try {
      // Check if terrain source exists
      if (!mapInstance.getSource('mapbox-dem')) {
        // Add the terrain source if it doesn't exist
        mapInstance.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 15
        });

        // Set terrain properties
        mapInstance.setTerrain({
          source: 'mapbox-dem',
          exaggeration: 1.5
        });

        // Wait for the source to load
        await new Promise<void>((resolve) => {
          const checkSource = () => {
            if (mapInstance.isSourceLoaded('mapbox-dem')) {
              resolve();
            } else {
              mapInstance.once('sourcedata', () => checkSource());
            }
          };
          checkSource();
        });
      }

      const elevation = mapInstance.queryTerrainElevation(coordinates);
      return elevation ?? 0;
    } catch (error) {
      console.error('Error getting terrain elevation:', error);
      return 0;
    }
  };

  useEffect(() => {
    const processTerrainData = async () => {
      try {
        setError(null);
  
        if (!flightPlan || !flightPlan.features.length) {
          throw new Error("Invalid flight plan data.");
        }
  
        // Step 1: Extract coordinates from LineString
        const lineFeature = flightPlan.features.find(
          (feature) => feature.geometry.type === "LineString"
        );
  
        if (!lineFeature || lineFeature.geometry.type !== "LineString") {
          throw new Error("No valid LineString geometry found.");
        }
  
        const coordinates = lineFeature.geometry.coordinates as [
          number,
          number,
          number
        ][];
  
        // Step 2: Create a LineString and sample points along the path
        const flightLine = turf.lineString(
          coordinates.map(([lng, lat]) => [lng, lat])
        );
        const pathLength = turf.length(flightLine, { units: "meters" });
        const interval = 10; // Distance between sampled points in meters
        const sampledPoints: [number, number][] = [];
  
        for (let i = 0; i <= pathLength; i += interval) {
          const point = turf.along(flightLine, i, { units: "meters" });
          sampledPoints.push(point.geometry.coordinates as [number, number]);
        }
  
        // Step 3: Query terrain elevations for sampled points
        const terrainElevations: number[] = [];
  
        // Add a delay between elevation queries to prevent rate limiting
        for (const point of sampledPoints) {
          const elevation = await getTerrainElevation(point);
          terrainElevations.push(elevation);
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay between queries
        }
  
        // Rest of your existing code...
        setTerrainElevations(terrainElevations);
  
        const flightAltitudes = coordinates.map(([, , alt]) => alt);
        const distances = sampledPoints.map((_, idx) => (idx * interval) / 1000);
  
        onDataProcessed?.({ flightAltitudes, terrainElevations, distances });
  
        // Calculate distances for waypoints
        const waypointDistances: number[] = [];
        let cumulativeDistance = 0;
  
        for (let idx = 0; idx < coordinates.length; idx++) {
          if (idx === 0) {
            waypointDistances.push(0);
          } else {
            const segment = turf.lineString([
              coordinates[idx - 1],
              coordinates[idx],
            ]);
            const segmentLength = turf.length(segment, { units: "kilometers" });
            cumulativeDistance += segmentLength;
            waypointDistances.push(cumulativeDistance);
          }
        }
  
        setWaypointDistances(waypointDistances);
        setDistances(distances);
  
        const interpolatedAltitudes = sampledPoints.map(([lng, lat]) => {
          const nearest = turf.nearestPointOnLine(
            flightLine,
            turf.point([lng, lat])
          );
          const index = nearest.properties.index;
          return coordinates[index][2];
        });
        setFlightAltitudes(interpolatedAltitudes);
  
      } catch (error) {
        console.error('Error processing terrain data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    };
  
    processTerrainData();
  }, [flightPlan, onDataProcessed, map]);

  useEffect(() => {
    console.log('Map object:', map);
    console.log('Map methods:', Object.keys(map));
    // This will help us see what methods are actually available
  }, [map]);
  
  // chart elevation both along the route and at waypoints
  const chartData = {
    labels: distances.map((d) => d.toFixed(2)), // X-axis labels (distances for terrain profile)
    datasets: [
      {
        label: "Terrain Elevation (m)",
        data: distances.map((d, idx) => ({
          x: d, // Distance on the X-axis
          y: terrainElevations[idx], // Elevation on the Y-axis
        })),
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        fill: true,
        pointRadius: 0, // No points for terrain line
      },
      {
        label: "Flight Path Altitude (m)",
        data: distances.map((d, idx) => ({
          x: d, // Distance on the X-axis
          y: flightAltitudes[idx], // Altitude on the Y-axis
        })),
        borderColor: "rgba(255, 99, 132, 1)", // Line color
        backgroundColor: "rgba(255, 99, 132, 0.2)", // Fill color
        fill: false, // No fill below the line
        pointRadius: 2, // Small points along the line
        showLine: true, // Draw a connecting line
      },

      //   This doesn't work yet      {
      //          label: "Waypoints",
      //          data: waypointDistances.map((dist, idx) => ({
      //            x: dist, // Use the cumulative distance as the X-axis value
      //            y: flightAltitudes[idx] || 0, // Y-axis value corresponds to the altitude
      //          })),
      //          borderColor: "rgba(0, 0, 0, 1)", // Marker color
      //          pointRadius: 5, // Marker size
      //          pointStyle: "rect", // Square marker style
      //          showLine: true, // No connecting line
      //        },
    ],
  };

  const chartOptions = {
    responsive: true,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            if (!tooltipItems.length) return "";
            const xVal = tooltipItems[0].parsed.x; 
            const xValInKm = xVal / 100; 
            const xValInMeters = xValInKm * 1000; 
            return `Distance: ${xValInMeters.toFixed(0)} m`;
          },
          footer: (tooltipItems) => {
            if (tooltipItems.length === 2) {
              const terrainElevation = tooltipItems[0].parsed.y;
              const flightAltitude = tooltipItems[1].parsed.y;
              const gap = flightAltitude - terrainElevation;
              return `Separation: ${gap.toFixed(2)} m`;
            }
            return "";
          },
        },
        external: function(context) {
          const { chart, tooltip } = context;
          if (!tooltip || !tooltip.opacity || tooltip.dataPoints.length < 2) return;
  
          const ctx = chart.ctx;
          const point1 = tooltip.dataPoints[0].element;
          const point2 = tooltip.dataPoints[1].element;
  
          if (point1 && point2) {
            const { x: x1, y: y1 } = point1.getProps(['x', 'y']);
            const { x: x2, y: y2 } = point2.getProps(['x', 'y']);
  
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // Customize the line color
            ctx.stroke();
            ctx.restore();
          }
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Distance (kms)",
        },
        ticks: {
          callback: function (_, index) {
            if (index >= distances.length) return "";
            const distance = distances[index];
            const scaling = distances[distances.length - 1] > 10 ? 1 : 0.1;
            return scaling === 1
              ? `${distance.toFixed(1)} km`
              : `${(distance * 1000).toFixed(0)} m`;
          },
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
  
  // Render the error UI
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }
  
  // Render the chart
  return (
    <div>
      <Line
        key={JSON.stringify(chartData)}
        data={chartData}
        //  @ts-expect-error This works
        options={chartOptions}
      />
    </div>
  );
  };
  export default ObstacleAssessment;
  