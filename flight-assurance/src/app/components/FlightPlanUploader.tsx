// FlightPlanUploader.tsx
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import toGeoJSON from "@mapbox/togeojson";
import JSZip from "jszip";

const parser = typeof window !== "undefined" ? new DOMParser() : null;

// MavLink Altitude Mode Setter
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

// Parse QGroundControl .waypoints file
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

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) continue;

    const index = parseInt(parts[0], 10);
    const frame = parseInt(parts[2], 10);
    const command = parseInt(parts[3], 10);
    const lat = parseFloat(parts[8]);
    const lon = parseFloat(parts[9]);
    const alt = parseFloat(parts[10]);

    if (i === 1) homePosition = { latitude: lat, longitude: lon, altitude: alt }; // Initial home

    const altitudeMode = frameToAltitudeMode(frame);
    if (command === 22) { // Takeoff command
      takeoffAltitude = alt;
      if (frame === 10) isTerrainMission = true; // Terrain mode
      if (frame === 3) isRelativeMission = true; // Relative mode
    }

    waypoints.push({
      index,
      altitudeMode,
      originalAltitude: alt,
      commandType: command,
      frame,
    });

    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      coordinates.push([lon, lat, alt]);
    }
  }

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
      metadata: { processed: false },
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { waypoints },
    }],
  };
}

// Parse KML file
function parseKMLFile(kmlText: string): import("../context/FlightPlanContext").FlightPlanData {
  const kmlDom = parser?.parseFromString(kmlText, "application/xml");
  const geojsonResult = toGeoJSON.kml(kmlDom) as GeoJSON.FeatureCollection;

  let coordinates: [number, number, number][] = [];
  let name = "KML Flight Path";

  for (const feature of geojsonResult.features) {
    if (feature.geometry?.type === "LineString") {
      coordinates = feature.geometry.coordinates.map(([lon, lat, alt]) => [lon, lat, alt ?? 0]);
      name = feature.properties?.name || name;
      break;
    }
  }

  if (!coordinates.length) throw new Error("No LineString geometry found in KML");

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
      metadata: { processed: false },
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { waypoints },
    }],
  };
}

// Parse GeoJSON file
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
      metadata: { processed: false },
    },
    features: [{
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { waypoints },
    }],
  };
}

