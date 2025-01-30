import React, { createContext, useState, useContext } from "react";

type FlightPlanData = Record<string, any>;

interface FlightPlanContextProps {
  flightPlan: FlightPlanData | null;
  setFlightPlan: (data: FlightPlanData) => void;
  distance: number | null; 
  setDistance: (distance: number) => void; // Add setter
}

const FlightPlanContext = createContext<FlightPlanContextProps | undefined>(undefined);

export const FlightPlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flightPlan, setFlightPlan] = useState<FlightPlanData | null>(null); // Fix destructuring
  const [distance, setDistance] = useState<number | null>(null); // Fix destructuring

  const updateFlightPlan = (data: FlightPlanData) => {
    setFlightPlan(data);
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