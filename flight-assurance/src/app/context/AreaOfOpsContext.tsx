// src/context/AreaOfOpsContext.tsx
"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface AreaOfOpsContextType {
  aoGeometry: GeoJSON.FeatureCollection | null;
  setAoGeometry: (geometry: GeoJSON.FeatureCollection | null) => void;
  aoTerrainGrid: GridCell[] | null; // Add this for storing the grid
  setAoTerrainGrid: (grid: GridCell[] | null) => void; // Setter for the grid
  generateAO: () => void;
}

interface GridCell {
  id: string;
  geometry: GeoJSON.Polygon;
  properties: {
    elevation: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any; // Allow additional properties for flexibility
  };
}

const AreaOfOpsContext = createContext<AreaOfOpsContextType | undefined>(undefined);

export const AreaOfOpsProvider = ({ children }: { children: ReactNode }) => {
  const [aoGeometry, setAoGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [aoTerrainGrid, setAoTerrainGrid] = useState<GridCell[] | null>(null); // New state

  const generateAO = () => {
    // Existing AO generation logic (if any) remains unchanged
    console.log("Generate AO called (placeholder)");
  };

  return (
    <AreaOfOpsContext.Provider
      value={{ aoGeometry, setAoGeometry, aoTerrainGrid, setAoTerrainGrid, generateAO }}
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
