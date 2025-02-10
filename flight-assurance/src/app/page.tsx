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
import MapSidePanel from './components/MapSidePanel';
import { Battery, Radio } from 'lucide-react';

// Create an inner component that uses the context
const HomeContent = () => {
  const mapRef = useRef<MapRef>(null);
  const [activePanel, setActivePanel] = useState<'energy' | 'los' | null>(null);
  const { flightPlan } = useFlightPlanContext();

  const togglePanel = (panel: 'energy' | 'los') => {
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
      <div className="flex-1 mx-auto w-full max-w-[2000px] px-4">
        <div className="flex flex-row gap-4">
          {/* Map Section with Overlay */}
          <div className="flex-grow relative">
            <Card>
              <div className="relative">
                <Map ref={mapRef} />
                
                {/* Upload Overlay - Only shown when no flight plan */}
                {!flightPlan && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Flight Plan Upload
                      </h3>
                      <FlightPlanUploader />
                    </div>
                  </div>
                )}

                {/* Analysis Control Buttons */}
                <div className="absolute top-4 left-4 z-10">
                  <div className="flex flex-row gap-2 mb-4">
                    <button
                      onClick={() => togglePanel('energy')}
                      className={`map-button flex items-center gap-2 transition-colors ${
                        activePanel === 'energy' 
                          ? 'bg-blue-100 border-blue-300 shadow-md' 
                          : 'hover:bg-gray-300/80'
                      }`}
                    >
                      <Battery className="w-4 h-4" />
                      Energy Analysis
                    </button>
                    <button
                      onClick={() => togglePanel('los')}
                      className={`map-button flex items-center gap-2 transition-colors ${
                        activePanel === 'los' 
                          ? 'bg-blue-100 border-blue-300 shadow-md' 
                          : 'hover:bg-gray-300/80'
                      }`}
                    >
                      <Radio className="w-4 h-4" />
                      LOS Analysis
                    </button>
                  </div>
                </div>

                {/* Analysis Panels */}
                <MapSidePanel
                  title="Energy Analysis"
                  icon={<Battery className="w-5 h-5" />}
                  isExpanded={activePanel === 'energy'}
                  onToggle={() => togglePanel('energy')}
                  className="top-4 h-[calc(100%-2rem)]"
                >
                  <Calculator />
                </MapSidePanel>

                <MapSidePanel
                  title="LOS Analysis"
                  icon={<Radio className="w-5 h-5" />}
                  isExpanded={activePanel === 'los'}
                  onToggle={() => togglePanel('los')}
                  className="top-4 h-[calc(100%-2rem)]"
                >
                  <ELOSAnalysisCard mapRef={mapRef} />
                </MapSidePanel>
              </div>
            </Card>
          </div>

          {/* Plan Verification Section - Always visible */}
          <div className="w-80">
            <Card>
              <div className="space-y-4">
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
        </div>
      </div>
    </div>
  );
};

// Main component that provides the context
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