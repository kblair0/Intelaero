/**
 * FlightPlanUploader.tsx
 * 
 * Purpose:
 * This component provides a user interface for uploading flight plan files (.waypoints, .geojson, .kml, .kmz) or loading an example flight plan.
 * It handles parsing various flight plan formats, processes them using `useFlightPlanProcessor` to resolve altitudes and calculate distances,
 * and stores the processed flight plan in `FlightPlanContext` for application-wide access. Additionally, it tracks uploaded flight plans in production
 * for analytics purposes.
 *
 * Responsibilities:
 * - Parse flight plan files into a standardized GeoJSON-based `FlightPlanData` format.
 * - Process flight plans using `useFlightPlanProcessor` to handle terrain elevation queries, altitude resolution, and distance calculations.
 * - Update `FlightPlanContext` with the processed flight plan.
 * - Provide user feedback on the upload and processing status (e.g., uploading, processing, success, error).
 * - Allow loading of an example flight plan for demo purposes.
 * - Track flight plan uploads in production using a Google Form submission.
 *
 * Related Files and Dependencies:
 * - **Contexts**:
 *   - `FlightPlanContext.tsx`: Stores the processed flight plan data and provides a `setFlightPlan` method to update it.
 *   - `MapContext.tsx`: Provides the Mapbox GL map instance required for terrain elevation queries.
 * - **Hooks**:
 *   - `useFlightPlanProcessor.ts`: Processes the flight plan by resolving altitudes based on terrain data and calculating distances.
 * - **Libraries**:
 *   - `react-dropzone`: Handles file drag-and-drop functionality for uploads.
 *   - `@mapbox/togeojson`: Converts KML files to GeoJSON format.
 *   - `jszip`: Extracts and processes KMZ files (zipped KML).
 * - **Components**:
 *   - Used in `page.tsx`: The main page component renders `FlightPlanUploader` to allow users to upload flight plans.
 * - **Services**:
 *   - `tracking/tracking.ts`: Tracks user actions (e.g., uploading a file or loading an example) via Google Forms.
 *
 * Likely Relationships:
 * - **FlightPathDisplay.tsx**: After uploading, the processed flight plan may be visualized on the map using this component.
 * - **LOSModal.tsx**: The flight plan may trigger line-of-sight analysis, prompting the user via this modal.
 * - **AnalysisStatus.tsx**: Displays the status of flight plan processing or related analyses.
 * - **useLayers.ts**: Adds the flight plan as a layer on the map after processing.
 *
 * Notes:
 * - This component assumes the map is initialized (via `MapContext`) before processing, as terrain queries require a Mapbox GL instance.
 * - Error handling is implemented to provide user feedback, but could be enhanced with toast notifications for a better UX.
 * - The tracking functionality submits data to a Google Form in production, which may need to be updated based on analytics requirements.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useMapContext } from "../context/MapContext";
import { useFlightPlanProcessor } from "../hooks/useFlightPlanProcessor";
import toGeoJSON from "@mapbox/togeojson";
import JSZip from "jszip";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

// Initialize DOMParser for parsing XML-based files (e.g., KML, KMZ), but only in browser environments
const parser = typeof window !== "undefined" ? new DOMParser() : null;

/**
 * Converts a MAVLink frame number to an altitude mode for flight plan waypoints.
 * @param frame - The MAVLink frame number (e.g., 3 for relative, 10 for terrain).
 * @returns The corresponding altitude mode ("absolute", "relative", or "terrain").
 */
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

/**
 * Parses a QGroundControl .waypoints file into a `FlightPlanData` structure.
 * @param content - The raw content of the .waypoints file.
 * @returns A `FlightPlanData` object representing the flight plan.
 * @throws Error if the file format is invalid.
 */
