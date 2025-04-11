/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

// components/map.tsx
"use client";
import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import FlightLogUploader from "./ULGLogUploader";
import ELOSGridAnalysis from "./ELOSGridAnalysis";
import { layerManager, MAP_LAYERS } from "./LayerManager";
import "../globals.css";
import { ProgressBar } from "./ProgressBar";
import { Loader } from "lucide-react";
import MapboxLayerHandler from "./MapboxLayerHandler";
import BYDALayerHandler from "./powerlines/BYDALayerHandler"; 
import { trackEventWithForm as trackEvent } from "./tracking/tracking";
import { AlertTriangle } from "lucide-react";

// Contexts
import { useLocation } from "../context/LocationContext";
import { FlightPlanData, useFlightPlanContext } from "../context/FlightPlanContext";
import { useFlightConfiguration } from "../context/FlightConfigurationContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { useAreaOfOpsContext } from "../context/AreaOfOpsContext";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface LocationData {
  lng: number;
  lat: number;
  elevation: number | null;
}

export interface MapRef {
  addGeoJSONToMap: (geojson: GeoJSON.FeatureCollection) => void;
  runElosAnalysis: (options?: MarkerAnalysisOptions | MergedAnalysisOptions) => Promise<void>;
  getMap: () => mapboxgl.Map | null;
  toggleLayerVisibility: (layerId: string) => void;
}

export interface MapProps {
  estimatedFlightDistance: number;
  onShowTickChange?: (value: boolean) => void;
  onTotalDistanceChange?: (distance: number) => void;
  onDataProcessed?: (data: { averageDraw: number; phaseData: any[] }) => void;
  onPlanUploaded?: (flightData: FlightPlanData, resetMap: () => void) => void;
}

interface ELOSGridAnalysisRef {
  runAnalysis: (options?: {
    markerOptions?: MarkerAnalysisOptions;
  }) => Promise<void>;
  runMergedAnalysis: (options: MergedAnalysisOptions) => Promise<AnalysisResults>;
  isAnalyzing: boolean;
}

// Interface for Marker LOS Analysis
interface MarkerAnalysisOptions {
  markerType: "gcs" | "observer" | "repeater";
  location: LocationData;
  range: number;
}
const waitForDEM = (map: mapboxgl.Map): Promise<void> => {
  return new Promise((resolve) => {
    const checkDEM = () => {
      if (map.isSourceLoaded("mapbox-dem")) {
        console.log("✅ Terrain data loaded successfully");
        resolve();
      } else {
        map.once("sourcedata", checkDEM);
      }
    };
    checkDEM();
  });
};

interface MarkerAnalysisOptions {
  markerType: "gcs" | "observer" | "repeater";
  location: LocationData;
  range: number;
}

interface MergedAnalysisOptions {
  mergedAnalysis: true;
  stations: Array<{
    type: 'gcs' | 'observer' | 'repeater';
    location: LocationData;
    config: MarkerConfig;
  }>;
}

