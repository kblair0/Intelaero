"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAreaOpsProcessor } from "../../hooks/useAreaOpsProcessor";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";

interface AreaOpsUploaderProps {
  onClose?: () => void;
}

const AreaOpsUploader: React.FC<AreaOpsUploaderProps> = ({ onClose }) => {
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "processed" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const { processKML } = useAreaOpsProcessor();

  // onDrop handler for drag & drop.
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setFileName(file.name);
    setFileUploadStatus("uploading");

    try {
      trackEvent("ao_upload_started", { fileName: file.name });
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const kmlText = reader.result as string;
          await processKML(kmlText);
          
          setFileUploadStatus("processed");
          trackEvent("ao_upload_completed", { fileName: file.name });
          
          // Close the uploader after a delay
          setTimeout(() => {
            if (onClose) onClose();
          }, 1500);
        } catch (err) {
          console.error("Error processing KML:", err);
          setFileUploadStatus("error");
          trackEvent("ao_upload_error", { error: String(err) });
        }
      };
      
      reader.onerror = () => {
        setFileUploadStatus("error");
        trackEvent("ao_upload_read_error", {});
      };
      
      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setFileUploadStatus("error");
      trackEvent("ao_upload_error", { error: String(err) });
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
      trackEvent("ao_example_load_started", {});
      
      const response = await fetch("/exampleAO.kml");
      if (!response.ok) {
        throw new Error("Failed to fetch example AO KML file");
      }
      
      const kmlText = await response.text();
      setFileName("exampleAO.kml");
      
      await processKML(kmlText);
      
      setFileUploadStatus("processed");
      trackEvent("ao_example_load_completed", {});
      
      // Close the uploader after a delay
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error("Error fetching example AO:", err);
      setFileUploadStatus("error");
      trackEvent("ao_example_load_error", { error: String(err) });
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
    </div>
  );
};

export default AreaOpsUploader;