function parseQGCFile(content: string): import("../context/FlightPlanContext").FlightPlanData {
  const lines = content.trim().split("\n");
  if (!lines[0].includes("QGC WPL 110")) {
    throw new Error("Invalid .waypoints file. Missing QGC WPL 110 header.");
  }

  let homePosition = { latitude: 0, longitude: 0, altitude: 0 };
  const waypoints: import("../context/FlightPlanContext").WaypointData[] = [];
  const coordinates: [number, number, number][] = [];
  let takeoffAltitude: number | null = null;
  let isTerrainMission = false;
  let isRelativeMission = false;

  // Process each line of the file to extract waypoints and home position
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) continue;

    const index = parseInt(parts[0], 10);
    const frame = parseInt(parts[2], 10);
    const command = parseInt(parts[3], 10);
    const lat = parseFloat(parts[8]);
    const lon = parseFloat(parts[9]);
    const alt = parseFloat(parts[10]);

    // Set the home position from the first waypoint
    if (i === 1) homePosition = { latitude: lat, longitude: lon, altitude: alt };

    const altitudeMode = frameToAltitudeMode(frame);
    // Handle takeoff command (command 22) to determine mission type and altitude
    if (command === 22) {
      takeoffAltitude = alt;
      if (frame === 10) isTerrainMission = true;
      if (frame === 3) isRelativeMission = true;
    }

    waypoints.push({
      index,
      altitudeMode,
      originalAltitude: alt,
      commandType: command,
      frame,
    });

    // Add valid coordinates to the flight path
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      coordinates.push([lon, lat, alt]);
    }
  }

  // Adjust home position and first waypoint based on mission type
  if (takeoffAltitude !== null) {
    if (isTerrainMission) {
      homePosition.altitude = takeoffAltitude;
      waypoints[0].altitudeMode = "terrain";
      waypoints[0].originalAltitude = takeoffAltitude;
      coordinates[0][2] = takeoffAltitude;
    } else if (isRelativeMission) {
      homePosition.altitude = takeoffAltitude;
      waypoints[0].altitudeMode = "relative";
      waypoints[0].originalAltitude = takeoffAltitude;
      coordinates[0][2] = takeoffAltitude;
    }
  }

  return {
    type: "FeatureCollection",
    properties: {
      homePosition,
      config: {},
      metadata: {
        processed: false,
        source: "waypoints",
        metadata: {
          file: { version: "QGC WPL 110" },
          segments: waypoints.map((wp) => ({
            index: wp.index,
            command: wp.commandType,
            frame: wp.frame,
          })),
        },
      },
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { waypoints },
    }],
  };
}

/**
 * Parses a KML file into a `FlightPlanData` structure, extracting flight path coordinates and metadata.
 * @param kmlText - The raw KML file content as a string.
 * @param file - The File object (optional) for metadata like last modified date.
 * @returns A `FlightPlanData` object representing the flight plan.
 * @throws Error if the KML file lacks a valid LineString geometry.
 */
function parseKMLFile(kmlText: string, file?: File): import("../context/FlightPlanContext").FlightPlanData {
  if (!parser) {
    throw new Error("DOMParser is not available in this environment.");
  }

  const kmlDom = parser.parseFromString(kmlText, "application/xml");
  const geojsonResult = toGeoJSON.kml(kmlDom) as GeoJSON.FeatureCollection;

  const lineStringFeatures = geojsonResult.features.filter(
    (feature): feature is GeoJSON.Feature<GeoJSON.LineString> => feature.geometry?.type === "LineString"
  );

  if (lineStringFeatures.length === 0) {
    throw new Error("No valid LineString geometry found in KML file.");
  }

  // Extract coordinates from LineString features
  const coordinates: [number, number, number][] = lineStringFeatures.flatMap((feature) =>
    (feature.geometry as GeoJSON.LineString).coordinates.map(([lon, lat, alt]) => [
      lon,
      lat,
      alt ?? 0,
    ] as [number, number, number])
  );

  // Create waypoints from coordinates, assuming absolute altitude mode
  const waypoints: import("../context/FlightPlanContext").WaypointData[] = coordinates.map((coord, index) => ({
    index,
    altitudeMode: "absolute" as const,
    originalAltitude: coord[2],
    commandType: 16,
    frame: 0,
  }));

  const fileName = kmlDom.querySelector("name")?.textContent;
  const metadata: import("../context/FlightPlanContext").FlightPlanMetadata = {
    processed: false,
    source: "kml",
    distance: lineStringFeatures.reduce((sum, f) => sum + (Number(f.properties?.Shape__Length) || 0), 0),
    ...(file?.lastModified && { updated: Math.floor(file.lastModified / 1000) }),
    metadata: {
      file: { name: fileName ?? "KML Flight Path" },
      segments: lineStringFeatures.map((f) => ({
        ...f.properties,
        coordinateCount: (f.geometry as GeoJSON.LineString).coordinates.length,
      })),
    },
  };

  return {
    type: "FeatureCollection",
    properties: {
      homePosition: inferHomePosition(coordinates),
      config: {},
      metadata,
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { waypoints },
    }],
  };
}

