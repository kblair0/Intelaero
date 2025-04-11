"use client";
import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Loader, ChevronDown, ChevronRight, Battery, Radio, Mountain, Upload } from "lucide-react";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
import { useFlightConfiguration } from "../context/FlightConfigurationContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { ObstacleAnalysisOutput } from "../context/ObstacleAnalysisContext";
import dynamic from "next/dynamic";
import { MapRef } from "./Map";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";
import { useAreaOfOpsContext } from "../context/AreaOfOpsContext";
import AOGenerator, { AOGeneratorRef } from "./AO/AOGenerator";

// Dynamically load components that use browser APIs
const ObstacleAssessment = dynamic(() => import("./ObstacleAssessment"), { ssr: false });
const TerrainClearancePopup = dynamic(() => import("./TerrainClearancePopup"), { ssr: false });

// Define layer toggle functions
const toggleLayerVisibility = (mapRef: React.RefObject<MapRef>, layerName: string) => {
  if (!mapRef.current) return;
  const map = mapRef.current.getMap();
  if (!map) return;
  const visibility = map.getLayoutProperty(layerName, "visibility");
  map.setLayoutProperty(layerName, "visibility", visibility === "visible" ? "none" : "visible");
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
  onTogglePanel: (panel: "energy" | "los" | null) => void;
}

interface VerificationSection {
  id: string;
  title: string;
  description: string;
  status: "pending" | "loading" | "success" | "error" | "warning";
  details?: string[];
  action?: () => void;
  actionLabel?: string;
  actions?: React.ReactNode;
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
  properties: Record<string, any>; // Adjusted to `any` for flexibility
}

