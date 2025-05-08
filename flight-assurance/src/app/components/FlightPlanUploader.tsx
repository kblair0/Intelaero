/**
 * FlightPlanUploader.tsx
 *
 * Purpose:
 * This component provides a user interface for uploading flight plan files (.waypoints, .geojson, .kml, .kmz)
 * or loading an example flight plan. It parses each format into a standardized GeoJSON-based FlightPlanData,
 * processes it (resolves altitudes, queries terrain, calculates distances), and stores the result in context.
 * In production it also tracks uploads via a Google Form.
 * 
 * Optimized to use ElevationService instead of TerrainUtils for more efficient terrain handling.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useMapContext } from "../context/mapcontext";
import { useFlightPlanProcessor } from "../components/Map/Hooks/useFlightPlanProcessor";
import toGeoJSON from "@mapbox/togeojson";
import JSZip from "jszip";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";
import MapLoadingGuard from "./Map/MapLoadingGuard";
import type {
  FlightPlanData,
  WaypointData,
  FlightPlanMetadata
} from "../context/FlightPlanContext";
import type {
  FeatureCollection,
  Feature,
  LineString,
  Position
} from "geojson";
import * as turf from '@turf/turf';

// DOMParser for KML/KMZ -> only in browser
const parser = typeof window !== "undefined" ? new DOMParser() : null;

/** Map a MAVLink frame to altitude mode */
function frameToAltitudeMode(frame: number): "absolute" | "relative" | "terrain" {
  switch (frame) {
    case 3:
      return "relative";
    case 10:
      return "terrain";
    default:
      return "absolute";
  }
}

/** Parse QGroundControl .waypoints */
function parseQGCFile(content: string): FlightPlanData {
  const lines = content.trim().split("\n");
  if (!lines[0].includes("QGC WPL 110")) {
    throw new Error("Invalid .waypoints file. Missing QGC WPL 110 header.");
  }

  let homePosition = { latitude: 0, longitude: 0, altitude: 0 };
  const waypoints: WaypointData[] = [];
  const coordinates: [number, number, number][] = [];
  const navigationIndices: number[] = []; // Store indices of waypoints with valid coordinates
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

    if (i === 1) homePosition = { latitude: lat, longitude: lon, altitude: alt };

    const altitudeMode = frameToAltitudeMode(frame);
    if (command === 22) {
      takeoffAltitude = alt;
      if (frame === 10) isTerrainMission = true;
      if (frame === 3) isRelativeMission = true;
    }

    waypoints.push({ index, altitudeMode, originalAltitude: alt, commandType: command, frame });
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      coordinates.push([lon, lat, alt]);
      navigationIndices.push(index); // Store the index of navigation waypoints
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
      metadata: {
        processed: false,
        source: "waypoints",
        metadata: {
          file: { version: "QGC WPL 110" },
          segments: waypoints.map((wp) => ({
            index: wp.index,
            command: wp.commandType,
            frame: wp.frame
          })),
          navigationIndices // Add navigation indices to metadata
        }
      }
    },
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { waypoints }
      }
    ]
  };
}

/** Parse KML -> GeoJSON, narrow coords to triples */
function parseKMLFile(kmlText: string, file?: File): FlightPlanData {
  if (!parser) throw new Error("DOMParser is not available");
  const doc = parser.parseFromString(kmlText, "application/xml");
  const rootEl = doc.documentElement; // now an Element
  const geojsonResult = toGeoJSON.kml(rootEl) as FeatureCollection;

  const lineStringFeatures = geojsonResult.features.filter(
    (feature): feature is Feature<LineString> =>
      feature.geometry?.type === "LineString"
  );
  if (!lineStringFeatures.length) {
    throw new Error("No valid LineString geometry found in KML file.");
  }

  // Narrow and cast coordinates
  const coordinates: [number, number, number][] = lineStringFeatures.flatMap(
    (feature) => {
      const raw = (feature.geometry as LineString).coordinates;
      return raw
        .filter((c): c is Position => Array.isArray(c) && c.length === 3)
        .map((c) => [c[0], c[1], c[2] ?? 0] as [number, number, number]);
    }
  );

  const waypoints: WaypointData[] = coordinates.map((coord, idx) => ({
    index: idx,
    altitudeMode: "absolute",
    originalAltitude: coord[2],
    commandType: 16,
    frame: 0
  }));

  const nameElem = doc.querySelector("name");
  const fileName = nameElem?.textContent ?? "KML Flight Path";

  const metadata: FlightPlanMetadata = {
    processed: false,
    source: "kml",
    distance: lineStringFeatures.reduce(
      (sum: number, f: Feature<LineString>) =>
        sum + (Number(f.properties?.Shape__Length) || 0),
      0
    ),
    ...(file?.lastModified && {
      updated: Math.floor(file.lastModified / 1000)
    }),
    metadata: {
      file: { name: fileName },
      segments: lineStringFeatures.map((f) => ({
        ...f.properties,
        coordinateCount: (f.geometry as LineString).coordinates.length
      }))
    }
  };

  return {
    type: "FeatureCollection",
    properties: {
      homePosition: inferHomePosition(coordinates),
      config: {},
      metadata
    },
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { waypoints }
      }
    ]
  };
}

