import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Interface for waypoint data
 */
export interface WaypointData {
  index: number;
  altitudeMode: "terrain" | "relative" | "absolute";
  originalAltitude: number;
  commandType?: number;
  frame?: number;
  params?: number[];
}

/**
 * Interface for flight plan configuration
 */
export interface FlightPlanConfig {
  takeoffHeight?: number;
  speed?: number;
  finishAction?: string;
}

/**
 * Interface for flight plan metadata
 */
export interface FlightPlanMetadata {
  created?: number;
  updated?: number;
  distance?: number;
  processed: boolean;
  source?: string;
  metadata?: { file?: Record<string, any>; segments?: Record<string, any>[] };
}

/**
 * Interface for flight plan feature
 */
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

/**
 * Interface for flight plan data
 */
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
  originalWaypointDistances?: number[];
}

/**
 * Interface for FlightPlanContext
 */
interface FlightPlanContextProps {
  flightPlan: FlightPlanData | null;
  setFlightPlan: (data: FlightPlanData) => void;
  distance: number | null;
  setDistance: (distance: number) => void;
  isProcessed: boolean;
  setProcessed: (processed: boolean) => void;
}

const FlightPlanContext = createContext<FlightPlanContextProps | undefined>(undefined);

/**
 * Provides flight plan state and methods
 * @param children - React components to render within the provider
 */
export const FlightPlanProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [flightPlan, setFlightPlanState] = useState<FlightPlanData | null>(null);
  const [distance, setDistanceState] = useState<number | null>(null);
  const [isProcessed, setProcessedState] = useState(false);

  const setFlightPlan = useCallback((data: FlightPlanData) => {
    const planId =
      data.properties?.metadata?.source ||
      data.properties?.metadata?.created?.toString() ||
      'unknown';

    console.groupCollapsed(`[FlightPlanContext] setFlightPlan (${planId})`);
    console.time('[FlightPlanContext] ⏱ setFlightPlan');

    // Critical summary of incoming data
    console.log('▶ Incoming summary', {
      features: data.features.length,
      geometry: data.features[0]?.geometry.type,
      totalDistance: data.properties?.totalDistance,
      processed: data.properties?.processed,
    });

    setFlightPlanState(prev => {
      const updated = {
        ...prev,
        ...data,
        properties: {
          ...prev?.properties,
          ...data.properties,
          processed: data.properties?.processed ?? prev?.properties?.processed ?? false,
        },
      } as FlightPlanData;
      console.log('✅ Flight plan state prepared');
      return updated;
    });

    setDistanceState(data.properties?.totalDistance ?? null);
    console.log('ℹ️ Distance state updated →', data.properties?.totalDistance ?? null);

    setProcessedState(Boolean(data.properties?.processed));
    console.log('ℹ️ Processed state updated →', Boolean(data.properties?.processed));

  
    console.timeEnd('[FlightPlanContext] ⏱ setFlightPlan');
    console.groupEnd();
  }, []);

  const setDistance = useCallback((distance: number) => {
    console.log('[FlightPlanContext] setDistance →', distance);
    setDistanceState(distance);
  }, []);

  const setProcessed = useCallback((processed: boolean) => {
    console.log('[FlightPlanContext] setProcessed →', processed);
    setProcessedState(processed);
  }, []);

  const contextValue: FlightPlanContextProps = {
    flightPlan,
    setFlightPlan,
    distance,
    setDistance,
    isProcessed,
    setProcessed,
  };

  return <FlightPlanContext.Provider value={contextValue}>{children}</FlightPlanContext.Provider>;
};

/**
 * Hook to access the FlightPlanContext
 * @returns The FlightPlanContext properties
 * @throws Error if used outside of FlightPlanProvider
 */
export const useFlightPlanContext = (): FlightPlanContextProps => {
  const context = useContext(FlightPlanContext);
  if (!context) throw new Error('useFlightPlanContext must be used within a FlightPlanProvider');
  return context;
};