const PlanVerification: React.FC<PlanVerificationProps> = ({ mapRef, onTogglePanel }) => {
  const { flightPlan } = useFlightPlanContext();
  const { metrics } = useFlightConfiguration();
  const { analysisData, setAnalysisData } = useObstacleAnalysis();
  const { results: losResults } = useLOSAnalysis();
  //Ao Draft Implementation
  const { generateAO } = useAreaOfOpsContext();
  const aoGeneratorRef = useRef<AOGeneratorRef>(null);

  const [expandedSection, setExpandedSection] = useState<string | null>("basic");
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [zeroAltitudePoints, setZeroAltitudePoints] = useState<WaypointCoordinate[]>([]);
  const [duplicateWaypoints, setDuplicateWaypoints] = useState<WaypointCoordinate[]>([]);
  const [kmzTakeoffWarning, setKmzTakeoffWarning] = useState<string | null>(null);
  const [energyAnalysisOpened, setEnergyAnalysisOpened] = useState(false);

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
    const isKmz = flightPlan.properties?.metadata?.distance !== undefined;
    if (isKmz) {
      const mode = flightPlan.features[0]?.properties?.waypoints?.[0]?.altitudeMode;
      const takeoffHeight = (flightPlan.properties?.config as { takeoffHeight?: number } | undefined)?.takeoffHeight || 0;
      const homeAltitude = flightPlan.properties?.homePosition?.altitude || 0;
      if ((mode === "terrain" || mode === "relative") && takeoffHeight === 0 && homeAltitude === 0) {
        setKmzTakeoffWarning(
          "Warning: Takeoff security height missing in terrain or relative mission; home altitude is 0m."
        );
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
      const seen = new Set<string>();
      feature.geometry.coordinates.forEach((coord: number[], index: number) => {
        const key = coord.join(",");
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
        status: "pending",
      };
    }

    const hasZeroAltitudes = zeroAltitudePoints.length > 0;
    const hasDuplicates = duplicateWaypoints.length > 0;
    const hasKmzTakeoffIssue = kmzTakeoffWarning !== null;

    let heightCheckStatus: "success" | "warning" | "loading" = "loading";
    let heightCheckContent: React.ReactNode = (
      <div className="text-sm text-gray-500">Terrain analysis pending</div>
    );

    if (analysisData) {
      const clearances = analysisData.flightAltitudes.map(
        (alt, idx) => alt - analysisData.terrainElevations[idx]
      );
      const maxClearance = Math.max(...clearances.filter((c) => !isNaN(c)));
      const exceedsHeightLimit = maxClearance > 120;

      if (exceedsHeightLimit) {
        heightCheckStatus = "warning";
        heightCheckContent = (
          <div className="text-sm text-yellow-600">
            ⚠️ Maximum height above ground exceeds 120m: {maxClearance.toFixed(1)}m AGL
          </div>
        );
      } else {
        heightCheckStatus = "success";
        heightCheckContent = (
          <div className="text-sm text-green-600">
            ✓ Maximum height above ground: {maxClearance.toFixed(1)}m AGL (within 120m limit)
          </div>
        );
      }
    }

    const heightMode = flightPlan.features[0]?.properties?.waypoints?.[0]?.altitudeMode || "Unknown";
    let heightModeDisplay: string;
    switch (heightMode) {
      case "terrain":
        heightModeDisplay = "Terrain Following (10m Fidelity Shown)";
        break;
      case "relative":
        heightModeDisplay = "Relative To Start Point";
        break;
      case "absolute":
        heightModeDisplay = "Absolute (Set AMSL Altitudes)";
        break;
      default:
        heightModeDisplay = "Unknown";
    }

    const overallStatus: VerificationSection["status"] =
      hasZeroAltitudes || hasDuplicates || hasKmzTakeoffIssue
        ? "error"
        : analysisData
        ? heightCheckStatus === "warning"
          ? "warning"
          : "success"
        : "pending";

    return {
      id: "basic",
      title: "Basic Flight Plan Checks",
      description: "Essential flight plan validation",
      status: overallStatus,
      subSections: [
        {
          title: "Explicit Height Mode",
          content: (
            <div className="text-sm">
              {heightMode === "Unknown" ? (
                <span className="text-yellow-600">⚠️ Height mode not detected</span>
              ) : (
                <span className="text-green-600">✓ {heightModeDisplay}</span>
              )}
            </div>
          ),
        },
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
                <div className="text-sm text-green-600">✓ All waypoints have valid altitudes</div>
              )}
              {hasKmzTakeoffIssue && (
                <div className="text-sm text-yellow-600 mt-2">⚠️ {kmzTakeoffWarning}</div>
              )}
            </div>
          ),
        },
        {
          title: "120m AGL Height Check",
          content: heightCheckContent,
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
            <div className="text-sm text-green-600">✓ No duplicate waypoints found</div>
          ),
        },
      ],
      actions: (
        <div className="flex flex-col gap-2 mt-3">
          <button
            onClick={() => {
              trackEvent("toggle_airspace_overlay", { panel: "planverification.tsx" });
              handleAddAirspaceOverlay(mapRef);
            }}
            className="flex gap-2 px-3 py-1.5 bg-blue-500 justify-center text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
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
      ),
    };
  };

  // Energy analysis section
  const getEnergyAnalysis = (): VerificationSection => {
    if (!flightPlan) {
      return {
        id: "energy",
        title: "Energy Analysis",
        description: "Check battery capacity against flight requirements",
        status: "pending",
      };
    }

    const status = energyAnalysisOpened
      ? metrics?.isFeasible
        ? "success"
        : "error"
      : "warning";

    return {
      id: "energy",
      title: "Energy Analysis",
      description: "Battery and flight time verification",
      status,
      subSections: [
        {
          title: "Battery Requirements",
          content: (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Required Capacity:</div>
                <div>{metrics?.expectedBatteryConsumption ?? "N/A"} mAh</div>
                <div>Available Capacity:</div>
                <div>{metrics?.availableBatteryCapacity ?? "N/A"} mAh</div>
                <div>Flight Time:</div>
                <div>{metrics?.flightTime ?? "N/A"}</div>
                <div>Reserve Required:</div>
                <div>{metrics?.batteryReserve ?? "N/A"} mAh</div>
                <div>Status:</div>
                <div
                  className={
                    energyAnalysisOpened
                      ? metrics?.isFeasible
                        ? "text-green-600"
                        : "text-red-600"
                      : "text-yellow-600"
                  }
                >
                  {energyAnalysisOpened
                    ? metrics?.isFeasible
                      ? "✓ Flight plan within battery capacity"
                      : "✗ Flight plan exceeds battery capacity"
                    : "⚠️ Review energy analysis for details"}
                </div>
              </div>
            </div>
          ),
        },
      ],
      actions: (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setEnergyAnalysisOpened(true);
              onTogglePanel("energy");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
          >
            <Battery className="w-4 h-4" />
            Open Energy Analysis
          </button>
          <button
            onClick={() => {
              trackEvent("upload_bin_ulg_click", { panel: "planverification.tsx" });
              if (typeof window !== "undefined") {
                window.alert("Coming Soon!");
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload BIN/ULG File for Analysis
          </button>
        </div>
      ),
    };
  };

  // Terrain analysis section
  const getTerrainAnalysis = (): VerificationSection => {
    if (!flightPlan) {
      return {
        id: "terrain",
        title: "Obstruction Analysis",
        description: "Check flight path against terrain and obstructions",
        status: "pending",
      };
    }

    if (!analysisData) {
      return {
        id: "terrain",
        title: "Obstruction Analysis",
        description: "Analyzing obstructions clearance...",
        status: "loading",
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
                  {Math.min(...analysisData.flightAltitudes).toFixed(1)}m -{" "}
                  {Math.max(...analysisData.flightAltitudes).toFixed(1)}m
                </div>
              </div>
            </div>
          ),
        },
      ],
      action: () => {
        trackEvent("terrain_detailed_analysis_click", {
          panel: "terrain",
          actionLabel: "View Detailed Analysis",
        });
        setShowTerrainPopup(true);
      },
      actionLabel: "View Detailed Analysis",
      actions: (
        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={() => {
              trackEvent("toggle_powerlines_overlay", { panel: "planverification.tsx" });
              handleAddPowerlines(mapRef);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
          >
            ⚡ Toggle Powerlines
          </button>
          <button
            onClick={() => {
              trackEvent("generate_ao_click", { panel: "planverification.tsx" });
              aoGeneratorRef.current?.generateAO();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
          >
            🌍 Generate Area of Operations
          </button>
        </div>
      ),
    };
  };

  // LOS analysis section
  const getLOSAnalysis = (): VerificationSection => {
    if (!flightPlan) {
      return {
        id: "los",
        title: "Line of Sight Analysis",
        description: "Verify communication coverage",
        status: "pending",
      };
    }

    if (!losResults) {
      return {
        id: "los",
        title: "Line of Sight Analysis",
        description: "Communication coverage not yet analyzed",
        status: "warning",
        action: () => onTogglePanel("los"),
        actionLabel: "Show LOS Analysis",
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
                <div>
                  {losResults.stats?.visibleCells || 0}/{losResults.stats?.totalCells || 0}
                </div>
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
          ),
        },
      ],
      action: () => onTogglePanel("los"),
      actionLabel: "Adjust LOS Settings",
    };
  };

  // Combine all sections
  const sections = [getBasicChecks(), getEnergyAnalysis(), getTerrainAnalysis(), getLOSAnalysis()];

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

      {/* Hidden AOGenerator Component */}
      <div className="hidden">
        <AOGenerator ref={aoGeneratorRef} mapRef={mapRef} /> {/* Pass mapref */}
      </div>

      {/* Hidden ObstacleAssessment Component */}
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
      {sections.map((section) => {
        const guideUrls = {
          basic: "https://youtu.be/iUYkmdUv46A",
          energy: "https://youtu.be/mJTWGmtgtZg",
          terrain: "https://youtu.be/H1JveIqB_v4",
          los: "https://youtu.be/u-WPwwh1tpA",
        };
        const guideUrl =
          guideUrls[section.id as keyof typeof guideUrls] || "https://www.youtube.com/channel/UCstd7Ks-s7hlZA8zmAxMlvw";

        return (
          <div key={section.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {renderStatusIcon(section.status)}
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{section.title}</h3>
                    <a
                      href={guideUrl}
                      target="_blank"
                      rel="intel.aero_testing"
                      className="inline-flex gap-1 items-center"
                      aria-label={`Watch YouTube guide for ${section.title}`}
                    >
                      <svg
                        className="w-5 h-5 text-red-600 hover:text-red-700 transition-colors"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M23.5 6.2c-.3-1.1-1.1-2-2.2-2.3C19.1 3.5 12 3.5 12 3.5s-7.1 0-9.3.4c-1.1.3-1.9 1.2-2.2 2.3C.5 8.4.5 12 .5 12s0 3.6.4 5.8c.3 1.1 1.1 2 2.2 2.3 2.2.4 9.3.4 9.3.4s7.1 0 9.3-.4c-1.1-.3 1.9-1.2 2.2-2.3.4-2.2.4-5.8.4-5.8s0-3.6-.4-5.8zM9.8 15.5V8.5l6.2 3.5-6.2 3.5z" />
                      </svg>
                      <span className="text-xs text-red-600 hover:text-red-700 transition-colors">Guide</span>
                    </a>
                  </div>
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
                ) : section.action ? (
                  <div className="mt-3">
                    <button
                      onClick={section.action}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                    >
                      {section.id === "energy" && <Battery className="w-4 h-4" />}
                      {section.id === "los" && <Radio className="w-4 h-4" />}
                      {section.id === "terrain" && <Mountain className="w-4 h-4" />}
                      {section.actionLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

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