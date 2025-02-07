/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFlightPlanContext } from './FlightPlanContext';

interface ConfigState {
  batteryCapacity: string;
  dischargeRate: string;
  assumedSpeed: string;
  batteryReserveReq: string; 
}

interface MetricsState {
  flightTime: string;
  maxDistance: number;
  batteryReserve: string;
  isFeasible: boolean;
  estimatedDistance: number;
  flightPlanEstimatedTime: string;
  expectedBatteryConsumption: number;
  numberOfWaypoints: number;
  mainAltitudeMode: string;
  availableBatteryCapacity: number;
  remainingCapacity: number;
  remainingTime: string;
  totalEndurance: string;
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
  const { flightPlan, distance: flightPlanDistance } = useFlightPlanContext();
  
  const [config, setConfig] = useState<ConfigState>({
    batteryCapacity: "28000",
    dischargeRate: "700",
    assumedSpeed: "20",
    batteryReserveReq: "20"
  });

  const [metrics, setMetrics] = useState<MetricsState>({
    flightTime: "0:00",
    maxDistance: 0,
    batteryReserve: "0%",
    totalEndurance: "0:00",
    isFeasible: false,
    estimatedDistance: 0,
    flightPlanEstimatedTime: "0:00",
    expectedBatteryConsumption: 0,
    numberOfWaypoints: 0,
    mainAltitudeMode: "N/A",
    availableBatteryCapacity: 0,
    remainingCapacity: 0,
    remainingTime: "0:00"
});

  const calculateMetrics = useCallback(() => {
    // Parse input values
    const batteryCapacity = parseFloat(config.batteryCapacity) || 0;
    const dischargeRate = parseFloat(config.dischargeRate) || 0;
    const assumedSpeed = parseFloat(config.assumedSpeed) || 20;
    const reservePercentage = parseFloat(config.batteryReserveReq) || 20;

    // Battery calculations
    const reserveAmount = batteryCapacity * (reservePercentage / 100);
    const availableBatteryCapacity = batteryCapacity - reserveAmount;

    // Time calculations
    const availableFlightTime = availableBatteryCapacity / dischargeRate || 0;
    const totalFlightTime = batteryCapacity / dischargeRate || 0; 

    // Distance calculations
    const maxAvailableDistance = (availableFlightTime / 60) * assumedSpeed;

    // Initialize metrics object
    const newMetrics: MetricsState = {
        flightTime: formatFlightTime(availableFlightTime),
        maxDistance: maxAvailableDistance,
        batteryReserve: `${reservePercentage}%`,
        isFeasible: true,
        estimatedDistance: maxAvailableDistance,
        totalEndurance: formatFlightTime(totalFlightTime),
        flightPlanEstimatedTime: "0:00",
        expectedBatteryConsumption: 0,
        numberOfWaypoints: 0,
        mainAltitudeMode: "N/A",
        availableBatteryCapacity: Math.round(availableBatteryCapacity),
        remainingCapacity: Math.round(availableBatteryCapacity),
        remainingTime: formatFlightTime(availableFlightTime)
    };

    // Flight plan specific calculations
    if (flightPlanDistance) {
        const flightPlanTimeMinutes = (flightPlanDistance / assumedSpeed) * 60;
        const requiredBatteryCapacity = flightPlanTimeMinutes * dischargeRate;
        
        newMetrics.isFeasible = requiredBatteryCapacity <= availableBatteryCapacity;
        newMetrics.flightPlanEstimatedTime = formatFlightTime(flightPlanTimeMinutes);
        newMetrics.expectedBatteryConsumption = Math.round(requiredBatteryCapacity);
        
        // Calculate remaining capacity after flight plan
        const remainingCapacity = availableBatteryCapacity - requiredBatteryCapacity;
        newMetrics.remainingCapacity = Math.round(remainingCapacity);
        newMetrics.remainingTime = formatFlightTime(remainingCapacity / dischargeRate);
    }

    // Waypoint analysis
    if (flightPlan?.features?.[0]?.properties?.waypoints) {
        const waypoints = flightPlan.features[0].properties.waypoints;
        newMetrics.numberOfWaypoints = waypoints.length;

        if (waypoints.length > 2) {
            const mainSegment = waypoints.slice(1, -1);
            const modeCounts: Record<string, number> = {};
            
            mainSegment.forEach((wp: any) => {
                const mode = wp.altitudeMode;
                modeCounts[mode] = (modeCounts[mode] || 0) + 1;
            });

            newMetrics.mainAltitudeMode = Object.entries(modeCounts)
                .reduce((a, b) => a[1] > b[1] ? a : b)[0];
        }
    }

    setMetrics(newMetrics);
}, [
    config.batteryCapacity, 
    config.dischargeRate, 
    config.assumedSpeed, 
    config.batteryReserveReq,
    flightPlanDistance, 
    flightPlan
]);

  useEffect(() => {
    calculateMetrics();
  }, [calculateMetrics]);

  const updateConfig = useCallback((updates: Partial<ConfigState>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <FlightConfigurationContext.Provider value={{ config, metrics, updateConfig }}>
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