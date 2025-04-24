// src/context/AreaOfOpsContext.tsx
"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

export interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    elevation: number;
    [key: string]: any;
  };
}

interface AreaOfOpsContextType {
  aoGeometry: GeoJSON.FeatureCollection | null;
  setAoGeometry: (geometry: GeoJSON.FeatureCollection | null) => void;
  aoTerrainGrid: GridCell[] | null;
  setAoTerrainGrid: (grid: GridCell[] | null) => void;
  bufferDistance: number; // Add bufferDistance
  setBufferDistance: (distance: number) => void; // Add setter
}

const AreaOfOpsContext = createContext<AreaOfOpsContextType | undefined>(undefined);

export const AreaOfOpsProvider = ({ children }: { children: ReactNode }) => {
  const [aoGeometry, setAoGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [aoTerrainGrid, setAoTerrainGrid] = useState<GridCell[] | null>(null);
  const [bufferDistance, setBufferDistance] = useState<number>(500);  // Default buffer distance

  return (
    <AreaOfOpsContext.Provider
      value={{
        aoGeometry,
        setAoGeometry,
        aoTerrainGrid,
        setAoTerrainGrid,
        bufferDistance,
        setBufferDistance,  // Provide setter for buffer distance
      }}
    >
      {children}
    </AreaOfOpsContext.Provider>
  );
};

export const useAreaOfOpsContext = () => {
  const context = useContext(AreaOfOpsContext);
  if (!context) {
    throw new Error("useAreaOfOpsContext must be used within an AreaOfOpsProvider");
  }
  return context;
};