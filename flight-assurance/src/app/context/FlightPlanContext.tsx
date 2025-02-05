import React, { createContext, useState, useContext } from "react";

/**
 * Data structure for a single waypoint, preserving raw fields from QGC:
 *   - index: waypoint index in the mission
 *   - altitudeMode: "relative" (AGL), "terrain", or "absolute" (MSL)
 *   - originalAltitude: the altitude value as read from the .waypoints file
 *   - commandType: MAVLink command type (e.g., 16 = NAV_WAYPOINT, 22 = TAKEOFF, etc.)
 *   - frame: the raw MAV_FRAME (0, 3, 10, etc.)
 *   - params: array of param1..param4 from the QGC file
 */
export interface WaypointData {
  index: number;
  altitudeMode: "relative" | "terrain" | "absolute";
  originalAltitude: number;
  commandType: number;
  frame: number;
  params: number[];
}

/**
 * Each feature in our flight plan can store:
 *   - geometry with raw [lon, lat, alt] from the QGC file
 *   - waypoint details in properties.waypoints
 */
export interface FlightPlanFeature extends GeoJSON.Feature {
  type: "Feature";
  geometry: {
    type: "LineString";
    // Raw altitudes directly from the QGC file (not yet resolved or corrected)
    coordinates: [number, number, number][];
  };
  properties: {
    name: string;
    // Entire array of altitudes, matching coordinates
    originalAltitudes: number[];
    // The altitude modes for each waypoint (optional but can be useful)
    altitudeModes: WaypointData["altitudeMode"][];
    // The raw MAVLink command types
    rawCommands: number[];
    // Detailed waypoint data
    waypoints: WaypointData[];
  };
}

/**
 * Main FlightPlanData extends GeoJSON.FeatureCollection with:
 *   - properties containing home position
 *   - a features[] array of flight plan segments (usually just 1 for a single route)
 */
export interface FlightPlanData extends GeoJSON.FeatureCollection {
  properties: {
    homePosition: {
      latitude: number;
      longitude: number;
      altitude: number;
    };
  };
  features: FlightPlanFeature[];
  waypointDistances?: number[];
  totalDistance?: number;
  processed?: boolean;
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
    setFlightPlanState(data);
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
