"use client";

import React, { useState } from "react";

const FlightLogUploader: React.FC<{
  onProcessComplete: (data: any) => void; // Pass entire response to parent
}> = ({ onProcessComplete }) => {
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "processed" | "error"
  >("idle");
  const [fileName, setFileName] = useState<string | null>(null);

  /**
   * Handle manual file upload (drag-and-drop or file dialog).
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    setFileName(file.name);
    setUploadState("uploading");

    // Option 1: Send to your backend for processing
    try {
      const backendURL =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${backendURL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process file");

      const data = await response.json();
      setUploadState("processed");
      onProcessComplete(data);
    } catch (error) {
      console.error("File processing failed", error);
      setUploadState("error");
    } finally {
      // Clear the input field so users can re-upload the same file if needed
      event.target.value = "";
    }

    // Option 2: Local client-side parsing (uncomment if you want to parse on the client)
    /*
    try {
      const parsedData = await processULGFile(file);
      setUploadState("processed");
      onProcessComplete(parsedData);
    } catch (err) {
      console.error("Error parsing ULG file on client:", err);
      setUploadState("error");
    }
    */
  };

  /**
   * Show an example by fetching a stored .ulg file in public folder.
   */
  const loadExampleLog = async () => {
    try {
      const response = await fetch("/example.ulg");
      if (!response.ok) throw new Error("Failed to fetch example flight log");

      // Read as array buffer because ULG files may be binary
      const fileBuffer = await response.arrayBuffer();
      const parsedData = parseULGFile(new Uint8Array(fileBuffer));

      setUploadState("processed");
      setFileName("example.ulg");
      onProcessComplete(parsedData);
    } catch (error) {
      console.error("Error loading example flight log:", error);
      setUploadState("error");
    }
  };

  /**
   * Read the file as an ArrayBuffer and parse it on the client (if desired).
   */
  async function processULGFile(file: File) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        try {
          // Convert the result to Uint8Array for binary-safe parsing
          const content = new Uint8Array(reader.result as ArrayBuffer);
          const parsedData = parseULGFile(content);
          resolve(parsedData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      // Use readAsArrayBuffer for binary files
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Mock parse function for .ulg content.
   * In reality, you'd decode binary data according to the .ulg spec.
   */
  function parseULGFile(content: Uint8Array) {
    // For demonstration: convert to string with TextDecoder (if it has text sections)
    const decoded = new TextDecoder().decode(content);

    // Check for a "magic" pattern or some known string in the text portion
    if (decoded.includes("expected_pattern_or_keyword")) {
      return { parsedKey: "parsedValue" }; // Example parse result
    } else {
      // If we don't see our pattern, we consider the file invalid
      throw new Error("Invalid .ulg file format");
    }
  }

  return (
    <div className="bg-gray-100 border rounded-lg p-4 mt-6">
      <h3 className="text-lg font-bold text-black">🔋 Enhance Your Flight Estimates</h3>
      <p className="text-sm text-gray-600">
        Upload a previous <strong>.ulg</strong> flight log from your drone to calculate a more accurate average
        battery draw rate and phase analysis.
      </p>
      <label htmlFor="file-upload" className="cursor-pointer">
        <input
          id="file-upload"
          type="file"
          accept=".ulg"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center">
          {uploadState === "idle" && (
            <>
              <p className="text-gray-500">Drag & Drop your .ulg file here</p>
              <p className="text-sm text-gray-400">or click to upload</p>
            </>
          )}
          {uploadState === "uploading" && (
            <p className="text-blue-600">Processing your file...</p>
          )}
          {uploadState === "processed" && (
            <p className="text-green-600">
              Upload complete! File: <strong>{fileName}</strong>
            </p>
          )}
          {uploadState === "error" && (
            <p className="text-red-600">Error processing file. Please try again.</p>
          )}
        </div>
      </label>
      <div className="flex justify-center mt-4">
        <button
          onClick={loadExampleLog}
          className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 text-sm"
        >
          Show Me an Example
        </button>
      </div>
    </div>
  );
};

export default FlightLogUploader;