// Parse KMZ (DJI) file
async function parseKMZFile(file: File): Promise<import("../context/FlightPlanContext").FlightPlanData> {
  const zip = await JSZip.loadAsync(file);
  const fileNames = Object.keys(zip.files);
  
  console.log("KMZ contents:", fileNames);
  
  // Check for files either at root or in wpmz/ directory
  let templateFile = zip.file("template.kml") || zip.file("wpmz/template.kml");
  let waylinesFile = zip.file("waylines.wpml") || zip.file("wpmz/waylines.wpml");
  
  if (templateFile && waylinesFile) {
    // Process as DJI format
    const templateText = await templateFile.async("string");
    const waylinesText = await waylinesFile.async("string");
    
    const templateDom = parser!.parseFromString(templateText, "application/xml");
    const waylinesDom = parser!.parseFromString(waylinesText, "application/xml");

    // Helper function to find elements with a specific tag name, handling namespaces
    const findElementsByTagName = (element: Element, tagName: string): Element[] => {
      const result: Element[] = [];
      const allElements = element.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        const elem = allElements[i];
        if (elem.localName === tagName || elem.tagName.endsWith(':' + tagName)) {
          result.push(elem);
        }
      }
      return result;
    };

    const safeNum = (val: string | undefined | null) => Number(val) || 0;
    
    // Get home position
    const takeOffRefPointElem = findElementsByTagName(templateDom, 'takeOffRefPoint')[0];
    let homePosition = { latitude: 0, longitude: 0, altitude: 0 };
    
    if (takeOffRefPointElem && takeOffRefPointElem.textContent) {
      const homeParts = takeOffRefPointElem.textContent.split(',');
      homePosition = {
        latitude: safeNum(homeParts[0]),
        longitude: safeNum(homeParts[1]),
        altitude: safeNum(homeParts[2]),
      };
    }
    
    // Get height mode
    const heightModeElem = findElementsByTagName(templateDom, 'heightMode')[0];
    const executeHeightModeElem = findElementsByTagName(templateDom, 'executeHeightMode')[0];
    
    const heightMode = 
      (heightModeElem && heightModeElem.textContent === "relativeToStartPoint") || 
      (executeHeightModeElem && executeHeightModeElem.textContent === "relativeToStartPoint")
        ? "relative"
        : (executeHeightModeElem && executeHeightModeElem.textContent === "realTimeFollowSurface")
          ? "terrain"
          : "absolute";
    
    // Get takeoff height
    const takeOffSecurityHeightElem = findElementsByTagName(templateDom, 'takeOffSecurityHeight')[0];
    const takeoffHeight = safeNum(takeOffSecurityHeightElem?.textContent);
    
    // Set home altitude for terrain missions
    if (heightMode === "terrain") {
      homePosition.altitude = takeoffHeight;
    }

    // Get all placemarks
    const placemarks = Array.from(waylinesDom.getElementsByTagName('Placemark'));
    
    // Process waypoints
    const coordinates: [number, number, number][] = [];
    const waypoints: any[] = [];
    
    placemarks.forEach((pm, index) => {
      // Get coordinates
      const coordElem = pm.querySelector('Point coordinates');
      if (!coordElem || !coordElem.textContent) return;
      
      const coordText = coordElem.textContent.trim();
      const coordParts = coordText.split(',');
      if (coordParts.length < 2) return;
      
      const lon = safeNum(coordParts[0]);
      const lat = safeNum(coordParts[1]);
      
      // Get altitude - FIXED: properly search for executeHeight tag
      const executeHeightElems = findElementsByTagName(pm, 'executeHeight');
      const altValue = executeHeightElems.length > 0 ? safeNum(executeHeightElems[0].textContent) : takeoffHeight;
      
      // Check for gimbal command
      const actionElems = findElementsByTagName(pm, 'actionActuatorFunc');
      const isGimbalCommand = actionElems.some(elem => 
        elem.textContent && elem.textContent.includes('gimbal'));
      
      // Add coordinate with correct altitude
      coordinates.push([lon, lat, altValue]);
      
      // Add waypoint data
      waypoints.push({
        index,
        altitudeMode: heightMode,
        originalAltitude: altValue,
        commandType: isGimbalCommand ? 178 : 16,
        frame: 0,
      });
    });
    
    // Get other metadata
    const speedElem = findElementsByTagName(templateDom, 'globalTransitionalSpeed')[0];
    const finishActionElem = findElementsByTagName(templateDom, 'finishAction')[0];
    const createTimeElem = findElementsByTagName(templateDom, 'createTime')[0];
    const updateTimeElem = findElementsByTagName(templateDom, 'updateTime')[0];
    const distanceElem = findElementsByTagName(waylinesDom, 'distance')[0];
    
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
          created: safeNum(createTimeElem?.textContent),
          updated: safeNum(updateTimeElem?.textContent),
          distance: safeNum(distanceElem?.textContent),
          processed: false,
        },
      },
      features: [{
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { waypoints },
      }],
    };
  }
  
  // If single KML file, try to parse that instead
  const kmlFiles = fileNames.filter(name => name.endsWith('.kml') && !name.includes('/'));
  if (kmlFiles.length > 0) {
    // Process single KML file logic here
    // ...similar approach but adapted for single file structure
  }
  
  // If we get here, no valid format was found
  throw new Error("Unsupported KMZ format. Only DJI flight plan KMZ files are supported.");
}

function inferHomePosition(coordinates: [number, number, number][]) {
  if (!coordinates.length) return null;
  const [lon, lat, alt] = coordinates[0];
  return { latitude: lat, longitude: lon, altitude: alt ?? 0 };
}

interface FlightPlanUploaderProps {
  onPlanUploaded?: (flightData: import("../context/FlightPlanContext").FlightPlanData, resetMap: () => void) => void;
  onClose?: () => void;
  mapRef?: React.RefObject<MapRef>;
}

