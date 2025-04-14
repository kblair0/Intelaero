// src/components/AO/AOGenerator.tsx

"use client";
import React, { useImperativeHandle, forwardRef } from "react";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";
import { useFlightPlanContext } from "../../context/FlightPlanContext";
import { useAreaOfOpsContext, GridCell } from "../../context/AreaOfOpsContext";
// Change this import to use the types file
import type { MapRef } from "../../types/MapTypes";

import { layerManager, MAP_LAYERS } from "../../services/LayerManager";

export interface AOGeneratorRef {
  generateAO: () => void;
}

interface AOGeneratorProps {
  mapRef: React.RefObject<MapRef>;
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
  const { aoGeometry, setAoGeometry, setAoTerrainGrid } = useAreaOfOpsContext();

  const generateAO = async () => {
    let sourceGeometry: GeoJSON.Feature | undefined;
    if (flightPlan) {
      const coordinates = flightPlan.features[0].geometry.coordinates;
      const line = turf.lineString(coordinates.map((coord: number[]) => [coord[0], coord[1]]));
      const buffer = turf.buffer(line, 1, { units: "kilometers" });
      sourceGeometry = buffer;
    } else if (aoGeometry && aoGeometry.features.length > 0) {
      sourceGeometry = aoGeometry.features[0];
    } else {
      console.log("No flight plan or AO geometry available to generate AO.");
      setAoTerrainGrid(null);
      return;
    }

    console.log("AOGenerator using geometry:", sourceGeometry);

    const map = mapRef.current?.getMap();
    if (!map || typeof map.queryTerrainElevation !== "function") {
      console.log("Map not available or terrain not enabled for elevation sampling.");
      setAoTerrainGrid(null);
      return;
    }

    try {
      // Wait until DEM is ready.
      await waitForDEM(map);

      // Update aoGeometry in context
      const featureCollection = turf.featureCollection([sourceGeometry]);
      setAoGeometry(featureCollection);

      // Add area-of-operations-outline layer
      layerManager.addLayer(
        MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE,
        {
          type: "geojson",
          data: featureCollection,
        },
        {
          id: MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE,
          type: "line",
          paint: {
            "line-color": "#000000",
            "line-width": 2,
            "line-opacity": 0.8,
          },
        }
      );
      console.log("Added area-of-operations-outline layer");

      // Generate terrain grid
      const bbox = turf.bbox(sourceGeometry);
      if (!isValidBounds(bbox)) {
        throw new Error("Invalid AO bounding box");
      }
      const grid = turf.pointGrid(bbox, GRID_SIZE, {
        units: "meters",
        mask: sourceGeometry,
      });
      console.log("Generated grid points:", grid.features.length);

      // Generate cells by sampling terrain elevation
      const cells: GridCell[] = await Promise.all(
        grid.features.map(async (point, index) => {
          const cell = turf.circle(point.geometry.coordinates, GRID_SIZE / 2, {
            units: "meters",
            steps: 4,
          });
          const center = turf.center(cell.geometry);
          const elevation =
            map.queryTerrainElevation(center.geometry.coordinates as [number, number]) ?? 0;
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

      // Add AOterrain-grid-layer below the outline
      const gridFeatureCollection = turf.featureCollection(cells.map(cell => ({
        type: "Feature",
        geometry: cell.geometry,
        properties: cell.properties,
      })));
      layerManager.addLayer(
        MAP_LAYERS.AOTERRAIN_GRID,
        {
          type: "geojson",
          data: gridFeatureCollection,
        },
        {
          id: MAP_LAYERS.AOTERRAIN_GRID,
          type: "fill",
          paint: {
            "fill-color": "#ff0000",
            "fill-opacity": 0.5,
            "fill-outline-color": "#000000",
          },
        },
        undefined,
        MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE // Place below outline
      );
      console.log("Added AOterrain-grid-layer");

      setAoTerrainGrid(cells);
    } catch (error) {
      console.error("Error generating AO or grid:", error);
      setAoTerrainGrid(null);
      setAoGeometry(null);
    }
  };

  useImperativeHandle(ref, () => ({
    generateAO,
  }));

  return null;
});

AOGenerator.displayName = "AOGenerator";
export default AOGenerator;