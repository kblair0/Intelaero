"use client";
import { useRef, useState } from "react";
import { MapRef } from "./components/Map";
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
import PlanVerification from "./components/PlanVerification";
import Card from "./components/Card";
import ELOSAnalysisCard from "./components/ELOSAnalysisCard";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";
import MapSidePanel from "./components/MapSidePanel";
import { Battery, Radio, GripVertical } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./components/tracking/tracking";
import WelcomePitch from "./components/WelcomePitch";
import { MapProvider } from "./context/MapContext";

const HomeContent = () => {
  const mapRef = useRef<MapRef>(null);
  const [activePanel, setActivePanel] = useState<"energy" | "los" | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showAreaOpsUploader, setShowAreaOpsUploader] = useState(false);
  const { flightPlan, setFlightPlan } = useFlightPlanContext();
  const { aoGeometry } = useAreaOfOpsContext();

  const togglePanel = (panel: "energy" | "los") => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  const handleAreaOps = () => {
    setShowAreaOpsUploader(true);
  };

  return (
    <MapProvider>
      <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
        <DisclaimerModal />

        {/* Logo Section */}
        <div className="absolute z-50 bottom-4 left-4 bg-white shadow-lg rounded-2xl p-4 w-40 flex flex-col items-center border border-gray-200">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/Logonobackgrnd.png"
              alt="Intel Aero Logo"
              width={0}
              height={0}
              sizes="100vw"
              style={{ width: "100%", height: "auto" }}
              className="max-w-full h-auto"
            />
            <Image
              src="/Namenobackgrnd.png"
              alt="Intel Aero Title"
              width={0}
              height={0}
              sizes="100vw"
              style={{ width: "100%", height: "auto" }}
              className="max-w-full h-auto"
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full h-full mx-2">
          <div className="flex flex-row h-full relative">
            {/* Map Section */}
            <div className="flex-grow relative h-full">
              <div className="relative h-full rounded-r-xl overflow-hidden">
                <Map ref={mapRef} />
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
                        mapRef={mapRef}
                        onPlanUploaded={(flightData, resetMap) => {
                          resetMap();
                          setFlightPlan(flightData);
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
                        mapRef={mapRef}
                      />
                    </div>
                  </div>
                )}

                {/* Analysis Control Buttons */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 mb-4">
                  <button
                    onClick={() => {
                      trackEvent("map_energy_panel_click", {
                        panel: "page.tsx",
                      });
                      togglePanel("energy");
                    }}
                    className={`map-button flex items-center gap-2 transition-colors ${
                      activePanel === "energy"
                        ? "bg-blue-100 border-blue-300 shadow-md"
                        : "hover:bg-gray-300/80"
                    }`}
                  >
                    <Battery className="w-4 h-4" />
                    Energy Analysis
                  </button>

                  <button
                    onClick={() => {
                      trackEvent("map_los_panel_click", { panel: "page.tsx" });
                      togglePanel("los");
                    }}
                    className={`map-button flex items-center gap-2 transition-colors ${
                      activePanel === "los"
                        ? "bg-blue-100 border-blue-300 shadow-md"
                        : "hover:bg-gray-300/80"
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    LOS Analysis
                  </button>

                  {flightPlan && (
                    <button
                      onClick={() => {
                        trackEvent("upload_flight_plan_click", {
                          panel: "page.tsx",
                        });
                        setShowUploader(true);
                      }}
                      className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
                    >
                      Upload Flight Plan
                    </button>
                  )}

                  <button
                    onClick={() => {
                      trackEvent("own_dem_data_request", { panel: "page.tsx" });
                      window.alert("Coming Soon!");
                    }}
                    className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
                  >
                    <GripVertical className="w-4 h-4" />
                    Add Your Own DEM Data
                  </button>
                </div>
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
                    <PlanVerification mapRef={mapRef} onTogglePanel={togglePanel} />
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
              <ELOSAnalysisCard mapRef={mapRef} />
            </MapSidePanel>
          </div>
        </div>
      </div>
    </MapProvider>
  );
};

export default function Home() {
  return (
    <FlightPlanProvider>
      <FlightConfigurationProvider>
        <MarkerProvider>
          <LOSAnalysisProvider>
            <ObstacleAnalysisProvider>
              <AreaOfOpsProvider>
                <HomeContent />
              </AreaOfOpsProvider>
            </ObstacleAnalysisProvider>
          </LOSAnalysisProvider>
        </MarkerProvider>
      </FlightConfigurationProvider>
    </FlightPlanProvider>
  );
}