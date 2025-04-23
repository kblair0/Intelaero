// page.tsx
"use client";
import React, { useState, ReactNode, useEffect } from "react";
import Calculator from "./components/Calculator";
import Image from "next/image";
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
import PlanVerificationDashboard from "./components/PlanVerification/PlanVerificationDashboard";
import Card from "./components/UI/Card";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";
import MapSidePanel from "./components/UI/MapSidePanel";
import { Battery, Radio, GripVertical } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./components/tracking/tracking";
import WelcomePitch from "./components/WelcomePitch";
import { MapProvider } from "./context/mapcontext";
import { AnalysisControllerProvider } from "./context/AnalysisControllerContext";
import AnalysisDashboard from "./components/Analyses/LOSAnalyses/UI/AnalysisDashboard";
import 'mapbox-gl/dist/mapbox-gl.css';


const HomeContent = () => {
  const [activePanel, setActivePanel] = useState<"energy" | "los" | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showAreaOpsUploader, setShowAreaOpsUploader] = useState(false);
  const { flightPlan, setFlightPlan } = useFlightPlanContext();
  const { aoGeometry } = useAreaOfOpsContext();

  const togglePanel = (panel: "energy" | "los" | null) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };


  const handleAreaOps = () => {
    setShowAreaOpsUploader(true);
  };

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
                  {/* Uploader Overlay */}
                  {(!showUploader && !showAreaOpsUploader && !flightPlan && !aoGeometry) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
                      <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-sm">
                        <h3 className="text-xl font-semibold text-center mb-4">
                          Choose Your Starting Point
                        </h3>
                        <div className="flex flex-col gap-4">
                          <button
                            onClick={() => setShowUploader(true)}
                            className="w-full border border-blue-500 text-blue-500 rounded-lg py-2 hover:bg-blue-50 transition"
                          >
                            Start With Flight Plan
                          </button>
                          <button
                            onClick={handleAreaOps}
                            className="w-full border border-green-500 text-green-500 rounded-lg py-2 hover:bg-green-50 transition"
                          >
                            Start With Area of Operations
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
  
                  {showUploader && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
                      <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-sm">
                        <h3 className="text-xl font-semibold mb-4">
                          Flight Plan Upload
                        </h3>
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
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
                      <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-sm">
                        <h3 className="text-xl font-semibold mb-4">
                          Area of Operations Upload
                        </h3>
                        <AreaOpsUploader
                          onClose={() => setShowAreaOpsUploader(false)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
  
              {/* Plan Verification Section - Fixed Width */}
              <div className="w-80 h-full shrink-0 max-h-screen overflow-y-auto">
                <Card className="h-full rounded-l-xl">
                  <div className="space-y-4 h-full flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Plan Verification
                    </h3>
                    <div className="flex-1 overflow-y-auto">
                      <PlanVerificationDashboard onTogglePanel={togglePanel} />
                      <div className="mt-4">
                        <WelcomePitch />
                      </div>
                    </div>
                  </div>
                </Card>
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
                title="LOS Analysis"
                icon={<Radio className="w-5 h-5" />}
                isExpanded={activePanel === "los"}
                onToggle={() => togglePanel("los")}
                className="z-30"
              >
                <AnalysisDashboard />
              </MapSidePanel>

            </div>
          </div>
        </div>
  );
}
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
                    <HomeContent />
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