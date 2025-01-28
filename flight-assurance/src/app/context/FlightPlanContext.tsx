/* eslint-disable @typescript-eslint/no-explicit-any */
// context/FlightPlanContext.tsx
import React, { createContext, useState, useContext } from "react";

type FlightPlanData = Record<string, any>; // Replace `any` with a more specific type if needed

interface FlightPlanContextProps {
  flightPlan: FlightPlanData | null;
  setFlightPlan: (data: FlightPlanData) => void;
}

const FlightPlanContext = createContext<FlightPlanContextProps | undefined>(
  undefined
);

export const FlightPlanProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [flightPlan, setFlightPlan] = useState<FlightPlanData | null>(null);

  return (
    <FlightPlanContext.Provider value={{ flightPlan, setFlightPlan }}>
      {children}
    </FlightPlanContext.Provider>
  );
};

export const useFlightPlanContext = (): FlightPlanContextProps => {
  const context = useContext(FlightPlanContext);
  if (!context) {
    throw new Error(
      "useFlightPlanContext must be used within a FlightPlanProvider"
    );
  }
  return context;
};
