"use client";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAreaOpsProcessor } from "../AO/Hooks/useAreaOpsProcessor";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";
import { 
  RotateCw, 
  CheckCircle, 
  XCircle, 
  FileUp,
  Info,
  Map
} from "lucide-react";

/**
 * AreaOpsUploader Component
 * 
 * Enables users to upload KML files to define Areas of Operation.
 * The map selection and location search functionality has been moved
 * to the standalone MapSelectionPanel component.
 * 
 * Features:
 * - KML file upload with drag-and-drop support
 * - Example area loading
 * - Status feedback during processing
 * - Error handling
 */
interface AreaOpsUploaderProps {
  onClose?: () => void;
  onAOUploaded?: (aoData: GeoJSON.FeatureCollection) => void;
  compact?: boolean;
}

/**
 * Component to display file format badge
 */
const FileBadge = ({ type }: { type: string }) => (
  <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
    {type}
  </span>
);

const AreaOpsUploader: React.FC<AreaOpsUploaderProps> = ({ 
  onClose, 
  onAOUploaded,
  compact = false
}) => {
  // Get KML processor from hook
  const { processKML } = useAreaOpsProcessor();
  
  // File upload state
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "processed" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  /**
   * Handles file drop for KML upload
   */
  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    setFileName(file.name);
    setFileUploadStatus("uploading");
    setErrorMessage(null);
    
    try {
      trackEvent("ao_upload_started", { fileName: file.name });
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const kmlText = reader.result as string;
          const aoData = await processKML(kmlText);
          
          setFileUploadStatus("processed");
          trackEvent("ao_upload_completed", { fileName: file.name });
          
          onAOUploaded?.(aoData);
          
          setTimeout(() => {
            if (onClose) onClose();
          }, 1500);
        } catch (err) {
          console.error("Error processing KML:", err);
          setFileUploadStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Failed to process KML file");
          trackEvent("ao_upload_error", { error: String(err) });
        }
      };
      
      reader.onerror = () => {
        setFileUploadStatus("error");
        setErrorMessage("Failed to read file");
        trackEvent("ao_upload_read_error", {});
      };
      
      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      setFileUploadStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      trackEvent("ao_upload_error", { error: String(err) });
    }
  };

  /**
   * Setup dropzone for file uploads
   */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.google-earth.kml+xml": [".kml"],
    },
    onDrop,
  });

  /**
   * Handle loading an example AO from file
   */
  const loadExampleAOFromFile = async () => {
    setFileUploadStatus("uploading");
    setErrorMessage(null);
    
    try {
      trackEvent("ao_example_load_started", {});
      
      const response = await fetch("/exampleAO.kml");
      if (!response.ok) {
        throw new Error("Failed to fetch example AO KML file");
      }
      
      const kmlText = await response.text();
      setFileName("exampleAO.kml");
      
      const aoData = await processKML(kmlText);
      
      setFileUploadStatus("processed");
      trackEvent("ao_example_load_completed", {});
      
      onAOUploaded?.(aoData);
      
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error("Error fetching example AO:", err);
      setFileUploadStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to load example area");
      trackEvent("ao_example_load_error", { error: String(err) });
    }
  };

  /**
   * Renders file upload content
   */
  const renderFileUploadContent = () => (
    <>
      <div
        {...getRootProps()}
        className={`
          p-5 rounded-lg border-2 border-dashed transition-all duration-200
          flex flex-col items-center justify-center
          ${isDragActive ? "border-blue-400 bg-blue-50 scale-[1.02] shadow-md" : ""}
          ${fileUploadStatus === "error" ? "border-red-300 bg-red-50" : 
            fileUploadStatus === "processed" ? "border-green-300 bg-green-50" : 
            "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50"}
        `}
        style={{ minHeight: compact ? "120px" : "180px" }}
      >
        <input {...getInputProps()} />
        
        {/* Conditional icon based on status */}
        <div className="mb-3">
          {fileUploadStatus === "idle" && (
            <FileUp className={`w-12 h-12 ${isDragActive ? "text-blue-500" : "text-gray-400"} transition-colors`} />
          )}
          {fileUploadStatus === "uploading" && (
            <RotateCw className="w-12 h-12 text-blue-500 animate-spin" />
          )}
          {fileUploadStatus === "processed" && (
            <CheckCircle className="w-12 h-12 text-green-500" />
          )}
          {fileUploadStatus === "error" && (
            <XCircle className="w-12 h-12 text-red-500" />
          )}
        </div>
        
        {/* Status-based content */}
        {fileUploadStatus === "idle" && (
          <>
            <p className={`text-sm font-medium ${isDragActive ? "text-blue-700" : "text-gray-700"} transition-colors`}>
              {isDragActive ? "Drop your KML file here" : "Drag and drop your KML file here"}
            </p>
            <p className="text-xs text-gray-500 mt-1">or click to browse files</p>
          </>
        )}
        
        {fileUploadStatus === "uploading" && (
          <>
            <p className="text-sm font-medium text-blue-700">
              {fileName ? `Processing ${fileName}` : "Processing file..."}
            </p>
            <div className="mt-3 h-1 w-32 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </>
        )}
        
        {fileUploadStatus === "processed" && (
          <>
            <p className="text-sm font-medium text-green-700">Area defined successfully!</p>
            <p className="text-xs text-green-600 mt-1">Your operational area has been loaded</p>
          </>
        )}
        
        {fileUploadStatus === "error" && (
          <>
            <p className="text-sm font-medium text-red-700">Error processing file</p>
            <p className="text-xs text-red-600 mt-1 max-w-md text-center">
              {errorMessage || "Please check your file format and try again"}
            </p>
            <button 
              className="mt-3 px-3 py-1 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setFileUploadStatus("idle");
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>

      {/* Action button for loading example */}
      <div className={`${compact ? 'mt-3' : 'mt-5'} flex justify-center`}>
        <button
          onClick={loadExampleAOFromFile}
          className={`flex items-center justify-center gap-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition-all hover:shadow-md active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2'
          }`}
          disabled={fileUploadStatus === "uploading"}
        >
          <Map className={compact ? "w-4 h-4" : "w-5 h-5"} />
          <span>{compact ? "Try Example" : "Load Example Area"}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={`w-full bg-white ${compact ? 'py-1' : 'py-2'}`}>
    {/* Header section */}
    {!compact ? (
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Upload Area of Operations</h3>
          <p className="text-sm text-gray-600">Upload a KML file to define your operational area</p>
        </div>
        <div className="flex items-center space-x-1">
          <FileBadge type=".kml" />
          <button 
            className="ml-2 text-blue-600 hover:text-blue-800" 
            aria-label="File format information"
          >
            <Info className="h-5 w-5" />
          </button>
        </div>
      </div>
    ) : (
      <div className="mb-2">
        <p className="text-xs text-gray-600">Drag & drop or click to upload KML file</p>
      </div>
    )}

      {/* File upload content */}
      {renderFileUploadContent()}
    </div>
  );
};

export default AreaOpsUploader;