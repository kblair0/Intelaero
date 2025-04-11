"use client";
import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";
import { useFlightPlanContext } from "../../context/FlightPlanContext";
import { useAreaOfOpsContext, GridCell } from "../../context/AreaOfOpsContext";
import { MapRef } from "../Map"; // Import MapRef type

export interface AOGeneratorRef {
  generateAO: () => void;
}

interface AOGeneratorProps {
  mapRef: React.RefObject<MapRef>; // Change to mapRef
}

const GRID_SIZE = 30; // meters

const isValidBounds = (bounds: number[]): boolean =>
  bounds.length === 4 &&
  bounds[0] >= -180 &&
  bounds[1] >= -90 &&
  bounds[2] <= 180 &&
  bounds[3] <= 90;

const waitForDEM = (map: mapboxgl.Map): Promise<void> => {
  return new Promise((resolve) => {
    const checkDEM = () => {
      if (map.isSourceLoaded("mapbox-dem")) {
        console.log("✅ Terrain data loaded successfully in AOGenerator");
        resolve();
      } else {
        map.once("sourcedata", checkDEM);
      }
    };
    checkDEM();
  });
};

const AOGenerator = forwardRef<AOGeneratorRef, AOGeneratorProps>(({ mapRef }, ref) => {
  const { flightPlan } = useFlightPlanContext();
  const { setAoGeometry, setAoTerrainGrid } = useAreaOfOpsContext();

  const generateAO = async () => {
    if (!flightPlan) {
      console.log("No flight plan available to generate AO.");
      setAoGeometry(null);
      setAoTerrainGrid(null);
      return;
    }

    const map = mapRef.current?.getMap();
    console.log("Map instance:", map);
    console.log("queryTerrainElevation available:", typeof map?.queryTerrainElevation);
    if (!map || typeof map.queryTerrainElevation !== "function") {
      console.log("Map not available or terrain not enabled for elevation sampling.");
      setAoGeometry(null);
      setAoTerrainGrid(null);
      return;
    }

    try {
      // Generate AO geometry
      const coordinates = flightPlan.features[0].geometry.coordinates;
      const line = turf.lineString(coordinates.map((coord: number[]) => [coord[0], coord[1]]));
      const buffer = turf.buffer(line, 1, { units: "kilometers" });
      const aoFeature = buffer;

      console.log("Generated AO geometry:", aoFeature);
      setAoGeometry(turf.featureCollection([aoFeature]));

      // Ensure terrain is loaded
      await waitForDEM(map);

      // Generate terrain grid
      const bbox = turf.bbox(aoFeature);
      if (!isValidBounds(bbox)) {
        throw new Error("Invalid AO bounding box");
      }

      const grid = turf.pointGrid(bbox, GRID_SIZE, {
        units: "meters",
        mask: aoFeature,
      });

      console.log("Generated grid points:", grid.features.length);

      // Generate cells and sample elevations
      const cells: GridCell[] = await Promise.all(
        grid.features.map(async (point, index) => {
          const cell = turf.circle(point.geometry.coordinates, GRID_SIZE / 2, {
            units: "meters",
            steps: 4,
          });

          const center = turf.center(cell.geometry);
          const elevation = map.queryTerrainElevation(center.geometry.coordinates as [number, number]) ?? 0;

          return {
            id: `terrain-cell-${index}`,
            geometry: cell.geometry as GeoJSON.Polygon,
            properties: {
              elevation,
              lastAnalyzed: Date.now(),
            },
          };
        })
      );

      console.log("Generated and sampled terrain grid with", cells.length, "cells");
      setAoTerrainGrid(cells);
    } catch (error) {
      console.error("Error generating AO or grid:", error);
      setAoTerrainGrid(null);
    }
  };

  useImperativeHandle(ref, () => ({
    generateAO,
  }));

  useEffect(() => {
    // Uncomment for automatic generation
    // generateAO();
  }, [flightPlan, mapRef]);

  return null;
});

AOGenerator.displayName = "AOGenerator";
export default AOGenerator;