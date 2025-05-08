/**
 * page.tsx
 * 
 * Purpose:
 * Main entry point for the application, orchestrating the layout and state management
 * for map, analysis panels, and verification tools. Wraps content with necessary providers.
 * 
 * Changes:
 * - Updated activePanel type to include "terrain".
 * - Added MapSidePanel for Terrain Analysis (ObstacleAnalysisDashboard).
 * - Ensured consistent z-index and styling with LOS and Energy panels.
 * - Passed togglePanel to ChecklistComponent for "Guide Me" functionality.
 */

"use client";
import React, { useState, ReactNode, useEffect } from "react";
import Calculator from "./components/Calculator";
import FlightPlanUploader from "./components/FlightPlanUploader";
import AreaOpsUploader from "./components/AO/AreaOpsUploader";
import Map from "./components/Map";
import DisclaimerModal from "./components/DisclaimerModal";
import {
  FlightPlanProvider,
  useFlightPlanContext,
} from "./context/FlightPlanContext";
import { useAreaOfOpsContext } from "./context/AreaOfOpsContext";
import { MarkerProvider } from "./context/MarkerContext";
import { LOSAnalysisProvider } from "./context/LOSAnalysisContext";
import { FlightConfigurationProvider } from "./context/FlightConfigurationContext";
import { AreaOfOpsProvider } from "./context/AreaOfOpsContext";
import { ChecklistProvider } from "./context/ChecklistContext";
import PlanVerificationDashboard from "./components/PlanVerification/ToolsDashboard";
import Card from "./components/UI/Card";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";
import MapSidePanel from "./components/UI/MapSidePanel";
import { Battery, Radio, Mountain } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./components/tracking/tracking";
import { MapProvider } from "./context/mapcontext";
import { AnalysisControllerProvider } from "./context/AnalysisControllerContext";
import AnalysisDashboard from "./components/Analyses/LOSAnalyses/UI/AnalysisDashboard";
import AnalysisWizard from "./components/AnalysisWizard";
import WelcomeMessage from "./components/WelcomeMessage";
import ChecklistComponent from "./components/ChecklistComponent";
import 'mapbox-gl/dist/mapbox-gl.css';
import ObstacleAnalysisDashboard from "./components/Analyses/ObstacleAnalysis/TerrainAnalysisDashboard";

/**
 * Main content component for the home page, managing UI layout and uploader/wizard overlays
 */
