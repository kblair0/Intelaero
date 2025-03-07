"use client";
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, Battery, Radio, Mountain } from "lucide-react";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
import { useFlightConfiguration } from "../context/FlightConfigurationContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { ObstacleAnalysisOutput } from "../context/ObstacleAnalysisContext";
import dynamic from "next/dynamic"; // Import dynamic from Next.js
import { MapRef } from "./Map";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

// Dynamically load components that use browser APIs
const ObstacleAssessment = dynamic(() => import("./ObstacleAssessment"), { ssr: false });
const TerrainClearancePopup = dynamic(() => import("./TerrainClearancePopup"), { ssr: false });

// --- Define layer toggle functions
const toggleLayerVisibility = (mapRef: React.RefObject<MapRef>, layerName: string) => {
  if (!mapRef.current) return;
  const map = mapRef.current.getMap();
  if (!map) return;
  const visibility = map.getLayoutProperty(layerName, 'visibility');
  map.setLayoutProperty(layerName, 'visibility', visibility === 'visible' ? 'none' : 'visible');
};

// Powerlines and Airspace Overlays Toggle
const handleAddPowerlines = (mapRef: React.RefObject<MapRef>) => {
  if (!mapRef.current) return;
  toggleLayerVisibility(mapRef, "Electricity Transmission Lines");
  toggleLayerVisibility(mapRef, "Electricity Transmission Lines Hitbox");
};

const handleAddAirspaceOverlay = (mapRef: React.RefObject<MapRef>) => {
  if (!mapRef.current) return;
  toggleLayerVisibility(mapRef, "Airfields");
  toggleLayerVisibility(mapRef, "Airfields Labels");
};



interface PlanVerificationProps {
  mapRef: React.RefObject<MapRef>;
  onTogglePanel: (panel: 'energy' | 'los' | null) => void;
}

interface VerificationSection {
  id: string;
  title: string;
  description: string;
  status: "pending" | "loading" | "success" | "error" | "warning";
  details?: string[];
  action?: () => void;
  actionLabel?: string;
  subSections?: {
    title: string;
    content: React.ReactNode;
  }[];
}

interface WaypointCoordinate {
  coord: number[];
  index: number;
}

interface FlightPlanFeature {
  geometry: {
    coordinates: number[][];
    type: string;
  };
  properties: Record<string, unknown>;
}

