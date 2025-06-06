/**
 * page.tsx - OPTIMIZED VERSION WITH LAZY LOADING
 * 
 * Purpose:
 * Main entry point for the application, orchestrating the layout and state management
 * for map, analysis panels, and verification tools. Wraps content with necessary providers.
 * 
 * Optimizations:
 * - Lazy loaded heavy analysis components to reduce initial bundle size
 * - Lazy loaded modal components that aren't immediately needed
 * - Added Suspense boundaries with loading states
 * - Kept core map and context providers in main bundle for immediate availability
 */

"use client";
import React, { useState, ReactNode, useEffect, Suspense, lazy } from "react";
import Map from "./components/Map";
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
import Card from "./components/UI/Card";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";
import MapSidePanel from "./components/UI/MapSidePanel";
import { Battery, Radio, Mountain, MapPin, Search, Loader2 } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./components/tracking/tracking";
import { MapProvider } from "./context/mapcontext";
import { AnalysisControllerProvider, useAnalysisController } from "./context/AnalysisControllerContext";
import 'mapbox-gl/dist/mapbox-gl.css';
import Image from "next/image";
import ReloadButton from "./components/UI/ReloadButton";

//payment and premium access
import { PremiumProvider } from "./context/PremiumContext";

// ========================================
// LAZY LOADED COMPONENTS
// ========================================
// Heavy analysis components - only loaded when panels are opened
const ObstacleAnalysisDashboard = lazy(() => import("./components/Analyses/ObstacleAnalysis/TerrainAnalysisDashboard"));
const AnalysisDashboard = lazy(() => import("./components/Analyses/LOSAnalyses/UI/VisibilityAnalysisDashboard"));
const Calculator = lazy(() => import("./components/Calculator"));

// Modal/overlay components - only loaded when needed
const AnalysisWizard = lazy(() => import("./components/AnalysisWizard"));
const FlightPlanUploader = lazy(() => import("./components/FlightPlanUploader"));
const AreaOpsUploader = lazy(() => import("./components/AO/AreaOpsUploader"));
const UpgradeModal = lazy(() => import("./components/UI/UpgradeModal"));
const MarkerLocationsModal = lazy(() => import("./components/UI/MarkerLocationsModal"));

// Conditional UI components
const ChecklistComponent = lazy(() => import("./components/ChecklistComponent"));
const WelcomeMessage = lazy(() => import("./components/WelcomeMessage"));
const MapSelectionPanel = lazy(() => import("./components/AO/MapSelectionPanel"));
const ToolsDashboard = lazy(() => import("./components/VerificationToolbar/ToolsDashboard"));

// Heavy sub-components within ToolsDashboard that can be preloaded
const CompactDisclaimerWidget = lazy(() => import("./components/CompactDisclaimerWidget"));

// ========================================
// LOADING COMPONENTS
// ========================================
/**
 * Loading spinner for analysis panels
 */
const AnalysisLoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      <span className="text-sm text-gray-600">Loading analysis tools...</span>
    </div>
  </div>
);

/**
 * Loading placeholder for modals
 */
const ModalLoadingPlaceholder: React.FC = () => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-4 rounded-lg">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
    </div>
  </div>
);

/**
 * Main content component for the home page, managing UI layout and uploader/wizard overlays
 */