/** Parse raw GeoJSON text */
function parseGeoJSONFile(geojsonText: string): FlightPlanData {
  const geojsonResult = JSON.parse(geojsonText) as FeatureCollection;
  if (!geojsonResult.features.length) {
    throw new Error("Invalid GeoJSON: No features found.");
  }

  const flightFeature = geojsonResult.features.find(
    (f): f is Feature<LineString> => f.geometry?.type === "LineString"
  );
  if (!flightFeature) {
    throw new Error("No valid flight path found in GeoJSON.");
  }

  // Narrow coords
  const raw = (flightFeature.geometry as LineString).coordinates;
  const coordinates: [number, number, number][] = raw
    .filter((c): c is Position => Array.isArray(c) && c.length === 3)
    .map((c) => [c[0], c[1], c[2]] as [number, number, number]);

  const waypoints: WaypointData[] = coordinates.map((coord, idx) => ({
    index: idx,
    altitudeMode: "absolute",
    originalAltitude: coord[2]
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
          segments: geojsonResult.features.map((f) => f.properties || {})
        }
      }
    },
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: { waypoints }
      }
    ]
  };
}

/** Parse DJI .kmz -> FlightPlanData */
async function parseKMZFile(file: File): Promise<FlightPlanData> {
  const zip = await JSZip.loadAsync(file);
  const tpl = zip.file("template.kml") || zip.file("wpmz/template.kml");
  const wpl = zip.file("waylines.wpml") || zip.file("wpmz/waylines.wpml");
  if (!tpl || !wpl) throw new Error("Unsupported KMZ format.");

  const [tplText, wplText] = await Promise.all([
    tpl.async("string"),
    wpl.async("string")
  ]);
  const tplDoc = parser!
    .parseFromString(tplText, "application/xml")
    .documentElement;
  const wplDoc = parser!
    .parseFromString(wplText, "application/xml")
    .documentElement;

  const getByTag = (el: Element, tag: string): Element[] =>
    Array.from(el.getElementsByTagName(tag));
  const safeNum = (v?: string | null) => Number(v) || 0;

  // Home
  const takeOffElem = getByTag(tplDoc, "takeOffRefPoint")[0];
  let homePosition = { latitude: 0, longitude: 0, altitude: 0 };
  if (takeOffElem?.textContent) {
    const [lat, lon, alt] = takeOffElem.textContent.split(",");
    homePosition = {
      latitude: safeNum(lat),
      longitude: safeNum(lon),
      altitude: safeNum(alt)
    };
  }

  // Height mode
  const execMode = getByTag(tplDoc, "executeHeightMode")[0]?.textContent;
  const heightMode =
    execMode === "relativeToStartPoint"
      ? "relative"
      : execMode === "realTimeFollowSurface"
      ? "terrain"
      : "absolute";
  const takeoffHeight = safeNum(
    getByTag(tplDoc, "takeOffSecurityHeight")[0]?.textContent
  );
  if (heightMode === "terrain") homePosition.altitude = takeoffHeight;

  // Waypoints
  const placemarks = Array.from(wplDoc.getElementsByTagName("Placemark"));
  const coords: [number, number, number][] = [];
  const waypoints: WaypointData[] = [];
  placemarks.forEach((pm, idx) => {
    const pt = pm.querySelector("Point coordinates");
    if (!pt?.textContent) return;
    const [lonStr, latStr, altStr] = pt.textContent.trim().split(",");
    const lon = safeNum(lonStr),
      lat = safeNum(latStr),
      alt = safeNum(altStr);
    coords.push([lon, lat, alt]);
    waypoints.push({ index: idx, altitudeMode: heightMode, originalAltitude: alt, frame: 0, commandType: 16 });
  });

  const metadata: FlightPlanMetadata = {
    processed: false,
    source: "kmz",
    distance: safeNum(
      wplDoc.getElementsByTagName("distance")[0]?.textContent
    ),
    created: safeNum(
      wplDoc.getElementsByTagName("createTime")[0]?.textContent
    ),
    metadata: {
      file: {
        takeoffHeight,
        speed: safeNum(
          tplDoc.getElementsByTagName("globalTransitionalSpeed")[0]?.textContent
        ),
        finishAction:
          tplDoc.getElementsByTagName("finishAction")[0]?.textContent ||
          "goHome"
      }
    }
  };

  return {
    type: "FeatureCollection",
    properties: {
      homePosition,
      config: { takeoffHeight },
      metadata
    },
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { waypoints }
      }
    ]
  };
}

