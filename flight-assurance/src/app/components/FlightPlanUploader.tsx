// FlightPlanUploader.tsx
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import toGeoJSON from "@mapbox/togeojson";

const parser = typeof window !== "undefined" ? new DOMParser() : null;

function frameToAltitudeMode(frame: number): "absolute" | "relative" | "terrain" {
  switch (frame) {
    case 3:
      return "relative";
    case 10:
      return "terrain";
    case 0:
    default:
      return "absolute";
  }
}

function parseQGCFile(content: string): import("../context/FlightPlanContext").FlightPlanData {
  const lines = content.trim().split("\n");

  if (!lines[0].includes("QGC WPL 110")) {
    throw new Error("Invalid .waypoints file. Missing QGC WPL 110 header.");
  }

  let homePosition = { latitude: 0, longitude: 0, altitude: 0 };
  const waypoints = [];
  const coordinates = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) continue;

    const index = parseInt(parts[0], 10);
    const current = parseInt(parts[1], 10);
    const frame = parseInt(parts[2], 10);
    const command = parseInt(parts[3], 10);
    const params = parts.slice(4, 8).map(parseFloat);
    const lat = parseFloat(parts[8]);
    const lon = parseFloat(parts[9]);
    const alt = parseFloat(parts[10]);

    const altitudeMode = frameToAltitudeMode(frame);

    if (index === 0 && current === 1) {
      homePosition = { latitude: lat, longitude: lon, altitude: alt };
    }

    waypoints.push({
      index,
      altitudeMode,
      originalAltitude: alt,
      commandType: command,
      frame,
      params,
    });

    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      coordinates.push([lon, lat, alt]);
    }
  }

  return {
    type: "FeatureCollection",
    properties: { homePosition },
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {
          name: "Drone Flight Path",
          originalAltitudes: coordinates.map((c) => c[2]),
          altitudeModes: waypoints.map((w) => w.altitudeMode),
          rawCommands: waypoints.map((w) => w.commandType),
          waypoints,
        },
      },
    ],
  };
}

function parseKMLFile(kmlText: string): import("../context/FlightPlanContext").FlightPlanData {
  const kmlDom = parser?.parseFromString(kmlText, "application/xml");
  const geojsonResult = toGeoJSON.kml(kmlDom) as GeoJSON.FeatureCollection;

  let lineStringCoords = [];
  let name = "KML Flight Path";

  for (const feature of geojsonResult.features) {
    if (feature.geometry?.type === "LineString") {
      lineStringCoords = feature.geometry.coordinates.map(([lon, lat, alt]) => [
        lon,
        lat,
        alt ?? 0,
      ]);
      name = feature.properties?.name || name;
      break;
    }
  }

  if (!lineStringCoords.length) throw new Error("No LineString geometry found in KML");

  return {
    type: "FeatureCollection",
    properties: { homePosition: inferHomePosition(lineStringCoords) },
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: lineStringCoords },
        properties: {
          name,
          originalAltitudes: lineStringCoords.map((c) => c[2]),
          altitudeModes: Array(lineStringCoords.length).fill("absolute"),
          rawCommands: Array(lineStringCoords.length).fill(16),
        },
      },
    ],
  };
}

function parseGeoJSONFile(geojsonText: string): import("../context/FlightPlanContext").FlightPlanData {
  const geojsonResult = JSON.parse(geojsonText) as GeoJSON.FeatureCollection;

  if (!geojsonResult.features || geojsonResult.features.length === 0)
    throw new Error("Invalid GeoJSON: No features found.");

  const flightFeature = geojsonResult.features.find((f) => f.geometry?.type === "LineString");
  if (!flightFeature) throw new Error("No valid flight path found in GeoJSON.");

  return {
    type: "FeatureCollection",
    properties: { homePosition: inferHomePosition(flightFeature.geometry.coordinates) },
    features: [flightFeature],
  };
}

function inferHomePosition(coordinates: [number, number, number][]) {
  if (!coordinates.length) return null;
  const [lon, lat, alt] = coordinates[0];
  return { latitude: lat, longitude: lon, altitude: alt ?? 0 };
}

interface FlightPlanUploaderProps {
  onPlanUploaded?: (flightData: import("../context/FlightPlanContext").FlightPlanData) => void;
}

const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({ onPlanUploaded }) => {
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "processed" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const { setFlightPlan } = useFlightPlanContext();

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    setFileName(file.name);
    setFileUploadStatus("uploading");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (reader.result) {
          let flightData;
          if (fileExtension === "waypoints") {
            flightData = parseQGCFile(reader.result as string);
          } else if (fileExtension === "geojson") {
            flightData = parseGeoJSONFile(reader.result as string);
          } else if (fileExtension === "kml") {
            flightData = parseKMLFile(reader.result as string);
          }

          // Reset the processed flag to false to ensure fresh processing
          const newFlightPlan = { ...flightData, processed: false };

          setFlightPlan(newFlightPlan);
          setFileUploadStatus("processed");

          // Notify parent that a new flight plan is available so it can auto-close the uploader window.
          if (onPlanUploaded) {
            onPlanUploaded(newFlightPlan);
          }
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setFileUploadStatus("error");
      }
    };
    reader.readAsText(file);
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "application/vnd.google-earth.kml+xml": [".kml"],
      "application/geo+json": [".geojson"],
      "application/waypoints": [".waypoints"],
    },
    onDrop,
  });

  const loadExampleGeoJSON = async () => {
    try {
      const response = await fetch("/example.geojson");
      const rawData = await response.json();

      const processedData = parseGeoJSONFile(JSON.stringify(rawData));
      // Reset the processed flag here too
      const newFlightPlan = { ...processedData, processed: false };

      setFlightPlan(newFlightPlan);

      if (onPlanUploaded) {
        onPlanUploaded(newFlightPlan);
      }
      setFileUploadStatus("processed");
    } catch (error) {
      console.error("Error loading example GeoJSON:", error);
      setFileUploadStatus("error");
    }
  };

  return (
    <div className="flex-1 bg-white shadow-lg p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-bold text-black">📁 Upload Your Flight Plan</h3>
      <p className="text-sm text-gray-600">
        Upload a <strong>.waypoints</strong>, <strong>.geojson</strong>, or <strong>.kml</strong> file to analyze your drone&apos;s flight path.
      </p>

      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <p className="text-gray-500">Drag &amp; Drop your file here or click to upload</p>
        {fileName && (
          <p className="mt-2 text-sm text-gray-600">Selected file: {fileName}</p>
        )}
        {fileUploadStatus === "uploading" && (
          <p className="mt-2 text-sm text-blue-600">Processing file...</p>
        )}
        {fileUploadStatus === "processed" && (
          <p className="mt-2 text-sm text-green-600">File processed successfully!</p>
        )}
        {fileUploadStatus === "error" && (
          <p className="mt-2 text-sm text-red-600">Error processing file. Please try again.</p>
        )}
      </div>

      <div className="flex justify-center gap-2 mt-6">
        <button
          onClick={loadExampleGeoJSON}
          className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 text-sm"
        >
          Show Me an Example
        </button>
      </div>
    </div>
  );
};

export default FlightPlanUploader;
