/* eslint-disable @typescript-eslint/no-unused-vars */
// components/map.tsx
// /* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
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


// Contexts
import { useLocation } from "../context/LocationContext";
import { FlightPlanData, useFlightPlanContext } from "../context/FlightPlanContext";
import { useFlightConfiguration } from "../context/FlightConfigurationContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { Cloud } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

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
  onPlanUploaded?: (data: GeoJSON.FeatureCollection) => void;
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
    // Add context hooks
    const {
      gcsLocation,
      setGcsLocation,
      observerLocation,
      setObserverLocation,
      repeaterLocation,
      setRepeaterLocation,
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

    //measuring tool
    const FIXED_LINE_SOURCE = 'fixed-line-source';
    const TEMP_LINE_SOURCE = 'temp-line-source';
    const FIXED_LINE_LAYER = 'fixed-line-layer';
    const TEMP_LINE_LAYER = 'temp-line-layer';

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
    
    //measuirng tool
    const [isMeasuring, setIsMeasuring] = useState(false);
    const fixedPointsRef = useRef<[number, number][]>([]);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const movingPopupRef = useRef<mapboxgl.Popup | null>(null);


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
    useEffect(() => {
      if (!contextFlightPlan || contextFlightPlan.processed) {
        return;
      }
    
      const processFlightPlan = async () => {
        try {
          if (!mapRef.current) {
            throw new Error("Map not initialized");
          }
    
          // Fit the map to the flight plan bounds
          const coordinates = contextFlightPlan.features[0].geometry.coordinates;
          console.log("Initial Coordinates:", coordinates);
          if (coordinates.length < 2) {
            console.warn("Flight plan has fewer than 2 coordinates. Skipping distance calculation.");
          }
          const bounds = coordinates.reduce(
            (acc, coord) => {
              acc[0] = Math.min(acc[0], coord[0]);
              acc[1] = Math.min(acc[1], coord[1]);
              acc[2] = Math.max(acc[2], coord[0]);
              acc[3] = Math.max(acc[3], coord[1]);
              return acc;
            },
            [Infinity, Infinity, -Infinity, -Infinity]
          );
          mapRef.current.fitBounds(bounds as [number, number, number, number], {
            padding: 50,
            duration: 0,
          });
    
          await new Promise((resolve) => setTimeout(resolve, 2000));
    
          console.log("Starting Flight Plan Processing:", { inputPlan: contextFlightPlan });
          const newPlan: FlightPlanData = structuredClone(contextFlightPlan);
          const homePosition = newPlan.properties.homePosition;
          const homeTerrainElev = await queryTerrainElevation([homePosition.longitude, homePosition.latitude]);
    
          // Determine home altitude using the takeoff command logic
          const homeWaypoint = newPlan.features[0].properties.waypoints.find((wp) => wp.index === 0);
          const homeAltitudeMode = homeWaypoint ? homeWaypoint.altitudeMode : "absolute";
          let resolvedHomeAlt: number;
          const hasTakeoff = newPlan.features[0].properties.rawCommands.some((cmd) => cmd === 22);
          if (hasTakeoff) {
            resolvedHomeAlt = homeTerrainElev + homePosition.altitude;
          } else {
            resolvedHomeAlt =
              homeAltitudeMode === "relative" ? homeTerrainElev + homePosition.altitude : homePosition.altitude;
          }
    
          let totalDistance = 0;
          let waypointDistances: number[] = [];
    
          // ---- TASK 1: Include All Waypoints (including home) ----
          const allWaypoints = newPlan.features[0].properties.waypoints;
          const flightWaypoints = allWaypoints; // Include all waypoints, including index 0
    
          // ---- TASK 2: Segment Flight Waypoints by Altitude Mode ----
          const segments: { waypoint: typeof flightWaypoints[0]; coordinate: [number, number, number] }[][] = [];
          let currentSegment: { waypoint: typeof flightWaypoints[0]; coordinate: [number, number, number] }[] = [];
          for (let i = 0; i < flightWaypoints.length; i++) {
            const wp = flightWaypoints[i];
            const coord = newPlan.features[0].geometry.coordinates[wp.index];
            if (!coord) continue;
            if (currentSegment.length === 0) {
              currentSegment.push({ waypoint: wp, coordinate: coord });
            } else {
              if (wp.altitudeMode === currentSegment[currentSegment.length - 1].waypoint.altitudeMode) {
                currentSegment.push({ waypoint: wp, coordinate: coord });
              } else {
                segments.push(currentSegment);
                currentSegment = [{ waypoint: wp, coordinate: coord }];
              }
            }
          }
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
          }
    
          // ---- TASK 3: Process Each Segment and Merge ----
          const processedFlightCoords: [number, number, number][] = [];
          const originalProcessedCoords: [number, number, number][] = []; // New array for original waypoints
    
          // Process each flight segment, including home waypoint
          for (const segment of segments) {
            const segmentMode = segment[0].waypoint.altitudeMode;
            const segmentCoords = segment.map(item => item.coordinate);
    
            if (segmentMode === "terrain") {
              const densifiedSegment = await densifyTerrainSegment(segmentCoords);
              processedFlightCoords.push(...densifiedSegment);
              // Store original waypoints with resolved altitudes
              for (let i = 0; i < segmentCoords.length; i++) {
                const [lon, lat, origAlt] = segmentCoords[i];
                const terrainElev = await queryTerrainElevation([lon, lat]);
                const resolvedAlt = terrainElev + origAlt; // Terrain mode: add to terrain elevation
                originalProcessedCoords.push([lon, lat, resolvedAlt]);
              }
            } else {
              const processedSegment: [number, number, number][] = [];
              for (let i = 0; i < segmentCoords.length; i++) {
                const [lon, lat, origAlt] = segmentCoords[i];
                const terrainElev = await queryTerrainElevation([lon, lat]);
                let resolvedAlt = origAlt;
                switch (segment[i].waypoint.altitudeMode) {
                  case "relative":
                    resolvedAlt = homeTerrainElev + origAlt;
                    break;
                  case "absolute":
                    resolvedAlt = origAlt;
                    break;
                  case "terrain":
                    resolvedAlt = terrainElev + origAlt;
                    break;
                  default:
                    resolvedAlt = origAlt;
                }
                // Special case for home waypoint (index 0)
                if (segment[i].waypoint.index === 0) {
                  resolvedAlt = resolvedHomeAlt; // Use the resolved home altitude
                }
                processedSegment.push([lon, lat, resolvedAlt]);
              }
              processedFlightCoords.push(...processedSegment);
              originalProcessedCoords.push(...processedSegment); // Same as processed for non-terrain
            }
          }
    
          // ---- TASK 4: Recalculate Distances ----
          let cumulative = 0;
          waypointDistances = [0];
          for (let i = 1; i < processedFlightCoords.length; i++) {
            const segmentLine = turf.lineString([
              processedFlightCoords[i - 1].slice(0, 2),
              processedFlightCoords[i].slice(0, 2)
            ]);
            cumulative += turf.length(segmentLine, { units: "kilometers" });
            waypointDistances.push(cumulative);
          }
          totalDistance = cumulative;
    
          // ---- TASK 5: Update Flight Plan Context ----
          const processedFlightPlan: FlightPlanData = {
            ...newPlan,
            properties: {
              ...newPlan.properties,
              homePosition: {
                ...homePosition,
                altitude: resolvedHomeAlt,
              },
            },
            features: [{
              ...newPlan.features[0],
              geometry: {
                ...newPlan.features[0].geometry,
                coordinates: processedFlightCoords // Densified coordinates for map
              },
              properties: {
                ...newPlan.features[0].properties,
                originalCoordinates: originalProcessedCoords // Original waypoints with resolved altitudes
              }
            }],
            waypointDistances,
            totalDistance,
            processed: true,
          };
    
          setContextFlightPlan(processedFlightPlan);
          setDistance(totalDistance);
          setResolvedGeoJSON(processedFlightPlan);
        } catch (error) {
          console.error("Error processing flight plan:", error);
          setError("Failed to process flight plan. Please try again.");
        }
      };
    
      processFlightPlan();
    }, [contextFlightPlan, queryTerrainElevation, setContextFlightPlan, setDistance, setError]);
  

    const addGeoJSONToMap = useCallback(
      (geojson: GeoJSON.FeatureCollection) => {
        if (mapRef?.current && geojson.type === "FeatureCollection") {
          const features = geojson.features.filter(
            (f) => f.geometry.type === "LineString"
          );

          features.forEach((feature, idx) => {
            const layerId = `line-${idx}`;

            // Clean up existing layers
            if (mapRef?.current?.getSource(layerId)) {
              mapRef?.current.removeLayer(layerId);
              mapRef?.current.removeSource(layerId);
            }

            // Using MSL altitudes directly from coordinates
            const coordinates = feature.geometry.coordinates;

            // Store altitude information in feature properties
            feature.properties = {
              ...feature.properties,
              altitudes: coordinates.map((coord) => coord[2]),
              // Original data already preserved in properties
            };

            // Create the line
            const validCoordinates = coordinates.map(([lng, lat, alt]) => [
              lng,
              lat,
              alt,
            ]);

            // Calculate distance...
            const line = turf.lineString(validCoordinates);
            const totalDistance = turf.length(line, { units: "kilometers" });
            setTotalDistance(totalDistance);

            // Add to map...
            mapRef?.current?.addSource(layerId, {
              type: "geojson",
              data: feature,
              lineMetrics: true,
            });

            mapRef?.current?.addLayer({
              id: layerId,
              type: "line",
              source: layerId,
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-width": 2,
                "line-color": "#FFFF00",
                "line-opacity": 1,
              },
            });

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

            mapRef?.current?.fitBounds(
              bounds as [number, number, number, number],
              {
                padding: 50,
                duration: 1000,
                pitch: 70,
                zoom: 12.5,
              }
            );

            const startCoord = coordinates[0];
            if (startMarkerRef.current) {
              startMarkerRef.current.setLngLat([startCoord[0], startCoord[1]]);
            } else {
              if (mapRef.current) {
                const newStartMarker = new mapboxgl.Marker({ color: "green" })
                  .setLngLat([startCoord[0], startCoord[1]])
                  .setPopup(
                    new mapboxgl.Popup({ closeButton: false }).setHTML(
                      '<strong style="color: black; bg-white;">Start</strong>'
                    )
                  )
                  .addTo(mapRef?.current);
                newStartMarker.togglePopup();
                startMarkerRef.current = newStartMarker;
              }
            }

            const endCoord = coordinates[coordinates.length - 1];
            if (endMarkerRef.current) {
              endMarkerRef.current.setLngLat([endCoord[0], endCoord[1]]);
            } else {
              if (mapRef.current) {
                const newEndMarker = new mapboxgl.Marker({ color: "red" })
                  .setLngLat([endCoord[0], endCoord[1]])
                  .setPopup(
                    new mapboxgl.Popup({ closeButton: false }).setHTML(
                      '<strong style="color: black; bg-white;">Finish</strong>'
                    )
                  )
                  .addTo(mapRef?.current);
                newEndMarker.togglePopup();
                endMarkerRef.current = newEndMarker;
              }
            }

            lineRef.current = geojson;
          });
        }
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
   * For each sampled point, it linearly interpolates the original altitude between segment endpoints,
   * queries the terrain elevation, and returns a densified coordinate with the resolved altitude.
   *
   * @param segmentCoords - An array of [lon, lat, alt] for the segment.
   * @returns A promise resolving to a densified array of [lon, lat, resolvedAlt] coordinates.
   */
  async function densifyTerrainSegment(
    segmentCoords: [number, number, number][]
  ): Promise<[number, number, number][]> {
    if (segmentCoords.length < 2) return segmentCoords;
    
    // Build a 2D LineString from the segment (ignoring altitude)
    const coords2D = segmentCoords.map(coord => [coord[0], coord[1]]);
    const line = turf.lineString(coords2D);
    
    // Compute cumulative distances (in meters) along the segment
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
      
      // Interpolate the original altitude (AGL offset) along the segment
      let interpAlt = segmentCoords[0][2];
      if (d <= cumDistances[0]) {
        interpAlt = segmentCoords[0][2];
      } else if (d >= cumDistances[cumDistances.length - 1]) {
        interpAlt = segmentCoords[segmentCoords.length - 1][2];
      } else {
        for (let i = 0; i < cumDistances.length - 1; i++) {
          if (d >= cumDistances[i] && d <= cumDistances[i + 1]) {
            const fraction = (d - cumDistances[i]) / (cumDistances[i + 1] - cumDistances[i]);
            interpAlt = segmentCoords[i][2] + fraction * (segmentCoords[i + 1][2] - segmentCoords[i][2]);
            break;
          }
        }
      }
      
      // Query the current terrain elevation at this location
      const terrainElev = await queryTerrainElevation([lon, lat]);
      const resolvedAlt = terrainElev + interpAlt;
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
                      markerRef.current = new mapboxgl.Marker({ color: 'blue' })
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
  
        try {
          if (options && "mergedAnalysis" in options) {
            // Merged analysis (user-triggered)
            console.log(
              "[runElosAnalysis] Running merged analysis with stations:",
              options.stations
            );
            if (mapRef.current.getLayer(MAP_LAYERS.MERGED_VISIBILITY)) {
              console.log(
                "[runElosAnalysis] Removing existing merged analysis layer."
              );
              mapRef.current.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
              mapRef.current.removeSource(MAP_LAYERS.MERGED_VISIBILITY);
            }
            const results = await elosGridRef.current.runMergedAnalysis({
              stations: options.stations,
              mergedAnalysis: true,
            });
            console.log("[runElosAnalysis] Merged analysis complete.");
            return results;
          } else if (options) {
            // Marker-based analysis (user-triggered)
            console.log(
              "[runElosAnalysis] Running marker-based analysis with options:",
              options
            );
            const layerId = `${options.markerType}-grid-layer`;
            if (mapRef.current.getLayer(layerId)) {
              console.log(
                "[runElosAnalysis] Removing existing marker-based analysis layer:",
                layerId
              );
              mapRef.current.removeLayer(layerId);
              mapRef.current.removeSource(layerId);
            }
            await elosGridRef.current.runAnalysis({
              markerOptions: {
                markerType: options.markerType,
                location: options.location,
                range: options.range,
              },
            });
            console.log("[runElosAnalysis] Marker-based analysis complete.");
          } else {
            // Flight path analysis (automatic)
            console.log(
              "[runElosAnalysis] Running flight path analysis (automatic) with no options."
            );
            if (mapRef.current.getLayer(MAP_LAYERS.ELOS_GRID)) {
              console.log(
                "[runElosAnalysis] Removing existing ELOS grid analysis layer."
              );
              mapRef.current.removeLayer(MAP_LAYERS.ELOS_GRID);
              mapRef.current.removeSource(MAP_LAYERS.ELOS_GRID);
            }
            await elosGridRef.current.runAnalysis();
            console.log("[runElosAnalysis] Flight path analysis complete.");
          }
        } catch (error) {
          console.error("[runElosAnalysis] Analysis error:", error);
          throw error;
        }
      },
      getMap: () => mapRef.current,
      toggleLayerVisibility,
    }),
    [addGeoJSONToMap, toggleLayerVisibility ]
  );
  

    // Map initialization
    useEffect(() => {
      if (mapContainerRef.current) {
        try {
          const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y",
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
    
              // Add the sky layer
              map.addLayer({
                id: "sky",
                type: "sky",
                paint: {
                  "sky-type": "atmosphere",
                  "sky-atmosphere-sun": [0.0, 90.0],
                  "sky-atmosphere-sun-intensity": 15,
                },
              });
    
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

    useEffect(() => {
      if (!mapRef.current || !isMeasuring) return;
    
      const map = mapRef.current;
      map.getCanvas().style.cursor = 'crosshair';
    
      const onClick = (e: mapboxgl.MapMouseEvent) => {
        try {
          const point = [e.lngLat.lng, e.lngLat.lat];
          if (fixedPointsRef.current.length === 0) {
            fixedPointsRef.current.push(point);
            const marker = new mapboxgl.Marker({ color: '#800080' }) // Purple color
              .setLngLat(point)
              .setPopup(new mapboxgl.Popup({ closeButton: false, className: 'measure-popup' })
                .setHTML('<div>Start</div>'))
              .addTo(map);
            marker.togglePopup();
            markersRef.current.push(marker);
          } else {
            const lastPoint = fixedPointsRef.current[fixedPointsRef.current.length - 1];
            const distance = turf.distance(lastPoint, point, { units: 'kilometers' });
            fixedPointsRef.current.push(point);
    
            const lineFeature = {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: fixedPointsRef.current },
            };
            map.getSource(FIXED_LINE_SOURCE).setData({
              type: 'FeatureCollection',
              features: [lineFeature],
            });
    
            const marker = new mapboxgl.Marker({ color: '#800080' }) // Purple color
              .setLngLat(point)
              .setPopup(new mapboxgl.Popup({ closeButton: false, className: 'measure-popup' })
                .setHTML(`<div>${distance.toFixed(2)} km</div>`))
              .addTo(map);
            marker.togglePopup();
            markersRef.current.push(marker);
          }
        } catch (error) {
          console.error("Error during measurement click:", error);
        }
      };
    
      const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
        if (fixedPointsRef.current.length > 0) {
          const mousePoint = [e.lngLat.lng, e.lngLat.lat];
          const lastPoint = fixedPointsRef.current[fixedPointsRef.current.length - 1];
          const tempLineFeature = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [lastPoint, mousePoint] },
          };
          map.getSource(TEMP_LINE_SOURCE).setData({
            type: 'FeatureCollection',
            features: [tempLineFeature],
          });
    
          if (!movingPopupRef.current) {
            movingPopupRef.current = new mapboxgl.Popup({ closeButton: false, className: 'measure-popup' });
            movingPopupRef.current.addTo(map);
          }
          const distance = turf.distance(lastPoint, mousePoint, { units: 'kilometers' });
          movingPopupRef.current.setLngLat(mousePoint).setHTML(`<div>${distance.toFixed(2)} km</div>`);
        } else {
          if (!movingPopupRef.current) {
            movingPopupRef.current = new mapboxgl.Popup({ closeButton: false, className: 'measure-popup' });
            movingPopupRef.current.addTo(map);
          }
          movingPopupRef.current.setLngLat(e.lngLat).setHTML('<div>Pick a position on the map</div>');
        }
      };
    
      const onDblClick = (e: mapboxgl.MapMouseEvent) => {
        e.preventDefault();
        if (fixedPointsRef.current.length > 0) {
          setIsMeasuring(false);
          map.getSource(TEMP_LINE_SOURCE).setData({ type: 'FeatureCollection', features: [] });
          if (movingPopupRef.current) {
            movingPopupRef.current.remove();
            movingPopupRef.current = null;
          }
        }
      };
    
      const onRightClick = (e: mapboxgl.MapMouseEvent) => {
        e.preventDefault(); // Prevent the default context menu
        // Reset measurement state without exiting measuring mode
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];
        fixedPointsRef.current = [];
        map.getSource(FIXED_LINE_SOURCE).setData({ type: 'FeatureCollection', features: [] });
        map.getSource(TEMP_LINE_SOURCE).setData({ type: 'FeatureCollection', features: [] });
        if (movingPopupRef.current) {
          movingPopupRef.current.remove();
          movingPopupRef.current = null;
        }
      };
    
      map.on('click', onClick);
      map.on('mousemove', onMouseMove);
      map.on('dblclick', onDblClick);
      map.on('contextmenu', onRightClick);
    
      return () => {
        map.off('click', onClick);
        map.off('mousemove', onMouseMove);
        map.off('dblclick', onDblClick);
        map.off('contextmenu', onRightClick);
        map.getCanvas().style.cursor = '';
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


const startMeasuring = () => {
  if (!mapRef.current || !terrainLoadedRef.current) return; // Ensure map and terrain are loaded
  deleteMeasurement();
  setIsMeasuring(true);

  const map = mapRef.current;
  if (!map.getSource(FIXED_LINE_SOURCE)) {
    map.addSource(FIXED_LINE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: FIXED_LINE_LAYER,
      type: 'line',
      source: FIXED_LINE_SOURCE,
      paint: { 'line-color': '#0000FF', 'line-width': 2 },
    });
  }

  if (!map.getSource(TEMP_LINE_SOURCE)) {
    map.addSource(TEMP_LINE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: TEMP_LINE_LAYER,
      type: 'line',
      source: TEMP_LINE_SOURCE,
      paint: { 'line-color': '#0000FF', 'line-width': 2, 'line-dasharray': [2, 2] },
    });
  }
};