const Map = forwardRef<MapRef, MapProps>(
  (
    {
      estimatedFlightDistance,
      onDataProcessed,
      onShowTickChange,
      onTotalDistanceChange,
      onPlanUploaded,
    },
    ref
  ) => {
    const {
      gcsLocation,
      setGcsLocation,
      observerLocation,
      setObserverLocation,
      repeaterLocation,
      setRepeaterLocation,
      gcsElevationOffset,
      setGcsElevationOffset,
      observerElevationOffset,
      setObserverElevationOffset,
      repeaterElevationOffset,
      setRepeaterElevationOffset,
    } = useLocation();
    
    const { config } = useFlightConfiguration();

    const {
      elosGridRange: contextGridRange,
      markerConfigs,
      isAnalyzing,
      setIsAnalyzing,
      setResults,
      results,
      setError,
      error,
      setMarkerConfig,
    } = useLOSAnalysis();

    const {
      flightPlan: contextFlightPlan,
      setFlightPlan: setContextFlightPlan,
      setDistance,
    } = useFlightPlanContext();

    const [totalDistance, setTotalDistance] = useState<number>(0);
    const lineRef = useRef<GeoJSON.FeatureCollection | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const elosGridRef = useRef<ELOSGridAnalysisRef | null>(null);
    const { metrics } = useFlightConfiguration();
    const [resolvedGeoJSON, setResolvedGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
    const terrainLoadedRef = useRef<boolean>(false);
    const [elosProgressDisplay, setElosProgressDisplay] = useState(0);
    const [showLosModal, setShowLosModal] = useState(false);
    const [showDBYD, setShowDBYD] = useState(false);
    const boundingBox: [number, number, number, number] = [
      151.20387, -33.8545, 151.21473, -33.8455
    ];

    //AO Box
    const { aoGeometry } = useAreaOfOpsContext();
    
    //measuirng tool
    const [isMeasuring, setIsMeasuring] = useState(false);
    const fixedPointsRef = useRef<[number, number][]>([]);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const movingPopupRef = useRef<mapboxgl.Popup | null>(null);
    const FIXED_LINE_SOURCE = 'fixed-line-source';
    const TEMP_LINE_SOURCE = 'temp-line-source';
    const FIXED_LINE_LAYER = 'fixed-line-layer';
    const TEMP_LINE_LAYER = 'temp-line-layer';
    const abortControllerRef = useRef<AbortController | null>(null);

    // marker offset holders for context
    const gcsMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const observerMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const repeaterMarkerRef = useRef<mapboxgl.Marker | null>(null);

    const queryTerrainElevation = useCallback(async (
      coordinates: [number, number],
      retryCount = 3
    ): Promise<number> => {
      if (!mapRef.current) {
        throw new Error("Map not initialized");
      }
    
      try {
        const elevation = mapRef.current.queryTerrainElevation(coordinates);
        if (elevation !== null && elevation !== undefined) {
          return elevation;
        }
        throw new Error("Invalid elevation value");
      } catch (error) {
        console.warn("Primary terrain query failed, trying fallback:", error);
        if (retryCount > 0) {
          try {
            const fallbackElevation = await fetchTerrainElevation(coordinates[0], coordinates[1]);
            return fallbackElevation;
          } catch (fallbackError) {
            if (retryCount > 1) {
              console.warn("Fallback failed, retrying:", fallbackError);
              return queryTerrainElevation(coordinates, retryCount - 1);
            }
            throw fallbackError;
          }
        }
        throw error;
      }
    }, [mapRef]);

    //Processing of flight plan
    useEffect(() => {
      if (!contextFlightPlan || contextFlightPlan.properties?.processed || !mapRef.current) return;
    
      const processFlightPlan = async () => {
        try {
          // Reset analysis layers
          ["ELOS_GRID", "GCS_GRID", "OBSERVER_GRID", "REPEATER_GRID", "MERGED_VISIBILITY"].forEach(layer =>
            layerManager.removeLayer(layer)
          );
    
          // Fit map to bounds
          const coordinates = contextFlightPlan.features[0].geometry.coordinates;
          const bounds = coordinates.reduce(
            (acc, [lon, lat]) => [
              Math.min(acc[0], lon),
              Math.min(acc[1], lat),
              Math.max(acc[2], lon),
              Math.max(acc[3], lat),
            ],
            [Infinity, Infinity, -Infinity, -Infinity]
          );
          mapRef.current.fitBounds(bounds as [number, number, number, number], { padding: 50, duration: 0 });
          await new Promise(resolve => setTimeout(resolve, 2000));
    
          const newPlan: FlightPlanData = structuredClone(contextFlightPlan);
          const homeTerrainElev = await queryTerrainElevation([
            newPlan.properties.homePosition.longitude,
            newPlan.properties.homePosition.latitude,
          ]);
    
          // Helper function to resolve altitude
          const resolveAltitude = async (
            wp: WaypointData,
            coord: [number, number, number],
            homeElev: number
          ): Promise<number> => {
            const [lon, lat, origAlt] = coord;
            const terrainElev = wp.altitudeMode === "terrain" || wp.altitudeMode === "relative" 
              ? await queryTerrainElevation([lon, lat]) 
              : homeElev;
            switch (wp.altitudeMode) {
              case "terrain": return terrainElev + origAlt;
              case "relative": return terrainElev + origAlt;
              case "absolute": return origAlt;
              default: return origAlt;
            }
          };
    
          // Process waypoints and coordinates
          const waypoints = newPlan.features[0].properties.waypoints;
          const segments: { waypoint: typeof waypoints[0]; coordinate: [number, number, number] }[][] = [];
          let currentSegment: { waypoint: typeof waypoints[0]; coordinate: [number, number, number] }[] = [];
    
          waypoints.forEach(wp => {
            const coord = newPlan.features[0].geometry.coordinates[wp.index];
            if (!coord) return;
            const item = { waypoint: wp, coordinate: coord };
            if (currentSegment.length && wp.altitudeMode !== currentSegment[currentSegment.length - 1].waypoint.altitudeMode) {
              segments.push(currentSegment);
              currentSegment = [item];
            } else {
              currentSegment.push(item);
            }
          });
          if (currentSegment.length) segments.push(currentSegment);
    
          const processedCoords: [number, number, number][] = [];
          const originalCoords: [number, number, number][] = [];
    
          for (const segment of segments) {
            const coords = segment.map(item => item.coordinate);
            if (segment[0].waypoint.altitudeMode === "terrain") {
              const densified = await densifyTerrainSegment(coords);
              processedCoords.push(...densified);
              for (const { waypoint, coordinate } of segment) {
                const resolvedAlt = await resolveAltitude(waypoint, coordinate, homeTerrainElev);
                originalCoords.push([coordinate[0], coordinate[1], resolvedAlt]);
              }
            } else {
              for (const { waypoint, coordinate } of segment) {
                const resolvedAlt = await resolveAltitude(waypoint, coordinate, homeTerrainElev);
                const newCoord = [coordinate[0], coordinate[1], resolvedAlt] as [number, number, number];
                processedCoords.push(newCoord);
                originalCoords.push(newCoord);
              }
            }
          }
    
          // Calculate distances
          let totalDistance = 0;
          const waypointDistances = [0];
          for (let i = 1; i < processedCoords.length; i++) {
            const segmentLine = turf.lineString([processedCoords[i - 1].slice(0, 2), processedCoords[i].slice(0, 2)]);
            totalDistance += turf.length(segmentLine, { units: "kilometers" });
            waypointDistances.push(totalDistance);
          }
    
          // Update context
          newPlan.properties.homePosition.altitude = await resolveAltitude(waypoints[0], coordinates[0], homeTerrainElev);
          newPlan.properties.totalDistance = totalDistance;
          newPlan.properties.processed = true;
          newPlan.features[0].geometry.coordinates = processedCoords;
          newPlan.features[0].properties.originalCoordinates = originalCoords;
          newPlan.waypointDistances = waypointDistances;
    
          setContextFlightPlan(newPlan);
          setDistance(totalDistance);
          setResolvedGeoJSON(newPlan);
        } catch (error) {
          console.error("Error processing flight plan:", error);
          setError("Failed to process flight plan. Please try again.");
        }
      };
    
      processFlightPlan();
    }, [contextFlightPlan, queryTerrainElevation, setContextFlightPlan, setDistance, setError]);

    const addGeoJSONToMap = useCallback(
      (geojson: GeoJSON.FeatureCollection) => {
        if (!mapRef?.current || geojson.type !== "FeatureCollection") return;
    
        const features = geojson.features.filter(
          (f) => f.geometry.type === "LineString"
        );
    
        features.forEach((feature, idx) => {
          const layerId = `line-${idx}`;
    
          // Clean up existing layers using LayerManager
          layerManager.removeLayer(layerId);
    
          // Using MSL altitudes directly from coordinates
          const coordinates = feature.geometry.coordinates;
    
          // Store altitude information in feature properties
          feature.properties = {
            ...feature.properties,
            altitudes: coordinates.map((coord) => coord[2]),
          };
    
          // Create the line
          const validCoordinates = coordinates.map(([lng, lat, alt]) => [
            lng,
            lat,
            alt,
          ]);
    
          // Calculate distance
          const line = turf.lineString(validCoordinates);
          const totalDistance = turf.length(line, { units: "kilometers" });
          setTotalDistance(totalDistance);
    
          // Add to map via LayerManager
          layerManager.addLayer(
            layerId,
            { type: "geojson", data: feature, lineMetrics: true },
            {
              id: layerId,
              type: "line",
              source: layerId,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-width": 2, "line-color": "#FFFF00", "line-opacity": 1 },
            }
          );
    
          // Fit bounds to line
          const bounds = coordinates.reduce(
            (acc, coord) => {
              const [lng, lat] = coord;
              acc[0] = Math.min(acc[0], lng);
              acc[1] = Math.min(acc[1], lat);
              acc[2] = Math.max(acc[2], lng);
              acc[3] = Math.max(acc[3], lat);
              return acc;
            },
            [Infinity, Infinity, -Infinity, -Infinity] as number[]
          );
    
          mapRef.current.fitBounds(
            bounds as [number, number, number, number],
            {
              padding: 50,
              duration: 1000,
              pitch: 70,
              zoom: 10.5,
            }
          );
    
          // Start marker
          const startCoord = coordinates[0];
          if (startMarkerRef.current) {
            startMarkerRef.current.setLngLat([startCoord[0], startCoord[1]]);
          } else {
            const newStartMarker = new mapboxgl.Marker({ color: "green" })
              .setLngLat([startCoord[0], startCoord[1]])
              .setPopup(
                new mapboxgl.Popup({ closeButton: false }).setHTML(
                  '<strong style="color: black; bg-white;">Start</strong>'
                )
              )
              .addTo(mapRef.current);
            newStartMarker.togglePopup();
            startMarkerRef.current = newStartMarker;
          }
    
          // End marker
          const endCoord = coordinates[coordinates.length - 1];
          if (endMarkerRef.current) {
            endMarkerRef.current.setLngLat([endCoord[0], endCoord[1]]);
          } else {
            const newEndMarker = new mapboxgl.Marker({ color: "blue" })
              .setLngLat([endCoord[0], endCoord[1]])
              .setPopup(
                new mapboxgl.Popup({ closeButton: false }).setHTML(
                  '<strong style="color: black; bg-white;">Finish</strong>'
                )
              )
              .addTo(mapRef.current);
            newEndMarker.togglePopup();
            endMarkerRef.current = newEndMarker;
          }
    
          lineRef.current = geojson;
        });
      },
      [mapRef]
    );

    useEffect(() => {
      if (resolvedGeoJSON && mapRef.current) {
        console.log("Displaying resolved flight plan:", resolvedGeoJSON);
        addGeoJSONToMap(resolvedGeoJSON);
      }
    }, [resolvedGeoJSON, mapRef, addGeoJSONToMap]);

      /**
   * Densify a segment of flight coordinates in terrain mode.
   * This function takes an array of coordinates ([lon, lat, alt]) that belong to a terrain segment,
   * builds a 2D LineString, and samples points every 10 meters along the segment.
   */
      async function densifyTerrainSegment(segmentCoords: [number, number, number][]): Promise<[number, number, number][]> {
        if (segmentCoords.length < 2) return segmentCoords;
        
        // Build a 2D LineString (ignoring altitude)
        const coords2D = segmentCoords.map(coord => [coord[0], coord[1]]);
        const line = turf.lineString(coords2D);
        
        // Compute cumulative distances along the segment in meters
        const cumDistances: number[] = [0];
        for (let i = 1; i < segmentCoords.length; i++) {
          const segmentDist = turf.distance(segmentCoords[i - 1], segmentCoords[i], { units: "meters" });
          cumDistances.push(cumDistances[i - 1] + segmentDist);
        }
        const totalLength = cumDistances[cumDistances.length - 1];
        
        const densified: [number, number, number][] = [];
        // Sample every 10 meters along the line
        for (let d = 0; d <= totalLength; d += 10) {
          const pt = turf.along(line, d, { units: "meters" });
          const [lon, lat] = pt.geometry.coordinates;
          
          // Interpolate the raw offset from segmentCoords (these are raw AGL values for terrain mode)
          let interpOffset = segmentCoords[0][2]; // default to the first point's offset
          if (d <= cumDistances[0]) {
            interpOffset = segmentCoords[0][2];
          } else if (d >= cumDistances[cumDistances.length - 1]) {
            interpOffset = segmentCoords[segmentCoords.length - 1][2];
          } else {
            for (let i = 0; i < cumDistances.length - 1; i++) {
              if (d >= cumDistances[i] && d <= cumDistances[i + 1]) {
                const fraction = (d - cumDistances[i]) / (cumDistances[i + 1] - cumDistances[i]);
                interpOffset = segmentCoords[i][2] + fraction * (segmentCoords[i + 1][2] - segmentCoords[i][2]);
                break;
              }
            }
          }
          
          // Query the current terrain elevation at this location and add the raw offset to compute the absolute altitude
          const terrainElev = await queryTerrainElevation([lon, lat]);
          const resolvedAlt = terrainElev + interpOffset;
          densified.push([lon, lat, resolvedAlt]);
        }
        return densified;
      }
     
      

    useEffect(() => {
      if (lineRef.current && metrics.availableBatteryCapacity > 0) {
          // Get flight time available (excluding reserve)
          const availableFlightTime = metrics.availableBatteryCapacity / parseFloat(config.dischargeRate);
          // Convert to distance
          const availableDistance = (availableFlightTime / 60) * parseFloat(config.assumedSpeed);
          
          const line = turf.lineString(
              (
                  lineRef.current.features[0].geometry as GeoJSON.LineString
              ).coordinates.map((coord: [number, number]) => [coord[0], coord[1]])
          );
          
          const estimatedPoint = turf.along(line, availableDistance, {
              units: "kilometers",
          });
  
          if (availableDistance > totalDistance) {
              // Remove marker if plan is within available range
              if (markerRef.current) {
                  markerRef.current.remove();
                  markerRef.current = null;
              }
          } else {
              // Show marker at available range point
              const [lng, lat] = estimatedPoint.geometry.coordinates as [number, number];
              if (markerRef.current) {
                  markerRef.current.setLngLat([lng, lat]);
              } else {
                  if (mapRef.current) {
                      markerRef.current = new mapboxgl.Marker({ color: 'red' })
                          .setLngLat([lng, lat])
                          .setPopup(
                              new mapboxgl.Popup({ closeButton: false }).setHTML(
                                  '<strong style="color: black;">Available Range Limit</strong>'
                              )
                          )
                          .addTo(mapRef.current!);
                      markerRef.current.togglePopup();
                  }
              }
          }
      }
  }, [metrics.availableBatteryCapacity, config.dischargeRate, config.assumedSpeed, totalDistance]);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    return layerManager.toggleLayerVisibility(layerId);
  }, []);

  // useImperativeHandle exposes map control methods (such as adding GeoJSON, running analysis, and toggling layers)
  useImperativeHandle(
    ref,
    () => ({
      addGeoJSONToMap,
      runElosAnalysis: async (
        options?: MarkerAnalysisOptions | MergedAnalysisOptions
      ) => {
        console.log("[runElosAnalysis] Called with options:", options);
  
        if (!mapRef.current) {
          console.error("[runElosAnalysis] Error: Map is not initialized");
          throw new Error("Map is not initialized");
        }
        if (!elosGridRef.current) {
          console.error("[runElosAnalysis] Error: ElosGridRef is not initialized");
          throw new Error("Analysis component not initialized");
        }
  
        setIsAnalyzing(true);
        setElosProgressDisplay(0);
  
        try {
          if (options && "mergedAnalysis" in options) {
            // Merged analysis
            console.log("[runElosAnalysis] Running merged analysis with stations:", options.stations);
            // Remove existing merged analysis layer
            layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
                    
            // Remove individual station analysis layers
            layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
            layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
            layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);

            const results = await elosGridRef.current.runMergedAnalysis({
              stations: options.stations,
              mergedAnalysis: true,
            });
            console.log("[runElosAnalysis] Merged analysis complete.");
            return results;
          } else if (options) {
            // Marker-based analysis
            console.log("[runElosAnalysis] Running marker-based analysis with options:", options);
            const layerId = `${options.markerType}-grid-layer`;
            layerManager.removeLayer(layerId); // Centralized cleanup
            await elosGridRef.current.runAnalysis(
              {
                markerOptions: {
                  markerType: options.markerType,
                  location: options.location,
                  range: options.range,
                },
              },
              (progress: number) => setElosProgressDisplay(progress)
            );
            console.log("[runElosAnalysis] Marker-based analysis complete.");
          } else {
            // Flight path analysis
            console.log("[runElosAnalysis] Running flight path analysis (automatic).");
            layerManager.removeLayer(MAP_LAYERS.ELOS_GRID); // Centralized cleanup
            await elosGridRef.current.runAnalysis(
              undefined,
              (progress: number) => setElosProgressDisplay(progress)
            );
            console.log("[runElosAnalysis] Flight path analysis complete.");
          }
        } catch (error) {
          console.error("[runElosAnalysis] Analysis error:", error);
          layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
          layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
          layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
          layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
          layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
          throw error;
        } finally {
        setIsAnalyzing(false);
        }
      },
      getMap: () => mapRef.current,
      toggleLayerVisibility,
    }),
    [addGeoJSONToMap, toggleLayerVisibility]
  );

  // Add AO geometry to map
  useEffect(() => {
    if (!mapRef.current || !terrainLoadedRef.current) return;

    const map = mapRef.current;
    if (aoGeometry) {
      // Update or add the AO source
      if (map.getSource("area-of-operations")) {
        (map.getSource("area-of-operations") as mapboxgl.GeoJSONSource).setData(aoGeometry);
      } else {
        map.addSource("area-of-operations", {
          type: "geojson",
          data: aoGeometry,
        });
      }

      // Add or update the fill layer (light blue, transparent)
      if (!map.getLayer("area-of-operations-fill")) {
        map.addLayer({
          id: "area-of-operations-fill",
          type: "fill",
          source: "area-of-operations",
          paint: {
            "fill-color": "#ADD8E6", 
            "fill-opacity": 0.5,
        }
      });
      }

      // Add or update the line layer (dark blue, dashed)
      if (!map.getLayer("area-of-operations-outline")) {
        map.addLayer({
          id: "area-of-operations-outline",
          type: "line",
          source: "area-of-operations",
          paint: {
            "line-color": "#00008B", // Dark blue
            "line-width": 2,
            "line-dasharray": [2, 2], // Dashed pattern: 2 units on, 2 units off
          },
        });
      }
    } else {
      // Remove layers if aoGeometry is null
      if (map.getLayer("area-of-operations-fill")) {
        map.removeLayer("area-of-operations-fill");
      }
      if (map.getLayer("area-of-operations-outline")) {
        map.removeLayer("area-of-operations-outline");
      }
      if (map.getSource("area-of-operations")) {
        map.removeSource("area-of-operations");
      }
    }
  }, [aoGeometry]);

  // Map initialization
  useEffect(() => {
    if (mapContainerRef.current) {
      try {
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/intelaero/cm7pqu42s000601svdp7m3h0b",
          center: [0, 0],
          zoom: 2.5,
          projection: "globe",
        });
  
        map.once('style.load', () => {  // Changed from on("load") to once('style.load')
          try {
            // Add the DEM source
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
  
            /* map.addLayer({
              id: "sky",
              type: "sky",
              paint: {
                "sky-type": "atmosphere",
                "sky-atmosphere-sun": [0.0, 90.0],
                "sky-atmosphere-sun-intensity": 15,
              },
            }); */
  
            // Wait for both style and DEM
            Promise.all([
              new Promise(resolve => map.once('idle', resolve)),
              waitForDEM(map)
            ]).then(() => {
              console.log("✅ Map style and terrain fully loaded");
              // Set map ref first
              mapRef.current = map;
              layerManager.setMap(map);
              // Then set terrain loaded
              terrainLoadedRef.current = true;
              // Finally set map ready
              console.log("Map and DEM ready – all refs set");
            }).catch((error) => {
              console.error("Error waiting for map and DEM:", error);
            });
  
          } catch (error) {
            console.error("❌ Error initializing map layers:", error);
            throw error;
          }
        });
        
        // Listen for any load errors
        map.on('error', (e) => {
          console.error("Mapbox error:", e);
        });
  
      } catch (error) {
        console.error("❌ Error creating map:", error);
      }
    }
  
    // Cleanup function
    return () => {
      terrainLoadedRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  //  Measuring Tool
  useEffect(() => {
    if (!mapRef.current || !isMeasuring) return;
  
    const map = mapRef.current;
    map.getCanvas().style.cursor = "crosshair";
  
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      try {
        const point = [e.lngLat.lng, e.lngLat.lat] as [number, number];
        const fixedPoints = fixedPointsRef.current;
  
        if (fixedPoints.length === 0) {
          fixedPoints.push(point);
          const marker = new mapboxgl.Marker({ color: "#800080" })
            .setLngLat(point)
            .setPopup(
              new mapboxgl.Popup({ closeButton: false, className: "measure-popup" }).setHTML(
                "<div>Start</div>"
              )
            )
            .addTo(map);
          marker.togglePopup();
          markersRef.current.push(marker);
          console.log("First point added:", point);
        } else {
          const lastPoint = fixedPoints[fixedPoints.length - 1];
          fixedPoints.push(point);
  
          const segmentDistance = turf.distance(lastPoint, point, { units: "kilometers" });
          const lineFeature = {
            type: "Feature" as const,
            geometry: { type: "LineString" as const, coordinates: fixedPoints },
          };
  
          const fixedSource = map.getSource(FIXED_LINE_SOURCE);
          if (fixedSource) {
            fixedSource.setData({
              type: "FeatureCollection" as const,
              features: [lineFeature],
            });
            console.log("Fixed line updated with points:", fixedPoints);
          } else {
            console.error("FIXED_LINE_SOURCE not found on click");
          }
  
          const totalDistance = turf.length(turf.lineString(fixedPoints), { units: "kilometers" });
  
          const marker = new mapboxgl.Marker({ color: "#800080" })
            .setLngLat(point)
            .setPopup(
              new mapboxgl.Popup({ closeButton: false, className: "measure-popup" }).setHTML(
                `<div>Segment: ${segmentDistance.toFixed(2)} km<br>Total: ${totalDistance.toFixed(2)} km</div>`
              )
            )
            .addTo(map);
          marker.togglePopup();
          markersRef.current.push(marker);
  
          const tempSource = map.getSource(TEMP_LINE_SOURCE);
          if (tempSource) {
            tempSource.setData({
              type: "FeatureCollection" as const,
              features: [],
            });
            console.log("Temp line reset after click");
          }
        }
      } catch (error) {
        console.error("Error during measurement click:", error);
      }
    };
  
    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!isMeasuring || fixedPointsRef.current.length === 0) return;
  
      const mousePoint = [e.lngLat.lng, e.lngLat.lat] as [number, number];
      const lastPoint = fixedPointsRef.current[fixedPointsRef.current.length - 1];
  
      const tempLineFeature = {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: [lastPoint, mousePoint] },
      };
  
      const tempSource = map.getSource(TEMP_LINE_SOURCE);
      if (tempSource) {
        tempSource.setData({
          type: "FeatureCollection" as const,
          features: [tempLineFeature],
        });
        console.log("Temp line updated from", lastPoint, "to", mousePoint);
      } else {
        console.error("TEMP_LINE_SOURCE not found during mousemove");
      }
  
      if (!movingPopupRef.current) {
        movingPopupRef.current = new mapboxgl.Popup({
          closeButton: false,
          className: "measure-popup",
          offset: 15,
        }).addTo(map);
      }
  
      let distance = 0;
      try {
        distance = turf.distance(lastPoint, mousePoint, { units: "kilometers" });
      } catch (error) {
        console.error("Error calculating distance:", error);
      }
  
      movingPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="background: rgba(255,255,255,0.9); padding: 4px 8px; border-radius: 4px; font-size: 12px;">
            ${distance.toFixed(2)} km
          </div>`
        );
    };
  
    const onRightClick = (e: mapboxgl.MapMouseEvent) => {
      e.preventDefault();
      if (isMeasuring && fixedPointsRef.current.length > 0) {
        setIsMeasuring(false); // Stop measuring on single right-click
        map.getCanvas().style.cursor = "";
        if (movingPopupRef.current) {
          movingPopupRef.current.remove();
          movingPopupRef.current = null;
        }
        const tempSource = map.getSource(TEMP_LINE_SOURCE);
        if (tempSource) {
          tempSource.setData({
            type: "FeatureCollection" as const,
            features: [],
          });
        }
        console.log("Stopped measuring with right-click");
      }
    };
  
    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    map.on("contextmenu", onRightClick);
  
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMouseMove);
      map.off("contextmenu", onRightClick);
      map.getCanvas().style.cursor = "";
      if (movingPopupRef.current) {
        movingPopupRef.current.remove();
        movingPopupRef.current = null;
      }
    };
  }, [isMeasuring, mapRef]);

async function fetchTerrainElevation(lng: number, lat: number): Promise<number> {
  try {
    const tileSize = 512;
    const zoom = 15;
    const scale = Math.pow(2, zoom);

    const latRad = (lat * Math.PI) / 180;
    const tileX = Math.floor(((lng + 180) / 360) * scale);
    const tileY = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
        2) *
        scale
    );

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

    const tileURL = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}@2x.pngraw?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`;
    const response = await fetch(tileURL);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Failed to create canvas context");

    context.drawImage(imageBitmap, 0, 0);
    const imageData = context.getImageData(0, 0, tileSize, tileSize);

    const idx = (pixelY * tileSize + pixelX) * 4;
    const [r, g, b] = [
      imageData.data[idx],
      imageData.data[idx + 1],
      imageData.data[idx + 2],
    ];

    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  } catch (error) {
    console.error("RGB elevation error:", error);
    return 0;
  }
}

