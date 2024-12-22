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

mapboxgl.accessToken =
  "pk.eyJ1IjoiaW50ZWxhZXJvIiwiYSI6ImNtM2EwZzY3ODB5bDgyam9yOTZ1ajE2YWsifQ.b9w33legWjEDzezOZx1N4g";

export interface MapRef {
  addGeoJSONToMap: (geojson: GeoJSON.FeatureCollection) => void;
}

interface MapProps {
  estimatedFlightDistance: number;
  onDataProcessed?: (data: { averageDraw: number; phaseData: any[] }) => void;
  onShowTickChange: (value: boolean) => void;
}
const Map = forwardRef<MapRef, MapProps>(
  ({ estimatedFlightDistance, onDataProcessed,onShowTickChange }, ref) => {
    const [totalDistance, setTotalDistance] = useState<number>(0);
    const lineRef = useRef<GeoJSON.FeatureCollection | null>(null);
    const [showTick, setShowTick] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null);

    useEffect(() => {
      if (mapRef.current) {
        mapRef.current.dragRotate.enable();
        mapRef.current.touchZoomRotate.enableRotation();
        mapRef.current.addControl(new mapboxgl.NavigationControl());
      }
    }, []);

    const addGeoJSONToMap = (geojson: GeoJSON.FeatureCollection) => {
      if (mapRef.current && geojson.type === "FeatureCollection") {
        const features = geojson.features.filter(
          (f) => f.geometry.type === "LineString"
        );

        features.forEach((feature, idx) => {
          const layerId = `line-${idx}`;
          if (mapRef.current.getSource(layerId)) {
            mapRef.current.removeLayer(layerId);
            mapRef.current.removeSource(layerId);
          }

          const coordinates = feature.geometry.coordinates as [
            number,
            number,
            number?
          ][];

          const line = turf.lineString(
            coordinates.map((coord) => [coord[0], coord[1]])
          );
          const totalDistance = turf.length(line, { units: "kilometers" });
          setTotalDistance(totalDistance);

          mapRef.current.addSource(layerId, {
            type: "geojson",
            data: feature,
            lineMetrics: true,
          });
          mapRef.current.addLayer({
            id: layerId,
            type: "line",
            source: layerId,
            paint: {
              "line-width": 4,
              "line-gradient": [
                "interpolate",
                ["linear"],
                ["line-progress"],
                0,
                "#FFFF00",
              ],
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
          mapRef.current.fitBounds(bounds as [number, number, number, number], {
            padding: 50,
            duration: 1000,
            pitch: 70,
            zoom: 12.5,
          });

          const startCoord = coordinates[0];
          if (startMarkerRef.current) {
            startMarkerRef.current.setLngLat(startCoord);
          } else {
            const newStartMarker = new mapboxgl.Marker({ color: "green" })
              .setLngLat(startCoord)
              .setPopup(
                new mapboxgl.Popup({ closeButton: false }).setHTML(
                  '<strong style="color: black;">Start</strong>'
                )
              )
              .addTo(mapRef.current);
            newStartMarker.togglePopup();
            startMarkerRef.current = newStartMarker;
          }

          const endCoord = coordinates[coordinates.length - 1];
          if (endMarkerRef.current) {
            endMarkerRef.current.setLngLat(endCoord);
          } else {
            const newEndMarker = new mapboxgl.Marker({ color: "red" })
              .setLngLat(endCoord)
              .setPopup(
                new mapboxgl.Popup({ closeButton: false }).setHTML(
                  '<strong style="color: black;">Finish</strong>'
                )
              )
              .addTo(mapRef.current);
            newEndMarker.togglePopup();
            endMarkerRef.current = newEndMarker;
          }

          lineRef.current = geojson;
        });
      }
    };

    useEffect(() => {
      if (lineRef.current && estimatedFlightDistance > 0) {
        const line = turf.lineString(
          lineRef.current.features[0].geometry.coordinates.map(
            (coord: [number, number]) => [coord[0], coord[1]]
          )
        );
        const estimatedPoint = turf.along(line, estimatedFlightDistance, {
          units: "kilometers",
        });

        if (estimatedFlightDistance > totalDistance) {
          setShowTick(true);
          onShowTickChange(true);
          if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
          }
        } else {
          setShowTick(false);
          onShowTickChange(false);
          const [lng, lat] = estimatedPoint.geometry.coordinates as [
            number,
            number
          ];
          if (markerRef.current) {
            markerRef.current.setLngLat([lng, lat]);
          } else {
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
    }, [estimatedFlightDistance, totalDistance]);

    useImperativeHandle(ref, () => ({
      addGeoJSONToMap,
    }));

    useEffect(() => {
      if (mapContainerRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y",
          center: [0, 0],
          zoom: 2.5,
          projection: "globe",
        });
      }
      return () => {
        mapRef.current?.remove();
      };
    }, []);

    useEffect(() => {
      if (mapContainerRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y",
          center: [0, 0],
          zoom: 2.5,
          projection: "globe",
        });
    
        mapRef.current.on("load", () => {
          // Add terrain source
          mapRef.current!.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });
    
          // Enable terrain with exaggeration
          mapRef.current!.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
    
          // Add sky layer
          mapRef.current!.addLayer({
            id: "sky",
            type: "sky",
            paint: {
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 90.0],
              "sky-atmosphere-sun-intensity": 15,
            },
          });
    
          console.log("Terrain and sky layer added successfully");
        });
      }
    
      // Cleanup on unmount
      return () => {
        mapRef.current?.remove();
      };
    }, []);
    
    const handleFlightPlanUpload = (geojson: GeoJSON.FeatureCollection) => {
      addGeoJSONToMap(geojson);
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

    return (
      <div>
        <div className="flex flex-col md:flex-row gap-4 p-4 px-4 mt-4">
          <div className="bg-gray-300 p-4 rounded-md w-full md:w-1/2">
            <h2 className="text-xl font-semibold mb-4">Step 1: Upload Your Flight Plan</h2>
            <FlightPlanUploader onPlanUploaded={handleFlightPlanUpload} />
          </div>
          <div className="bg-gray-300 p-4 rounded-md w-full md:w-1/2">
            <h2 className="text-xl font-semibold mb-4">Step A: Upload Your Flight Log, or</h2>
            <FlightLogUploader onProcessComplete={handleFileProcessing} />
          </div>
        </div>
        <div
          ref={mapContainerRef}
          style={{ height: "70vh", width: "100%", marginBottom: "100px" }}
        />
      </div>
    );
  }
);

Map.displayName = "Map";
export default Map;