/** First waypoint = home */
function inferHomePosition(
  coords: [number, number, number][]
): { latitude: number; longitude: number; altitude: number } {
  if (!coords.length) return { latitude: 0, longitude: 0, altitude: 0 };
  const [lon, lat, alt] = coords[0];
  return { latitude: lat, longitude: lon, altitude: alt };
}

/** Send audit + flightData to Google Form */
const trackFlightPlan = async (
  flightData: FlightPlanData,
  fileName: string
) => {
  const formUrl =
    "https://docs.google.com/forms/d/e/1FAIpQLScuzovyjSaTRVVKVLa-Y88bGjBp1uG-doxALVE4aAdJTmzvJg/formResponse";
  const audit = {
    uploadTimestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    ipAddress: ""
  };
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const j = await res.json();
    audit.ipAddress = j.ip;
  } catch {}
  const formData: Record<string, string> = {
    "entry.2094842776": new Date().toISOString(),
    "entry.1248754852": fileName,
    "entry.1814819258": JSON.stringify(flightData),
    "entry.903129689": JSON.stringify(audit)
  };
  let iframe = document.getElementById(
    "hidden_iframe_flightplan"
  ) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = iframe.name = "hidden_iframe_flightplan";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
  }
  const form = document.createElement("form");
  form.action = formUrl;
  form.method = "POST";
  form.target = iframe.name;
  form.style.display = "none";
  Object.entries(formData).forEach(([k, v]) => {
    const inp = document.createElement("input");
    inp.type = "hidden";
    inp.name = k;
    inp.value = v;
    form.appendChild(inp);
  });
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

interface FlightPlanUploaderProps {
  onPlanUploaded?: (fp: FlightPlanData) => void;
  onClose?: () => void;
}