//measurement tool on map
const startMeasuring = () => {
  if (!mapRef.current || !terrainLoadedRef.current) return;

  const map = mapRef.current;

  // Clear any existing measurement before starting a new one
  deleteMeasurement();

  setIsMeasuring(true);

  // Initialize or reset FIXED_LINE_SOURCE and FIXED_LINE_LAYER
  if (!map.getSource(FIXED_LINE_SOURCE)) {
    map.addSource(FIXED_LINE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    console.log("Added FIXED_LINE_SOURCE");
  }
  if (!map.getLayer(FIXED_LINE_LAYER)) {
    map.addLayer({
      id: FIXED_LINE_LAYER,
      type: "line",
      source: FIXED_LINE_SOURCE,
      paint: { "line-color": "#0000FF", "line-width": 2 },
    });
    console.log("Added FIXED_LINE_LAYER");
  }

  // Initialize or reset TEMP_LINE_SOURCE and TEMP_LINE_LAYER
  if (!map.getSource(TEMP_LINE_SOURCE)) {
    map.addSource(TEMP_LINE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    console.log("Added TEMP_LINE_SOURCE");
  }
  if (!map.getLayer(TEMP_LINE_LAYER)) {
    map.addLayer({
      id: TEMP_LINE_LAYER,
      type: "line",
      source: TEMP_LINE_SOURCE,
      paint: { "line-color": "#0000FF", "line-width": 2, "line-dasharray": [2, 2] },
    });
    console.log("Added TEMP_LINE_LAYER");
  }

  console.log("New measurement started");
};

const deleteMeasurement = () => {
  if (mapRef.current) {
    const map = mapRef.current;
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (map.getLayer(FIXED_LINE_LAYER)) {
      map.removeLayer(FIXED_LINE_LAYER);
      console.log("Removed FIXED_LINE_LAYER");
    }
    if (map.getSource(FIXED_LINE_SOURCE)) {
      map.removeSource(FIXED_LINE_SOURCE);
      console.log("Removed FIXED_LINE_SOURCE");
    }
    if (map.getLayer(TEMP_LINE_LAYER)) {
      map.removeLayer(TEMP_LINE_LAYER);
      console.log("Removed TEMP_LINE_LAYER");
    }
    if (map.getSource(TEMP_LINE_SOURCE)) {
      map.removeSource(TEMP_LINE_SOURCE);
      console.log("Removed TEMP_LINE_SOURCE");
    }
    if (movingPopupRef.current) {
      movingPopupRef.current.remove();
      movingPopupRef.current = null;
    }
  }
  fixedPointsRef.current = [];
  setIsMeasuring(false);
  console.log("Measurement deleted");
};

const handleResetMap = () => {
  // Remove marker-related analysis layers
  layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
  layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
  layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
  layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
  layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);

  // Remove measurement layers
  layerManager.removeLayer(FIXED_LINE_LAYER);
  layerManager.removeLayer(TEMP_LINE_LAYER);

  deleteMeasurement();
};

// In the JSX:
<button onClick={handleResetMap} className="map-button">Reset LOS Analyses</button>

const handleFileProcessing = (data: any) => {
  if (Array.isArray(data)) {
    const totalDraw = data.reduce(
      (sum, phase) => sum + (phase["Total Draw(mAh)"] || 0),
      0
    );
    const totalTime = data.reduce(
      (sum, phase) => sum + (phase["TotalTime(s)"] || 0),
      0
    );
    const averageDraw = totalTime > 0 ? totalDraw / totalTime : 0;

    if (onDataProcessed) {
      onDataProcessed({ averageDraw, phaseData: data });
    }
  }
};

    // Map Marker Popup Implementation
    const createMarkerPopup = (
      markerType: "gcs" | "observer" | "repeater",
      initialElevation: number,
      onDelete: () => void
    ) => {
      const popupDiv = document.createElement("div");
      const styles = {
        container: "padding: 8px; min-width: 200px;",
        header:
          "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;",
        deleteBtn:
          "background: #e53e3e; color: white; border: none; padding: 2px 4px; border-radius: 4px; cursor: pointer; font-size: 10px;",
        label: "color: #4a5568; font-size: 12px; display: block; margin-bottom: 4px;",
        value: "color: #1a202c; font-size: 12px; font-weight: 500;",
      };
    
      const markerInfo = {
        gcs: { icon: "📡", title: "GCS", color: "#3182ce" },
        observer: { icon: "🔭", title: "Observer", color: "#38a169" },
        repeater: { icon: "⚡️", title: "Repeater", color: "#e53e3e" },
      };
    
      const { icon, title } = markerInfo[markerType];
    
      // Use elevation offset from LocationContext
      const elevationOffset =
        markerType === "gcs"
          ? gcsElevationOffset
          : markerType === "observer"
          ? observerElevationOffset
          : repeaterElevationOffset;
    
      // Calculate the effective station elevation
      const stationElevation = initialElevation + elevationOffset;
    
      popupDiv.innerHTML = `
        <div class="popup-container" style="${styles.container}">
          <!-- Header -->
          <div style="${styles.header}">
            <h5 style="font-weight: 600; font-size: 0.875rem; color: #4a5568;">
              ${title} ${icon}
            </h5>
            <button id="delete-${markerType}-btn" style="${styles.deleteBtn}">
              Delete
            </button>
          </div>
    
          <!-- Ground Elevation -->
          <div style="margin-bottom: 8px;">
            <label style="${styles.label}">Ground Elevation:</label>
            <span style="${styles.value}">${initialElevation.toFixed(1)} m ASL</span>
          </div>
    
          <!-- Elevation Offset (Read-only) -->
          <div style="margin-bottom: 8px;">
            <label style="${styles.label}">Elevation Offset:</label>
            <span style="${styles.value}">${elevationOffset.toFixed(1)} m</span>
          </div>
    
          <!-- Station Elevation -->
          <div style="margin-bottom: 8px;">
            <label style="${styles.label}">Station Elevation:</label>
            <span style="${styles.value}">${stationElevation.toFixed(1)} m ASL</span>
          </div>
        </div>
      `;
    
      // Add delete button handler
      popupDiv
        .querySelector(`#delete-${markerType}-btn`)
        ?.addEventListener("click", () => {
          onDelete();
        });
    
      return new mapboxgl.Popup({ closeButton: false }).setDOMContent(popupDiv);
    };
    
    //Add Markers //GCS Marker
    const addGroundStation = async () => {
      if (!mapRef.current) return;
      
      const center = mapRef.current.getCenter();
      try {
        const elevation = await queryTerrainElevation([center.lng, center.lat]);
        const initialLocation: LocationData = {
          lng: center.lng,
          lat: center.lat,
          elevation: elevation,
        };
        console.log("GCS Initial Location:", initialLocation);
      
        setGcsLocation(initialLocation);
      
        const gcsMarker = new mapboxgl.Marker({ color: "blue", draggable: true })
          .setLngLat(center)
          .addTo(mapRef.current);
      
        // Use the updated createMarkerPopup function
        const popup = createMarkerPopup("gcs", elevation, () => {
          gcsMarker.remove();
          setGcsLocation(null);
        });
      
        gcsMarker.setPopup(popup).togglePopup();
      
        // On dragend, update the location using the context
        gcsMarker.on("dragend", async () => {
          const lngLat = gcsMarker.getLngLat();
          try {
            const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
            const location: LocationData = {
              lng: lngLat.lng,
              lat: lngLat.lat,
              elevation: newElevation,
            };
            setGcsLocation(location);
            // Clean up outdated analysis layers
            layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
            layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
      
            // Recreate popup with updated elevation
            const newPopup = createMarkerPopup("gcs", newElevation, () => {
              gcsMarker.remove();
              setGcsLocation(null);
            });
            gcsMarker.setPopup(newPopup).togglePopup();
          } catch (error) {
            console.error("Error updating GCS elevation:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing GCS:", error);
      }
    };
    
    // Update addObserver 
    const addObserver = async () => {
      if (!mapRef.current) return;
    
      const center = mapRef.current.getCenter();
      try {
        const elevation = await queryTerrainElevation([center.lng, center.lat]);
        const initialLocation: LocationData = {
          lng: center.lng,
          lat: center.lat,
          elevation: elevation,
        };
        console.log("Observer Initial Location:", initialLocation);
    
        setObserverLocation(initialLocation);
    
        const observerMarker = new mapboxgl.Marker({
          color: "green",
          draggable: true,
        })
          .setLngLat(center)
          .addTo(mapRef.current);
    
        // Store the marker reference
        observerMarkerRef.current = observerMarker;
    
        const popup = createMarkerPopup("observer", elevation, () => {
          observerMarker.remove();
          setObserverLocation(null);
        });
        observerMarker.setPopup(popup).togglePopup();
    
        observerMarker.on("dragend", async () => {
          const lngLat = observerMarker.getLngLat();
          try {
            const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
            const location: LocationData = {
              lng: lngLat.lng,
              lat: lngLat.lat,
              elevation: newElevation,
            };
            setObserverLocation(location);
            layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
            layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
    
            const newPopup = createMarkerPopup("observer", newElevation, () => {
              observerMarker.remove();
              setObserverLocation(null);
            });
            observerMarker.setPopup(newPopup).togglePopup();
          } catch (error) {
            console.error("Error updating Observer elevation:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing Observer:", error);
      }
    };
    
    const addRepeater = async () => {
      if (!mapRef.current) return;
    
      const center = mapRef.current.getCenter();
      try {
        const elevation = await queryTerrainElevation([center.lng, center.lat]);
        const initialLocation: LocationData = {
          lng: center.lng,
          lat: center.lat,
          elevation: elevation,
        };
        console.log("Repeater Initial Location:", initialLocation);
    
        setRepeaterLocation(initialLocation);
    
        const repeaterMarker = new mapboxgl.Marker({
          color: "red",
          draggable: true,
        })
          .setLngLat(center)
          .addTo(mapRef.current);
    
        // Store the marker reference
        repeaterMarkerRef.current = repeaterMarker;
    
        const popup = createMarkerPopup("repeater", elevation, () => {
          repeaterMarker.remove();
          setRepeaterLocation(null);
        });
        repeaterMarker.setPopup(popup).togglePopup();
    
        repeaterMarker.on("dragend", async () => {
          const lngLat = repeaterMarker.getLngLat();
          try {
            const newElevation = await queryTerrainElevation([lngLat.lng, lngLat.lat]);
            const location: LocationData = {
              lng: lngLat.lng,
              lat: lngLat.lat,
              elevation: newElevation,
            };
            setRepeaterLocation(location);
            layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
            layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
    
            const newPopup = createMarkerPopup("repeater", newElevation, () => {
              repeaterMarker.remove();
              setRepeaterLocation(null);
            });
            repeaterMarker.setPopup(newPopup).togglePopup();
          } catch (error) {
            console.error("Error updating Repeater elevation:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing Repeater:", error);
      }
    };

    // update marker/station popup for context data
    useEffect(() => {
      if (gcsMarkerRef.current && gcsLocation && gcsLocation.elevation !== null) {
        const updatedPopup = createMarkerPopup("gcs", gcsLocation.elevation, () => {
          gcsMarkerRef.current?.remove();
          setGcsLocation(null);
        });
        gcsMarkerRef.current.setPopup(updatedPopup);
        if (gcsMarkerRef.current.getPopup()?.isOpen()) {
          gcsMarkerRef.current.getPopup()?.setDOMContent(updatedPopup.getElement());
        }
      }
    }, [gcsElevationOffset, gcsLocation]);
    
    useEffect(() => {
      if (observerMarkerRef.current && observerLocation && observerLocation.elevation !== null) {
        const updatedPopup = createMarkerPopup("observer", observerLocation.elevation, () => {
          observerMarkerRef.current?.remove();
          setObserverLocation(null);
        });
        observerMarkerRef.current.setPopup(updatedPopup);
        if (observerMarkerRef.current.getPopup()?.isOpen()) {
          observerMarkerRef.current.getPopup()?.setDOMContent(updatedPopup.getElement());
        }
      }
    }, [observerElevationOffset, observerLocation]);
    
    useEffect(() => {
      if (repeaterMarkerRef.current && repeaterLocation && repeaterLocation.elevation !== null) {
        const updatedPopup = createMarkerPopup("repeater", repeaterLocation.elevation, () => {
          repeaterMarkerRef.current?.remove();
          setRepeaterLocation(null);
        });
        repeaterMarkerRef.current.setPopup(updatedPopup);
        if (repeaterMarkerRef.current.getPopup()?.isOpen()) {
          repeaterMarkerRef.current.getPopup()?.setDOMContent(updatedPopup.getElement());
        }
      }
    }, [repeaterElevationOffset, repeaterLocation]);
    
    
    const stopAnalysisHandler = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      layerManager.removeLayer(MAP_LAYERS.ELOS_GRID);
      layerManager.removeLayer(MAP_LAYERS.GCS_GRID);
      layerManager.removeLayer(MAP_LAYERS.OBSERVER_GRID);
      layerManager.removeLayer(MAP_LAYERS.REPEATER_GRID);
      layerManager.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
      setElosProgressDisplay(0);
      setIsAnalyzing(false);
    };

    // Powerlines and Airspace Overlays
    const handleAddPowerlines = () => {
      if (!mapRef.current) return;
      // Toggle both the powerlines line and its hitbox layers
      toggleLayerVisibility("Electricity Transmission Lines");
      toggleLayerVisibility("Electricity Transmission Lines Hitbox");
    };

    const handleDBYDPowerlines = () => {
      setShowDBYD(true);
    };
    
    const handleAddAirspaceOverlay = () => {
      if (!mapRef.current) return;
      // Toggle both the airfields fill and the labels layers
      toggleLayerVisibility("Airfields");
      toggleLayerVisibility("Airfields Labels");
    };

    //Do LOS Modal
    useEffect(() => {
      if (resolvedGeoJSON && !showLosModal) {
        setShowLosModal(true); // Show modal only once per new flight plan
      }
    }, [resolvedGeoJSON]);

    //autodismiss
    useEffect(() => {
      if (isAnalyzing) setShowLosModal(false);
    }, [isAnalyzing]);


    return (
      <div className="relative">
        {/* Map container with buttons, legend, etc. */}
        <div
          ref={mapContainerRef}
          style={{ height: "100vh", width: "100%" }}
        >
          {/* Progress Bar Overlay */}
          {isAnalyzing && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-gray-200 px-4 py-2 rounded-lg border-l-4 border-yellow-500 shadow-lg flex flex-col gap-3 z-50 animate-slide-down min-w-[150px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Loader className="w-5 h-5 animate-spin text-yellow-400" />
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">Analysing</span>
                  <span className="text-gray-500">
                    This may take a few moments... {Math.round(elosProgressDisplay)}%
                  </span>
                  <span className="text-gray-500 text-xxs">Especially for terrain following missions.</span>
                </div>
              </div>
              <button
                onClick={() => {
                  trackEvent("stop_analysis_click", { panel: "map.tsx" });
                  stopAnalysisHandler();
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded text-xs"
              >
                Stop
              </button>
            </div>
            <div className="relative mt-2 w-full">
              <ProgressBar progress={Math.round(elosProgressDisplay)} />
            </div>
          </div>
        )}

        {/* LOS Modal with Direct Call */}
        {showLosModal && (
  <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-xl z-50 max-w-md w-full animate-slide-down border-l-4 border-yellow-500">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
      <AlertTriangle className="text-yellow-500 h-8 w-8" />
        <p className="text-sm text-gray-900 mr-2 leading-tight">
          <span className="font-semibold text-gray-900">Start Here:</span> Check your flight path visibility to begin your mission.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (!ref.current) return;
            try {
              setIsAnalyzing(true);
              setError(null);
              await ref.current.runElosAnalysis();
              trackEvent("full_elos_analysis_from_modal_click", { panel: "map.tsx" });
              setShowLosModal(false);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Analysis failed");
            } finally {
              setIsAnalyzing(false);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium shadow-sm"
        >
          Run
        </button>
        <button
          onClick={() => {
            trackEvent("dismiss_los_modal_click", { panel: "map.tsx" });
            setShowLosModal(false);
          }}
          className="text-gray-500 hover:text-gray-700 text-lg font-semibold"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
)}

          {/* Add Ground Station, Observer, and Repeater Buttons */}
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <button 
              onClick={() => {
                trackEvent("add_ground_station_click", { panel: "map.tsx" });
                addGroundStation();
              }} 
              className="map-button ground-station-icon"
            >
              Add Ground Station 📡
            </button>
            <button 
              onClick={() => {
                trackEvent("add_observer_click", { panel: "map.tsx" });
                addObserver();
              }} 
              className="map-button observer-icon"
            >
              Add Observer 🔭
            </button>
            <button 
              onClick={() => {
                trackEvent("add_repeater_click", { panel: "map.tsx" });
                addRepeater();
              }} 
              className="map-button repeater-icon"
            >
              Add Repeater ⚡️
            </button>
            <button 
              onClick={() => {
                trackEvent("reset_los_analyses_click", { panel: "map.tsx" });
                handleResetMap();
              }} 
              className="map-button"
            >
              Reset LOS Analyses 🚫
            </button>
            <button 
              onClick={() => {
                trackEvent("powerlines_add_overlay_click", { panel: "map.tsx" });
                handleAddPowerlines();
              }} 
              className="map-button"
            >
              Add Powerlines ⚡️
            </button>
            <button 
              onClick={() => {
                trackEvent("DYBDpowerlines_add_overlay_click", { panel: "map.tsx" });
                handleDBYDPowerlines()
              }} 
              className="map-button"
            >
              Add DBYD Powerlines 🏡
            </button>
            <button 
              onClick={() => {
                trackEvent("airspace_add_overlay_click", { panel: "map.tsx" });
                handleAddAirspaceOverlay();
              }} 
              className="map-button"
            >
              Add Airspace Overlay ✈️
            </button>
          </div>

          {/* Conditionally render the DBYD layer handler when requested */}
          {showDBYD && mapRef.current && (
            <BYDALayerHandler 
              map={mapRef.current} 
              boundingBox={boundingBox}
              /* Optionally pass an extra prop like isDBYD={true}
                so that BYDALayerHandler can choose the correct endpoints or query parameters. */
            />
          )}
    
          {/* Analysis Status Indicator */}
          {isAnalyzing && (
            <div className="absolute bottom-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
              Running Analysis...
            </div>
          )}
    
          {/* Error UI */}
          {error && (
            <div className="absolute bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
              <span>⚠️</span>
              <span className="ml-2">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-2 hover:opacity-75"
              >
                ✕
              </button>
            </div>
          )}
    
          {/* Measurement Buttons */}
          <div className="absolute bottom-48 right-4 z-10 flex flex-col space-y-2">
          <button 
            onClick={() => {
              trackEvent("start_measuring_click", { panel: "map.tsx" });
              startMeasuring();
            }} 
            className="map-button"
          >
            Start Measuring
          </button>
          <button 
            onClick={() => {
              trackEvent("delete_measurement_click", { panel: "map.tsx" });
              deleteMeasurement();
            }} 
            className="map-button"
          >
            Delete Measurement
          </button>
          </div>
    
          {/* Legend for Visibility Colors */}
          <div className="map-legend">
            <h4 className="font-semibold mb-2">Legend</h4>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-[#d32f2f] block rounded"></span>
                <span>0% Visibility (Red)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-[#f57c00] block rounded"></span>
                <span>25% Visibility (Orange)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-[#fbc02d] block rounded"></span>
                <span>50% Visibility (Yellow)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-[#7cb342] block rounded"></span>
                <span>75% Visibility (Green)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-[#1976d2] block rounded"></span>
                <span>100% Visibility (Blue)</span>
              </div>
            </div>
          </div>
        </div>
    
        {mapRef.current && (
  <>
    <ELOSGridAnalysis
      ref={elosGridRef}
      map={mapRef.current}
      flightPath={resolvedGeoJSON}
      elosGridRange={contextGridRange}
      onError={(error) => {
        console.error("ELOS Analysis error:", error);
        setError(error.message);
      }}
      onSuccess={(result) => {
        console.log("ELOS Analysis completed:", result);
        setResults(result);
      }}
    />
    <MapboxLayerHandler map={mapRef.current} />
  </>
)}

      </div>
    );
  }
);

Map.displayName = "Map";
export default Map;