"use client";
import React, { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import * as turf from "@turf/turf";
import AOGenerator, { AOGeneratorRef } from "../AO/AOGenerator";

interface AreaOpsUploaderProps {
  mapRef: React.RefObject<any>;
  onClose?: () => void;
}

const AreaOpsUploader: React.FC<AreaOpsUploaderProps> = ({ mapRef, onClose }) => {
  const { setAoGeometry, setAoTerrainGrid } = useAreaOfOpsContext();
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "processed" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  // Create a ref for AOGenerator so we can trigger its analysis
  const aoGenRef = useRef<AOGeneratorRef>(null);

  // Generic function to process KML text.
  const processKMLText = (kmlText: string) => {
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlText, "text/xml");
    const coordsElement = kmlDom.querySelector("Polygon > outerBoundaryIs > LinearRing > coordinates");

    if (!coordsElement || !coordsElement.textContent) {
      setFileUploadStatus("error");
      throw new Error("No polygon coordinates found in KML");
    }
    
    const coordsText = coordsElement.textContent.trim();
    const coordinates = coordsText.split(/\s+/).map((pair) => {
      const [lon, lat] = pair.split(",").map(Number);
      return [lon, lat];
    });

    // Ensure the polygon is closed.
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push(first);
      }
    }
    const polygon = turf.polygon([coordinates]);

    // Update AO context.
    setAoGeometry(turf.featureCollection([polygon]));
    setAoTerrainGrid(null);
    setFileUploadStatus("processed");

    // Fly the map to the polygon bounds.
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      if (map) {
        const bbox = turf.bbox(polygon);
        map.fitBounds(bbox, { padding: 20 });
      }
    }

    // Trigger AO generation analysis.
    if (aoGenRef.current) {
      aoGenRef.current.generateAO();
    }

    // Close the uploader overlay.
    if (onClose) onClose();
  };

  // onDrop handler for drag & drop.
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setFileName(file.name);
    setFileUploadStatus("uploading");

    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const kmlText = reader.result as string;
          processKMLText(kmlText);
        } catch (err) {
          console.error("Error processing KML file:", err);
          setFileUploadStatus("error");
        }
      };
      reader.onerror = () => setFileUploadStatus("error");
      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setFileUploadStatus("error");
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "application/vnd.google-earth.kml+xml": [".kml"],
    },
    onDrop,
  });

  // Load example AO from the file located at /exampleAO.kml.
  const loadExampleAOFromFile = async () => {
    setFileUploadStatus("uploading");
    try {
      const response = await fetch("/exampleAO.kml");
      if (!response.ok) {
        throw new Error("Failed to fetch example AO KML file");
      }
      const kmlText = await response.text();
      setFileName("exampleAO.kml");
      processKMLText(kmlText);
    } catch (err) {
      console.error("Error fetching example AO:", err);
      setFileUploadStatus("error");
    }
  };

  return (
    <div className="flex-1 bg-white shadow-lg p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-bold">🗺️ Define Your Area of Ops</h3>
      <p className="text-sm text-gray-600">
        Upload a <strong>.kml</strong> file outlining your operational area, or use our example to see Sydney Harbour.
      </p>

      {/* Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dotted border-gray-400 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer bg-gray-50"
      >
        <input {...getInputProps()} />
        <p className="text-gray-600">Drag & Drop your KML file here, or click to select</p>
        {fileName && (
          <p className="mt-2 text-sm text-gray-700">Chosen file: {fileName}</p>
        )}
        {fileUploadStatus === "uploading" && (
          <p className="mt-2 text-sm text-blue-600">Uploading…</p>
        )}
        {fileUploadStatus === "processed" && (
          <p className="mt-2 text-sm text-green-600">File processed successfully!</p>
        )}
        {fileUploadStatus === "error" && (
          <p className="mt-2 text-sm text-red-600">There was a problem processing your file.</p>
        )}
      </div>

      {/* Example AO Button */}
      <div className="mt-4">
        <p className="text-sm text-gray-600 text-center">No file? Try our example area.</p>
        <div className="flex justify-center mt-2">
          <button
            onClick={loadExampleAOFromFile}
            className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700 text-sm"
          >
            Load Example Area
          </button>
        </div>
      </div>

      {/* Hidden AOGenerator – triggers further analysis */}
      <AOGenerator ref={aoGenRef} mapRef={mapRef} />
    </div>
  );
};

export default AreaOpsUploader;
