import React, { createContext, useContext, useState } from "react";

export interface ObstacleAnalysisOutput {
  flightAltitudes: number[];
  terrainElevations: number[];
  distances: number[];
  minimumClearanceHeight: number;
  highestObstacle: number;
  error?: string | null;
}

interface ObstacleAnalysisContextProps {
  analysisData: ObstacleAnalysisOutput | null;
  setAnalysisData: (data: ObstacleAnalysisOutput | null) => void;
}

const ObstacleAnalysisContext = createContext<ObstacleAnalysisContextProps | undefined>(undefined);

export const ObstacleAnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [analysisData, setAnalysisData] = useState<ObstacleAnalysisOutput | null>(null);

  return (
    <ObstacleAnalysisContext.Provider value={{ analysisData, setAnalysisData }}>
      {children}
    </ObstacleAnalysisContext.Provider>
  );
};

export const useObstacleAnalysis = (): ObstacleAnalysisContextProps => {
  const context = useContext(ObstacleAnalysisContext);
  if (!context) {
    throw new Error("useObstacleAnalysis must be used within an ObstacleAnalysisProvider");
  }
  return context;
};