/**
 * Parses a GeoJSON file into a `FlightPlanData` structure.
 * @param geojsonText - The raw GeoJSON file content as a string.
 * @returns A `FlightPlanData` object representing the flight plan.
 * @throws Error if the GeoJSON file lacks features or a valid LineString.
 */
function parseGeoJSONFile(geojsonText: string): import("../context/FlightPlanContext").FlightPlanData {
  const geojsonResult = JSON.parse(geojsonText) as GeoJSON.FeatureCollection;
  if (!geojsonResult.features || geojsonResult.features.length === 0) {
    throw new Error("Invalid GeoJSON: No features found.");
  }

  const flightFeature = geojsonResult.features.find((f) => f.geometry?.type === "LineString");
  if (!flightFeature) throw new Error("No valid flight path found in GeoJSON.");

  const coordinates = flightFeature.geometry.coordinates as [number, number, number][];
  const waypoints = coordinates.map((coord, index) => ({
    index,
    altitudeMode: "absolute",
    originalAltitude: coord[2],
  }));

  return {
    type: "FeatureCollection",
    properties: {
      homePosition: inferHomePosition(coordinates),
      config: {},
      metadata: {
        processed: false,
        source: "geojson",
        metadata: {
          file: { featureCount: geojsonResult.features.length },
          segments: geojsonResult.features.map((f) => f.properties || {}),
        },
      },
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { waypoints },
    }],
  };
}

/**
 * Parses a KMZ file (DJI format) into a `FlightPlanData` structure by extracting KML and WPML files.
 * @param file - The KMZ file to parse.
 * @returns A `FlightPlanData` object representing the flight plan.
 * @throws Error if the KMZ file format is unsupported.
 */