const HomeContent = () => {
  const [activePanel, setActivePanel] = useState<"energy" | "los" | "terrain" | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showAreaOpsUploader, setShowAreaOpsUploader] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);
  const { flightPlan, setFlightPlan } = useFlightPlanContext();
  const { aoGeometry } = useAreaOfOpsContext();

  /**
   * Toggles the active analysis panel
   * @param panel - The panel to toggle
   */
  const togglePanel = (panel: "energy" | "los" | "terrain" | null) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    trackEvent("toggle_analysis_panel", { panel });
  };

  /**
   * Handles opening the Area of Operations uploader
   */
  const handleAreaOps = () => {
    setShowAreaOpsUploader(true);
    trackEvent('area_ops_uploader_opened', {});
  };

  /**
   * Handles opening the wizard
   */
  const handleWizard = () => {
    setShowWizard(true);
    setShowWelcomeMessage(false);
    trackEvent('wizard_opened', {});
  };

  /**
   * Closes the checklist overlay
   */
  const handleCloseChecklist = () => {
    setShowChecklist(false);
  };

  /**
   * Effect to show checklist when wizard closes and upload is complete
   */
  useEffect(() => {
    if ((flightPlan || aoGeometry) && !showWizard && !showUploader && !showAreaOpsUploader) {
      setShowChecklist(true);
    } else {
      setShowChecklist(false);
    }
  }, [flightPlan, aoGeometry, showWizard, showUploader, showAreaOpsUploader]);

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      <DisclaimerModal />

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full mx-2">
        <div className="flex flex-row h-full relative">
          {/* Map Section */}
          <div className="flex-grow relative h-full">
            <div className="relative h-full rounded-r-xl overflow-hidden">
              <Map
                activePanel={activePanel}
                togglePanel={togglePanel}
                flightPlan={flightPlan}
                setShowUploader={setShowUploader}
              />
              {/* Welcome Message Overlay */}
              {(!showUploader && !showAreaOpsUploader && !showWizard && showWelcomeMessage && !flightPlan && !aoGeometry) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-2">
                  <WelcomeMessage
                    onGetStarted={handleWizard}
                    onClose={() => setShowWelcomeMessage(false)}
                  />
                </div>
              )}
              {/* Wizard Overlay */}
              {(!showUploader && !showAreaOpsUploader && showWizard && !flightPlan && !aoGeometry) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
                  <div className="bg-white p-2 rounded-lg shadow-lg w-full max-w-5xl">
                    <h3 className="text-2xl font-semibold mx-4 mt-4 mb-2">Start Your Analysis</h3>
                    <AnalysisWizard onClose={() => setShowWizard(false)} />
                  </div>
                </div>
              )}
              {showUploader && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-2">
                  <div className="bg-white p-2 rounded-lg shadow-lg w-full max-w-5xl">
                    <h3 className="text-xl font-semibold mb-2">Flight Plan Upload</h3>
                    <FlightPlanUploader
                      onClose={() => setShowUploader(false)}
                      onPlanUploaded={(flightData) => {
                        setShowUploader(false);
                      }}
                    />
                  </div>
                </div>
              )}
              {showAreaOpsUploader && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-2">
                  <div className="bg-white p-2 rounded-lg shadow-lg w-full max-w-5xl">
                    <h3 className="text-xl font-semibold mb-2">Area of Operations Upload</h3>
                    <AreaOpsUploader
                      onClose={() => setShowAreaOpsUploader(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Checklist and Plan Verification */}
          <div className="w-80 h-full shrink-0 max-h-screen overflow-y-auto flex flex-col gap-4 pb-4">
            {/* Checklist Section */}
            {(flightPlan || aoGeometry) && !showWizard && !showUploader && !showAreaOpsUploader && (
              <div className="w-full relative z-10">
                <ChecklistComponent className="relative" togglePanel={togglePanel} />
              </div>
            )}

            {/* Plan Verification Section */}
            <div className="w-full z-0">
              <Card className="w-full rounded-l-xl">
                <div className="space-y-4 h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-gray-900">Terrain and Visibility Toolbar</h3>
                  <div className="flex-1 overflow-y-auto">
                    <PlanVerificationDashboard onTogglePanel={togglePanel} />
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Analysis Panels */}
          <MapSidePanel
            title="Energy Analysis"
            icon={<Battery className="w-5 h-5" />}
            isExpanded={activePanel === "energy"}
            onToggle={() => togglePanel("energy")}
            className="z-30"
          >
            <Calculator />
          </MapSidePanel>

          <MapSidePanel
            title="Visibilty and Comms Tools"
            icon={<Radio className="w-5 h-5" />}
            isExpanded={activePanel === "los"}
            onToggle={() => togglePanel("los")}
            className="z-30"
          >
            <AnalysisDashboard />
          </MapSidePanel>

          <MapSidePanel
            title="Terrain Analysis Tools"
            icon={<Mountain className="w-5 h-5" />}
            isExpanded={activePanel === "terrain"}
            onToggle={() => togglePanel("terrain")}
            className="z-30"
          >

              <ObstacleAnalysisDashboard />

          </MapSidePanel>
        </div>
      </div>
    </div>
  );
};

/**
 * Home page component, wrapping content with necessary providers
 */
export default function Home() {
  return (
    <MapProvider>
      <AreaOfOpsProvider>
        <FlightPlanProvider>
          <FlightConfigurationProvider>
            <MarkerProvider>
              <LOSAnalysisProvider>
                <ObstacleAnalysisProvider>
                  <AnalysisControllerProvider>
                    <ChecklistProvider>
                      <HomeContent />
                    </ChecklistProvider>
                  </AnalysisControllerProvider>
                </ObstacleAnalysisProvider>
              </LOSAnalysisProvider>
            </MarkerProvider>
          </FlightConfigurationProvider>
        </FlightPlanProvider>
      </AreaOfOpsProvider>
    </MapProvider>
  );
}