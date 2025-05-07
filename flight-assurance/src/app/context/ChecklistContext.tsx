// src/context/ChecklistContext.tsx
"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Interface for a single checklist item
 */
interface ChecklistItem {
  id: string; // Matches analysis ID (e.g., 'terrainProfile')
  label: string; // User-friendly name (e.g., 'View the Terrain Profile')
  action: string; // Instructions (e.g., 'Click the "Show Terrain Profile" button...')
  status: 'pending' | 'completed'; // Completion status
  target: {
    component: string; // Target component (e.g., 'PlanVerificationDashboard')
    action: string; // Action identifier (e.g., 'showTerrainProfile')
  };
}

/**
 * Interface for ChecklistContext
 */
interface ChecklistContextProps {
  checks: ChecklistItem[];
  addChecks: (analyses: string[]) => void;
  completeCheck: (id: string) => void;
  resetChecks: () => void;
}

const ChecklistContext = createContext<ChecklistContextProps | undefined>(undefined);

/**
 * Provides checklist state and methods
 * @param children - React components to render within the provider
 */
export const ChecklistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [checks, setChecks] = useState<ChecklistItem[]>([]);

  /**
   * Mapping of analysis IDs to checklist items
   */
  const analysisToChecklistMap: Record<string, Omit<ChecklistItem, 'id' | 'status'>> = {
    terrainProfile: {
      label: 'View the Terrain Profile',
      action: 'Click the "Show Terrain Profile" button in the Plan Verification panel',
      target: { component: 'PlanVerificationDashboard', action: 'showTerrainProfile' },
    },
    observerVsTerrain: {
      label: 'Check Observer vs Terrain',
      action: 'Click the "Observer vs Terrain" button in the Plan Verification panel',
      target: { component: 'PlanVerificationDashboard', action: 'observerVsTerrain' },
    },
    gcsRepeaterVsTerrain: {
      label: 'Check GCS/Repeater vs Terrain',
      action: 'Click the "GCS/Repeater vs Terrain" button in the Plan Verification panel',
      target: { component: 'PlanVerificationDashboard', action: 'gcsRepeaterVsTerrain' },
    },
    flightPathVsTerrain: {
      label: 'Check Flight Path vs Terrain',
      action: 'Click the "Flight Path vs Terrain" button in the Plan Verification panel',
      target: { component: 'PlanVerificationDashboard', action: 'flightPathVsTerrain' },
    },
    powerline: {
      label: 'Check Powerline Proximity',
      action: 'Click the "Powerlines" button in the Plan Verification panel',
      target: { component: 'PlanVerificationDashboard', action: 'powerline' },
    },
    airspace: {
      label: 'Check Airspace Compliance',
      action: 'Click the "Airspace" button in the Plan Verification panel',
      target: { component: 'PlanVerificationDashboard', action: 'airspace' },
    },
    observerToDrone: {
      label: 'Analyze Observer to Drone Visibility',
      action: 'Open the LOS Analysis panel and run the "Observer to Drone" analysis',
      target: { component: 'AnalysisDashboard', action: 'observerToDrone' },
    },
    antennaToDrone: {
      label: 'Analyze Antenna to Drone Visibility',
      action: 'Open the LOS Analysis panel and run the "Antenna to Drone" analysis',
      target: { component: 'AnalysisDashboard', action: 'antennaToDrone' },
    },
    droneToGround: {
      label: 'Analyze Drone to Ground Visibility',
      action: 'Open the LOS Analysis panel and run the "Drone to Ground" analysis',
      target: { component: 'AnalysisDashboard', action: 'droneToGround' },
    },
    antennaToAntenna: {
      label: 'Analyze Antenna to Antenna Visibility',
      action: 'Open the LOS Analysis panel and run the "Antenna to Antenna" analysis',
      target: { component: 'AnalysisDashboard', action: 'antennaToAntenna' },
    },
  };

  /**
   * Adds checklist items based on selected analyses
   * @param analyses - Array of analysis IDs from AnalysisWizard
   */
  const addChecks = useCallback((analyses: string[]) => {
    const newChecks: ChecklistItem[] = analyses
      .filter((id) => analysisToChecklistMap[id]) // Ensure valid analysis IDs
      .map((id) => ({
        id,
        ...analysisToChecklistMap[id],
        status: 'pending',
      }));
    setChecks(newChecks);
    console.log('[ChecklistContext] Added checks:', newChecks);
  }, []);

  /**
   * Marks a checklist item as completed
   * @param id - The ID of the check to complete
   */
  const completeCheck = useCallback((id: string) => {
    setChecks((prev) =>
      prev.map((check) =>
        check.id === id ? { ...check, status: 'completed' } : check
      )
    );
    console.log(`[ChecklistContext] Completed check: ${id}`);
  }, []);

  /**
   * Resets the checklist
   */
  const resetChecks = useCallback(() => {
    setChecks([]);
    console.log('[ChecklistContext] Reset checks');
  }, []);

  const contextValue: ChecklistContextProps = {
    checks,
    addChecks,
    completeCheck,
    resetChecks,
  };

  return (
    <ChecklistContext.Provider value={contextValue}>
      {children}
    </ChecklistContext.Provider>
  );
};

/**
 * Hook to access the ChecklistContext
 * @returns The ChecklistContext properties
 * @throws Error if used outside of ChecklistProvider
 */
export const useChecklistContext = (): ChecklistContextProps => {
  const context = useContext(ChecklistContext);
  if (!context) {
    throw new Error('useChecklistContext must be used within a ChecklistProvider');
  }
  return context;
};