async function parseKMZFile(file: File): Promise<import("../context/FlightPlanContext").FlightPlanData> {
  const zip = await JSZip.loadAsync(file);
  const fileNames = Object.keys(zip.files);

  console.log("KMZ contents:", fileNames);

  const templateFile = zip.file("template.kml") || zip.file("wpmz/template.kml");
  const waylinesFile = zip.file("waylines.wpml") || zip.file("wpmz/waylines.wpml");

  if (templateFile && waylinesFile) {
    const templateText = await templateFile.async("string");
    const waylinesText = await waylinesFile.async("string");

    const templateDom = parser!.parseFromString(templateText, "application/xml");
    const waylinesDom = parser!.parseFromString(waylinesText, "application/xml");

    const findElementsByTagName = (element: Element, tagName: string): Element[] => {
      const result: Element[] = [];
      const allElements = element.getElementsByTagName("*");
      for (let i = 0; i < allElements.length; i++) {
        const elem = allElements[i];
        if (elem.localName === tagName || elem.tagName.endsWith(":" + tagName)) {
          result.push(elem);
        }
      }
      return result;
    };

    const safeNum = (val: string | undefined | null) => Number(val) || 0;

    const takeOffRefPointElem = findElementsByTagName(templateDom, "takeOffRefPoint")[0];
    let homePosition = { latitude: 0, longitude: 0, altitude: 0 };

    if (takeOffRefPointElem && takeOffRefPointElem.textContent) {
      const homeParts = takeOffRefPointElem.textContent.split(",");
      homePosition = {
        latitude: safeNum(homeParts[0]),
        longitude: safeNum(homeParts[1]),
        altitude: safeNum(homeParts[2]),
      };
    }

    const heightModeElem = findElementsByTagName(templateDom, "heightMode")[0];
    const executeHeightModeElem = findElementsByTagName(templateDom, "executeHeightMode")[0];

    const heightMode =
      (heightModeElem && heightModeElem.textContent === "relativeToStartPoint") ||
      (executeHeightModeElem && executeHeightModeElem.textContent === "relativeToStartPoint")
        ? "relative"
        : (executeHeightModeElem && executeHeightModeElem.textContent === "realTimeFollowSurface")
          ? "terrain"
          : "absolute";

    const takeOffSecurityHeightElem = findElementsByTagName(templateDom, "takeOffSecurityHeight")[0];
    const takeoffHeight = safeNum(takeOffSecurityHeightElem?.textContent);

    if (heightMode === "terrain") {
      homePosition.altitude = takeoffHeight;
    }

    const placemarks = Array.from(waylinesDom.getElementsByTagName("Placemark"));
    const coordinates: [number, number, number][] = [];
    const waypoints: import("../context/FlightPlanContext").WaypointData[] = [];

    placemarks.forEach((pm, index) => {
      const coordElem = pm.querySelector("Point coordinates");
      if (!coordElem || !coordElem.textContent) return;

      const coordText = coordElem.textContent.trim();
      const coordParts = coordText.split(",");
      if (coordParts.length < 2) return;

      const lon = safeNum(coordParts[0]);
      const lat = safeNum(coordParts[1]);
      const executeHeightElems = findElementsByTagName(pm, "executeHeight");
      const altValue = executeHeightElems.length > 0 ? safeNum(executeHeightElems[0].textContent) : takeoffHeight;

      const actionElems = findElementsByTagName(pm, "actionActuatorFunc");
      const isGimbalCommand = actionElems.some((elem) =>
        elem.textContent && elem.textContent.includes("gimbal")
      );

      coordinates.push([lon, lat, altValue]);
      waypoints.push({
        index,
        altitudeMode: heightMode,
        originalAltitude: altValue,
        commandType: isGimbalCommand ? 178 : 16,
        frame: 0,
      });
    });

    const speedElem = findElementsByTagName(templateDom, "globalTransitionalSpeed")[0];
    const finishActionElem = findElementsByTagName(templateDom, "finishAction")[0];
    const createTimeElem = findElementsByTagName(templateDom, "createTime")[0];
    const updateTimeElem = findElementsByTagName(templateDom, "updateTime")[0];
    const distanceElem = findElementsByTagName(waylinesDom, "distance")[0];

    return {
      type: "FeatureCollection",
      properties: {
        homePosition,
        config: {
          takeoffHeight,
          speed: safeNum(speedElem?.textContent),
          finishAction: finishActionElem?.textContent || "goHome",
        },
        metadata: {
          processed: false,
          source: "kmz",
          distance: safeNum(distanceElem?.textContent),
          created: safeNum(createTimeElem?.textContent),
          updated: safeNum(updateTimeElem?.textContent) || (file?.lastModified && Math.floor(file.lastModified / 1000)),
          metadata: {
            file: {
              takeoffHeight,
              speed: safeNum(speedElem?.textContent),
              finishAction: finishActionElem?.textContent || "goHome",
            },
            segments: placemarks.map((pm, index) => ({
              index,
              executeHeight: safeNum(findElementsByTagName(pm, "executeHeight")[0]?.textContent),
            })),
          },
        },
      },
      features: [{
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { waypoints },
      }],
    };
  }

  throw new Error("Unsupported KMZ format. Only DJI flight plan KMZ files are supported.");
}

/**
 * Infers the home position from the first coordinate in the flight plan.
 * @param coordinates - Array of coordinates in the flight plan.
 * @returns An object with latitude, longitude, and altitude for the home position.
 */
function inferHomePosition(coordinates: [number, number, number][]) {
  if (!coordinates.length) return { latitude: 0, longitude: 0, altitude: 0 };
  const [lon, lat, alt] = coordinates[0];
  return { latitude: lat, longitude: lon, altitude: alt ?? 0 };
}