const PlanVerification: React.FC<PlanVerificationProps> = ({ mapRef, onTogglePanel }) => {
  const { flightPlan } = useFlightPlanContext();
  const { metrics } = useFlightConfiguration();
  const { analysisData, setAnalysisData } = useObstacleAnalysis();
  const { results: losResults } = useLOSAnalysis();
  
  const [expandedSection, setExpandedSection] = useState<string | null>("basic");
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [zeroAltitudePoints, setZeroAltitudePoints] = useState<WaypointCoordinate[]>([]);
  const [duplicateWaypoints, setDuplicateWaypoints] = useState<WaypointCoordinate[]>([]);
  const [kmzTakeoffWarning, setKmzTakeoffWarning] = useState<string | null>(null);
  const [energyAnalysisOpened, setEnergyAnalysisOpened] = useState(false);


  // Reset analysis state when a new flight plan is loaded
  useEffect(() => {
    if (flightPlan) {
      // Reset any analysis state if needed
    }
  }, [flightPlan]);

  // Utility function to get minimum clearance distance
  const getMinClearanceDistance = (): number | null => {
    if (!analysisData) return null;
    const clearances = analysisData.flightAltitudes.map(
      (alt, idx) => alt - analysisData.terrainElevations[idx]
    );
    const minClearance = Math.min(...clearances);
    const index = clearances.indexOf(minClearance);
    return analysisData.distances[index];
  };

  // Check for zero altitude points and KMZ takeoff height
  useEffect(() => {
    if (!flightPlan) {
      setZeroAltitudePoints([]);
      setKmzTakeoffWarning(null);
      return;
    }

    const zeroPoints: WaypointCoordinate[] = [];
    flightPlan.features.forEach((feature: FlightPlanFeature) => {
      feature.geometry.coordinates.forEach((coord: number[], index: number) => {
        if (coord[2] === 0) {
          zeroPoints.push({ coord, index });
        }
      });
    });
    setZeroAltitudePoints(zeroPoints);

    // KMZ-specific takeoff height check
    const isKmz = flightPlan.properties.metadata?.distance !== undefined; // Rough check for .kmz
    if (isKmz) {
      const mode = flightPlan.features[0].properties.waypoints[0].altitudeMode;
      // Replace 'any' with unknown if you have a better type for config
      const takeoffHeight = (flightPlan.properties.config as unknown as { takeoffHeight?: number })?.takeoffHeight || 0;
      const homeAltitude = flightPlan.properties.homePosition.altitude;
      if ((mode === "terrain" || mode === "relative") && takeoffHeight === 0 && homeAltitude === 0) {
        setKmzTakeoffWarning("Warning: Takeoff security height missing in terrain or relative mission; home altitude is 0m.");
      } else {
        setKmzTakeoffWarning(null);
      }
    } else {
      setKmzTakeoffWarning(null);
    }
  }, [flightPlan]);

  // Check for duplicate waypoints
  useEffect(() => {
    if (!flightPlan) return;
    const duplicates: WaypointCoordinate[] = [];
    flightPlan.features.forEach((feature: FlightPlanFeature) => {
      const seen = new Set();
      feature.geometry.coordinates.forEach((coord: number[], index: number) => {
        const key = coord.join(',');
        if (seen.has(key)) {
          duplicates.push({ coord, index });
        }
        seen.add(key);
      });
    });
    setDuplicateWaypoints(duplicates);
  }, [flightPlan]);

  // Basic flight plan checks section
  const getBasicChecks = (): VerificationSection => {
    if (!flightPlan) {
      return {
        id: "basic",
        title: "Basic Flight Plan Checks",
        description: "Upload a flight plan to begin verification",
        status: "pending"
      };
    }
  
    const hasZeroAltitudes = zeroAltitudePoints.length > 0;
    const hasDuplicates = duplicateWaypoints.length > 0;
    const hasKmzTakeoffIssue = kmzTakeoffWarning !== null;
  
    let heightCheckStatus: "success" | "error" | "loading" = "loading";
    let heightCheckContent: React.ReactNode = (
      <div className="text-sm text-gray-500">Terrain analysis pending</div>
    );
  
    if (analysisData) {
      const clearances = analysisData.flightAltitudes.map(
        (alt, idx) => alt - analysisData.terrainElevations[idx]
      );
      const maxClearance = Math.max(...clearances);
      const hasExceededRegulatoryLimit = maxClearance > 120;
  
      if (hasExceededRegulatoryLimit) {
        heightCheckStatus = "error";
        heightCheckContent = (
          <div className="text-sm text-red-600">
            Flight altitude exceeds 120m regulatory limit: {maxClearance.toFixed(1)}m
          </div>
        );
      } else {
        heightCheckStatus = "success";
        heightCheckContent = (
          <div className="text-sm text-green-600">
            ✓ Maximum altitude: {maxClearance.toFixed(1)}m (within limit)
          </div>
        );
      }
    }
  
    const overallStatus: VerificationSection["status"] =
      hasZeroAltitudes || hasDuplicates || hasKmzTakeoffIssue || (analysisData && heightCheckStatus === "error")
        ? "error"
        : analysisData
        ? "success"
        : "pending";
  
    return {
      id: "basic",
      title: "Basic Flight Plan Checks",
      description: "Essential flight plan validation",
      status: overallStatus,
      subSections: [
        {
          title: "Zero Altitude Check",
          content: (
            <div>
              {hasZeroAltitudes ? (
                <div className="text-sm text-red-600">
                  Found {zeroAltitudePoints.length} zero altitude points:
                  {zeroAltitudePoints.map((point, idx) => (
                    <div key={idx} className="ml-2">
                      • Waypoint {point.index + 1}: (
                      {point.coord.map((v) => v.toFixed(2)).join(", ")})
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-green-600">
                  ✓ All waypoints have valid altitudes
                </div>
              )}
              {hasKmzTakeoffIssue && (
                <div className="text-sm text-yellow-600 mt-2">
                  ⚠️ {kmzTakeoffWarning}
                </div>
              )}
            </div>
          )
        },
        {
          title: "120m Height Check",
          content: heightCheckContent
        },
        {
          title: "Duplicate Waypoints Check",
          content: hasDuplicates ? (
            <div className="text-sm text-red-600">
              Found {duplicateWaypoints.length} duplicate waypoints:
              {duplicateWaypoints.map((point, idx) => (
                <div key={idx} className="ml-2">
                  • Waypoint {point.index + 1}: (
                  {point.coord.map((v) => v.toFixed(2)).join(", ")})
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-green-600">
              ✓ No duplicate waypoints found
            </div>
          )
        }
      ],
      actions: (
        <div className="flex flex-col gap-2 mt-3">
          <button
            onClick={() => {
              trackEvent("toggle_airspace_overlay", { panel: "planverification.tsx" });
              handleAddAirspaceOverlay(mapRef);
            }}
            className="mt-2 flex gap-2 px-3 py-1.5 bg-blue-500 justify-center text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
          >
            ✈️ Toggle Airspace
          </button>
          <button
            onClick={() => {
              trackEvent("insert_weather_click", { panel: "planverification.tsx" });
              if (typeof window !== "undefined") {
                window.alert("Coming Soon!");
              }
            }}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
          >
            Insert Weather
          </button>
        </div>
      )
    };
  };
  
// Energy analysis section
const getEnergyAnalysis = (): VerificationSection => {
  if (!flightPlan) {
    return {
      id: "energy",
      title: "Energy Analysis",
      description: "Check battery capacity against flight requirements",
      status: "pending"
    };
  }

  // Compute the status:
  // If the user hasn't opened the energy analysis, force a "warning" status.
  // Once opened, show "success" if metrics.isFeasible is true, otherwise "warning".
  const status = energyAnalysisOpened ? (metrics?.isFeasible ? "success" : "warning") : "warning";

  return {
    id: "energy",
    title: "Energy Analysis",
    description: "Battery and flight time verification",
    status, // Use the computed status value here
    subSections: [
      {
        title: "Battery Requirements",
        content: (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Required Capacity:</div>
              <div>{metrics?.expectedBatteryConsumption} mAh</div>
              <div>Available Capacity:</div>
              <div>{metrics?.availableBatteryCapacity} mAh</div>
              <div>Flight Time:</div>
              <div>{metrics?.flightTime}</div>
              <div>Reserve Required:</div>
              <div>{metrics?.batteryReserve} mAh</div>
              <div>Status:</div>
              <div className={metrics?.isFeasible ? "text-green-600" : "text-red-600"}>
                {energyAnalysisOpened
                  ? (metrics?.isFeasible 
                      ? "Flight plan within battery capacity" 
                      : "Flight plan exceeds battery capacity")
                  : "Review energy analysis for details"}
              </div>
            </div>
          </div>
        )
      }
    ],
    action: () => {
      // Update the state so that the warning is removed once opened.
      setEnergyAnalysisOpened(true);
      onTogglePanel('energy');
    },
    actionLabel: "Open Energy Analysis"
  };
};
  
  // Terrain analysis section
  const getTerrainAnalysis = (): VerificationSection => {
    if (!flightPlan) {
      return {
        id: "terrain",
        title: "Obstruction Analysis",
        description: "Check flight path against terrain and obstructions",
        status: "pending"
      };
    }

    if (!analysisData) {
      return {
        id: "terrain",
        title: "Obstruction Analysis",
        description: "Analyzing obstructions clearance...",
        status: "loading"
      };
    }

    const isSafe = analysisData.minimumClearanceHeight >= 0;
    return {
      id: "terrain",
      title: "Obstruction Analysis",
      description: "Obstruction clearance verification",
      status: isSafe ? "success" : "error",
      subSections: [
        {
          title: "Clearance Analysis",
          content: (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Minimum Clearance:</div>
                <div className={isSafe ? "text-green-600" : "text-red-600"}>
                  {analysisData.minimumClearanceHeight.toFixed(1)}m
                </div>
                <div>Closest Approach:</div>
                <div>{getMinClearanceDistance()?.toFixed(2)} km along route</div>
                <div>Highest Terrain:</div>
                <div>{analysisData.highestObstacle.toFixed(1)}m</div>
                <div>Flight Plan Altitude Range:</div>
                <div>
                  {Math.min(...analysisData.flightAltitudes).toFixed(1)}m - 
                  {Math.max(...analysisData.flightAltitudes).toFixed(1)}m
                </div>
              </div>
            </div>
          )
        }
      ],
      action: () => {
        trackEvent("terrain_detailed_analysis_click", { panel: "terrain", actionLabel: "View Detailed Analysis" });
        setShowTerrainPopup(true);
      },
      actionLabel: "View Detailed Analysis"
      
    };
  };

  const getLOSAnalysis = (): VerificationSection => {
    if (!flightPlan) {
      return {
        id: "los",
        title: "Line of Sight Analysis",
        description: "Verify communication coverage",
        status: "pending"
      };
    }
  
    if (!losResults) {
      return {
        id: "los",
        title: "Line of Sight Analysis",
        description: "Communication coverage not yet analyzed",
        status: "warning",
        action: () => onTogglePanel('los'),
        actionLabel: "Show LOS Analysis"
      };
    }
  
    const coverage = losResults.stats?.averageVisibility || 0;
    
    return {
      id: "los",
      title: "Line of Sight Analysis",
      description: "Communication coverage verification",
      status: coverage > 80 ? "success" : "warning",
      subSections: [
        {
          title: "Coverage Analysis",
          content: (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Average Coverage:</div>
                <div className={coverage > 80 ? "text-green-600" : "text-yellow-600"}>
                  {coverage.toFixed(1)}%
                </div>
                <div>Visible Cells:</div>
                <div>{losResults.stats?.visibleCells || 0}/{losResults.stats?.totalCells || 0}</div>
                <div>Analysis Time:</div>
                <div>{((losResults.stats?.analysisTime || 0) / 1000).toFixed(1)}s</div>
              </div>
  
              {losResults?.stationLOSResult && (
                <div className="mt-3">
                  {losResults.stationLOSResult.clear ? (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Clear line of sight between stations</span>
                    </div>
                  ) : (
                    <div className="flex flex-col text-red-600 text-sm">
                      <div className="flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        <span>Line of sight obstructed</span>
                      </div>
                      <div className="ml-6">
                        Obstruction at {losResults.stationLOSResult.obstructionDistance?.toFixed(1)}m (
                        {(losResults.stationLOSResult.obstructionFraction! * 100).toFixed(1)}% along path)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        }
      ],
      action: () => onTogglePanel('los'),
      actionLabel: "Adjust LOS Settings"
    };
  };

  // Combine all sections
  const sections = [
    getBasicChecks(),
    getEnergyAnalysis(),
    getTerrainAnalysis(),
    getLOSAnalysis(),
  ];

  const renderStatusIcon = (status: VerificationSection["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <span className="text-yellow-500">⚠️</span>;
      case "loading":
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <ChevronRight className="w-5 h-5 text-gray-400" />;
    }
  };

  // Auto terrain analysis on flight plan upload (guarded)
  useEffect(() => {
    if (flightPlan && mapRef.current?.getMap() && typeof window !== "undefined") {   
      const event = new CustomEvent("triggerTerrainAnalysis");
      window.dispatchEvent(event);
      console.log("triggerTerrainAnalysis event dispatched.");
    }
  }, [flightPlan, mapRef]);
  
  return (
    <div className="flex flex-col gap-2">
      {/* Show a loading indicator when analysis is running */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 p-2 bg-blue-100 text-blue-700 rounded">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing flight plan...</span>
        </div>
      )}
  
      {/* Hidden ObstacleAssessment/ELOS Grid analysis Component for background processing */}
      <div className="hidden">
        <ObstacleAssessment
          flightPlan={flightPlan}
          map={mapRef.current?.getMap() || null}
          onDataProcessed={async (data: ObstacleAnalysisOutput) => {
            console.log("ObstacleAssessment onDataProcessed fired", data);
            setAnalysisData(data);
            setIsAnalyzing(false);
          }}
        />
      </div>

      {/* Render sections */}
      {sections.map((section) => (
        <div key={section.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              {renderStatusIcon(section.status)}
              <div className="text-left">
                <h3 className="font-medium text-gray-900">{section.title}</h3>
                <p className="text-sm text-gray-500">{section.description}</p>
              </div>
            </div>
            {expandedSection === section.id ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
  
          {expandedSection === section.id && (
            <div className="px-4 py-3 bg-gray-50 border-t space-y-4">
              {section.subSections?.map((subSection, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium text-gray-700">{subSection.title}</h4>
                  {subSection.content}
                </div>
              ))}
              {section.actions ? (
                <div className="mt-3">{section.actions}</div>
              ) : section.action && (
                <>
                  <button
                    onClick={section.action}
                    className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                  >
                    {section.id === "energy" && <Battery className="w-4 h-4" />}
                    {section.id === "los" && <Radio className="w-4 h-4" />}
                    {section.id === "terrain" && <Mountain className="w-4 h-4" />}
                    {section.actionLabel}
                  </button>
                  {section.id === "terrain" && (
                    <button
                      onClick={() => {
                        trackEvent("toggle_powerlines_overlay", { panel: "planverification.tsx" });
                        handleAddPowerlines(mapRef);
                      }}
                      className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
                    >
                      ⚡ Toggle Powerlines
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
  
      {/* Terrain Clearance Popup */}
      {showTerrainPopup && (
        <TerrainClearancePopup
          onClose={() => {
            setShowTerrainPopup(false);
            setIsAnalyzing(false);
          }}
        />
      )}
    </div>
  );
};

export default PlanVerification;
