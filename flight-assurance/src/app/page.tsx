"use client";

import { useRef, useState } from "react";
import { MapRef } from "./components/Map";
import Calculator from "./components/Calculator";
import Image from "next/image";
import FlightPlanUploader from "./components/FlightPlanUploader";
import Map from "./components/Map";
import DisclaimerModal from "./components/DisclaimerModal";
import { FlightPlanProvider, useFlightPlanContext } from "./context/FlightPlanContext";
import { LocationProvider } from "./context/LocationContext";
import { LOSAnalysisProvider } from "./context/LOSAnalysisContext";
import { FlightConfigurationProvider } from "./context/FlightConfigurationContext";
import PlanVerification from "./components/PlanVerification";
import Card from "./components/Card";
import ELOSAnalysisCard from "./components/ELOSAnalysisCard";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";
import MapSidePanel from "./components/MapSidePanel";
import { Battery, Radio, GripVertical, Mountain } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./components/tracking/tracking";

const HomeContent = () => {
  const mapRef = useRef<MapRef>(null);
  const [activePanel, setActivePanel] = useState<"energy" | "los" | null>(null);
  // New state for showing the flight plan uploader overlay.
  const [showUploader, setShowUploader] = useState(false);
  const { flightPlan } = useFlightPlanContext();

  const togglePanel = (panel: "energy" | "los") => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <DisclaimerModal />

      {/* Logo Section */}
      <div className="flex flex-col justify-center items-center gap-5 mt-8 mb-6 lg:mt-12 lg:mb-8">
        <Image
          src="/Logonobackgrnd.png"
          alt="Intel Aero Logo"
          width={120}
          height={120}
          className="max-w-full h-auto"
        />
        <Image
          src="/Namenobackgrnd.png"
          alt="Intel Aero Title"
          width={300}
          height={60}
          className="max-w-full h-auto"
        />
      </div>

      {/* Title Section */}
      <div className="flex flex-col justify-center items-center gap-3 mb-6 lg:mb-8 px-4">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-normal text-black text-center">
          Intelligent Mission Assurance For RPAS
        </h2>
        <p className="text-lg sm:text-xl lg:text-2xl font-normal text-black text-center">
          Smarter Planning, Safer Flights, Guaranteed Returns
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 mx-auto w-full max-w-[2000px] px-4 h-screen">
        <div className="flex flex-row gap-4 h-full">
          {/* Map Section with Overlays */}
          <div className="flex-grow relative h-full">
            <Card className="h-full">
              <div className="relative h-full">
                <Map ref={mapRef} />

                {/* Uploader Overlay:
                    - If no flight plan exists, show uploader automatically.
                    - If a flight plan exists, the uploader is hidden by default;
                      it is shown only when 'showUploader' is true.
                */}
                {(!flightPlan || showUploader) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Flight Plan Upload
                        </h3>
                        <button
                          onClick={() => setShowUploader(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          X
                        </button>
                      </div>
                      {/* 
                        Pass an onClose prop if your FlightPlanUploader supports it.
                        Otherwise, rely on the close button above.
                      */}
                      <FlightPlanUploader onClose={() => setShowUploader(false)} />
                    </div>
                  </div>
                )}

                {/* Analysis Control Buttons */}
                <div className="absolute top-4 left-4 z-10 flex flex-row gap-2 mb-4">
                  <button
                    onClick={() => togglePanel("energy")}
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
                    onClick={() => togglePanel("los")}
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
                      onClick={() => setShowUploader(true)}
                      className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
                    >
                      Upload Flight Plan
                    </button>
                  )}
                  {/* New DEM Data Button */}
                  <button
                    onClick={() => {
                      trackEvent("own_dem_data_request", { panel: "dem" });
                      window.alert("Coming Soon!");
                    }}
                    className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
                  >
                    <GripVertical className="w-4 h-4" />
                    Add Your Own DEM Data
                  </button>
                </div>

                {/* Analysis Panels */}
                <MapSidePanel
                  title="Energy Analysis"
                  icon={<Battery className="w-5 h-5" />}
                  isExpanded={activePanel === "energy"}
                  onToggle={() => togglePanel("energy")}
                  className="top-0 h-full"
                >
                  <Calculator />
                </MapSidePanel>

                <MapSidePanel
                  title="LOS Analysis"
                  icon={<Radio className="w-5 h-5" />}
                  isExpanded={activePanel === "los"}
                  onToggle={() => togglePanel("los")}
                  className="top-4 h-[calc(100%-2rem)]"
                >
                  <ELOSAnalysisCard mapRef={mapRef} />
                </MapSidePanel>
              </div>
            </Card>
          </div>

          {/* Plan Verification Section - Always visible */}
          <div className="w-80 h-full">
            <Card className="h-full">
              <div className="space-y-4 h-full">
                <h3 className="text-lg font-semibold text-gray-900">
                  Plan Verification
                </h3>
                <PlanVerification mapRef={mapRef} onTogglePanel={togglePanel} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  return (
    <FlightPlanProvider>
      <FlightConfigurationProvider>
        <LocationProvider>
          <LOSAnalysisProvider>
            <ObstacleAnalysisProvider>
              <HomeContent />
            </ObstacleAnalysisProvider>
          </LOSAnalysisProvider>
        </LocationProvider>
      </FlightConfigurationProvider>
    </FlightPlanProvider>
  );
}