const deleteMeasurement = () => {
  if (mapRef.current) {
    const map = mapRef.current;

    // Remove markers and their popups
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Remove layers and sources
    if (map.getLayer(FIXED_LINE_LAYER)) map.removeLayer(FIXED_LINE_LAYER);
    if (map.getSource(FIXED_LINE_SOURCE)) map.removeSource(FIXED_LINE_SOURCE);
    if (map.getLayer(TEMP_LINE_LAYER)) map.removeLayer(TEMP_LINE_LAYER);
    if (map.getSource(TEMP_LINE_SOURCE)) map.removeSource(TEMP_LINE_SOURCE);

    // Remove moving popup
    if (movingPopupRef.current) {
      movingPopupRef.current.remove();
      movingPopupRef.current = null;
    }
  }

  fixedPointsRef.current = [];
  setIsMeasuring(false);
};

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
      const currentElevation = initialElevation;
    
      const styles = {
        container: "padding: 8px; min-width: 200px;",
        header:
          "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;",
        deleteBtn:
          "background: #e53e3e; color: white; border: none; padding: 2px 4px; border-radius: 4px; cursor: pointer; font-size: 10px;",
        section: "margin-bottom: 8px;",
        label: "color: #4a5568; font-size: 12px; display: block; margin-bottom: 4px;",
        value: "color: #1a202c; font-size: 12px; font-weight: 500;",
              };
    
      const markerInfo = {
        gcs: { icon: "📡", title: "GCS", color: "#3182ce" },
        observer: { icon: "🔭", title: "Observer", color: "#38a169" },
        repeater: { icon: "⚡️", title: "Repeater", color: "#e53e3e" },
      };
    
      const { icon, title } = markerInfo[markerType];
      const offset = markerConfigs[markerType].elevationOffset;
      const stationElevation = currentElevation + offset;
    
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
            <span style="${styles.value}">${currentElevation.toFixed(1)} m ASL</span>
          </div>
    
          <!-- Elevation Offset -->
          <div style="margin-bottom: 8px;">
            <label style="${styles.label}">Elevation Offset:</label>
            <span style="${styles.value}">${offset.toFixed(1)} m</span>
          </div>
    
          <!-- Station Elevation -->
          <div style="margin-bottom: 8px;">
            <label style="${styles.label}">Station Elevation:</label>
            <span style="${styles.value}">${stationElevation.toFixed(1)} m ASL</span>
          </div>
        </div>
      `;

      // Add event handlers
      const rangeInput = popupDiv.querySelector(`#${markerType}-range`);
      const rangeValue = popupDiv.querySelector(`#${markerType}-range-value`);
      const offsetInput = popupDiv.querySelector(`#${markerType}-offset`);
      const analyzeButton = popupDiv.querySelector(`#${markerType}-analyze`);
    
      // Range input handler
      if (rangeInput && rangeValue) {
        rangeInput.addEventListener("input", (e) => {
          const value = (e.target as HTMLInputElement).value;
          rangeValue.textContent = `${value}m`;
          setMarkerConfig(markerType, { gridRange: Number(value) });
        });
      }
    
      // Offset input handler
      if (offsetInput) {
        offsetInput.addEventListener("change", (e) => {
          const value = Number((e.target as HTMLInputElement).value);
          setMarkerConfig(markerType, { elevationOffset: value });
        });
      }
    
      // Analysis button handler
      if (analyzeButton) {
        analyzeButton.addEventListener("click", async () => {
          if (isAnalyzing) return;
    
          const currentLoc =
            markerType === "gcs"
              ? gcsLocation
              : markerType === "observer"
              ? observerLocation
              : repeaterLocation;
    
          if (currentLoc && elosGridRef.current) {
            setIsAnalyzing(true);
            try {
              await elosGridRef.current.runAnalysis({
                markerOptions: {
                  markerType,
                  location: currentLoc,
                  range: markerConfigs[markerType].gridRange,
                },
              });
            } catch (error) {
              console.error("Analysis failed:", error);
              if (error instanceof Error) {
                setError(error.message);
              } else {
                setError(String(error));
              }
            } finally {
              setIsAnalyzing(false);
            }
          }
        });
      }
    
      // Add delete button handler
      popupDiv
        .querySelector(`#delete-${markerType}-btn`)
        ?.addEventListener("click", () => {
          const layerId = `${markerType}-grid-layer`;
          if (mapRef.current?.getLayer(layerId)) {
            layerManager.toggleLayerVisibility(layerId);
          }
          onDelete();
        });
    
      return new mapboxgl.Popup({ closeButton: false }).setDOMContent(popupDiv);
    };
    

    //Add Markers //GCS Marker
    // Update addGroundStation
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
    
        const popup = createMarkerPopup("gcs", elevation, () => {
          gcsMarker.remove();
          setGcsLocation(null);
        });
    
        gcsMarker.setPopup(popup).togglePopup();
    
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
    
            const popup = createMarkerPopup("gcs", newElevation, () => {
              gcsMarker.remove();
              setGcsLocation(null);
            });
            gcsMarker.setPopup(popup).togglePopup();
          } catch (error) {
            console.error("Error updating GCS elevation:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing GCS:", error);
      }
    };
    
    // Update addObserver (similar changes)
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
    
            const popup = createMarkerPopup("observer", newElevation, () => {
              observerMarker.remove();
              setObserverLocation(null);
            });
            observerMarker.setPopup(popup).togglePopup();
          } catch (error) {
            console.error("Error updating Observer elevation:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing Observer:", error);
      }
    };
    
    // Update addRepeater (similar changes)
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
    
            const popup = createMarkerPopup("repeater", newElevation, () => {
              repeaterMarker.remove();
              setRepeaterLocation(null);
            });
            repeaterMarker.setPopup(popup).togglePopup();
          } catch (error) {
            console.error("Error updating Repeater elevation:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing Repeater:", error);
      }
    };

    return (
      <div className="relative">
        {/* Map container with buttons, legend, etc. */}
        <div
          ref={mapContainerRef}
          style={{ height: "100vh", width: "100%" }}
        >
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <button
              onClick={addGroundStation}
              className={`map-button ground-station-icon ${isAnalyzing ? "opacity-50" : ""}`}
              disabled={isAnalyzing}
            >
              Add Ground Station 📡
              {isAnalyzing && <span className="ml-2">•••</span>}
            </button>
            <button
              onClick={addObserver}
              className={`map-button observer-icon ${isAnalyzing ? "opacity-50" : ""}`}
              disabled={isAnalyzing}
            >
              Add Observer 🔭
              {isAnalyzing && <span className="ml-2">•••</span>}
            </button>
            <button
              onClick={addRepeater}
              className={`map-button repeater-icon ${isAnalyzing ? "opacity-50" : ""}`}
              disabled={isAnalyzing}
            >
              Add Repeater ⚡️
              {isAnalyzing && <span className="ml-2">•••</span>}
            </button>
          </div>
    
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

<div className="absolute bottom-48 right-4 z-10 flex flex-col space-y-2">
        <button onClick={startMeasuring} className="map-button">Start Measuring</button>
        <button onClick={deleteMeasurement} className="map-button">Delete Measurement</button>
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
        )}
      </div>
    );
  }
);

Map.displayName = "Map";
export default Map;