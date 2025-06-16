// src/context/DemoOrchestrationContext.tsx

/**
 * Purpose:
 * Central coordination context for automated demo flow. Manages the 4-step demo sequence:
 * 1. Load example flight plan via FlightPlanUploader forwardRef
 * 2. Place observer at fixed coordinates  
 * 3. Run terrain analysis
 * 4. Complete demo and show results
 * 
 * This context provides:
 * - Demo state management (step tracking, progress, messages)
 * - Coordination methods for triggering demo actions
 * - Error handling and recovery
 * - Integration with existing contexts and components via refs
 * 
 * Related Files:
 * - FlightPlanUploader.tsx: Handles flight plan loading via forwardRef
 * - MarkerContext.tsx: For placing observer markers
 * - AreaOfOpsContext.tsx: For terrain analysis
 * - ChecklistContext.tsx: For completing demo checks
 */

"use client";
import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { useAreaOfOpsContext } from './AreaOfOpsContext';
import { useMarkersContext } from './MarkerContext';
import { useChecklistContext } from './ChecklistContext';
import { trackEventWithForm as trackEvent } from '../components/tracking/tracking';
import FlightPlanUploader, { FlightPlanUploaderRef } from '../components/FlightPlanUploader';
import TerrainAnalysisDashboard, { TerrainAnalysisDashboardRef } from '../components/Analyses/ObstacleAnalysis/TerrainAnalysisDashboard';
import GridAnalysisController, { GridAnalysisRef } from '../components/Analyses/Services/GridAnalysis/GridAnalysisController';
import { useFlightPlanContext } from './FlightPlanContext';


// Demo step enumeration for type safety
export enum DemoStep {
  IDLE = 0,
  LOADING_FLIGHT_PLAN = 1,
  RUNNING_TERRAIN_ANALYSIS = 2,
  PLACING_OBSERVER = 3,
  RUNNING_FLIGHT_PATH_VISIBILITY = 4,  // 🔥 NEW STEP
  COMPLETING_DEMO = 5,                  // 🔧 SHIFTED from 4
  COMPLETED = 6,                        // 🔧 SHIFTED from 5
  ERROR = -1
}

// Demo state interface
export interface DemoState {
  currentStep: DemoStep;
  isRunning: boolean;
  progress: number; // 0-100
  message: string;
  error: string | null;
  startTime: number | null;
  completedTime: number | null;
}

// Demo orchestration context interface
interface DemoOrchestrationContextType {
  // Core demo state
  demoState: DemoState;
  onCreateObserver?: () => Promise<void>;
  
  // Demo control methods
  startDemo: () => Promise<void>;
  abortDemo: () => void;
  resetDemo: () => void;
  
  // Internal step execution methods (exposed for testing/debugging)
  executeStepLoadFlightPlan: () => Promise<boolean>;
  executeStepPlaceObserver: () => Promise<boolean>;
  executeStepRunTerrainAnalysis: () => Promise<boolean>;
  executeStepCompleteDemo: () => Promise<boolean>;
  executeStepRunFlightPathVisibility: () => Promise<boolean>;
}

// Context creation with undefined default (forces provider usage)
const DemoOrchestrationContext = createContext<DemoOrchestrationContextType | undefined>(undefined);

// Demo configuration constants
const DEMO_CONFIG = {
  STEP_DELAY_MS: 1500,
  OBSERVER_COORDINATES: {
    lat: -20.91124,
    lng: 140.69715,
    elevation: 5     
  },
  FLIGHT_PLAN_PATH: "/example2.waypoints",
  TERRAIN_REFERENCE_ALTITUDE: 120,
STEP_MESSAGES: {
  [DemoStep.IDLE]: "Ready to start demo",
  [DemoStep.LOADING_FLIGHT_PLAN]: "Loading demo flight plan...",
  [DemoStep.RUNNING_TERRAIN_ANALYSIS]: "Analysing terrain and obstacles...",
  [DemoStep.PLACING_OBSERVER]: "Placing optimal observer position...",
  [DemoStep.RUNNING_FLIGHT_PATH_VISIBILITY]: "Analysing high fidelity flight path visibility...",  
  [DemoStep.COMPLETING_DEMO]: "Finalising demo setup...",
  [DemoStep.COMPLETED]: "Demo complete! ✅",
  [DemoStep.ERROR]: "Demo encountered an error"
}
} as const;