const HomeContent = () => {
  const [activePanel, setActivePanel] = useState<"energy" | "los" | "terrain" | null>(null);
  const [initialSection, setInitialSection] = useState<'flight' | 'station' | 'merged' | 'stationLOS' | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showAreaOpsUploader, setShowAreaOpsUploader] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  const [showChecklist, setShowChecklist] = useState(false);
  const { flightPlan, setFlightPlan } = useFlightPlanContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { showMarkerLocationsModal, setShowMarkerLocationsModal } = useAnalysisController();

  const [isMapSelectionMode, setIsMapSelectionMode] = useState<boolean>(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<"map" | "search">("map");

  /**
   * Toggles the active analysis panel and sets initial section
   * @param panel - The panel to toggle
   * @param section - Optional section to expand in AnalysisDashboard
   */
  const togglePanel = (panel: "energy" | "los" | "terrain" | null, section?: 'flight' | 'station' | 'merged' | 'stationLOS' | null) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setInitialSection(panel === 'los' ? section || null : null);
    trackEvent("toggle_analysis_panel", { panel, section });
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

  // Add handlers for map selection
  /**
   * Starts map selection mode
   */
  const handleStartMapSelection = (mode: "map" | "search") => {
    setIsMapSelectionMode(true);
    setMapSelectionMode(mode);
    setShowWizard(false);
    trackEvent('map_selection_started', { mode });
  };

  /**
   * Completes map selection
   */
  const handleMapSelectionComplete = () => {
    setIsMapSelectionMode(false);
    trackEvent('map_selection_completed', {});
  };

  /**
   * Cancels map selection
   */
  const handleMapSelectionCancel = () => {
    setIsMapSelectionMode(false);
    setShowWizard(true);
    trackEvent('map_selection_cancelled', {});
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      {/* Main Content Area */}
      <div className="flex-1 w-full h-full">
        <div className="flex flex-row h-full relative">
          {/* Map Section */}
          <div className="flex-grow relative h-full">
            <div className="relative h-full rounded-r-lg overflow-hidden">
              <Map
                activePanel={activePanel}
                togglePanel={togglePanel}
                flightPlan={flightPlan}
                setShowUploader={setShowUploader}
              />
              {/* Welcome Message Overlay */}
              {(!showUploader && !showAreaOpsUploader && !showWizard && showWelcomeMessage && !flightPlan && !aoGeometry) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-2">
                  <Suspense fallback={<ModalLoadingPlaceholder />}>
                    <WelcomeMessage
                      onGetStarted={handleWizard}
                      onClose={() => setShowWelcomeMessage(false)}
                    />
                  </Suspense>
                </div>
              )}
              {/* Wizard Overlay */}
              {(!showUploader && !showAreaOpsUploader && showWizard && !flightPlan && !aoGeometry) && (
                <div className="absolute inset-0 bg-black/50 flex items-start justify-center z-20 p-4 overflow-y-auto">
                  <div className="bg-white p-2 rounded-lg shadow-lg w-full max-w-3xl">
                    <div className="flex items-center mx-4 mt-4 gap-2">
                        <Image
                        src="/Logonobackgrnd.png"
                        alt="Intel.Aero Name Logo"
                        width={60}
                        height={24}
                        style={{ objectFit: "contain" }}
                      />
                      <h3 className="text-xl font-semibold">Start Here</h3>

                    </div>
                    <Suspense fallback={<AnalysisLoadingSpinner />}>
                      <AnalysisWizard 
                        onClose={() => setShowWizard(false)} 
                        onStartMapSelection={handleStartMapSelection}
                        onShowAreaOpsUploader={() => setShowAreaOpsUploader(true)}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {showUploader && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-2">
                  <div className="bg-white p-2 rounded-lg shadow-lg w-full max-w-5xl">
                    <h3 className="text-xl font-semibold mb-2">Flight Plan Upload</h3>
                    <Suspense fallback={<AnalysisLoadingSpinner />}>
                      <FlightPlanUploader
                        onClose={() => setShowUploader(false)}
                        onPlanUploaded={(flightData) => {
                          setShowUploader(false);
                        }}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
              {showAreaOpsUploader && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-2">
                  <div className="bg-white p-2 rounded-lg shadow-lg w-full max-w-5xl">
                    <h3 className="text-xl font-semibold mb-2">Area of Operations Upload</h3>
                    <Suspense fallback={<AnalysisLoadingSpinner />}>
                      <AreaOpsUploader
                        onClose={() => setShowAreaOpsUploader(false)}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Checklist and Plan Verification */}
          <div className="w-80 h-full shrink-0 max-h-screen overflow-y-auto flex p-1 mr-2 flex-col gap-4 pb-4">
            {/* Plan Verification Section */}
            <div className="w-full z-0">
              <Card className="w-full rounded-l-xl">
                <div className="space-y-4 h-full flex flex-col">
                  <h3 className="text-lg font-medium text-gray-900">Terrain and Visibility Toolbar</h3>
                  <div className="flex-1 overflow-y-auto">
                    <Suspense fallback={<AnalysisLoadingSpinner />}>
                      <ToolsDashboard onTogglePanel={togglePanel} />
                    </Suspense>
                  </div>
                </div>
              </Card>
            </div>

            {/* Map Selection Panel - Only shown when in map selection mode */}
            {isMapSelectionMode && (
              <div className="w-full z-10">
                <Card className="w-full rounded-l-xl">
                  <div className="space-y-3 h-full flex flex-col">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      {mapSelectionMode === "map" ? (
                        <>
                          <MapPin className="w-5 h-5 text-blue-600" />
                          Select Area on Map
                        </>
                      ) : (
                        <>
                          <Search className="w-5 h-5 text-blue-600" />
                          Search Location
                        </>
                      )}
                    </h3>
                    <div className="flex-1 overflow-y-auto">
                      <Suspense fallback={<AnalysisLoadingSpinner />}>
                        <MapSelectionPanel 
                          mode={mapSelectionMode}
                          onComplete={handleMapSelectionComplete}
                          onCancel={handleMapSelectionCancel}
                        />
                      </Suspense>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Checklist Section */}
            {(flightPlan || aoGeometry) && !showWizard && !showUploader && !showAreaOpsUploader && (
              <div className="w-full relative z-10">
                <Suspense fallback={<AnalysisLoadingSpinner />}>
                  <ChecklistComponent className="relative" togglePanel={togglePanel} />
                </Suspense>
              </div>
            )}            
          </div>

          {/* Analysis Panels - WITH LAZY LOADING */}
          <MapSidePanel
            title="Energy Analysis"
            icon={<Battery className="w-5 h-5" />}
            isExpanded={activePanel === "energy"}
            onToggle={() => togglePanel("energy")}
            className="z-30"
          >
            <Suspense fallback={<AnalysisLoadingSpinner />}>
              <Calculator />
            </Suspense>
          </MapSidePanel>

          <MapSidePanel
            title="Visibility and Comms Tools"
            icon={<Radio className="w-5 h-5" />}
            isExpanded={activePanel === "los"}
            onToggle={() => togglePanel("los")}
            className="z-30"
          >
            <Suspense fallback={<AnalysisLoadingSpinner />}>
              <AnalysisDashboard initialSection={initialSection} />
            </Suspense>
          </MapSidePanel>

          <MapSidePanel
            title="Terrain Analysis Tools"
            icon={<Mountain className="w-5 h-5" />}
            isExpanded={activePanel === "terrain"}
            onToggle={() => togglePanel("terrain")}
            className="z-30"
          >
            <Suspense fallback={<AnalysisLoadingSpinner />}>
              <ObstacleAnalysisDashboard />
            </Suspense>
          </MapSidePanel>
        </div>
      </div>
    </div>
  );
};

/**
 * Wrapper component for the MarkerLocationsModal - WITH LAZY LOADING
 * This ensures the modal has access to all necessary context
 * and is rendered at the application level
 */
const MarkerLocationsModalWrapper: React.FC = () => {
  const { showMarkerLocationsModal, setShowMarkerLocationsModal } = useAnalysisController();
  
  if (!showMarkerLocationsModal) return null;
  
  return (
    <Suspense fallback={<ModalLoadingPlaceholder />}>
      <MarkerLocationsModal
        isOpen={showMarkerLocationsModal}
        onClose={() => setShowMarkerLocationsModal(false)}
      />
    </Suspense>
  );
};

/**
 * Lazy-loaded UpgradeModal wrapper
 */
const UpgradeModalWrapper: React.FC = () => {
  return (
    <Suspense fallback={null}>
      <UpgradeModal />
    </Suspense>
  );
};

/**
 * Home page component, wrapping content with necessary providers
 */
export default function Home() {
  return (
    <MapProvider>
      <AnalysisControllerProvider> 
        <AreaOfOpsProvider>
          <FlightPlanProvider>
            <FlightConfigurationProvider>
              <PremiumProvider>
                <MarkerProvider>
                  <LOSAnalysisProvider>
                    <ObstacleAnalysisProvider>
                      <ChecklistProvider>
                        <HomeContent />
                        <UpgradeModalWrapper />
                        <MarkerLocationsModalWrapper />
                      </ChecklistProvider>
                    </ObstacleAnalysisProvider>
                  </LOSAnalysisProvider>
                </MarkerProvider>
              </PremiumProvider>
            </FlightConfigurationProvider>
          </FlightPlanProvider>
        </AreaOfOpsProvider>
      </AnalysisControllerProvider>
    </MapProvider>
  );
}