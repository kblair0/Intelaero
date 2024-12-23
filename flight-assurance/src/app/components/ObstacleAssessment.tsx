import React, { useState, useEffect } from "react";
import * as turf from "@turf/turf";

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
  // Move useState hooks inside the functional component
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
      


  // Render the loading/error UI
  if (loading) {
    return <div>Processing Obstacle Assessment...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return <div>Obstacle Assessment Completed</div>;
};

export default ObstacleAssessment;