/**
 * Inner component that uses other contexts and provides demo functionality
 * This component has access to all the required contexts and implements the demo logic
 */
const DemoOrchestrationInner: React.FC<{ 
  children: ReactNode; 
  onCreateObserver?: () => Promise<void> 
}> = ({ children, onCreateObserver }) => {
  // Access required contexts
  const { setDefaultElevationOffset } = useMarkersContext();
  const { analyzeTerrainElevation, setBufferDistance } = useAreaOfOpsContext();
  const { completeDemoChecks } = useChecklistContext();

  // FlightPlanUploader ref for programmatic access
  const flightPlanUploaderRef = useRef<FlightPlanUploaderRef>(null);
  // TerrainAnalysisDashboard ref for programmatic access
  const terrainDashboardRef = useRef<TerrainAnalysisDashboardRef>(null);
  // gridanalysiscontroller ref for programmatic access
  const gridAnalysisRef = useRef<GridAnalysisRef>(null);
  const { flightPlan } = useFlightPlanContext();
  

  // Core demo state
  const [demoState, setDemoState] = useState<DemoState>({
    currentStep: DemoStep.IDLE,
    isRunning: false,
    progress: 0,
    message: DEMO_CONFIG.STEP_MESSAGES[DemoStep.IDLE],
    error: null,
    startTime: null,
    completedTime: null
  });

  // Abort reference for cleanup
  const abortRef = useRef<boolean>(false);

  /**
   * Updates demo state with new values
   */
  const updateDemoState = useCallback((updates: Partial<DemoState>) => {
    setDemoState(prev => ({
      ...prev,
      ...updates,
      message: updates.currentStep ? DEMO_CONFIG.STEP_MESSAGES[updates.currentStep] : prev.message
    }));
  }, []);

  /**
   * Creates a delay between demo steps for visual effect
   */
  const delay = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => {
      const timeout = setTimeout(resolve, ms);
      // Store timeout reference for potential cleanup
      if (abortRef.current) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }, []);

  /**
   * Safe error handler that updates state and logs errors
   */
  const handleDemoError = useCallback((error: unknown, stepName: string) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[DemoOrchestration] Error in ${stepName}:`, error);
    
    updateDemoState({
      currentStep: DemoStep.ERROR,
      isRunning: false,
      error: errorMessage,
      completedTime: Date.now()
    });
  }, [updateDemoState]);

  /**
   * STEP 1: Load Example Flight Plan via FlightPlanUploader forwardRef
   */
  const executeStepLoadFlightPlan = useCallback(async (): Promise<boolean> => {
    if (abortRef.current) return false;
    
    try {
      updateDemoState({
        currentStep: DemoStep.LOADING_FLIGHT_PLAN,
        progress: 20
      });
      
      // Set demo defaults
      setDefaultElevationOffset('observer', 2);
      setDefaultElevationOffset('gcs', 2);
      setDefaultElevationOffset('repeater', 2);
      setBufferDistance(500);
      
      // Use FlightPlanUploader's programmatic method via ref
      if (!flightPlanUploaderRef.current) {
        throw new Error('FlightPlanUploader ref not available');
      }
      
      const success = await flightPlanUploaderRef.current.loadExampleProgrammatically(DEMO_CONFIG.FLIGHT_PLAN_PATH);
      if (!success) {
        throw new Error('Failed to load example flight plan');
      }
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      return true;
    } catch (error) {
      handleDemoError(error, 'executeStepLoadFlightPlan');
      return false;
    }
  }, [updateDemoState, delay, handleDemoError, setDefaultElevationOffset, setBufferDistance]);

  /**
   * STEP 2: Place Observer at Fixed Coordinates
   */
  const executeStepPlaceObserver = useCallback(async (): Promise<boolean> => {
    if (abortRef.current) return false;
    
    try {
      updateDemoState({
        currentStep: DemoStep.PLACING_OBSERVER,
        progress: 60
      });
      
      // Use the passed-in observer creation function
      if (onCreateObserver) {
        await onCreateObserver();
      } else {
        console.warn('[DemoOrchestration] No observer creation function provided');
      }
      
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      return true;
    } catch (error) {
      handleDemoError(error, 'executeStepPlaceObserver');
      return false;
    }
  }, [updateDemoState, delay, handleDemoError, onCreateObserver]);

  /**
   * STEP 3: Run Terrain Analysis from Dashboard
   */
  const executeStepRunTerrainAnalysis = useCallback(async (): Promise<boolean> => {
    if (abortRef.current) return false;
    
    try {
      updateDemoState({
        currentStep: DemoStep.RUNNING_TERRAIN_ANALYSIS,
        progress: 40
      });
      
      // Wait for AO to be generated from flight plan
      await delay(1000); // Reduced wait time
      
      // Use TerrainAnalysisDashboard's programmatic method via ref
      if (!terrainDashboardRef.current) {
        throw new Error('TerrainAnalysisDashboard ref not available');
      }
      
      const success = await terrainDashboardRef.current.runAnalysis();
      if (!success) {
        console.warn('[DemoOrchestration] Terrain analysis failed but continuing demo');
        // Don't fail the demo if terrain analysis doesn't work
      } else {
      }
      
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      return true;
    } catch (error) {
      console.warn('[DemoOrchestration] Terrain analysis error (continuing demo):', error);
      // Don't fail the demo if terrain analysis doesn't work
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      return true;
    }
  }, [updateDemoState, delay]);

  /**
   * STEP 4: Run Flight Path Visibility Analysis
   */
  const executeStepRunFlightPathVisibility = useCallback(async (): Promise<boolean> => {
    if (abortRef.current) return false;
    
    try {
      updateDemoState({
        currentStep: DemoStep.RUNNING_FLIGHT_PATH_VISIBILITY,
        progress: 80
      });
      
      // Use GridAnalysisController for flight path visibility
      if (!gridAnalysisRef.current) {
        throw new Error('GridAnalysisController ref not available');
      }
      
      const results = await gridAnalysisRef.current.runFlightPathVisibilityAnalysis({
        showLayer: true,
        sampleInterval: 10
      });
      
      if (!results.flightPathVisibility) {
        console.warn('[DemoOrchestration] Flight path visibility analysis failed but continuing demo');
      } else {
      }
      
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      return true;
    } catch (error) {
      console.warn('[DemoOrchestration] Flight path visibility analysis error (continuing demo):', error);
      // Don't fail the demo if this analysis doesn't work
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      return true;
    }
  }, [updateDemoState, delay, gridAnalysisRef]);
    
  /**
   * STEP 5: Complete Demo
   */
  const executeStepCompleteDemo = useCallback(async (): Promise<boolean> => {
    if (abortRef.current) return false;
    
    try {
      updateDemoState({
        currentStep: DemoStep.COMPLETING_DEMO,
        progress: 90
      });
      
      // Complete demo checklist items
      completeDemoChecks();
      
      // Give a moment for the checklist to update
      await delay(500);
      
      await delay(DEMO_CONFIG.STEP_DELAY_MS);
      
      updateDemoState({
        currentStep: DemoStep.COMPLETED,
        progress: 100,
        isRunning: false,
        completedTime: Date.now()
      });
      
      return true;
    } catch (error) {
      handleDemoError(error, 'executeStepCompleteDemo');
      return false;
    }
  }, [updateDemoState, delay, handleDemoError, completeDemoChecks]);

  /**
   * Main Demo Orchestration Method
   */
  const startDemo = useCallback(async (): Promise<void> => {
    // Prevent multiple concurrent demos
    if (demoState.isRunning) {
      console.warn('[DemoOrchestration] Demo already running, ignoring start request');
      return;
    }
    trackEvent('demo_started', { source: 'orchestration_context' });
    
    // Reset abort flag and initialize demo state
    abortRef.current = false;
    updateDemoState({
      currentStep: DemoStep.IDLE,
      isRunning: true,
      progress: 0,
      error: null,
      startTime: Date.now(),
      completedTime: null
    });

    try {
      // Execute each step in sequence
      const steps = [
        executeStepLoadFlightPlan,
        executeStepRunTerrainAnalysis,
        executeStepPlaceObserver,
        executeStepRunFlightPathVisibility,
        executeStepCompleteDemo
      ];

      for (const step of steps) {
        if (abortRef.current) {
          break;
        }

        const success = await step();
        if (!success) {
          console.error('[DemoOrchestration] Demo step failed, aborting sequence');
          break;
        }
      }

    } catch (error) {
      handleDemoError(error, 'startDemo');
    }
  }, [demoState.isRunning, updateDemoState, executeStepLoadFlightPlan, executeStepPlaceObserver, executeStepRunTerrainAnalysis, executeStepRunFlightPathVisibility, executeStepCompleteDemo, handleDemoError]);
  /**
   * Aborts the currently running demo
   */
  const abortDemo = useCallback(() => {
    abortRef.current = true;
    updateDemoState({
      isRunning: false,
      error: 'Demo aborted by user',
      completedTime: Date.now()
    });
  }, [updateDemoState]);

  /**
   * Resets demo state to initial values
   */
  const resetDemo = useCallback(() => {
    abortRef.current = false;
    setDemoState({
      currentStep: DemoStep.IDLE,
      isRunning: false,
      progress: 0,
      message: DEMO_CONFIG.STEP_MESSAGES[DemoStep.IDLE],
      error: null,
      startTime: null,
      completedTime: null
    });
  }, []);

  // Context value object
  const contextValue: DemoOrchestrationContextType = {
    demoState,
    startDemo,
    abortDemo,
    resetDemo,
    executeStepLoadFlightPlan,
    executeStepPlaceObserver,
    executeStepRunTerrainAnalysis,
    executeStepRunFlightPathVisibility,
    executeStepCompleteDemo
  };

  return (
    <DemoOrchestrationContext.Provider value={contextValue}>
      {/* Hidden FlightPlanUploader for demo functionality */}
      <div style={{ display: 'none' }}>
        <FlightPlanUploader
          ref={flightPlanUploaderRef}
          compact={true}
          onClose={() => {}} // No-op since it's hidden
          onPlanUploaded={() => {}} // FlightPlanContext will handle the data
        />
        {/* ADD: Hidden TerrainAnalysisDashboard for demo functionality */}
        <TerrainAnalysisDashboard
          ref={terrainDashboardRef}
          onClose={() => {}} // No-op since it's hidden
        />
        <GridAnalysisController
          ref={gridAnalysisRef}
          flightPlan={flightPlan || undefined} // Need to get this from context
        />
      </div>
      {children}
    </DemoOrchestrationContext.Provider>
  );
};

/**
 * Outer Demo Orchestration Provider Component
 * 
 * This is the main export that gets used in page.tsx
 * It simply wraps children with the Inner component that does the real work
 */
export const DemoOrchestrationProvider: React.FC<{ 
  children: ReactNode;
  onCreateObserver?: () => Promise<void>;
}> = ({ children, onCreateObserver }) => {
  return <DemoOrchestrationInner onCreateObserver={onCreateObserver}>{children}</DemoOrchestrationInner>;
};

/**
 * Custom hook to access Demo Orchestration Context
 * 
 * @returns DemoOrchestrationContextType
 * @throws Error if used outside of DemoOrchestrationProvider
 */
export const useDemoOrchestration = (): DemoOrchestrationContextType => {
  const context = useContext(DemoOrchestrationContext);
  if (context === undefined) {
    throw new Error('useDemoOrchestration must be used within a DemoOrchestrationProvider');
  }
  return context;
};

// Export demo configuration for use by consuming components
export { DEMO_CONFIG };