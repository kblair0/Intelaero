/**
 * src/app/context/AnalysisControllerContext.tsx
 * 
 * Purpose:
 * Central controller for managing analysis state and coordination between different analysis tools.
 * Acts as a communication layer between map, analysis panels, and various tools.
 * 
 * Features:
 * - Provides shared references to analysis utilities
 * - Manages global UI states like modals that need to be rendered at the app level
 * - Coordinates analysis triggers and results across components
 * 
 * Related Files:
 * - page.tsx: Consumes this context to render app-level modals
 * - VisibilityAnalysisDashboard.tsx: Uses this context to trigger modals
 */

import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';

// Define the shape of the context
interface AnalysisControllerContextType {
  gridAnalysisRef: React.RefObject<any>;
  showMarkerLocationsModal: boolean;
  setShowMarkerLocationsModal: React.Dispatch<React.SetStateAction<boolean>>;
  // Add other analysis controller states and methods as needed
}

// Create the context with a default value
const AnalysisControllerContext = createContext<AnalysisControllerContextType | undefined>(undefined);

// Provider component
interface AnalysisControllerProviderProps {
  children: ReactNode;
}

export const AnalysisControllerProvider: React.FC<AnalysisControllerProviderProps> = ({ children }) => {
  // Reference to the grid analysis component
  const gridAnalysisRef = useRef(null);
  
  // State for controlling marker locations modal visibility
  const [showMarkerLocationsModal, setShowMarkerLocationsModal] = useState(false);

  // Context value
  const value = {
    gridAnalysisRef,
    showMarkerLocationsModal,
    setShowMarkerLocationsModal,
    // Add other controller values as needed
  };

  return (
    <AnalysisControllerContext.Provider value={value}>
      {children}
    </AnalysisControllerContext.Provider>
  );
};

// Custom hook for using the context
export const useAnalysisController = () => {
  const context = useContext(AnalysisControllerContext);
  if (context === undefined) {
    throw new Error('useAnalysisController must be used within an AnalysisControllerProvider');
  }
  return context;
};