const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({ onPlanUploaded, onClose, mapRef }) => {
  const [fileUploadStatus, setFileUploadStatus] = useState<"idle" | "uploading" | "processed" | "error">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const { setFlightPlan } = useFlightPlanContext();


// Flightplan Uploader Dropbox
const onDrop = async (acceptedFiles: File[]) => {
  const file = acceptedFiles[0];
  const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
  setFileName(file.name);
  setFileUploadStatus("uploading");

  try {
    let flightData: import("../context/FlightPlanContext").FlightPlanData;
    if (fileExtension === "kmz") {
      flightData = await parseKMZFile(file);
    } else {
      const reader = new FileReader();
      flightData = await new Promise((resolve, reject) => {
        reader.onload = () => {
          try {
            const result = reader.result as string;
            if (fileExtension === "waypoints") resolve(parseQGCFile(result));
            else if (fileExtension === "geojson") resolve(parseGeoJSONFile(result));
            else if (fileExtension === "kml") resolve(parseKMLFile(result));
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
      ...flightData,
      properties: { ...flightData.properties, processed: false },
    };

    // Reset map and update flight plan if callback provided
    if (onPlanUploaded && mapRef?.current) {
      onPlanUploaded(newFlightPlan, () => {
        const map = mapRef.current!.getMap();
        if (map) {
          // Hide old flight path
          mapRef.current!.toggleLayerVisibility("line-0");

          // Remove analysis layers
          ["ELOS_GRID", "GCS_GRID", "OBSERVER_GRID", "REPEATER_GRID", "MERGED_VISIBILITY"].forEach(layer => {
            if (map.getSource(layer)) {
              mapRef.current!.toggleLayerVisibility(layer);
            }
          });

          // Remove markers
          map.getStyle().layers?.forEach(layer => {
            if (layer.id.startsWith("marker")) {
              map.removeLayer(layer.id);
              map.removeSource(layer.id);
            }
          });
        }
      });
    }

    // Update context with new flight plan
    setFlightPlan(newFlightPlan);

    // Upload to backend
    const payload = {
      fileName: file.name,
      fileContent: flightData,
      fileExtension,
    };
    const response = await fetch("/api/uploadFlightPlan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Drive upload failed");

    setFileUploadStatus("processed");
    if (onClose) onClose(); // Close uploader if provided
  } catch (error) {
    console.error("Error processing file:", error);
    setFileUploadStatus("error");
  }
};

const { getRootProps, getInputProps } = useDropzone({
  accept: {
    "application/vnd.google-earth.kmz": [".kmz"],
    "application/vnd.google-earth.kml+xml": [".kml"],
    "application/geo+json": [".geojson"],
    "application/waypoints": [".waypoints"],
  },
  onDrop,
});

  const loadExampleGeoJSON = async () => {
    try {
      const response = await fetch("/example.geojson");
      const rawData = await response.json();

      const processedData = parseGeoJSONFile(JSON.stringify(rawData));
      const newFlightPlan = { ...processedData, processed: false };

      setFlightPlan(newFlightPlan);
      if (onPlanUploaded) {
        onPlanUploaded(newFlightPlan);
      }
      setFileUploadStatus("processed");
    } catch (error) {
      console.error("Error loading example GeoJSON:", error);
      setFileUploadStatus("error");
    }
  };

  return (
    <div className="flex-1 bg-white shadow-lg p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-bold text-black">📁 Upload Your Flight Plan</h3>
      <p className="text-sm text-gray-600">
        Upload a <strong>.waypoints</strong>, <strong>.geojson</strong>, <strong>.kml</strong>, or <strong>.kmz</strong> file to analyze your drone's flight path.
      </p>

      <div
        {...getRootProps()}
        className="mt-4 border-2 border-dashed border-gray-300 p-6 rounded-lg flex flex-col items-center justify-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <p className="text-gray-500">Drag & Drop your file here or click to upload</p>
        {fileName && (
          <p className="mt-2 text-sm text-gray-600">Selected file: {fileName}</p>
        )}
        {fileUploadStatus === "uploading" && (
          <p className="mt-2 text-sm text-blue-600">Processing file...</p>
        )}
        {fileUploadStatus === "processed" && (
          <p className="mt-2 text-sm text-green-600">File processed successfully!</p>
        )}
        {fileUploadStatus === "error" && (
          <p className="mt-2 text-sm text-red-600">Error processing file. Please try again.</p>
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
