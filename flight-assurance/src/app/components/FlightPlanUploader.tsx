"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";

// Parse QGC files for waypoints
function parseQGCFile(content: string): GeoJSON.FeatureCollection {
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
      coordinates.push([longitude, latitude, elevation]); // [lon, lat, alt]
    }
  }

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
}

interface FlightPlanUploaderProps {
  onPlanUploaded: (geojson: GeoJSON.FeatureCollection) => void;
}

const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({ onPlanUploaded }) => {
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "processed" | "error"
  >("idle");
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";

    setFileName(file.name);
    setUploadState("uploading");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (reader.result) {
          if (fileExtension === "waypoints") {
            const qgcToGeojson = parseQGCFile(reader.result as string);
            onPlanUploaded(qgcToGeojson);
          } else if (fileExtension === "geojson") {
            const geojson = JSON.parse(reader.result as string);
            onPlanUploaded(geojson);
          }
          setUploadState("processed");
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setUploadState("error");
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

  const loadExampleGeoJSON = async () => {
    try {
      const response = await fetch("/example.geojson");
      const data = await response.json();
      onPlanUploaded(data);
      setUploadState("processed");
    } catch (error) {
      console.log("Error loading example GeoJSON:", error);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 mt-6">
      <h3 className="text-lg font-bold text-black">📁 Upload Your Flight Plan</h3>
      <p className="text-sm text-gray-600">
        Upload a <strong>.waypoints</strong> or <strong>.geojson</strong> file to analyze your drone's flight path.
      </p>
      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        {uploadState === "idle" && (
          <>
            <p className="text-gray-500">Drag & Drop your file here</p>
            <p className="text-sm text-gray-400">or click to upload</p>
          </>
        )}
        {uploadState === "uploading" && <p className="text-blue-600">Processing your file...</p>}
        {uploadState === "processed" && (
          <p className="text-green-600">
            Upload complete! File: <strong>{fileName}</strong>
          </p>
        )}
        {uploadState === "error" && (
          <p className="text-red-600">Error processing file. Please try again.</p>
        )}
      </div>
      {/* Always Show 'Show Me an Example' Button */}
      <div className="flex justify-center gap-2 mt-6">
        <button
          onClick={loadExampleGeoJSON}
          className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 text-sm"
        >
          Show Me an Example
        </button>
        {/* Conditionally Show 'Obstacle Clearance Assessment' Button */}
        {uploadState === "processed" && (
          <button
            className="bg-yellow-500 text-black px-4 py-2 rounded shadow hover:bg-yellow-600 text-sm"
            onClick={() => console.log("Obstacle Clearance Assessment triggered!")}
          >
            🚨 Obstacle Assessment
          </button>
        )}
      </div>
    </div>
  );  
};

export default FlightPlanUploader;