/**
 * Tracks the uploaded flight plan by submitting it to a Google Form in production.
 * @param flightData - The processed flight plan data.
 * @param fileName - The name of the uploaded file.
 */
const trackFlightPlan = async (
  flightData: import("../context/FlightPlanContext").FlightPlanData,
  fileName: string
) => {
  const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLScuzovyjSaTRVVKVLa-Y88bGjBp1uG-doxALVE4aAdJTmzvJg/formResponse";

  const auditMetadata = {
    uploadTimestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    ipAddress: "",
    userId: "",
  };

  // Fetch IP address for audit metadata
  try {
    const ipResponse = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipResponse.json();
    auditMetadata.ipAddress = ipData.ip;
  } catch (error) {
    console.error("Failed to fetch IP address:", error);
  }

  const formData = {
    "entry.2094842776": new Date().toISOString(),
    "entry.1248754852": fileName,
    "entry.1814819258": JSON.stringify(flightData),
    "entry.903129689": JSON.stringify(auditMetadata),
  };

  let iframe = document.getElementById("hidden_iframe_flightplan") as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.name = "hidden_iframe_flightplan";
    iframe.id = "hidden_iframe_flightplan";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }

  const form = document.createElement("form");
  form.action = formUrl;
  form.method = "POST";
  form.target = "hidden_iframe_flightplan";
  form.style.display = "none";

  Object.keys(formData).forEach((key) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = formData[key];
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

interface FlightPlanUploaderProps {
  onPlanUploaded?: (flightData: import("../context/FlightPlanContext").FlightPlanData, resetMap: () => void) => void;
  onClose?: () => void;
  mapRef?: React.RefObject<any>;
}

/**
 * A component for uploading and processing flight plan files, or loading an example flight plan.
 * @param props - Component props.
 * @param props.onPlanUploaded - Callback to handle the processed flight plan and reset the map.
 * @param props.onClose - Callback to close the uploader UI.
 * @param props.mapRef - Reference to the map component for resetting layers.
 */
const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({ onPlanUploaded, onClose, mapRef }) => {
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "processed" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const { setFlightPlan } = useFlightPlanContext();
  const { map } = useMapContext();
  const { processFlightPlan, isProcessing: isProcessingFlightPlan, error: processingError } = useFlightPlanProcessor();

  /**
   * Processes a raw flight plan and stores it in `FlightPlanContext` after processing.
   * @param rawFlightPlan - The raw flight plan data to process.
   * @param fileName - The name of the file being processed.
   */
  const processAndStoreFlightPlan = useCallback(async (
    rawFlightPlan: import("../context/FlightPlanContext").FlightPlanData,
    fileName: string
  ) => {
    if (!map) {
      setFileUploadStatus("error");
      throw new Error("Map not initialized");
    }

    try {
      // Process the flight plan to resolve altitudes and calculate distances
      const processedFlightPlan = await processFlightPlan(map, rawFlightPlan);
      
      // Store the processed flight plan in context for app-wide access
      setFlightPlan(processedFlightPlan);

      // Notify the parent component of the processed flight plan and provide a reset function
      if (onPlanUploaded && mapRef?.current) {
        onPlanUploaded(processedFlightPlan, () => {
          const mapInstance = mapRef.current!.getMap();
          if (mapInstance) {
            if (mapInstance.getLayer("line-0")) {
              mapRef.current!.toggleLayerVisibility("line-0");
            }
            ["ELOS_GRID", "GCS_GRID", "OBSERVER_GRID", "REPEATER_GRID", "MERGED_VISIBILITY"].forEach((layer) => {
              if (mapInstance.getSource(layer)) {
                mapRef.current!.toggleLayerVisibility(layer);
              }
            });
            mapInstance.getStyle().layers?.forEach((layer: any) => {
              if (layer.id.startsWith("marker")) {
                mapInstance.removeLayer(layer.id);
                mapInstance.removeSource(layer.id);
              }
            });
          }
        });
      }

      // Track the processed flight plan in production for analytics
      if (process.env.NODE_ENV === "production") {
        await trackFlightPlan(processedFlightPlan, fileName);
      }

      setFileUploadStatus("processed");
      if (onClose) onClose();
    } catch (error) {
      console.error("Error processing flight plan:", error);
      setFileUploadStatus("error");
    }
  }, [map, processFlightPlan, setFlightPlan, onPlanUploaded, mapRef, onClose]);

  /**
   * Handles file drop events by parsing the uploaded file and processing the flight plan.
   * @param acceptedFiles - Array of files dropped by the user.
   */
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    setFileName(file.name);
    setFileUploadStatus("uploading");

    try {
      let rawFlightData: import("../context/FlightPlanContext").FlightPlanData;
      if (fileExtension === "kmz") {
        rawFlightData = await parseKMZFile(file);
      } else {
        const reader = new FileReader();
        rawFlightData = await new Promise<import("../context/FlightPlanContext").FlightPlanData>((resolve, reject) => {
          reader.onload = () => {
            try {
              const result = reader.result as string;
              if (fileExtension === "waypoints") resolve(parseQGCFile(result));
              else if (fileExtension === "geojson") resolve(parseGeoJSONFile(result));
              else if (fileExtension === "kml") resolve(parseKMLFile(result, file));
              else reject(new Error("Unsupported file type"));
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });
      }

      const newFlightPlan = {
        ...rawFlightData,
        properties: { ...rawFlightData.properties, processed: false },
      };

      await processAndStoreFlightPlan(newFlightPlan, file.name);
    } catch (error) {
      console.error("Error processing file:", error);
      setFileUploadStatus("error");
    }
  }, [processAndStoreFlightPlan]);

  /**
   * Loads an example GeoJSON flight plan for demo purposes.
   */
  const loadExampleGeoJSON = useCallback(async () => {
    try {
      const response = await fetch("/example.geojson");
      const rawData = await response.json();

      const processedData = parseGeoJSONFile(JSON.stringify(rawData));
      const newFlightPlan = { ...processedData, properties: { ...processedData.properties, processed: false } };

      await processAndStoreFlightPlan(newFlightPlan, "example.geojson");
    } catch (error) {
      console.error("Error loading example GeoJSON:", error);
      setFileUploadStatus("error");
    }
  }, [processAndStoreFlightPlan]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.waypoints'],
      'application/json': ['.geojson'],
      'application/vnd.google-earth.kml+xml': ['.kml'],
      'application/vnd.google-earth.kmz': ['.kmz']
    }
  });

  return (
    <div className="flex-1 bg-white shadow-lg p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-bold">🚀 Upload or Use Example Flight Plan 📁</h3>
      <p className="text-sm text-gray-600">
        Upload a <strong>.waypoints</strong>, <strong>.geojson</strong>, <strong>.kml</strong>, or{" "}
        <strong>.kmz</strong> file, or use our example to analyze a drone flight path.
      </p>

      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <p className="text-gray-500">Drag & Drop your file here or click to upload</p>
        {fileName && (
          <p className="mt-2 text-sm text-gray-600">Selected file: {fileName}</p>
        )}
        {(fileUploadStatus === "uploading" || isProcessingFlightPlan) && (
          <p className="mt-2 text-sm text-blue-600">Processing file...</p>
        )}
        {fileUploadStatus === "processed" && (
          <p className="mt-2 text-sm text-green-600">File processed successfully!</p>
        )}
        {fileUploadStatus === "error" && (
          <p className="mt-2 text-sm text-red-600">
            Error processing file: {processingError || "Please try again."}
          </p>
        )}
      </div>

      {/* Example Button */}
      <div className="mt-4">
        <p className="text-sm text-gray-600 text-center">
          Don’t have a file? Try our example to get started.
        </p>
        <div className="flex justify-center mt-2">
          <button
            onClick={() => {
              trackEvent("example_geojson_click", { panel: "flightplanuploader.tsx" });
              loadExampleGeoJSON();
            }}
            className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600 text-sm"
          >
            Load Example Flight Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlightPlanUploader;