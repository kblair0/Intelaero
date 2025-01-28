/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import FlightLogUploader from "./FlightLogUploader";
import FlightPlanUploader from "./FlightPlanUploader";
import ELOSGridAnalysis from './ELOSGridAnalysis';
import { layerManager } from './LayerManager';

// Contexts
import { useLocation } from '../context/LocationContext';
import { useFlightPlanContext } from '../context/FlightPlanContext';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface LocationData {
  lng: number;
  lat: number;
  elevation: number | null;
}

export interface MapRef {
  addGeoJSONToMap: (geojson: GeoJSON.FeatureCollection) => void;
  runElosAnalysis: (options?: MarkerAnalysisOptions) => Promise<void>;
  getMap: () => mapboxgl.Map | null; // To expose the underlying map
  toggleLayerVisibility: (layerId: string) => void;
}

interface MapProps {
  estimatedFlightDistance: number;
  onShowTickChange?: (value: boolean) => void;
  onTotalDistanceChange?: (distance: number) => void;
  elosGridRange?: number;
}

interface ELOSGridAnalysisRef {
  runAnalysis: (options?: { markerOptions?: MarkerAnalysisOptions }) => Promise<void>;
}

// Interface for Marker LOS Analysis
interface MarkerAnalysisOptions {
  markerType: 'gcs' | 'observer' | 'repeater';
  location: LocationData;
  range: number;
}

