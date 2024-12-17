"use client";

import React, { useState } from "react";

const FlightLogUploader: React.FC<{
  onProcessComplete: (data: any) => void; // Pass entire response to parent
}> = ({ onProcessComplete }) => {
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "processed" | "error"
  >("idle");
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    setFileName(file.name);
    setUploadState("uploading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Send file to Flask backend
      const response = await fetch("http://127.0.0.1:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process file");

      const data = await response.json();
      setUploadState("processed");

      // Pass response data (phases) to parent component
      onProcessComplete(data);
    } catch (error) {
      console.error("File processing failed", error);
      setUploadState("error");
    }
  };

  return (
    <div className="bg-gray-100 border rounded-lg p-4 mt-6">
      <h3 className="text-lg font-bold text-black">🔋 Enhance Your Flight Estimates</h3>
      <p className="text-sm text-gray-600">
        Upload a previous <strong>.ulg</strong> flight log from your drone to calculate a more accurate average
        battery draw rate and phase analysis.
      </p>
      <div className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer">
        {uploadState === "idle" && (
          <>
            <p className="text-gray-500">Drag & Drop your .ulg file here</p>
            <p className="text-sm text-gray-400">or click to upload</p>
            <input
              type="file"
              accept=".ulg"
              onChange={handleFileUpload}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer"
            />
          </>
        )}
        {uploadState === "uploading" && <p className="text-blue-600">Processing your file...</p>}
        {uploadState === "processed" && (
          <p className="text-green-600">
            Upload complete! File: <strong>{fileName}</strong>
          </p>
        )}
        {uploadState === "error" && <p className="text-red-600">Error processing file. Please try again.</p>}
      </div>
    </div>
  );
};

export default FlightLogUploader;
