"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useDropzone } from "react-dropzone";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";

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

const Map = ({
  estimatedFlightDistance,
}: {
  estimatedFlightDistance: number;
}) => {
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [startMarker, setStartMarker] = useState<mapboxgl.Marker | null>(null);
  const [endMarker, setEndMarker] = useState<mapboxgl.Marker | null>(null);
  const [showTick, setShowTick] = useState(false); // New state to manage the tick display

  const lineRef = useRef<GeoJSON.FeatureCollection | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null); // Ref to store the marker instance

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

        // @ts-expect-error coordinates definite exists
        const coordinates = feature.geometry.coordinates;
        // Calculate the total distance covered by the line
        const line = turf.lineString(
          coordinates.map((coord: [number, number]) => [coord[0], coord[1]])
        );

        const totalDistance = turf.length(line, { units: "kilometers" });
        setTotalDistance(totalDistance);

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
              "#FFFF00",
            ],
          },
        });
        // Calculate the bounds of the line
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
          zoom: 12.5,
        });

        // Create markers at the start and end of the line
        const startCoord = coordinates[0];
        const endCoord = coordinates[coordinates.length - 1];
        // Create start marker
        if (!startMarker) {
          const newStartMarker = new mapboxgl.Marker({ color: "green" })
            .setLngLat(startCoord)
            .setPopup(
              new mapboxgl.Popup({ closeButton: false }).setHTML(
                "'<strong style=\"color: black;\">Start</strong>'"
              )
            )
            .addTo(mapRef.current!);
          newStartMarker.togglePopup();
          setStartMarker(newStartMarker);
        }

        // Create end marker
        if (!endMarker) {
          const newEndMarker = new mapboxgl.Marker({ color: "red" })
            .setLngLat(endCoord)
            .setPopup(
              new mapboxgl.Popup({ closeButton: false }).setHTML(
                "'<strong style=\"color: black;\">Finish</strong>'"
              )
            )
            .addTo(mapRef.current!);
          newEndMarker.togglePopup();
          setEndMarker(newEndMarker);
        }
      });

      lineRef.current = geojson;
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

  // Update the marker position when the estimated distance changes
  useEffect(() => {
    if (lineRef.current && estimatedFlightDistance > 0) {
      const line = turf.lineString(
        // @ts-expect-error Why
        lineRef.current.features[0].geometry.coordinates.map(
          (coord: [number, number]) => [coord[0], coord[1]]
        )
      );
      const distanceAlongLine = turf.along(line, estimatedFlightDistance, {
        units: "kilometers",
      });
      const point = distanceAlongLine.geometry.coordinates;

      // Check if the estimated flight distance is greater than the total distance
      if (estimatedFlightDistance > totalDistance) {
        setShowTick(true); // Show the green tick
        if (markerRef.current) {
          markerRef.current.remove(); // Remove the marker
          markerRef.current = null; // Clear the marker ref
        }
      } else {
        setShowTick(false); // Hide the green tick

        // Update marker position on map
        if (markerRef.current) {
          markerRef.current.setLngLat([point[0], point[1]]);
        } else {
          // If marker does not exist yet, create it
          if (mapRef.current) {
            const popup = new mapboxgl.Popup({ closeButton: false })
              .setHTML(
                '<strong style="color: black;">❌ Estimated finish</strong>'
              ) // Red Cross Emoji
              .setMaxWidth("none");

            const newMarker = new mapboxgl.Marker()
              .setLngLat([point[0], point[1]])
              .addTo(mapRef.current);

            newMarker.setPopup(popup).togglePopup(); // Automatically show the popup

            markerRef.current = newMarker; // Store marker instance in ref
          }
        }
      }
    }
  }, [estimatedFlightDistance, totalDistance]);

  return (
    <div>
      <div className="flex items-center">
        {/* Component 1: Dropzone */}
        <div className="flex-1 px-16 py-10">
          <div
            {...getRootProps()}
            className="border-dashed border-2 text-white px-4 py-4 rounded shadow hover:bg-blue-600"
          >
            <input {...getInputProps()} />
            <p>
              Drag & drop GeoJSON or Mission Planner files here, or click to
              select files
            </p>
          </div>
        </div>

        {/* Component 2: Button for Example */}
        <div className="flex-4 px-8 py-10">
          <button
            onClick={loadExampleGeoJSON}
            className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600"
          >
            Show Me an Example
          </button>
        </div>
      </div>
      <div className="flex justify-center items-center my-4">
        {showTick ? (
          <>
            <p className="text-green-500">
              ✅ Flight distance exceeds the total distance! (
              {totalDistance.toFixed(2)}km)
            </p>
          </>
        ) : (
          <>
            <p className="text-red-500">
              ❌ Flight distance does not exceed the total distance! (
              {totalDistance.toFixed(2)}km)
            </p>
          </>
        )}
      </div>
      <div ref={mapContainerRef} style={{ height: "70vh", width: "100%" }} />
    </div>
  );
};

export default Map;
