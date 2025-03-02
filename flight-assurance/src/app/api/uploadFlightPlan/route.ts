// src/app/api/uploadFlightPlan/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOMParser } from 'xmldom';
import type { FlightPlanData, WaypointData, FlightPlanFeature } from '../context/FlightPlanContext';

// Resolve the current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your service account key JSON file
const KEYFILEPATH = path.join(process.cwd(), 'src/app/api/uploadFlightPlan/intel-aero-452003-05940784a3d3.json');

// Define scopes for Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Initialize GoogleAuth with your service account credentials
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

// ----- Parser Implementations -----

// Define an interface for the home position handler in the QGC parser.
interface HomeHandler {
  homePosition: { latitude: number; longitude: number; altitude: number; };
  takeoffAltitude: number | null;
  processWaypoint: (index: number, command: number, alt: number, lat: number, lon: number) => void;
  getHomePosition: () => { latitude: number; longitude: number; altitude: number; };
}

// QGC .waypoints Parser
function parseQGCFile(content: string): FlightPlanData {
  const lines = content.trim().split("\n");

  if (!lines[0].includes("QGC WPL 110")) {
    throw new Error("Invalid .waypoints file. Missing QGC WPL 110 header.");
  }

  const homeHandler: HomeHandler = { 
    homePosition: { latitude: 0, longitude: 0, altitude: 0 },
    takeoffAltitude: null,
    processWaypoint(index: number, command: number, alt: number, lat: number, lon: number) {
      if (index === 0) {
        this.homePosition = { latitude: lat, longitude: lon, altitude: alt };
      }
      if (command === 22) {
        this.takeoffAltitude = alt;
      }
    },
    getHomePosition() {
      return this.takeoffAltitude !== null
        ? { ...this.homePosition, altitude: this.takeoffAltitude }
        : this.homePosition;
    }
  };

  const waypoints: WaypointData[] = [];
  const coordinates: [number, number, number][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    if (parts.length < 12) continue;

    const index = parseInt(parts[0], 10);
    const frame = parseInt(parts[2], 10);
    const command = parseInt(parts[3], 10);
    const params = parts.slice(4, 8).map(parseFloat);
    const lat = parseFloat(parts[8]);
    const lon = parseFloat(parts[9]);
    const alt = parseFloat(parts[10]);

    // Simple altitude mode logic
    const altitudeMode = frame === 3 ? "relative" : frame === 10 ? "terrain" : "absolute";

    homeHandler.processWaypoint(index, command, alt, lat, lon);

    waypoints.push({ index, altitudeMode, originalAltitude: alt, commandType: command, frame, params });

    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      coordinates.push([lon, lat, alt]);
    } else {
      console.log(`Skipping invalid coordinate at index ${index}: lat=${lat}, lon=${lon}`);
    }
  }

  const homePosition = homeHandler.getHomePosition();

  if (coordinates.length < 2) {
    throw new Error("Flight plan must contain at least 2 valid coordinates.");
  }

  const feature: FlightPlanFeature = {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {
      name: "Drone Flight Path",
      originalAltitudes: coordinates.map(c => c[2]),
      altitudeModes: waypoints.map(w => w.altitudeMode),
      rawCommands: waypoints.map(w => w.commandType),
      waypoints,
    }
  };

  return {
    type: "FeatureCollection",
    properties: { homePosition },
    features: [feature]
  };
}
function parseKMLFile(kmlText: string): FlightPlanData {
  const parser = new DOMParser();
  const kmlDom = parser.parseFromString(kmlText, "application/xml");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojsonResult = (window as any).togeojson?.kml(kmlDom) as GeoJSON.FeatureCollection;



  let lineStringCoords: [number, number, number][] = [];
  let name = "KML Flight Path";

  for (const feature of geojsonResult.features) {
    if (feature.geometry?.type === "LineString") {
      lineStringCoords = feature.geometry.coordinates.map(([lon, lat, alt]) => [lon, lat, alt ?? 0]);
      name = feature.properties?.name || name;
      break;
    }
  }

  if (!lineStringCoords.length) throw new Error("No LineString geometry found in KML");

  const feature: FlightPlanFeature = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: lineStringCoords },
    properties: {
      name,
      originalAltitudes: lineStringCoords.map(c => c[2]),
      altitudeModes: Array(lineStringCoords.length).fill("absolute"),
      rawCommands: Array(lineStringCoords.length).fill(16),
      waypoints: lineStringCoords.map((coord, index) => ({
        index,
        altitudeMode: "absolute",
        originalAltitude: coord[2],
        commandType: 16,
        frame: 0,
        params: [],
      })),
    }
  };

  return {
    type: "FeatureCollection",
    properties: { homePosition: inferHomePosition(lineStringCoords) },
    features: [feature]
  };
}

