"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAreaOpsProcessor } from "../AO/Hooks/useAreaOpsProcessor";
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
  <div className="w-full max-w-2xl bg-white p-4 rounded-lg shadow-lg border border-gray-300">
    <h3 className="text-md font-semibold text-gray-800 mb-4">Define Area of Operations</h3>
    <p className="text-xs text-gray-600 mb-4">
      Upload a <strong>.kml</strong> file to outline your operational area or try our example.
    </p>

    <div
      {...getRootProps()}
      className="p-6 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer flex flex-col items-center justify-center"
    >
      <input {...getInputProps()} />
      <p className="text-xs text-gray-600">Drop your KML file here or click to select</p>
      {fileName && (
        <p className="mt-2 text-xs text-gray-700">Selected file: {fileName}</p>
      )}
      {fileUploadStatus === "uploading" && (
        <p className="mt-2 text-xs text-blue-600">Uploading...</p>
      )}
      {fileUploadStatus === "processed" && (
        <p className="mt-2 text-xs text-green-500">File processed successfully!</p>
      )}
      {fileUploadStatus === "error" && (
        <p className="mt-2 text-xs text-red-500">Error processing file.</p>
      )}
    </div>

    <div className="mt-4 flex justify-center">
      <button
        onClick={loadExampleAOFromFile}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors text-sm"
      >
        Load Example Area
      </button>
    </div>
  </div>
);
};

export default AreaOpsUploader;