const Map = forwardRef<MapRef, MapProps>(
  (
    {
      estimatedFlightDistance,
      onDataProcessed,
      onShowTickChange,
      onTotalDistanceChange,
      onPlanUploaded,
      elosGridRange,
    },
    ref
  ) => {
    // Add context hooks
    const { 
      gcsLocation, setGcsLocation,
      observerLocation, setObserverLocation,
      repeaterLocation, setRepeaterLocation 
    } = useLocation();
    
    const { flightPlan: contextFlightPlan, setFlightPlan: setContextFlightPlan } = useFlightPlanContext();

    const [totalDistance, setTotalDistance] = useState<number>(0);
    const lineRef = useRef<GeoJSON.FeatureCollection | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const elosGridRef = useRef<ELOSGridAnalysisRef | null>(null);

    useEffect(() => {
      if (mapRef?.current) {
        mapRef?.current.dragRotate.enable();
        mapRef?.current.touchZoomRotate.enableRotation();
        mapRef?.current.addControl(new mapboxgl.NavigationControl());
      }
    }, []);

    useEffect(() => {
      if (contextFlightPlan && mapRef.current) {
        console.log("Displaying flight plan from context:", contextFlightPlan);
        addGeoJSONToMap(contextFlightPlan);
      }
    }, [contextFlightPlan]); // Only re-run when contextFlightPlan changes

    const addGeoJSONToMap = (geojson: GeoJSON.FeatureCollection) => {
      if (mapRef?.current && geojson.type === "FeatureCollection") {
        const features = geojson.features.filter(
          (f) => f.geometry.type === "LineString"
        );

        features.forEach((feature, idx) => {
          const layerId = `line-${idx}`;
          if (mapRef?.current?.getSource(layerId)) {
            mapRef?.current.removeLayer(layerId);
            mapRef?.current.removeSource(layerId);
          }

          // @ts-expect-error This works
          const coordinates = feature.geometry.coordinates as [
            number,
            number,
            number?
          ][];

          console.log("Coordinates with altitude data:", coordinates);
          feature.properties = feature.properties || {}; // Ensure properties object exists
          feature.properties.altitudes = coordinates.map(
            (coord) => coord[2] || 0
          );
          console.log(
            "Feature properties after adding altitudes:",
            feature.properties
          );

          const validCoordinates = coordinates.map(([lng, lat, alt]) => [
            lng,
            lat,
            alt || 0,
          ]);
          const line = turf.lineString(validCoordinates);
          const totalDistance = turf.length(line, { units: "kilometers" });
          setTotalDistance(totalDistance);
          if (onTotalDistanceChange) {
            console.log("Calculated total distance:", totalDistance);
            onTotalDistanceChange(totalDistance);
          }

          mapRef?.current?.addSource(layerId, {
            type: "geojson",
            data: feature,
            lineMetrics: true,
          });

          console.log(
            "Adding layer with altitudes:",
            feature.properties.altitudes
          );

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
              "line-color": "#FFFF00", // Static yellow color
              "line-opacity": 1,
            },
          });

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
                    '<strong style="color: black;">Start</strong>'
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
                    '<strong style="color: black;">Finish</strong>'
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
    };

    useEffect(() => {
      if (lineRef.current && estimatedFlightDistance > 0) {
        const line = turf.lineString(
          // @ts-expect-error This works
          lineRef.current.features[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[0], coord[1]]
          )
        );
        const estimatedPoint = turf.along(line, estimatedFlightDistance, {
          units: "kilometers",
        });

        if (estimatedFlightDistance > totalDistance) {
          onShowTickChange(true);
          if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
          }
        } else {
          onShowTickChange(false);
          const [lng, lat] = estimatedPoint.geometry.coordinates as [
            number,
            number
          ];
          if (markerRef.current) {
            markerRef.current.setLngLat([lng, lat]);
          } else {
            if (mapRef.current) {
              markerRef.current = new mapboxgl.Marker({ color: "blue" })
                .setLngLat([lng, lat])
                .setPopup(
                  new mapboxgl.Popup({ closeButton: false }).setHTML(
                    '<strong style="color: black;">Estimated Finish</strong>'
                  )
                )
                .addTo(mapRef.current!);
              markerRef.current.togglePopup();
            }
          }
        }
      }
    }, [estimatedFlightDistance, onShowTickChange, totalDistance]);

    const terrainElevationMethods: TerrainElevationMethods = {
      async getRGBElevation(lng: number, lat: number): Promise<number> {
        try {
          const tileSize = 512;
          const zoom = 15;
          const scale = Math.pow(2, zoom);
          
          const latRad = (lat * Math.PI) / 180;
          const tileX = Math.floor(((lng + 180) / 360) * scale);
          const tileY = Math.floor(
            ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
          );
    
          const pixelX = Math.floor((((lng + 180) / 360) * scale - tileX) * tileSize);
          const pixelY = Math.floor(
            (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale - tileY) *
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
  },

  getQueryElevation(lng: number, lat: number): number | null {
    return mapRef.current?.queryTerrainElevation([lng, lat]) ?? null;
  }
};

const toggleLayerVisibility = (layerId: string) => {
  return layerManager.toggleLayerVisibility(layerId);
};

useImperativeHandle(ref, () => ({
  addGeoJSONToMap,
  runElosAnalysis: async (options?: MarkerAnalysisOptions) => {
    if (!mapRef.current) {
      throw new Error('Map is not initialized');
    }
    if (elosGridRef.current) {
      if (options) {
        // Marker-based analysis
        await elosGridRef.current.runAnalysis({
          markerOptions: {
            markerType: options.markerType,
            location: options.location,
            range: options.range
          }
        });
      } else {
        // Flight path analysis
        await elosGridRef.current.runAnalysis();
      }
    }
  },
  getMap: () => mapRef.current,
  toggleLayerVisibility,
}), [addGeoJSONToMap]);

    //map initialization
    useEffect(() => {
      if (mapContainerRef.current) {
        try {
          // Initialize the Mapbox map
          const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: "mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y",
            center: [0, 0],
            zoom: 2.5,
            projection: "globe",
          });
    
          map.on("load", () => {
            try {
              // Add terrain source
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
    
              map.addLayer({
                id: "sky",
                type: "sky",
                paint: {
                  "sky-type": "atmosphere",
                  "sky-atmosphere-sun": [0.0, 90.0],
                  "sky-atmosphere-sun-intensity": 15,
                },
              });

              layerManager.setMap(map);
    
              // Only set mapRef.current after everything is loaded
              mapRef.current = map;
              console.log("Map fully initialized with all layers");
            } catch (error) {
              console.error("Error initializing map layers:", error);
            }
          });
        } catch (error) {
          console.error("Error creating map:", error);
        }
      }
    
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }, []);

    const fetchTerrainElevation = async (lng: number, lat: number): Promise<number> => {
      try {
        const tileSize = 512;
        const zoom = 15;
        const scale = Math.pow(2, zoom);
        
        const latRad = (lat * Math.PI) / 180;
        const tileX = Math.floor(((lng + 180) / 360) * scale);
        const tileY = Math.floor(
          ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
        );
    
        const pixelX = Math.floor((((lng + 180) / 360) * scale - tileX) * tileSize);
        const pixelY = Math.floor(
          (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale - tileY) *
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
      markerType: 'gcs' | 'observer' | 'repeater',
      initialElevation: number | null,
      onDelete: () => void
    ) => {
      const popupDiv = document.createElement("div");
      const currentElevation = initialElevation || 0;
    
      const styles = {
        container: 'padding: 8px; min-width: 200px;',
        header: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;',
        deleteBtn: 'background: #e53e3e; color: white; border: none; padding: 2px 4px; border-radius: 4px; cursor: pointer; font-size: 10px;',
        section: 'margin-bottom: 8px;',
        label: 'color: #4a5568; font-size: 12px; display: block; margin-bottom: 4px;',
        value: 'color: #1a202c; font-size: 12px; font-weight: 500;',
        losButton: 'background: #4a5568; color: white; border: none; padding: 4px 8px; border-radius: 4px; margin: 2px; font-size: 12px; cursor: pointer; width: 100%;',
      };
    
      const markerInfo = {
        gcs: { icon: '📡', title: 'GCS', color: '#3182ce' },
        observer: { icon: '🔭', title: 'Observer', color: '#38a169' },
        repeater: { icon: '⚡️', title: 'Repeater', color: '#e53e3e' }
      };
    
      const { icon, title, color } = markerInfo[markerType];
    
      popupDiv.innerHTML = `
      <div style="${styles.container}">
        <div style="${styles.header}">
          <strong style="color: black; font-size: 14px;">${title} ${icon}</strong>
          <button id="delete-${markerType}-btn" style="${styles.deleteBtn}">X</button>
        </div>
        
        <div style="${styles.section}">
          <label style="${styles.label}">Ground Elevation:</label>
          <span style="${styles.value}">${currentElevation.toFixed(1)}m ASL</span>
        </div>
  
        <div style="${styles.section}" id="los-buttons">
        </div>
      </div>
    `;
  
    // Add LOS check buttons for other markers
    const losButtons = popupDiv.querySelector('#los-buttons');
    if (losButtons) {
      // Get current locations and their types
      const markerLocations = {
        gcs: gcsLocation,
        observer: observerLocation,
        repeater: repeaterLocation
      };
  
      // Add buttons for other markers
      Object.entries(markerLocations).forEach(([type, location]) => {
        if (type !== markerType && location) {
          const button = document.createElement('button');
          button.style.cssText = styles.losButton;
          button.textContent = `Check LOS to ${type.toUpperCase()}`;
          
          button.onclick = async () => {
            const currentLoc = markerLocations[markerType as keyof typeof markerLocations];
            if (currentLoc && location) {
              console.log('Checking LOS between:', currentLoc, location);
              const hasLOS = await checkLineOfSight(currentLoc, location);
              console.log('LOS result:', hasLOS);
              
              // Make the style changes more explicit
              button.style.cssText = `
                ${styles.losButton};
                background-color: ${hasLOS ? '#38a169' : '#e53e3e'};
                transition: background-color 0.3s ease;
              `;
              
              button.textContent = `${type.toUpperCase()}: ${hasLOS ? 'Visible ✓' : 'No LOS ✗'}`;
            } else {
              console.log('Missing location data:', { currentLoc, location });
            }
          };
          
          losButtons.appendChild(button);
        }
      });
    }
  
    // Add delete button handler
    popupDiv.querySelector(`#delete-${markerType}-btn`)?.addEventListener('click', onDelete);
  
    return new mapboxgl.Popup({ closeButton: false }).setDOMContent(popupDiv);
  };
  
    //Add Markers
    //GCS Marker
    const addGroundStation = () => {
      if (!mapRef.current) return;
    
      const center = mapRef.current.getCenter();
      const elevation = mapRef.current?.queryTerrainElevation(center);
      const initialLocation: LocationData = {
        lng: center.lng,
        lat: center.lat,
        elevation: elevation
      };
      console.log('GCS Initial Location:', initialLocation);
    
      setGcsLocation(initialLocation); // Only context update
      
      const gcsMarker = new mapboxgl.Marker({ color: "blue", draggable: true })
        .setLngLat(center)
        .addTo(mapRef.current);
    
      // Create popup with enhanced content
      const popup = createMarkerPopup(
        'gcs',
        elevation,
        () => {
          gcsMarker.remove();
          setGcsLocation(null); // Only context update
        }
      );
    
      gcsMarker.setPopup(popup).togglePopup();
    
      // Add dragend event listener
      gcsMarker.on('dragend', () => {
        const lngLat = gcsMarker.getLngLat();
        const newElevation = mapRef.current?.queryTerrainElevation(lngLat);
        const location: LocationData = {
          lng: lngLat.lng,
          lat: lngLat.lat,
          elevation: newElevation
        };
        setGcsLocation(location); // Only context update
        
        // Update popup with new elevation
        const popup = createMarkerPopup(
          'gcs',
          newElevation,
          () => {
            gcsMarker.remove();
            setGcsLocation(null); // Only context update
          }
        );
        gcsMarker.setPopup(popup).togglePopup();
      });
    };
    //Observer Marker
    const addObserver = () => {
      if (!mapRef.current) return;
    
      const center = mapRef.current.getCenter();
      const elevation = mapRef.current?.queryTerrainElevation(center);
      const initialLocation: LocationData = {
        lng: center.lng,
        lat: center.lat,
        elevation: elevation
      };
      console.log('Observer Initial Location:', initialLocation);
    
      setObserverLocation(initialLocation); // Only keep this context update
      
      const observerMarker = new mapboxgl.Marker({ color: "green", draggable: true })
        .setLngLat(center)
        .addTo(mapRef.current);
    
      const popup = createMarkerPopup(
        'observer',
        elevation,
        () => {
          observerMarker.remove();
          setObserverLocation(null); // Only keep this context update
        }
      );
    
      observerMarker.setPopup(popup).togglePopup();
      
      observerMarker.on('dragend', () => {
        const lngLat = observerMarker.getLngLat();
        const newElevation = mapRef.current?.queryTerrainElevation(lngLat);
        const location: LocationData = {
          lng: lngLat.lng,
          lat: lngLat.lat,
          elevation: newElevation
        };
        setObserverLocation(location); // Only keep this context update
        
        const popup = createMarkerPopup(
          'observer',
          newElevation,
          () => {
            observerMarker.remove();
            setObserverLocation(null); // Only keep this context update
          }
        );
        observerMarker.setPopup(popup).togglePopup();
      });
    };
    
    const addRepeater = () => {
      if (!mapRef.current) return;
    
      const center = mapRef.current.getCenter();
      const elevation = mapRef.current?.queryTerrainElevation(center);
      const initialLocation: LocationData = {
        lng: center.lng,
        lat: center.lat,
        elevation: elevation
      };
      console.log('Repeater Initial Location:', initialLocation);
    
      setRepeaterLocation(initialLocation); // Only keep this context update
    
      const repeaterMarker = new mapboxgl.Marker({ color: "red", draggable: true })
        .setLngLat(center)
        .addTo(mapRef.current);
    
      const popup = createMarkerPopup(
        'repeater',
        elevation,
        () => {
          repeaterMarker.remove();
          setRepeaterLocation(null); // Only keep this context update
        }
      );
    
      repeaterMarker.setPopup(popup).togglePopup();
    
      repeaterMarker.on('dragend', () => {
        const lngLat = repeaterMarker.getLngLat();
        const newElevation = mapRef.current?.queryTerrainElevation(lngLat);
        const location: LocationData = {
          lng: lngLat.lng,
          lat: lngLat.lat,
          elevation: newElevation
        };
        setRepeaterLocation(location); // Only keep this context update
        
        const popup = createMarkerPopup(
          'repeater',
          newElevation,
          () => {
            repeaterMarker.remove();
            setRepeaterLocation(null); // Only keep this context update
          }
        );
        repeaterMarker.setPopup(popup).togglePopup();
      });
    };
    // Marker LOS Between Check
    const checkLineOfSight = async (point1: LocationData, point2: LocationData): Promise<boolean> => {
      if (!mapRef.current) return false;
    
      const distance = turf.distance(
        turf.point([point1.lng, point1.lat]),
        turf.point([point2.lng, point2.lat]),
        { units: 'kilometers' }
      );
    
      // Sample points along the line
      const samples = 50;
      const line = turf.lineString([[point1.lng, point1.lat], [point2.lng, point2.lat]]);
      
      for (let i = 0; i <= samples; i++) {
        const along = turf.along(line, (distance * i) / samples, { units: 'kilometers' });
        const [lng, lat] = along.geometry.coordinates;
        
        // Get elevation at this point
        const pointElevation = mapRef.current.queryTerrainElevation([lng, lat]) || 0;
        
        // Calculate expected elevation at this point (linear interpolation)
        const ratio = i / samples;
        const expectedElevation = 
          (point1.elevation || 0) + ratio * ((point2.elevation || 0) - (point1.elevation || 0));
        
        // If terrain is higher than our line of sight, return false
        if (pointElevation > expectedElevation) {
          return false;
        }
      }
      
      return true;
    };

    return (
      <div>
        {/* Map container with the buttons */}
        <div
          ref={mapContainerRef}
          style={{ height: "70vh", width: "100%", marginBottom: "100px" }}
          className="relative"
        >
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <button
              onClick={addGroundStation}
              className="map-button ground-station-icon"
            >
              Add Ground Station 📡
            </button>
            <button
              onClick={addObserver}
              className="map-button observer-icon"
            >
              Add Observer 🔭
            </button>
            <button
              onClick={addRepeater}
              className="map-button repeater-icon"
            >
              Add Repeater ⚡️
            </button>
          </div>
        </div>
    
        {contextFlightPlan && (
          <ELOSGridAnalysis
            ref={elosGridRef}
            map={mapRef.current!}
            flightPath={contextFlightPlan}
            elosGridRange={elosGridRange}
            onError={(error) => {
              console.error('ELOS Analysis error:', error);
            }}
            onSuccess={(result) => {
              console.log('ELOS Analysis completed:', result);
            }}
          />
        )}
      </div>
    );
  }
);

Map.displayName = "Map";
export default Map;