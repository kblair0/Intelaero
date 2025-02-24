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

class HomePositionHandler {
  private homePosition: { latitude: number; longitude: number; altitude: number };
  private takeoffAltitude: number | null = null;

  constructor() {
    this.homePosition = { latitude: 0, longitude: 0, altitude: 0 };
  }

  processWaypoint(index: number, command: number, alt: number, lat: number, lon: number) {
    if (index === 0) {
      this.homePosition = { latitude: lat, longitude: lon, altitude: alt };
    }
    if (command === 22) { // MAV_CMD_NAV_TAKEOFF
      this.takeoffAltitude = alt;
    }
  }

  getHomePosition(): { latitude: number; longitude: number; altitude: number } {
    if (this.takeoffAltitude !== null) {
      return {
        ...this.homePosition,
        altitude: this.takeoffAltitude
      };
    }
    return this.homePosition;
  }
}

function parseQGCFile(content: string): import("../context/FlightPlanContext").FlightPlanData {
  const lines = content.trim().split("\n");

  if (!lines[0].includes("QGC WPL 110")) {
    throw new Error("Invalid .waypoints file. Missing QGC WPL 110 header.");
  }

  const homeHandler = new HomePositionHandler();
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

    homeHandler.processWaypoint(index, command, alt, lat, lon);

    // Include all waypoints for debugging, not just current === 1
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
    } else {
      console.log(`Skipping invalid coordinate at index ${index}: lat=${lat}, lon=${lon}`);
    }
  }

  const homePosition = homeHandler.getHomePosition();
  console.log("Parsed Coordinates:", coordinates);

  if (coordinates.length < 2) {
    throw new Error("Flight plan must contain at least 2 valid coordinates.");
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

  let lineStringCoords: [number, number, number][] = [];
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
          // Create a default waypoint for each coordinate
          waypoints: lineStringCoords.map((coord, index) => ({
            index,
            altitudeMode: "absolute",
            originalAltitude: coord[2],
            commandType: 16,
            frame: 0,
            params: [],
          })),
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

  // Ensure coordinates are treated as [number, number, number][]
  const coordinates = flightFeature.geometry.coordinates as [number, number, number][];

  // Augment flightFeature properties with default arrays and a waypoints array.
  flightFeature.properties = {
    ...flightFeature.properties,
    originalAltitudes: coordinates.map((c) => c[2]),
    altitudeModes: Array(coordinates.length).fill("absolute"),
    rawCommands: Array(coordinates.length).fill(16),
    waypoints: coordinates.map((coord, index) => ({
      index,
      altitudeMode: "absolute",
      originalAltitude: coord[2],
      commandType: 16,
      frame: 0,
      params: [],
    })),
  };

  return {
    type: "FeatureCollection",
    properties: { homePosition: inferHomePosition(coordinates) },
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

          const newFlightPlan = { ...flightData, processed: false };
          setFlightPlan(newFlightPlan);
          setFileUploadStatus("processed");

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
        Upload a <strong>.waypoints</strong>, <strong>.geojson</strong>, or <strong>.kml</strong> file to analyze your drone's flight path.
      </p>

      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <p className="text-gray-500">Drag & Drop your file here or click to upload</p>
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