// GeoJSON Parser
function parseGeoJSONFile(geojsonText: string): FlightPlanData {
  const geojsonResult = JSON.parse(geojsonText) as GeoJSON.FeatureCollection;
  if (!geojsonResult.features || geojsonResult.features.length === 0) {
    throw new Error("Invalid GeoJSON: No features found.");
  }

  const flightFeature = geojsonResult.features.find(f => f.geometry?.type === "LineString");
  if (!flightFeature) throw new Error("No valid flight path found in GeoJSON.");

  const coordinates = flightFeature.geometry.coordinates as [number, number, number][];
  flightFeature.properties = {
    ...flightFeature.properties,
    originalAltitudes: coordinates.map(c => c[2]),
    altitudeModes: Array(coordinates.length).fill("absolute"),
    rawCommands: Array(coordinates.length).fill(16),
    waypoints: coordinates.map((coord, index) => ({
      index,
      altitudeMode: "absolute",
      originalAltitude: coord[2],
      commandType: 16,
      frame: 0,
      params: [],
    })),
  };

  return {
    type: "FeatureCollection",
    properties: { homePosition: inferHomePosition(coordinates) },
    features: [flightFeature as FlightPlanFeature],
  };
}

// Helper to infer home position from coordinates
function inferHomePosition(coordinates: [number, number, number][]) {
  if (!coordinates.length) return null;
  const [lon, lat, alt] = coordinates[0];
  return { latitude: lat, longitude: lon, altitude: alt ?? 0 };
}

// ----- API Route Handler -----
export async function POST(request: Request) {
  try {
    const { fileName, fileContent, fileExtension } = await request.json();

    // In development mode, skip the upload.
    if (process.env.NODE_ENV === 'development') {
      console.log("Localhost environment detected - skipping Drive upload.");
      return NextResponse.json({
        message: "Test environment: upload skipped.",
        file: { id: "test-dummy-id" }
      });
    }

    let processedData: FlightPlanData;

    if (fileExtension === 'kml') {
      processedData = parseKMLFile(fileContent);
    } else if (fileExtension === 'geojson') {
      processedData = parseGeoJSONFile(fileContent);
    } else if (fileExtension === 'waypoints' || fileExtension === 'waypoint') {
      processedData = parseQGCFile(fileContent);
    } else {
      return NextResponse.json({ message: 'Unsupported file type.' }, { status: 400 });
    }

    const uploadContent = JSON.stringify(processedData, null, 2);
    const driveFolderId = '1ByfmPZ62Q8q8H4pi06Onn1WebMIK7P7F';

    const driveResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/json',
        parents: [driveFolderId],
      },
      media: {
        mimeType: 'application/json',
        body: uploadContent,
      },
    });

    return NextResponse.json({
      message: 'Upload successful!',
      file: driveResponse.data,
    });
  } catch (error: unknown) {
    console.error('Upload failed:', error);
    return NextResponse.json({ message: 'Upload failed', error: String(error) }, { status: 500 });
  }
}
