/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFlightPlanContext } from './FlightPlanContext';

interface ConfigState {
  batteryCapacity: string;
  dischargeRate: string;
  assumedSpeed: string;
}

interface MetricsState {
  flightTime: string;
  maxDistance: number;
  reserveTime: string;
  batteryReserve: string;
  isFeasible: boolean;
  estimatedDistance: number;
  flightPlanEstimatedTime: string;
  expectedBatteryConsumption: number;
  numberOfWaypoints: number;
  mainAltitudeMode: string;
}

interface FlightConfigurationContextType {
  config: ConfigState;
  metrics: MetricsState;
  updateConfig: (updates: Partial<ConfigState>) => void;
}

const FlightConfigurationContext = createContext<FlightConfigurationContextType | undefined>(undefined);

const formatFlightTime = (timeInMinutes: number): string => {
  const minutes = Math.floor(timeInMinutes);
  const seconds = Math.round((timeInMinutes - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export const FlightConfigurationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Destructure both flightPlan and flightPlanDistance from FlightPlanContext
  const { flightPlan, distance: flightPlanDistance } = useFlightPlanContext();
  
  const [config, setConfig] = useState<ConfigState>({
    batteryCapacity: "28000",
    dischargeRate: "700",
    assumedSpeed: "20"
  });

  const [metrics, setMetrics] = useState<MetricsState>({
    flightTime: "0:00",
    maxDistance: 0,
    reserveTime: "0:00",
    batteryReserve: "0%",
    isFeasible: false,
    estimatedDistance: 0,
    flightPlanEstimatedTime: "0:00",
    expectedBatteryConsumption: 0,
    numberOfWaypoints: 0,
    mainAltitudeMode: "N/A"
  });

  const calculateMetrics = useCallback(() => {
    const batteryCapacity = parseFloat(config.batteryCapacity) || 0;
    const dischargeRate = parseFloat(config.dischargeRate) || 0;
    const assumedSpeed = parseFloat(config.assumedSpeed) || 20;
    const flightTimeMinutes = batteryCapacity / dischargeRate || 0;
    const maxDistance = (flightTimeMinutes / 60) * assumedSpeed;

    const newMetrics: MetricsState = {
      flightTime: formatFlightTime(flightTimeMinutes),
      maxDistance,
      reserveTime: "0:00",
      batteryReserve: "0%",
      isFeasible: true,
      estimatedDistance: maxDistance,
      flightPlanEstimatedTime: "0:00",
      expectedBatteryConsumption: 0,
      numberOfWaypoints: 0,
      mainAltitudeMode: "N/A"
    };

    if (flightPlanDistance) {
      const flightPlanTimeMinutes = (flightPlanDistance / assumedSpeed) * 60;
      const reserveTimeMinutes = flightTimeMinutes - flightPlanTimeMinutes;
      const batteryReservePercent = ((maxDistance - flightPlanDistance) / flightPlanDistance) * 100;

      newMetrics.reserveTime = formatFlightTime(Math.max(0, reserveTimeMinutes));
      newMetrics.batteryReserve = `${batteryReservePercent.toFixed(2)}%`;
      newMetrics.isFeasible = maxDistance >= flightPlanDistance;
      newMetrics.flightPlanEstimatedTime = formatFlightTime(flightPlanTimeMinutes);
      newMetrics.expectedBatteryConsumption = Math.round(dischargeRate * flightPlanTimeMinutes);
    }

    // Calculate numberOfWaypoints and mainAltitudeMode from the flight plan if available
    if (flightPlan && flightPlan.features && flightPlan.features.length > 0) {
      const waypoints = flightPlan.features[0].properties?.waypoints;
      newMetrics.numberOfWaypoints = waypoints ? waypoints.length : 0;

      // For the main segment (excluding the first and last waypoints)
      if (waypoints && waypoints.length > 2) {
        const mainSegment = waypoints.slice(1, -1);
        // Tally the altitude modes for these waypoints
        const modeCounts: Record<string, number> = {};
        mainSegment.forEach((wp: any) => {
          const mode = wp.altitudeMode;
          modeCounts[mode] = (modeCounts[mode] || 0) + 1;
        });
        // Determine the most common mode
        let commonMode = "N/A";
        let maxCount = 0;
        Object.keys(modeCounts).forEach(mode => {
          if (modeCounts[mode] > maxCount) {
            maxCount = modeCounts[mode];
            commonMode = mode;
          }
        });
        newMetrics.mainAltitudeMode = commonMode;
      }
    }

    setMetrics(newMetrics);
  }, [config.batteryCapacity, config.dischargeRate, config.assumedSpeed, flightPlanDistance, flightPlan]);

  // Update metrics when config or flight plan distance changes
  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  const updateConfig = useCallback((updates: Partial<ConfigState>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <FlightConfigurationContext.Provider 
      value={{ 
        config, 
        metrics, 
        updateConfig
      }}
    >
      {children}
    </FlightConfigurationContext.Provider>
  );
};

export const useFlightConfiguration = () => {
  const context = useContext(FlightConfigurationContext);
  if (!context) {
    throw new Error('useFlightConfiguration must be used within a FlightConfigurationProvider');
  }
  return context;
};
