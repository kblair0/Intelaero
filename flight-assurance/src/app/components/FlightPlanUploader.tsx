"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";

// Parse QGC files for waypoints
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
  onPlanUploaded: (geojson: GeoJSON.FeatureCollection) => void;
  onObstacleAssessment: (geojson: GeoJSON.FeatureCollection) => void;
}

interface FlightPlanUploaderProps {
    onPlanUploaded: (geojson: GeoJSON.FeatureCollection) => void;
    onObstacleAssessment: (geojson: GeoJSON.FeatureCollection) => void;
  }
  
  const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({ onPlanUploaded, onObstacleAssessment }) => {
    const [uploadState, setUploadState] = useState<
      "idle" | "uploading" | "processed" | "error"
    >("idle");
    const [fileName, setFileName] = useState<string | null>(null);
    const [uploadedPlan, setUploadedPlan] = useState<GeoJSON.FeatureCollection | null>(null); // Store uploaded plan
  
    const onDrop = (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
  
      setFileName(file.name);
      setUploadState("uploading");
  
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
            onPlanUploaded(geojson); // Notify parent about uploaded plan
            setUploadedPlan(geojson); // Store locally for obstacle assessment
            setUploadState("processed");
          }
        } catch (error) {
          console.error("Error processing file:", error);
          setUploadState("error");
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
        onPlanUploaded(data);
        setUploadedPlan(data); // Store example plan for assessment
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
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={loadExampleGeoJSON}
            className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 text-sm"
          >
            Show Me an Example
          </button>
          {uploadState === "processed" && (
            <button
              className="bg-yellow-500 text-black px-4 py-2 rounded shadow hover:bg-yellow-600 text-sm"
              onClick={() => {
                if (uploadedPlan) {
                  onObstacleAssessment(uploadedPlan);
                } else {
                  console.warn("No flight plan uploaded yet!");
                }
              }}
            >
              🚨 Obstacle Assessment
            </button>
          )}
        </div>
      </div>
    );
  };
  
  export default FlightPlanUploader;
  