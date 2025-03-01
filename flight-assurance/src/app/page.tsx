"use client";
import { useRef, useState } from "react";
import { MapRef } from "./components/Map";
import Calculator from "./components/Calculator";
import Image from "next/image";
import FlightPlanUploader from "./components/FlightPlanUploader";
import Map from "./components/Map";
import DisclaimerModal from "./components/DisclaimerModal";
import {
  FlightPlanProvider,
  useFlightPlanContext,
} from "./context/FlightPlanContext";
import { LocationProvider } from "./context/LocationContext";
import { LOSAnalysisProvider } from "./context/LOSAnalysisContext";
import { FlightConfigurationProvider } from "./context/FlightConfigurationContext";
import PlanVerification from "./components/PlanVerification";
import Card from "./components/Card";
import ELOSAnalysisCard from "./components/ELOSAnalysisCard";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";
import MapSidePanel from "./components/MapSidePanel";
import { Battery, Radio, GripVertical, X } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./components/tracking/tracking";

const HomeContent = () => {
  const mapRef = useRef<MapRef>(null);
  const [activePanel, setActivePanel] = useState<"energy" | "los" | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [logoVisible, setLogoVisible] = useState(true);
  const { flightPlan, setFlightPlan } = useFlightPlanContext();

  const togglePanel = (panel: "energy" | "los") => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white overflow-x-hidden">
      <DisclaimerModal />

      {/* Logo Section */}
      {logoVisible && (
        <div className="absolute z-50 bottom-4 left-4 bg-white shadow-lg rounded-2xl p-4 w-40 flex flex-col items-center border border-gray-200">
          <button
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            onClick={() => setLogoVisible(false)}
          >
            <X size={20} />
          </button>
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/Logonobackgrnd.png"
              alt="Intel Aero Logo"
              width={0}
              height={0}
              sizes="100vw"
              style={{ width: '100%', height: 'auto' }}
              className="max-w-full h-auto"
            />
            <Image
              src="/Namenobackgrnd.png"
              alt="Intel Aero Title"
              width={0}
              height={0}
              sizes="100vw"
              style={{ width: '100%', height: 'auto' }}
              className="max-w-full h-auto"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full mx-2">
        <div className="flex flex-row h-full relative">
          {/* Map Section */}
          <div className="flex-grow relative h-full pr-6">
            <div className="relative h-full rounded-r-xl overflow-hidden">
              <Map ref={mapRef} />
              {/* Uploader Overlay */}
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
                        <X size={20} />
                      </button>
                    </div>
                    <FlightPlanUploader
                      onClose={() => setShowUploader(false)}
                      mapRef={mapRef}
                      onPlanUploaded={(flightData, resetMap) => {
                        resetMap(); // Reset map before setting new plan
                        setFlightPlan(flightData);
                      }}
                    />
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
            </div>
          </div>

          {/* Plan Verification Section - Fixed Width */}
          <div className="w-80 h-full shrink-0">
            <Card className="h-full rounded-l-xl">
              <div className="space-y-4 h-full">
                <h3 className="text-lg font-semibold text-gray-900">
                  Plan Verification
                </h3>
                <PlanVerification 
                  mapRef={mapRef} 
                  onTogglePanel={togglePanel} 
                />
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