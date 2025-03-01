// FlightPlanContext.tsx
import React, { createContext, useState, useContext } from "react";

/**
 * WaypointData with unified altitude mode
 */
export interface WaypointData {
  index: number;
  altitudeMode: "terrain" | "relative" | "absolute"; // Single source of truth for altitude interpretation
  originalAltitude: number; // Raw altitude from file
  commandType?: number; // Optional for MAVLink compatibility (e.g., .waypoints)
  frame?: number; // Optional for MAVLink compatibility
}

/**
 * FlightPlanFeature with simplified properties
 */
export interface FlightPlanFeature extends GeoJSON.Feature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number, number][]; // [lon, lat, alt]
  };
  properties: {
    waypoints: WaypointData[]; // Waypoint details
    originalCoordinates?: [number, number, number][]; // Post-processed original waypoints
  };
}

/**
 * FlightPlanData with streamlined top-level properties
 */
export interface FlightPlanData extends GeoJSON.FeatureCollection {
  properties: {
    homePosition: {
      longitude: number;
      latitude: number;
      altitude: number;
    };
    config?: { [key: string]: any }; // Flexible mission settings (e.g., takeoffHeight, speed from KMZ)
    metadata?: { [key: string]: any }; // Flexible audit data (e.g., timestamps, distance)
    totalDistance?: number; // Total flight path length
    processed?: boolean; // Processing state
  };
  features: FlightPlanFeature[];
  waypointDistances?: number[]; // Cumulative distances
}

/**
 * Context interface
 */
interface FlightPlanContextProps {
  flightPlan: FlightPlanData | null;
  setFlightPlan: (data: FlightPlanData) => void;
  distance: number | null;
  setDistance: (distance: number) => void;
}

const FlightPlanContext = createContext<FlightPlanContextProps | undefined>(undefined);

export const FlightPlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flightPlan, setFlightPlanState] = useState<FlightPlanData | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  const updateFlightPlan = (data: FlightPlanData) => {
    setFlightPlanState((prev) => ({
      ...prev,
      ...data,
      properties: {
        ...prev?.properties,
        ...data.properties,
        processed: data.properties?.processed ?? prev?.properties?.processed ?? false,
      },
    }));
    setDistance(data.properties?.totalDistance ?? null);
  };

  return (
    <FlightPlanContext.Provider
      value={{
        flightPlan,
        setFlightPlan: updateFlightPlan,
        distance,
        setDistance,
      }}
    >
      {children}
    </FlightPlanContext.Provider>
  );
};

export const useFlightPlanContext = (): FlightPlanContextProps => {
  const context = useContext(FlightPlanContext);
  if (!context) {
    throw new Error("useFlightPlanContext must be used within a FlightPlanProvider");
  }
  return context;
};