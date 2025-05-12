"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Interface for a single checklist step
 */
interface ChecklistStep {
  label: string; // User-friendly name (e.g., 'Open Terrain Tools')
  action: string; // Instructions (e.g., 'Click on the Terrain Analysis card...')
  target: {
    component: string; // Target component (e.g., 'PlanVerificationDashboard')
    action: string; // Action identifier (e.g., 'openTerrainTools')
  };
}

/**
 * Interface for a single checklist item
 */
interface ChecklistItem extends ChecklistStep {
  id: string; // Unique ID for the step (e.g., 'terrainProfile-0')
  status: 'pending' | 'completed'; // Completion status
  group: string; // Analysis group (e.g., 'terrainProfile')
}

/**
 * Interface for ChecklistContext
 */
interface ChecklistContextProps {
  checks: ChecklistItem[];
  addChecks: (analyses: string[]) => void;
  completeCheck: (id: string) => void;
  resetChecks: () => void;
  guidedTarget: { component: string; action: string } | null;
  setGuidedTarget: (target: { component: string; action: string } | null) => void;
  actionToPanelMap: Record<string, 'terrain' | 'los' | 'energy' | null>;
}

const ChecklistContext = createContext<ChecklistContextProps | undefined>(undefined);

/**
 * Provides checklist state and methods
 * @param children - React components to render within the provider
 */
export const ChecklistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [checks, setChecks] = useState<ChecklistItem[]>([]);
  const [guidedTarget, setGuidedTarget] = useState<{ component: string; action: string } | null>(null);

/**
 * Mapping of analysis IDs to checklist steps
 */
const analysisToChecklistSteps: Record<string, ChecklistStep[]> = {
  terrainProfile: [
    {
      label: 'Run Terrain Profile Analysis in AO',
      action: 'Click the "Analyse Terrain Profile in AO" button under Terrain Analysis Tools',
      target: { component: 'TerrainAnalysisCard', action: 'analyseTerrainInAO' },
    },
  ],
  observerVsTerrain: [
    {
      label: 'Place Observer Marker',
      action: 'Click the "Add Observer" button on the map and select a location',
      target: { component: 'MarkerControls', action: 'addObserver' },
    },
    {
      label: 'Run Observer vs Terrain Analysis',
      action: 'Click the "Analyse Terrain Profile in AO" button under Visibility Analysis Tools with Observer marker placed',
      target: { component: 'AnalysisDashboard', action: 'analyseObserverVsTerrain' },
    },
  ],
  gcsRepeaterVsTerrain: [
    {
      label: 'Place GCS or Repeater Marker',
      action: 'Click the "Add Ground Station" or "Add Repeater" button on the map',
      target: { component: 'MarkerControls', action: 'addGCSorRepeater' },
    },
    {
      label: 'Run GCS/Repeater vs Terrain Analysis',
      action: 'Click the "Analyse Terrain Profile in AO" button under Visibility Analysis Tools with GCS/Repeater marker placed',
      target: { component: 'AnalysisDashboard', action: 'analyseGCSRepeaterVsTerrain' },
    },
  ],
  flightPathVsTerrain: [
    {
      label: 'Run Flight Path vs Terrain Analysis',
      action: 'Click the "Analyse Terrain Obstacles" button under Visibility Analysis Tools',
      target: { component: 'AnalysisDashboard', action: 'analyseFlightPathVsTerrain' },
    },
  ],
  powerline: [
    {
      label: 'Toggle Powerlines',
      action: 'Click the "Show Powerlines" button under Terrain Analysis Tools',
      target: { component: 'TerrainAnalysisCard', action: 'togglePowerlines' },
    },
  ],
  airspace: [
    {
      label: 'Toggle Airspace Overlay',
      action: 'Toggle Airspace Overlay',
      target: { component: 'LayerControls', action: 'toggleAirspace' },
    },
  ],
  observerToDrone: [
    {
      label: 'Place Observer Marker',
      action: 'Click the "Add Observer" button on the map and select a location',
      target: { component: 'MarkerControls', action: 'addObserver' },
    },
    {
      label: 'Run Observer to Drone Analysis',
      action: 'Click the "Station Analysis" section and run the Observer analysis',
      target: { component: 'AnalysisDashboard', action: 'observerToDrone' },
    },
  ],
  antennaToDrone: [
    {
      label: 'Place GCS or Repeater Marker',
      action: 'Click the "Add Ground Station" or "Add Repeater" button on the map',
      target: { component: 'MarkerControls', action: 'addGCSorRepeater' },
    },
    {
      label: 'Run Antenna to Drone Analysis',
      action: 'Click the "Station Analysis" section and run the GCS or Repeater analysis',
      target: { component: 'AnalysisDashboard', action: 'antennaToDrone' },
    },
  ],
  droneToGround: [
    {
      label: 'Upload Flight Plan',
      action: 'Click the "Upload Flight Plan" button and select a file',
      target: { component: 'LayerControls', action: 'uploadFlightPlan' },
    },
    {
      label: 'Run Drone to Ground Analysis',
      action: 'Click the "Merged Analysis" section and run the analysis',
      target: { component: 'AnalysisDashboard', action: 'droneToGround' },
    },
  ],
  antennaToAntenna: [
    {
      label: 'Place Two Markers (GCS/Repeater)',
      action: 'Click the "Add Ground Station" and "Add Repeater" buttons on the map',
      target: { component: 'MarkerControls', action: 'addGCSorRepeater' },
    },
    {
      label: 'Run Antenna to Antenna Analysis',
      action: 'Click the "Station-to-Station LOS" section and run the analysis',
      target: { component: 'AnalysisDashboard', action: 'antennaToAntenna' },
    },
  ],
};

/**
 * Mapping of checklist actions to MapSidePanel names
 */
const actionToPanelMap: Record<string, 'terrain' | 'los' | 'energy' | null> = {
  analyseTerrainInAO: 'terrain',
  analyseObserverVsTerrain: 'los',
  analyseGCSRepeaterVsTerrain: 'los',
  analyseFlightPathVsTerrain: 'los',
  togglePowerlines: 'terrain',
  addObserver: 'terrain',
  addGCSorRepeater: 'terrain',
  uploadFlightPlan: 'terrain',
  openLayerControls: null,
  toggleAirspace: 'terrain',
  observerToDrone: 'los',
  antennaToDrone: 'los',
  droneToGround: 'los',
  antennaToAntenna: 'los',
};

  /**
   * Adds checklist items based on selected analyses
   * @param analyses - Array of analysis IDs from AnalysisWizard
   */
  const addChecks = useCallback((analyses: string[]) => {
    const newChecks: ChecklistItem[] = analyses
      .filter((id) => analysisToChecklistSteps[id]) // Ensure valid analysis IDs
      .flatMap((analysisId) => {
        const steps = analysisToChecklistSteps[analysisId];
        return steps.map((step, index) => ({
          id: `${analysisId}-${index}`,
          group: analysisId,
          ...step,
          status: 'pending' as const,
        }));
      });
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
    setGuidedTarget(null);
    console.log('[ChecklistContext] Reset checks');
  }, []);

  const contextValue: ChecklistContextProps = {
    checks,
    addChecks,
    completeCheck,
    resetChecks,
    guidedTarget,
    setGuidedTarget,
    actionToPanelMap,
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