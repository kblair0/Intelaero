"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useFlightPlanContext } from "../context/FlightPlanContext";

{
  /*Parse QGC files for waypoints*/
}
function parseQGCFile(content: string): GeoJSON.FeatureCollection {
  const lines = content.trim().split("\n");
  const coordinates = [];

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
      longitude !== 0 &&
      elevation >= 0
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
  onPlanUploaded?: (geojson: GeoJSON.FeatureCollection) => void;
}

const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({
  onPlanUploaded,
}) => {
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
          let geojson: GeoJSON.FeatureCollection;
          if (fileExtension === "waypoints") {
            geojson = parseQGCFile(reader.result as string);
          } else if (fileExtension === "geojson") {
            geojson = JSON.parse(reader.result as string);
          } else {
            throw new Error("Unsupported file format");
          }
          setFlightPlan(geojson); // Set flight plan in context
          if (onPlanUploaded) {
            onPlanUploaded(geojson); // Notify parent about uploaded plan
          }
          console.log("Setting file upload status to 'processed'");
          setFileUploadStatus("processed");
          console.log("Current file upload status:", fileUploadStatus);
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
      "application/geo+json": [".geojson"],
      "application/waypoints": [".waypoints"],
    },
    onDrop,
  });

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
      console.log("Error loading example GeoJSON:", error);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <h3 className="text-lg font-bold text-black">
        📁 Upload Your Flight Plan
      </h3>
      <p className="text-sm text-gray-600">
        Upload a <strong>.waypoints</strong> or <strong>.geojson</strong> file
        to analyze your drone&apos;s flight path.
      </p>
      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        {fileUploadStatus === "idle" && (
          <>
            <p className="text-gray-500">Drag & Drop your file here</p>
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
