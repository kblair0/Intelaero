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

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface MapRef {
  addGeoJSONToMap: (geojson: GeoJSON.FeatureCollection) => void;
}

interface MapProps {
  estimatedFlightDistance: number;
  onDataProcessed?: (data: { averageDraw: number; phaseData: any[] }) => void;
  onShowTickChange: (value: boolean) => void;
  onTotalDistanceChange: (distance: number) => void;
  onPlanUploaded: (geojson: GeoJSON.FeatureCollection) => void;
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
    const [totalDistance, setTotalDistance] = useState<number>(0);
    const lineRef = useRef<GeoJSON.FeatureCollection | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markerRef = useRef<mapboxgl.Marker | null>(null);
    const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const endMarkerRef = useRef<mapboxgl.Marker | null>(null);

    useEffect(() => {
      if (mapRef?.current) {
        mapRef?.current.dragRotate.enable();
        mapRef?.current.touchZoomRotate.enableRotation();
        mapRef?.current.addControl(new mapboxgl.NavigationControl());
      }
    }, []);

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
        mapRef?.current?.remove();
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

        mapRef?.current.on("load", () => {
          // Add terrain source
          mapRef?.current!.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512,
            maxzoom: 14,
          });

          // Enable terrain with exaggeration
          mapRef?.current!.setTerrain({
            source: "mapbox-dem",
            exaggeration: 1.5,
          });

          // Add sky layer
          mapRef?.current!.addLayer({
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
        mapRef?.current?.remove();
      };
    }, []);

    const handleFlightPlanUpload = (geojson: GeoJSON.FeatureCollection) => {
      // Add the flight plan to the map
      addGeoJSONToMap(geojson);

      // Ensure the original `onPlanUploaded` behavior is preserved
      if (typeof onPlanUploaded === "function") {
        onPlanUploaded(geojson);
      }
    };

    const combinedOnPlanUploaded = (geojson: GeoJSON.FeatureCollection) => {
      // Trigger the parent-provided onPlanUploaded
      if (typeof onPlanUploaded === "function") {
        onPlanUploaded(geojson); // This calls handleFlightPlanUpdate in battcalc
      }

      // Trigger the Map-specific upload logic
      handleFlightPlanUpload(geojson); // Adds the flight plan to the map
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
            <h2 className="text-xl font-semibold mb-4">
              Step 1: Upload Your Flight Plan
            </h2>
            <FlightPlanUploader onPlanUploaded={combinedOnPlanUploaded} />
          </div>
          <div className="bg-gray-300 p-4 rounded-md w-full md:w-1/2">
            <h2 className="text-xl font-semibold mb-4">
              Step 2A: Upload Your Flight Log (.ulg) (Optional)
            </h2>
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
