// page.tsx (home)
"use client";
import { useRef } from "react";
import { MapRef } from "./components/Map";
import Calculator from "./components/Calculator";
import Image from "next/image";
import FlightPlanUploader from "./components/FlightPlanUploader";
import Map from "./components/Map";
import DisclaimerModal from "./components/DisclaimerModal";
import { FlightPlanProvider } from "./context/FlightPlanContext";
import { LocationProvider } from "./context/LocationContext";
import { LOSAnalysisProvider } from "./context/LOSAnalysisContext";
import { FlightConfigurationProvider } from "./context/FlightConfigurationContext";
import PlanVerification from "./components/PlanVerification";
import Card from "./components/Card";
import TwoColumn from "./components/TwoColumn";
import CollapsibleCard from "./components/CollapsibleCard";
import ELOSAnalysisCard from "./components/ELOSAnalysisCard";
import { ObstacleAnalysisProvider } from "./context/ObstacleAnalysisContext";

export default function Home() {
  const mapRef = useRef<MapRef>(null);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <FlightPlanProvider>
        <FlightConfigurationProvider>
          <LocationProvider>
            <LOSAnalysisProvider>
              <ObstacleAnalysisProvider>
                <DisclaimerModal />
                
                {/* Logo Section */}
                <div className="flex flex-col justify-center items-center gap-5 mt-[calc(25vh-20px)] mb-10">
                  <Image
                    src="/Logonobackgrnd.png"
                    alt="Intel Aero Logo"
                    width={160}
                    height={160}
                    className="max-w-full h-auto"
                  />
                  <Image
                    src="/Namenobackgrnd.png"
                    alt="Intel Aero Title"
                    width={400}
                    height={80}
                    className="max-w-full h-auto"
                  />
                </div>

                {/* Title Section */}
                <div className="flex flex-col justify-center items-center gap-5 mt-10 md:mt-20 mb-10 lg:mb-20 xl:mb-20">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-black text-center">
                    Intelligent Mission Assurance For RPAS
                  </h2>
                  <p className="text-2xl sm:text-3xl md:text-4xl font-normal text-black text-center">
                    Smarter Planning, Safer Flights, Guaranteed Returns
                  </p>
                </div>

                {/* FlightPlan and Verification Cards */}
                <CollapsibleCard title="Flight Plan and Verification">
                  <TwoColumn>
                    <Card>
                      <FlightPlanUploader />
                    </Card>
                    <Card>
                      <PlanVerification
                        checks={[
                          "No zero altitude points",
                          "Terrain clearance",
                          "No duplicate waypoints",
                          "Regulatory Altitude Limits",
                        ]}
                        mapRef={mapRef}
                      />
                    </Card>
                  </TwoColumn>
                </CollapsibleCard>

                {/* Battery Calculations and LOS Cards */}
                <CollapsibleCard title="Energy and LOS Analyses">
                  <TwoColumn>
                    <Card>
                      <Calculator />
                    </Card>
                    <Card>
                      <ELOSAnalysisCard mapRef={mapRef} />
                    </Card>
                  </TwoColumn>
                </CollapsibleCard>

                {/* Full-width Map Section */}
                <Card>
                  <Map ref={mapRef} />
                </Card>

              </ObstacleAnalysisProvider>
            </LOSAnalysisProvider>
          </LocationProvider>
        </FlightConfigurationProvider>
      </FlightPlanProvider>
    </div>
  );
}