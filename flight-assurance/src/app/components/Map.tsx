"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useDropzone } from "react-dropzone";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

// Function to parse QGC WPL file format into GeoJSON
const parseQGCFile = (content: string): GeoJSON.FeatureCollection => {
  const lines = content.trim().split("\n");
  const coordinates = [];

  // Skip the header (first two lines)
  for (let i = 2; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    const latitude = parseFloat(parts[8]);
    const longitude = parseFloat(parts[9]);
    const elevation = parseFloat(parts[10]);

    if (
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      !isNaN(elevation) &&
      latitude !== 0 &&
      longitude !== 0
    ) {
      coordinates.push([longitude, latitude, elevation]); // Format: [lon, lat, alt]
    }
  }

  // Convert to GeoJSON format
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Drone Flight Path" },
        geometry: {
          type: "LineString",
          coordinates,
        },
      },
    ],
  };
};

const Map = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // Enable free tilt and rotation
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.dragRotate.enable();
      mapRef.current.touchZoomRotate.enableRotation();

      // Add zoom and rotation controls to the map.
      mapRef.current.addControl(new mapboxgl.NavigationControl());
    }
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        if (fileExtension === "waypoints") {
          const qgcToGeojson = parseQGCFile(reader.result as string);
          addGeoJSONToMap(qgcToGeojson);
        }
        if (fileExtension === "geojson") {
          const geojson = JSON.parse(reader.result as string);
          addGeoJSONToMap(geojson);
        }
      }
    };
    acceptedFiles.forEach((file) => reader.readAsText(file));
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "application/geo+json": [".geojson"],
      "application/waypoints": [".waypoints"],
    },
    onDrop,
  });

  const addGeoJSONToMap = (geojson: GeoJSON.FeatureCollection) => {
    if (mapRef.current && geojson.type === "FeatureCollection") {
      const features = geojson.features.filter(
        (f) => f.geometry.type === "LineString"
      );
      features.forEach((feature, idx) => {
        const layerId = `line-${idx}`;
        // Remove existing layer and source if they exist
        if (mapRef.current!.getSource(layerId)) {
          mapRef.current!.removeLayer(layerId);
          mapRef.current!.removeSource(layerId);
        }
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
          pitch: 70, // Pitch of the map
          zoom: 13,
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
        zoom: 2.5,
      });
    }

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  const loadExampleGeoJSON = async () => {
    try {
      const response = await fetch("/example.geojson"); // Path to your example file
      const data = await response.json();

      addGeoJSONToMap(data);
    } catch (error) {
      console.log("Error loading example GeoJSON:", error);
    }
  };

  return (
    <div>
      <div
        {...getRootProps()}
        style={{ border: "2px dashed gray", padding: "1rem", margin: "1rem" }}
      >
        <input {...getInputProps()} />
        <p>
          Drag & drop GeoJSON or Mission Planner files here, or click to select
          files
        </p>
      </div>
      <button
        onClick={loadExampleGeoJSON}
        className="absolute top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600"
      >
        Show Me an Example
      </button>
      <div ref={mapContainerRef} style={{ height: "80vh", width: "100%" }} />
    </div>
  );
};

export default Map;
