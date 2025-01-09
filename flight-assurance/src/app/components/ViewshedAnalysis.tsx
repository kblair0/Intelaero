"use client";
import React, { useState, forwardRef, useImperativeHandle } from "react";
import * as turf from "@turf/turf";
import mapboxgl from "mapbox-gl";

/**
 * 1) This interface is what we'll "expose" via ref to the Map.tsx
 */
export interface ViewshedAnalysisRef {
  runAnalysis: () => void;
}

/**
 * 2) Props for the ViewshedAnalysis component
 */
interface ViewshedAnalysisProps {
  map: mapboxgl.Map;
  flightPlan: GeoJSON.FeatureCollection; // Drone flight path from Map.tsx (LineString)
  maxRange: number;
  angleStep: number;
  samplingInterval: number;
  skipUnion: boolean;
  viewshedLoading?: (loading: boolean) => void;
}

/**
 * 3) We also define the DecodedTile interface OUTSIDE the component
 */
interface DecodedTile {
  data: Uint8ClampedArray; // RGBA pixel data for the entire tile (512x512)
  width: number;
  height: number;
}

/**
 * 4) We maintain a cache of downloaded terrain-rgb tiles
 */
const tileCache = new Map<string, DecodedTile>();

/**
 * 5) removeOldCoverageLayers helper: Removes old layers/polygons to avoid duplication
 */
const removeOldCoverageLayers = (mapRef: mapboxgl.Map) => {
  const layerIds = mapRef.getStyle().layers?.map((l) => l.id) || [];
  const coverageLayers = layerIds.filter((id) => id.includes("drone-coverage-layer"));

  coverageLayers.forEach((layerId) => {
    const sourceId = mapRef.getLayer(layerId)?.source;
    if (sourceId && typeof sourceId === "string") {
      mapRef.removeLayer(layerId);
      if (mapRef.getSource(sourceId)) {
        mapRef.removeSource(sourceId);
      }
    }
  });

  // Also remove union coverage if present
  if (mapRef.getLayer("drone-coverage-layer-union")) {
    mapRef.removeLayer("drone-coverage-layer-union");
  }
  if (mapRef.getSource("drone-coverage-union")) {
    mapRef.removeSource("drone-coverage-union");
  }
};

/**
 * 6) Convert [lng, lat] to tile x,y coordinates for a given zoom
 */
function lngLatToTile(lng: number, lat: number, zoom = 14) {
  const scale = 1 << zoom;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      scale
  );
  return { x, y };
}

/**
 * 7) Download and decode a terrain-rgb tile into a Uint8ClampedArray
 */
async function fetchAndDecodeTile(tileURL: string): Promise<DecodedTile | null> {
  try {
    const response = await fetch(tileURL);
    if (!response.ok) {
      console.error("Failed to fetch DEM tile:", tileURL);
      return null;
    }
    const blob = await response.blob();

    // Convert to ImageBitmap
    const imageBitmap = await createImageBitmap(blob);

    // Draw on canvas
    const tileSize = 512; // we assume 512 for mapbox terrain-rgb
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, tileSize, tileSize);

    return {
      data: imageData.data, // Uint8ClampedArray
      width: tileSize,
      height: tileSize,
    };
  } catch (error) {
    console.error("Error fetching/decoding tile:", tileURL, error);
    return null;
  }
}

/**
 * 8) Retrieve or fetch+decode a tile for (x,y,zoom). Returns DecodedTile or null.
 */
async function getDecodedTile(x: number, y: number, zoom = 14): Promise<DecodedTile | null> {
  const tileURL = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${x}/${y}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;

  // Check cache first
  if (tileCache.has(tileURL)) {
    return tileCache.get(tileURL)!;
  }

  // Otherwise, fetch and decode
  const decoded = await fetchAndDecodeTile(tileURL);
  if (decoded) {
    tileCache.set(tileURL, decoded);
    return decoded;
  }
  return null;
}

/**
 * 9) Get the terrain elevation (in meters) at [lng, lat] from the cached tile data
 */
async function getElevation(lng: number, lat: number): Promise<number> {
  const zoom = 14;
  const tileSize = 512;

  const { x, y } = lngLatToTile(lng, lat, zoom);

  const scale = 1 << zoom;
  const latRad = (lat * Math.PI) / 180;
  const pixelX = Math.floor((((lng + 180) / 360) * scale - x) * tileSize);
  const pixelY = Math.floor(
    (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      scale -
      y) *
      tileSize
  );

  const decodedTile = await getDecodedTile(x, y, zoom);
  if (!decodedTile) {
    // If failed to load, return 0 or NaN
    return 0;
  }

  const { data, width } = decodedTile;
  const idx = (pixelY * width + pixelX) * 4;
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  // const a = data[idx + 3]; // alpha channel not used

  // Per Mapbox docs:  elevation = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1
  const elevation = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  return elevation;
}

/**
 * 10) For each vantage point, generate a coverage polygon via "raycasting"
 */