/** SINGLE FlightPlanUploader with matching locals & UI */
const FlightPlanUploader: React.FC<FlightPlanUploaderProps> = ({
  onPlanUploaded,
  onClose
}) => {
  const [status, setStatus] = useState<
    "idle" | "uploading" | "processed" | "error"
  >("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const { setFlightPlan } = useFlightPlanContext();
  const { map, elevationService } = useMapContext();
  const { processFlightPlan, isProcessing, error } = useFlightPlanProcessor();
  const [progress, setProgress] = useState(0);

  /**
   * Processes and stores the flight plan, ensuring terrain data is loaded.
   * @param raw - Raw flight plan data to process.
   * @param name - Name of the uploaded file.
   */
  const processAndStore = useCallback(
    async (raw: FlightPlanData, name: string) => {
      if (!map) {
        setStatus("error");
        throw new Error("Map not initialized");
      }
      
      if (!elevationService) {
        console.warn("ElevationService not available, terrain functionality may be limited");
      }
      
      try {
        // Compute originalWaypointDistances from coordinates
        const coordinates = raw.features[0].geometry.coordinates;
        let cumulativeDistance = 0;
        const originalWaypointDistances: number[] = [0];
        
        for (let i = 1; i < coordinates.length; i++) {
          const prevCoord = coordinates[i - 1];
          const currCoord = coordinates[i];
          if (!prevCoord || !currCoord || !Array.isArray(prevCoord) || !Array.isArray(currCoord) || prevCoord.length < 2 || currCoord.length < 2) {
            console.warn(`Invalid coordinate at index ${i - 1} or ${i}:`, { prevCoord, currCoord });
            continue;
          }
          const segmentDistance = turf.distance(
            [prevCoord[0], prevCoord[1]],
            [currCoord[0], currCoord[1]],
            { units: 'meters' }
          );
          cumulativeDistance += segmentDistance;
          originalWaypointDistances.push(cumulativeDistance);
        }
        
        console.log('processAndStore: Original Waypoint Distances (meters):', originalWaypointDistances);

        // Update raw with originalWaypointDistances
        const updatedRaw: FlightPlanData = {
          ...raw,
          originalWaypointDistances,
          properties: {
            ...raw.properties,
            totalDistance: cumulativeDistance
          }
        };

        // Progress indicator
        setProgress(10);

        // Ensure terrain data is ready and preload the flight plan area using ElevationService
        if (elevationService) {
          await elevationService.ensureDEM();
          setProgress(20);
          
          // Extract 2D coordinates for preloading
          const coordsFor2D = updatedRaw.features[0].geometry.coordinates.map(
            ([lon, lat]) => [lon, lat] as [number, number]
          );
          
          // Use the preloadArea method from ElevationService
          await elevationService.preloadArea(coordsFor2D);
          setProgress(40);
          
          console.log(`[${new Date().toISOString()}] [FlightPlanUploader.tsx] Preload completed for ${coordsFor2D.length} coordinates`);
        }

        setProgress(50);
        const proc = await processFlightPlan(updatedRaw);
        setProgress(90);
        setFlightPlan(proc);
        onPlanUploaded?.(proc); // Notify parent before closing
        
        if (process.env.NODE_ENV === "production") {
          await trackFlightPlan(proc, name);
        }
        
        setProgress(100);
        setStatus("processed");
        onClose?.(); // Close after notifying parent
      } catch (error: any) {
        console.error("🔥 processAndStore error:", error);
        alert(`❌ Flight-plan processing failed:\n${error?.message ?? String(error)}`);
        setStatus("error");
        throw error;
      }
    },
    [map, elevationService, processFlightPlan, setFlightPlan, onPlanUploaded, onClose]
  );

  /** handle file drop */
  const onDrop = useCallback(
    async (files: File[]) => {
      const f = files[0];
      setFileName(f.name);
      setStatus("uploading");
      setProgress(0);

      try {
        let raw: FlightPlanData;
        const ext = f.name.split(".").pop()?.toLowerCase();
        
        setProgress(10);
        
        if (ext === "kmz") {
          raw = await parseKMZFile(f);
        } else {
          const txt = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = () => rej();
            r.readAsText(f);
          });
          
          if (ext === "waypoints") raw = parseQGCFile(txt);
          else if (ext === "geojson") raw = parseGeoJSONFile(txt);
          else if (ext === "kml") raw = parseKMLFile(txt, f);
          else throw new Error("Unsupported file type");
        }
        
        setProgress(20);
        
        await processAndStore(
          { ...raw, properties: { ...raw.properties, processed: false } },
          f.name
        );
      } catch (error: any) {
        console.error("🌶️ onDrop catch:", error);
        alert(`❌ Upload failed:\n${error?.message ?? String(error)}`);
        setStatus("error");
        setProgress(0);
      }
    },
    [processAndStore]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".waypoints"],
      "application/json": [".geojson"],
      "application/vnd.google-earth.kml+xml": [".kml"],
      "application/vnd.google-earth.kmz": [".kmz"]
    }
  });

  /** load built‑in example */
  const loadExample = useCallback(async () => {
    setStatus("uploading");
    setProgress(0);
    
    try {
      setProgress(10);
      const res = await fetch("/example.geojson");
      const data = await res.json();
      
      setProgress(30);
      const raw = parseGeoJSONFile(JSON.stringify(data));
      
      await processAndStore(
        { ...raw, properties: { ...raw.properties, processed: false } },
        "example.geojson"
      );
    } catch (error) {
      console.error("Example loading error:", error);
      setStatus("error");
      setProgress(0);
    }
  }, [processAndStore]);

  return (
    <div className="w-full max-w-2xl bg-white p-4 rounded-lg shadow-lg border border-gray-300">
      <h3 className="text-md font-semibold text-gray-800 mb-4">Upload Flight Plan</h3>
      <p className="text-xs text-gray-600 mb-4">
        Upload a <strong>.waypoints</strong>, <strong>.geojson</strong>, <strong>.kml</strong>, or <strong>.kmz</strong> file to analyze your drone flight path.
      </p>
  
      <MapLoadingGuard
        fallback={
          <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-300">
            <p className="text-sm text-gray-600">Waiting for map to initialize...</p>
            <div className="mt-4 w-8 h-8 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin" />
            <p className="mt-2 text-xs text-gray-400">This may take a moment</p>
          </div>
        }
      >
        <div
          {...getRootProps()}
          className="p-6 bg-gray-50 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer flex flex-col items-center justify-center"
        >
          <input {...getInputProps()} />
          <p className="text-xs text-gray-600">Drop your flight plan file here or click to select</p>
          {fileName && (
            <p className="mt-2 text-xs text-gray-700">Selected file: {fileName}</p>
          )}
          {(status === "uploading" || isProcessing) && (
            <div className="mt-3 w-full">
              <p className="text-xs text-blue-600 mb-1">Processing file... {progress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
          {status === "processed" && (
            <p className="mt-2 text-xs text-green-500">File processed successfully!</p>
          )}
          {status === "error" && (
            <p className="mt-2 text-xs text-red-500">Error processing file: {error ?? "Please try again."}</p>
          )}
        </div>
  
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => {
              trackEvent("example_geojson_click", { panel: "flightplanuploader.tsx" });
              loadExample();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors text-sm"
          >
            Load Example Flight Plan
          </button>
        </div>
      </MapLoadingGuard>
    </div>
  );
};

export default FlightPlanUploader;