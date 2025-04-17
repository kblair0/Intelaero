import React, { createContext, useState, useContext } from "react";

export interface WaypointData {
  index: number;
  altitudeMode: "terrain" | "relative" | "absolute";
  originalAltitude: number;
  commandType?: number;
  frame?: number;
  params?: number[];
}

export interface FlightPlanConfig {
  takeoffHeight?: number;
  speed?: number;
  finishAction?: string;
}

export interface FlightPlanMetadata {
  created?: number;
  updated?: number;
  distance?: number;
  processed: boolean;
  source?: string;
  metadata?: { file?: Record<string, any>; segments?: Record<string, any>[] };
}

export interface FlightPlanFeature extends GeoJSON.Feature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number, number][];
  };
  properties: {
    waypoints: WaypointData[];
    originalCoordinates?: [number, number, number][];
  };
}

export interface FlightPlanData extends GeoJSON.FeatureCollection {
  properties: {
    homePosition: { longitude: number; latitude: number; altitude: number };
    config?: FlightPlanConfig;
    metadata?: FlightPlanMetadata;
    totalDistance?: number;
    processed?: boolean;
  };
  features: FlightPlanFeature[];
  waypointDistances?: number[];
}

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
    const planId =
      data.properties?.metadata?.source ||
      data.properties?.metadata?.created?.toString() ||
      `flight-plan-${Math.random().toString(36).slice(2)}`;

    setFlightPlanState(prev => ({
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

  const contextValue: FlightPlanContextProps = {
    flightPlan,
    setFlightPlan: updateFlightPlan,
    distance,
    setDistance,
  };

  return <FlightPlanContext.Provider value={contextValue}>{children}</FlightPlanContext.Provider>;
};

export const useFlightPlanContext = (): FlightPlanContextProps => {
  const context = useContext(FlightPlanContext);
  if (!context) throw new Error("useFlightPlanContext must be used within a FlightPlanProvider");
  return context;
};