async function getCoveragePolygon(
  vantage: [number, number, number],
  angleStep: number,
  range: number,
  increment = 50
): Promise<turf.Feature<turf.Polygon>> {
  const [lng, lat, alt] = vantage;
  const groundElev = await getElevation(lng, lat);
  const vantageAbsoluteAlt = groundElev + alt;

  const boundaryPoints: [number, number][] = [];

  for (let angle = 0; angle < 360; angle += angleStep) {
    let currentDistance = 0;
    let lastVisible: [number, number] = [lng, lat];

    while (currentDistance <= range) {
      currentDistance += increment;

      const bearingRad = (angle * Math.PI) / 180;
      const dx = currentDistance * Math.cos(bearingRad);
      const dy = currentDistance * Math.sin(bearingRad);

      const earthCircumLat = 111_320; // ~ meters per degree latitude
      const earthCircumLng = 111_320 * Math.cos((lat * Math.PI) / 180);

      const targetLat = lat + dy / earthCircumLat;
      const targetLng = lng + dx / earthCircumLng;

      const terrainAlt = await getElevation(targetLng, targetLat);

      if (terrainAlt > vantageAbsoluteAlt) {
        // Blocked line of sight
        break;
      } else {
        lastVisible = [targetLng, targetLat];
      }
    }
    boundaryPoints.push(lastVisible);
  }

  // Close polygon
  boundaryPoints.push(boundaryPoints[0]);
  return turf.polygon([[...boundaryPoints]]);
}

/**
 * 11) The actual ViewshedAnalysis component
 */
const ViewshedAnalysis = forwardRef<ViewshedAnalysisRef, ViewshedAnalysisProps>(
  ({ map, flightPlan, maxRange, angleStep, samplingInterval, skipUnion, viewshedLoading }, ref) => {
    const [loading, setLoading] = useState(false);

    // This function runs when we want to do the viewshed analysis
    const handleViewshedClick = async () => {
      if (!map || !flightPlan?.features?.length) return;
      setLoading(true);
      viewshedLoading?.(true);
      try {
        // 1) Find the flight path (LineString)
        const lineFeature = flightPlan.features.find(
          (f) => f.geometry.type === "LineString"
        );
        if (!lineFeature) {
          console.error("No LineString found in flightPlan");
          return;
        }

        // 2) Sample the path every `samplingInterval` meters
        const line = turf.lineString(
          (lineFeature.geometry as turf.LineString).coordinates
        );
        const totalLength = turf.length(line, { units: "meters" });

        const samplePoints: turf.Feature<turf.Point>[] = [];
        for (let dist = 0; dist <= totalLength; dist += samplingInterval) {
          const sample = turf.along(line, dist, { units: "meters" });
          samplePoints.push(sample);
        }

        // Ensure the very end is included
        const endCoord = line.geometry.coordinates[line.geometry.coordinates.length - 1];
        if (
          samplePoints.length === 0 ||
          samplePoints[samplePoints.length - 1].geometry.coordinates.toString()
            !== endCoord.toString()
        ) {
          samplePoints.push(turf.point(endCoord));
        }

        // 3) For each sample point, get coverage polygon
        const coveragePolygons: turf.Feature<turf.Polygon>[] = [];
        for (let i = 0; i < samplePoints.length; i++) {
          const coords = samplePoints[i].geometry.coordinates as [number, number, number?];
          const alt = coords[2] || 0;
          const vantage: [number, number, number] = [coords[0], coords[1], alt];

          const coveragePoly = await getCoveragePolygon(
            vantage,
            angleStep,
            maxRange,
            50 // radial stepping distance
          );
          coveragePolygons.push(coveragePoly);
        }

        // 4) Add coverage polygons to the map
        // Remove old coverage layers first to avoid duplicates
        removeOldCoverageLayers(map);

        if (skipUnion) {
          // Option A: Skip union, just add each coverage polygon as a layer
          coveragePolygons.forEach((poly, idx) => {
            const sourceId = `drone-coverage-${idx}`;
            const layerId = `drone-coverage-layer-${idx}`;

            map.addSource(sourceId, {
              type: "geojson",
              data: poly as GeoJSON.Feature<GeoJSON.Geometry>,
            });

            map.addLayer({
              id: layerId,
              type: "fill",
              source: sourceId,
              paint: {
                "fill-color": "#00FF00",
                "fill-opacity": 0.3,
              },
            });
          });
        } else {
          // Option B: Union coverage polygons into one big polygon
          let aggregatedCoverage = coveragePolygons[0];
          for (let i = 1; i < coveragePolygons.length; i++) {
            try {
              const unionPoly = turf.union(aggregatedCoverage, coveragePolygons[i]);
              if (unionPoly) {
                aggregatedCoverage = unionPoly;
              }
            } catch (err) {
              console.warn("Union error:", err);
            }
          }

          const coverageSourceId = "drone-coverage-union";
          const coverageLayerId = "drone-coverage-layer-union";

          map.addSource(coverageSourceId, {
            type: "geojson",
            data: aggregatedCoverage as GeoJSON.Feature<GeoJSON.Geometry>,
          });
          map.addLayer({
            id: coverageLayerId,
            type: "fill",
            source: coverageSourceId,
            paint: {
              "fill-color": "#00FF00",
              "fill-opacity": 0.3,
            },
          });
        }
      } catch (error) {
        console.error("Error in Viewshed:", error);
      } finally {
        setLoading(false);
        viewshedLoading?.(false);
      }
    };

    /**
     * Expose a public method via ref so parent can call `viewshedRef.current?.runAnalysis()`
     */
    useImperativeHandle(ref, () => ({
      runAnalysis() {
        handleViewshedClick();
      },
    }));

    // Minimal return (no visible UI)
    return null;
  }
);

ViewshedAnalysis.displayName = "ViewshedAnalysis";
export default ViewshedAnalysis;
