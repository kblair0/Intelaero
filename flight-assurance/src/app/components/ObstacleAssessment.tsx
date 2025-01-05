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
  flightPlan: GeoJSON.FeatureCollection; // Flight plan GeoJSON
  onDataProcessed: (data: {
    flightAltitudes: number[];
    terrainElevations: number[];
    distances: number[];
  }) => void;
}

const ObstacleAssessment: React.FC<ObstacleAssessmentProps> = ({
  flightPlan,
  onDataProcessed,
}) => {
  const [distances, setDistances] = useState<number[]>([]);
  const [flightAltitudes, setFlightAltitudes] = useState<number[]>([]);
  const [terrainElevations, setTerrainElevations] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [waypointDistances, setWaypointDistances] = useState<number[]>([]);

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

        for (let i = 0; i < sampledPoints.length; i++) {
          const [lng, lat] = sampledPoints[i];
          const elevation = await fetchTerrainElevation(lng, lat);
          terrainElevations.push(elevation);
        }

        // Update state after fetching all elevations
        setTerrainElevations(terrainElevations);

        // Step 4: Prepare datasets for the graph
        const flightAltitudes = coordinates.map(([, , alt]) => alt); // Altitudes from waypoints
        const distances = sampledPoints.map(
          (_, idx) => (idx * interval) / 1000
        ); // Distances in km

        // Notify parent component
        onDataProcessed?.({ flightAltitudes, terrainElevations, distances });

        // Calculate distances for waypoints
        const waypointDistances: number[] = [];
        let cumulativeDistance = 0;

        for (let idx = 0; idx < coordinates.length; idx++) {
          if (idx === 0) {
            waypointDistances.push(0); // First waypoint is always at 0
          } else {
            // const from = turf.point(coordinates[idx - 1]); // Previous waypoint
            // const to = turf.point(coordinates[idx]); // Current waypoint
            const segment = turf.lineString([
              coordinates[idx - 1],
              coordinates[idx],
            ]); // Segment between waypoints
            const segmentLength = turf.length(segment, { units: "kilometers" });
            cumulativeDistance += segmentLength; // Add segment length to cumulative distance
            waypointDistances.push(cumulativeDistance); // Push the updated distance
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
          return coordinates[index][2]; // Use the altitude from the nearest waypoint
        });
        setFlightAltitudes(interpolatedAltitudes);
      } catch (error) {
        console.error(error);
      }
    };

    processTerrainData();
  }, [flightPlan, onDataProcessed]);

  const fetchTerrainElevation = async (
    lng: number,
    lat: number
  ): Promise<number> => {
    try {
      const tileSize = 512; // Size of Mapbox tiles
      const zoom = 15; // Adjust as needed for fidelity
      const scale = Math.pow(2, zoom);

      // Fix: Calculate latitude in radians
      const latRad = (lat * Math.PI) / 180;

      // Calculate tile indices
      const tileX = Math.floor(((lng + 180) / 360) * scale);
      const tileY = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
          2) *
          scale
      );

      // Calculate pixel position within the tile
      const pixelX = Math.floor(
        (((lng + 180) / 360) * scale - tileX) * tileSize
      );
      const pixelY = Math.floor(
        (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
          2) *
          scale -
          tileY) *
          tileSize
      );

      // Fetch the raster DEM tile
      const tileURL = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
      const response = await fetch(tileURL);

      if (!response.ok) {
        console.error(`Failed to fetch terrain tile: ${response.statusText}`);
        return 0;
      }

      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      // Read pixel data from the image
      const canvas = document.createElement("canvas");
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to create canvas context for terrain tile.");
      }

      context.drawImage(imageBitmap, 0, 0);
      const imageData = context.getImageData(0, 0, tileSize, tileSize);

      // Decode the elevation from RGB
      const idx = (pixelY * tileSize + pixelX) * 4;

      const [r, g, b] = [
        imageData.data[idx],
        imageData.data[idx + 1],
        imageData.data[idx + 2],
      ];
      const elevation = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;

      return elevation;
    } catch (error) {
      console.error("Failed to fetch or decode terrain elevation:", {
        lng,
        lat,
        error,
      });
      return NaN; // Return NaN for failed queries to indicate missing data
    }
  };

  // Interpolate waypoints to match terrain density
  // const interpolatedWaypoints = distances.map((d) => {
  //   // Find the closest waypoint before and after this distance
  //   const lowerIdx = waypointDistances.findIndex((wd) => wd > d) - 1;
  //   const upperIdx = lowerIdx + 1;

  //   if (lowerIdx < 0) return { x: d, y: flightAltitudes[0] }; // Use first altitude if below range
  //   if (upperIdx >= waypointDistances.length) return { x: d, y: flightAltitudes[flightAltitudes.length - 1] }; // Use last altitude if above range

  //   // Interpolate altitude
  //   const lowerDist = waypointDistances[lowerIdx];
  //   const upperDist = waypointDistances[upperIdx];
  //   const lowerAlt = flightAltitudes[lowerIdx];
  //   const upperAlt = flightAltitudes[upperIdx];

  //   const ratio = (d - lowerDist) / (upperDist - lowerDist);
  //   const interpolatedAltitude = lowerAlt + ratio * (upperAlt - lowerAlt);

  //   return { x: d, y: interpolatedAltitude };
  // });

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
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Distance (kms)", // Adjusted dynamically
        },
        ticks: {
          callback: function (_: number, index: number) {
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
  console.log("Chart Data:", chartData);
};

export default ObstacleAssessment;
