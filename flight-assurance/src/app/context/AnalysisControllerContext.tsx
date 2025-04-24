"use client";
import React, { createContext, useContext, ReactNode, useRef } from "react";
import type { GridAnalysisRef } from "../components/Analyses/Services/GridAnalysis/GridAnalysisController";

interface AnalysisControllerContextType {
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}

const AnalysisControllerContext = createContext<AnalysisControllerContextType | undefined>(undefined);

export const AnalysisControllerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const gridAnalysisRef = useRef<GridAnalysisRef>(null);

  return (
    <AnalysisControllerContext.Provider value={{ gridAnalysisRef }}>
      {children}
    </AnalysisControllerContext.Provider>
  );
};

export function useAnalysisController() {
  const context = useContext(AnalysisControllerContext);
  if (!context) {
    throw new Error("useAnalysisController must be used within an AnalysisControllerProvider");
  }
  return context;
}
