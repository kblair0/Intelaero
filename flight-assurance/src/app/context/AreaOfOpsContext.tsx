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
}

const AreaOfOpsContext = createContext<AreaOfOpsContextType | undefined>(undefined);

export const AreaOfOpsProvider = ({ children }: { children: ReactNode }) => {
  const [aoGeometry, setAoGeometry] = useState<GeoJSON.FeatureCollection | null>(null);
  const [aoTerrainGrid, setAoTerrainGrid] = useState<GridCell[] | null>(null);

  return (
    <AreaOfOpsContext.Provider
      value={{
        aoGeometry,
        setAoGeometry,
        aoTerrainGrid,
        setAoTerrainGrid
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