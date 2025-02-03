"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useFlightPlanContext } from "../context/FlightPlanContext";

// For converting KML → GeoJSON
import toGeoJSON from "@mapbox/togeojson";

// DOMParser is used to parse the KML text into an XML DOM.
const parser = new DOMParser();

/**
 * Convert the QGC `frame` integer into a string altitude mode.
 * Adjust these mappings if your QGC uses different frames:
 *   0  -> "absolute"
 *   3  -> "relative"
 *   10 -> "terrain"
 */
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

/**
 * Parse QGC WPL 110 format:
 *   index, current, frame, command, param1, param2, param3, param4, lat, lon, alt, autocontinue
 */
function parseQGCFile(
  content: string
): import("../context/FlightPlanContext").FlightPlanData {
  const lines = content.trim().split("\n");

  // Basic validation
  if (!lines[0].includes("QGC WPL 110")) {
    throw new Error("Invalid .waypoints file. Missing QGC WPL 110 header.");
  }

  let homePosition = {
    latitude: 0,
    longitude: 0,
    altitude: 0,
  };

  const waypoints: {
    index: number;
    altitudeMode: "relative" | "terrain" | "absolute";
    originalAltitude: number;
    commandType: number;
    frame: number;
    params: number[];
  }[] = [];

  const coordinates: [number, number, number][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) {
      continue; // skip incomplete lines
    }

    const index = parseInt(parts[0], 10);
    const current = parseInt(parts[1], 10);
    const frame = parseInt(parts[2], 10);
    const command = parseInt(parts[3], 10);
    const param1 = parseFloat(parts[4]);
    const param2 = parseFloat(parts[5]);
    const param3 = parseFloat(parts[6]);
    const param4 = parseFloat(parts[7]);
    const lat = parseFloat(parts[8]);
    const lon = parseFloat(parts[9]);
    const alt = parseFloat(parts[10]);

    const altitudeMode = frameToAltitudeMode(frame);

    // If this is the "home" line
    if (index === 0 && current === 1) {
      homePosition = {
        latitude: lat,
        longitude: lon,
        altitude: alt,
      };
    }

    waypoints.push({
      index,
      altitudeMode,
      originalAltitude: alt,
      commandType: command,
      frame,
      params: [param1, param2, param3, param4],
    });

    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      coordinates.push([lon, lat, alt]);
    }
  }

  if (coordinates.length === 0) {
    throw new Error("No valid waypoints with lat/lon found in the .waypoints file.");
  }

console.log('Flight Plan Parse Details:', {
  waypoints: waypoints.map((wp, idx) => ({
    waypointNumber: idx,
    rawAltitude: wp.originalAltitude,
    altitudeMode: wp.altitudeMode,
    frame: wp.frame
  })),
  homeAltitude: homePosition.altitude
});

  return {
    type: "FeatureCollection",
    properties: {
      homePosition,
    },
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
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

/**
 * Parse a KML file using @mapbox/togeojson, then produce a minimal FlightPlanData.
 * This example simply extracts the **first** LineString in the KML.
 */
function parseKMLFile(
  kmlText: string
): import("../context/FlightPlanContext").FlightPlanData {
  // Convert text → XML DOM
  const kmlDom = parser.parseFromString(kmlText, "application/xml");
  // Convert KML DOM → GeoJSON
  const geojsonResult = toGeoJSON.kml(kmlDom) as GeoJSON.FeatureCollection;

  // For a minimal approach, let's find the first LineString
  let lineStringCoords: [number, number, number][] = [];
  let name = "KML Flight Path";

  // Use a default home for KML in case we don't have one
  const homePosition = {
    latitude: 0,
    longitude: 0,
    altitude: 0,
  };

  for (const feature of geojsonResult.features) {
    if (feature.geometry?.type === "LineString") {
      const coords3D = feature.geometry.coordinates as [number, number, number][];
      lineStringCoords = coords3D.map(([lon, lat, alt]) => [lon, lat, alt ?? 0]);

      if (feature.properties?.name) {
        name = feature.properties.name;
      }
      break; // just the first LineString
    }
  }

  if (!lineStringCoords.length) {
    throw new Error("No LineString geometry found in KML");
  }

  // Build waypoints array
  const waypoints = lineStringCoords.map((coord, i) => {
    return {
      index: i,
      altitudeMode: "absolute" as const,
      originalAltitude: coord[2], // 0
      commandType: 16, // e.g. MAV_CMD_NAV_WAYPOINT
      frame: 0,
      params: [0, 0, 0, 0], // placeholders
    };
  });

  return {
    type: "FeatureCollection",
    properties: {
      homePosition,
    },
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: lineStringCoords,
        },
        properties: {
          name,
          originalAltitudes: lineStringCoords.map((c) => c[2]),
          altitudeModes: waypoints.map((w) => w.altitudeMode),
          rawCommands: waypoints.map((w) => w.commandType),
          waypoints,
        },
      },
    ],
  };
}

interface FlightPlanUploaderProps {
  onPlanUploaded?: (
    flightData: import("../context/FlightPlanContext").FlightPlanData
  ) => void;
}

const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({ onPlanUploaded }) => {
  const [fileUploadStatus, setFileUploadStatus] = useState<
    "idle" | "uploading" | "processed" | "error"
  >("idle");
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
            flightData = JSON.parse(reader.result as string);
          } else if (fileExtension === "kml") {
            flightData = parseKMLFile(reader.result as string);
          } else {
            throw new Error("Unsupported file format");
          }

          // Update context
          setFlightPlan(flightData);

          // Notify parent if provided
          if (onPlanUploaded) {
            onPlanUploaded(flightData);
          }

          setFileUploadStatus("processed");
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

  // Example button for loading a sample .geojson from the public folder
  const loadExampleGeoJSON = async () => {
    try {
      const response = await fetch("/example.geojson");
      const data = await response.json();

      setFlightPlan(data);

      if (onPlanUploaded) {
        onPlanUploaded(data);
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
        Upload a <strong>.waypoints</strong>, <strong>.geojson</strong>, or{" "}
        <strong>.kml</strong> file to analyze your drone&apos;s flight path.
      </p>

      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        {fileUploadStatus === "idle" && (
          <>
            <p className="text-gray-500">Drag &amp; Drop your file here</p>
            <p className="text-sm text-gray-400">or click to upload</p>
          </>
        )}
        {fileUploadStatus === "uploading" && (
          <p className="text-blue-600">Processing your file...</p>
        )}
        {fileUploadStatus === "processed" && (
          <p className="text-green-600">
            Upload complete! File: <strong>{fileName}</strong>
          </p>
        )}
        {fileUploadStatus === "error" && (
          <p className="text-red-600">
            Error processing file. Please try again.
          </p>
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
