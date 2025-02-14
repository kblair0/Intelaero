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

// Contexts
import { useLocation } from "../context/LocationContext";
import { useFlightPlanContext } from "../context/FlightPlanContext";
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

interface MapProps {
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

    //FlightPlan Processing including logging
    useEffect(() => {
      if (!contextFlightPlan || contextFlightPlan.processed) {
          return;
      }
      const processFlightPlan = async () => {
          try {
              if (!mapRef.current) {
                  throw new Error("Map not initialized");
              }
  
              // Calculate bounds of flight plan
              const bounds = contextFlightPlan.features[0].geometry.coordinates.reduce(
                  (acc, coord) => {
                      acc[0] = Math.min(acc[0], coord[0]);  // min lng
                      acc[1] = Math.min(acc[1], coord[1]);  // min lat
                      acc[2] = Math.max(acc[2], coord[0]);  // max lng
                      acc[3] = Math.max(acc[3], coord[1]);  // max lat
                      return acc;
                  },
                  [Infinity, Infinity, -Infinity, -Infinity]
              );
  
              // Move map to flight plan area first
              mapRef.current.fitBounds(bounds as [number, number, number, number], {
                  padding: 50,
                  duration: 0
              });
  
              // Wait for tiles to load
              console.log("Waiting for terrain tiles to load...");
              await new Promise(resolve => setTimeout(resolve, 2000));
  
              console.log("Starting Altitude Resolution:", { inputPlan: contextFlightPlan });
              const newPlan = structuredClone(contextFlightPlan);
              
              // Get and set home position elevation
              const homePosition = newPlan.properties.homePosition;
              const homeTerrainElev = await queryTerrainElevation([homePosition.longitude, homePosition.latitude]);
              homePosition.altitude = homeTerrainElev;
              if (newPlan.features[0]?.geometry?.coordinates?.[0]) {
                  newPlan.features[0].geometry.coordinates[0][2] = homeTerrainElev;
              }
              
              // Process each feature's waypoints...
              for (const feature of newPlan.features) {
                  if (feature.geometry.type !== "LineString") continue;
                  const coords = feature.geometry.coordinates;
                  const waypoints = feature.properties.waypoints || [];
                  for (let i = 0; i < coords.length; i++) {
                      const [lon, lat, originalAlt] = coords[i];
                      const wp = waypoints[i];
                      if (!wp) continue;
                      try {
                          const terrainElev = await queryTerrainElevation([lon, lat]);
                          console.log(`Waypoint ${i} processing:`, {
                              longitude: lon,
                              latitude: lat,
                              originalAltitude: originalAlt,
                              terrainElevation: terrainElev,
                              mode: wp.altitudeMode,
                              beforeResolution: coords[i][2],
                          });
                          switch (wp.altitudeMode) {
                              case "absolute":
                                  break;
                              case "relative":
                                  if (wp.commandType === 22) {
                                      const takeoffGroundElev = await queryTerrainElevation([lon, lat]);
                                      coords[i][2] = takeoffGroundElev + originalAlt;
                                  } else {
                                      coords[i][2] = terrainElev + originalAlt;
                                  }
                                  break;
                              case "terrain":
                                  coords[i][2] = terrainElev + originalAlt;
                                  break;
                              default:
                                  break;
                          }
                      } catch (error) {
                          console.error(`Error processing waypoint ${i}:`, error);
                          throw error;
                      }
                  }
              }
  
              // Calculate distances
              const coords2D = newPlan.features[0].geometry.coordinates.map(
                  (coord: [number, number, number]) => [coord[0], coord[1]]
              );
              const routeLine = turf.lineString(coords2D);
              const totalDistance = turf.length(routeLine, { units: "kilometers" });
  
              // Calculate waypoint distances
              let cumulativeDistance = 0;
              const waypointDistances = newPlan.features[0].geometry.coordinates.map(
                  (coord, idx, arr) => {
                      if (idx === 0) return 0;
                      const segment = turf.lineString([
                          arr[idx - 1].slice(0, 2),
                          coord.slice(0, 2),
                      ]);
                      cumulativeDistance += turf.length(segment, { units: "kilometers" });
                      return cumulativeDistance;
                  }
              );
  
              const processedFlightPlan = {
                  ...newPlan,
                  waypointDistances,
                  totalDistance,
                  processed: true
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

    useImperativeHandle(ref, () => ({
      addGeoJSONToMap,
      runElosAnalysis: async (options?: MarkerAnalysisOptions | MergedAnalysisOptions) => {
        // Log map initialization check
        console.log("Checking map initialization...");
        if (!mapRef.current) {
          console.error("Error: Map is not initialized");
          throw new Error("Map is not initialized");
        }
        console.log("Map initialized:", mapRef.current);
    
        if (elosGridRef.current) {
          console.log("elosGridRef initialized:", elosGridRef.current);
          try {
            if (options && 'mergedAnalysis' in options) {
              // Merged analysis
              console.log("Running merged analysis with stations:", options.stations);
              
              // Clean up existing merged visibility layer if it exists
              if (mapRef.current.getLayer(MAP_LAYERS.MERGED_VISIBILITY)) {
                mapRef.current.removeLayer(MAP_LAYERS.MERGED_VISIBILITY);
                mapRef.current.removeSource(MAP_LAYERS.MERGED_VISIBILITY);
              }
    
              // Run the merged analysis using the elosGridRef
              const results = await elosGridRef.current.runMergedAnalysis({
                stations: options.stations
              });
    
              console.log("Merged analysis complete");
              return results;
    
            } else if (options) {
              // Single marker analysis
              console.log("Running marker-based analysis with options:", options);
              
              const layerId = `${options.markerType}-grid-layer`;
              // Clean up existing layer if it exists
              if (mapRef.current.getLayer(layerId)) {
                mapRef.current.removeLayer(layerId);
                mapRef.current.removeSource(layerId);
              }
    
              // Run the analysis
              await elosGridRef.current.runAnalysis({
                markerOptions: {
                  markerType: options.markerType,
                  location: options.location,
                  range: options.range,
                },
              });
    
              console.log("Marker-based analysis completed");
    
            } else {
              // Flight path analysis
              console.log("Running flight path analysis (no options)");
              
              // Clean up existing ELOS grid layer if it exists
              if (mapRef.current.getLayer(MAP_LAYERS.ELOS_GRID)) {
                mapRef.current.removeLayer(MAP_LAYERS.ELOS_GRID);
                mapRef.current.removeSource(MAP_LAYERS.ELOS_GRID);
              }
    
              await elosGridRef.current.runAnalysis();
              console.log("Flight path analysis completed");
            }
    
          } catch (error) {
            console.error("Analysis error:", error);
            throw error;
          }
        } else {
          console.error("Error: ElosGridRef is not initialized");
          throw new Error("Analysis component not initialized");
        }
      },
      getMap: () => mapRef.current,
      toggleLayerVisibility
    }), [addGeoJSONToMap, toggleLayerVisibility]);

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
      <div>
        {/* Map container with the buttons */}
        <div
          ref={mapContainerRef}
          style={{ height: "100vh", width: "100%" }}
          className="relative"
        >
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <button
              onClick={addGroundStation}
              className={`map-button ground-station-icon ${
                isAnalyzing ? "opacity-50" : ""
              }`}
              disabled={isAnalyzing}
            >
              Add Ground Station 📡
              {isAnalyzing && <span className="ml-2">•••</span>}
            </button>
            <button
              onClick={addObserver}
              className={`map-button observer-icon ${
                isAnalyzing ? "opacity-50" : ""
              }`}
              disabled={isAnalyzing}
            >
              Add Observer 🔭
              {isAnalyzing && <span className="ml-2">•••</span>}
            </button>
            <button
              onClick={addRepeater}
              className={`map-button repeater-icon ${
                isAnalyzing ? "opacity-50" : ""
              }`}
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