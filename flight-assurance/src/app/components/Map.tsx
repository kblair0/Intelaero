"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useDropzone } from "react-dropzone";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

const Map = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const geojson = JSON.parse(reader.result as string);
        addGeoJSONToMap(geojson);
      }
    };
    acceptedFiles.forEach((file) => reader.readAsText(file));
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "application/geo+json": [".geojson"] },
    onDrop,
  });

  const addGeoJSONToMap = (geojson: GeoJSON.FeatureCollection) => {
    if (mapRef.current && geojson.type === "FeatureCollection") {
      const features = geojson.features.filter(
        (f) => f.geometry.type === "LineString"
      );
      features.forEach((feature, idx) => {
        const layerId = `line-${idx}`;
        mapRef.current!.addSource(layerId, {
          type: "geojson",
          data: feature,
          lineMetrics: true,
        });
        mapRef.current!.addLayer({
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
              "#00FF00", // Green at the start
              1,
              "#FF0000", // Red at the end
            ],
          },
        });
        // Calculate the bounds of the line
        // @ts-expect-error lineMetrics is enabled
        const coordinates = feature.geometry.coordinates;
        const bounds = coordinates.reduce(
          // @ts-expect-error lineMetrics is enabled
          (acc, coord) => {
            const [lng, lat] = coord;
            acc[0] = Math.min(acc[0], lng);
            acc[1] = Math.min(acc[1], lat);
            acc[2] = Math.max(acc[2], lng);
            acc[3] = Math.max(acc[3], lat);
            return acc;
          },
          [Infinity, Infinity, -Infinity, -Infinity]
        );

        // Zoom to the bounds of the line
        mapRef.current!.fitBounds(bounds, {
          padding: 50, // Optional padding around the line
          duration: 1000, // Duration of the zoom animation
          pitch: 45, // Pitch of the map
        });
      });
    }
  };

  useEffect(() => {
    if (mapContainerRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/jackmckew2/cm481344h00en01rcewr60wj5",
        center: [0, 0],
        zoom: 2,
      });
    }

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div>
      <div
        {...getRootProps()}
        style={{ border: "2px dashed gray", padding: "1rem", margin: "1rem" }}
      >
        <input {...getInputProps()} />
        <p>Drag & drop GeoJSON files here, or click to select files</p>
      </div>
      <div ref={mapContainerRef} style={{ height: "100vh", width: "100%" }} />
    </div>
  );
};

export default Map;
