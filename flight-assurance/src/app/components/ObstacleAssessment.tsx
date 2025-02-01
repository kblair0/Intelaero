"use client";
import React, { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Line } from "react-chartjs-2";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";
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

export interface ObstacleAssessmentProps {
  flightPlan: GeoJSON.FeatureCollection;
  // Change this: Instead of expecting a wrapper, expect the actual map instance.
  map: mapboxgl.Map;
  onDataProcessed?: (data: ObstacleAnalysisOutput) => void;
}

const ObstacleAssessment = forwardRef<any, ObstacleAssessmentProps>(
  ({ flightPlan, map, onDataProcessed }, ref) => {
    // Defensive Check:
    if (!flightPlan || !flightPlan.features || flightPlan.features.length === 0) {
      return <div className="text-red-500">Please upload a valid flight plan before running the analysis.</div>;
    }

    const [distances, setDistances] = useState<number[]>([]);
    const [flightAltitudes, setFlightAltitudes] = useState<number[]>([]);
    const [terrainElevations, setTerrainElevations] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [waypointDistances, setWaypointDistances] = useState<number[]>([]);
    const { setAnalysisData } = useObstacleAnalysis();

    // Modified: Use the map instance directly (without getMap())
    const getTerrainElevation = async (coordinates: [number, number]): Promise<number> => {
      if (!map) {
        console.error("Map instance not available");
        return 0;
      }
      try {
        // Check if the terrain source exists; if not, add it.
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 15,
          });
          map.setTerrain({
            source: "mapbox-dem",
            exaggeration: 1.5,
          });
          await new Promise<void>((resolve) => {
            const checkSource = () => {
              if (map.isSourceLoaded("mapbox-dem")) {
                resolve();
              } else {
                map.once("sourcedata", () => checkSource());
              }
            };
            checkSource();
          });
        }
        // Directly use map.queryTerrainElevation()
        const elevation = map.queryTerrainElevation(coordinates);
        return elevation ?? 0;
      } catch (error) {
        console.error("Error getting terrain elevation:", error);
        return 0;
      }
    };

    const processTerrainData = async () => {
      try {
        setError(null);

        // Find the LineString feature in the flight plan
        const lineFeature = flightPlan.features.find(
          (feature) => feature.geometry.type === "LineString"
        );
        if (!lineFeature || lineFeature.geometry.type !== "LineString") {
          throw new Error("No valid LineString geometry found.");
        }
        const coordinates = lineFeature.geometry.coordinates as [number, number, number][];
        const flightLine = turf.lineString(
          coordinates.map(([lng, lat]) => [lng, lat])
        );
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
          await new Promise((resolve) => setTimeout(resolve, 10));
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
            const segment = turf.lineString([
              coordinates[idx - 1],
              coordinates[idx],
            ]);
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
        const clearances = interpolatedAltitudes.map(
          (flightAlt, idx) => flightAlt - terrainElevationsArray[idx]
        );
        const minimumClearanceHeight = Math.min(...clearances);
        const highestObstacle = Math.max(...terrainElevationsArray);
        const outputData: ObstacleAnalysisOutput = {
          flightAltitudes: interpolatedAltitudes,
          terrainElevations: terrainElevationsArray,
          distances: distancesArray,
          minimumClearanceHeight,
          highestObstacle,
          error: null,
        };
        setAnalysisData(outputData);
        if (onDataProcessed) {
          onDataProcessed(outputData);
        }
      } catch (err) {
        console.error("Error processing terrain data:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      }
    };

    useImperativeHandle(ref, () => ({
      runAnalysis: processTerrainData,
    }));

    if (error) {
      return <div className="text-red-500">Error: {error}</div>;
    }
    return null;
  }
);

ObstacleAssessment.displayName = "ObstacleAssessment";
export default ObstacleAssessment;
