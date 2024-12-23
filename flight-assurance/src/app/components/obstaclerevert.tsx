import React, { useEffect, useState } from "react";
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
} from "chart.js";

// Register chart components
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Legend, Tooltip);


interface ObstacleAssessmentProps {
  flightPlan: GeoJSON.FeatureCollection; // Flight plan GeoJSON
  onDataProcessed: (data: {
    flightAltitudes: number[];
    terrainElevations: number[];
    distances: number[];
  }) => void;
}

const ObstacleAssessment: React.FC<ObstacleAssessmentProps> = ({ flightPlan, onDataProcessed, }) => 
    {
    const [distances, setDistances] = useState<number[]>([]);
    const [flightAltitudes, setFlightAltitudes] = useState<number[]>([]);
    const [terrainElevations, setTerrainElevations] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processTerrainData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!flightPlan || !flightPlan.features.length) {
          throw new Error("Invalid flight plan data.");
        }

        // Extract coordinates from the first LineString in the flight plan
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
        const flightAltitudes = coordinates.map((coord) => coord[2]); // Extract altitudes
        const distances: number[] = [];
        const terrainElevations: number[] = [];

        // Calculate cumulative distances
        let cumulativeDistance = 0;
        for (let i = 0; i < coordinates.length; i++) {
          if (i > 0) {
            const prevCoord = coordinates[i - 1];
            const currentCoord = coordinates[i];
            cumulativeDistance += turf.distance(
              [prevCoord[0], prevCoord[1]],
              [currentCoord[0], currentCoord[1]],
              { units: "kilometers" }
            );
          }
          distances.push(cumulativeDistance);
        }

        // Query Mapbox DEM for terrain elevations
        for (const [lng, lat] of coordinates) {
          const elevation = await fetchTerrainElevation(lng, lat);
          terrainElevations.push(elevation);
        }

        // Send processed data back to parent
        onDataProcessed?.({ flightAltitudes, terrainElevations, distances });
        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An error occurred during processing."
        );
        setLoading(false);
      }
    };

    processTerrainData();  }, [flightPlan, onDataProcessed]);

const fetchTerrainElevation = async (lng: number, lat: number): Promise<number> => {
    try {
        console.log("Querying terrain for coordinates:", { lng, lat });
        const response = await fetch(
        'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/tilequery/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_SECRET_TOKEN'
        );
    
        if (!response.ok) {
        console.error(`API returned error: ${response.status} ${response.statusText}`);
        return 0; // Default to 0 elevation
        }
    
        const data = await response.json();
        if (!data.features || data.features.length === 0) {
        console.warn("No terrain data available for location:", { lng, lat });
        return 0; // Default elevation
        }
    
        return data.features[0]?.properties.ele || 0; // Extract elevation
    } catch (error) {
        console.error("Error fetching terrain elevation:", error);
        return 0; // Default elevation
    }
    };

    // Prepare data for the chart
const chartData = {
    labels: distances.map((d) => d.toFixed(2)), // X-axis labels (distances)
    datasets: [
      {
        label: "Flight Altitude (m)",
        data: flightAltitudes, // Y-axis values (flight altitudes)
        borderColor: "rgba(75, 192, 192, 1)", // Line color
        backgroundColor: "rgba(75, 192, 192, 0.2)", // Fill color
        fill: true,
      },
      {
        label: "Terrain Elevation (m)",
        data: terrainElevations, // Y-axis values (terrain elevations)
        borderColor: "rgba(255, 99, 132, 1)", // Line color
        backgroundColor: "rgba(255, 99, 132, 0.2)", // Fill color
        fill: true,
      },
    ],
  };
  
  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
    },
  };
  
// Render the loading/error UI
if (loading) {
    return <div>Processing Obstacle Assessment...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  // Render the chart
  return (
    <div>
      <h2>Obstacle Assessment Completed</h2>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
};

export default ObstacleAssessment;