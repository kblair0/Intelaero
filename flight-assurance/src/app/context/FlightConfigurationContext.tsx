// context/FlightConfigurationContext.tsx
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
  const { distance: flightPlanDistance } = useFlightPlanContext();
  
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
    estimatedDistance: 0
  });

  const calculateMetrics = useCallback(() => {
    const batteryCapacity = parseFloat(config.batteryCapacity) || 0;
    const dischargeRate = parseFloat(config.dischargeRate) || 0;
    const assumedSpeed = parseFloat(config.assumedSpeed) || 20;
    const flightTimeMinutes = batteryCapacity / dischargeRate || 0;
    const maxDistance = (flightTimeMinutes / 60) * assumedSpeed;

    const newMetrics = {
      flightTime: formatFlightTime(flightTimeMinutes),
      maxDistance,
      reserveTime: "0:00",
      batteryReserve: "0%",
      isFeasible: true,
      estimatedDistance: maxDistance
    };

    if (flightPlanDistance) {
      const flightPlanTimeMinutes = (flightPlanDistance / assumedSpeed) * 60;
      const reserveTimeMinutes = flightTimeMinutes - flightPlanTimeMinutes;
      const batteryReservePercent = ((maxDistance - flightPlanDistance) / flightPlanDistance) * 100;

      newMetrics.reserveTime = formatFlightTime(Math.max(0, reserveTimeMinutes));
      newMetrics.batteryReserve = `${batteryReservePercent.toFixed(2)}%`;
      newMetrics.isFeasible = maxDistance >= flightPlanDistance;
    }

    setMetrics(newMetrics);
  }, [config.batteryCapacity, config.dischargeRate, config.assumedSpeed, flightPlanDistance]);

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