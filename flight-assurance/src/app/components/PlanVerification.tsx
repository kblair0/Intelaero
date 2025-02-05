// PlanVerification.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
import TerrainClearancePopup from "./TerrainClearancePopup";
import ObstacleAssessment from "./ObstacleAssessment";
import { MapRef } from "./Map";
import StatusRow from "./StatusRow";

interface PlanVerificationProps {
  mapRef: React.RefObject<MapRef>;
}

const PlanVerification: React.FC<PlanVerificationProps> = ({ mapRef }) => {
  const { flightPlan } = useFlightPlanContext();
  const { analysisData, setAnalysisData } = useObstacleAnalysis();
  const [statuses, setStatuses] = useState<{
    [key: string]: {
      status: "loading" | "success" | "error";
      errorMessages?: string[];
    };
  }>({});
  const [finalStatus, setFinalStatus] = useState<
    "loading" | "success" | "error"
  >("loading");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);

  const getMinClearanceDistance = (): number | null => {
    if (!analysisData) return null;
    const clearances = analysisData.flightAltitudes.map(
      (alt, idx) => alt - analysisData.terrainElevations[idx]
    );
    const minClearance = Math.min(...clearances);
    const index = clearances.indexOf(minClearance);
    return analysisData.distances[index];
  };

  // Debug logging to help trace state updates
  useEffect(() => {
    const map = mapRef.current?.getMap();
    console.log("State Update:");
    console.log("- Flight Plan:", !!flightPlan);
    console.log("- Map Reference:", !!mapRef.current?.getMap());
    console.log("- Map Ref Current:", mapRef.current);
    console.log("- getMap() returns:", map);
    console.log("- Is Analyzing:", isAnalyzing);
  }, [flightPlan, isAnalyzing, mapRef]);

  // Zero altitude check
  useEffect(() => {
    const checkForZeros = async () => {
      if (!flightPlan) return;
      if (flightPlan?.features && flightPlan.features.length > 0) {
        setStatuses((prev) => ({
          ...prev,
          "No zero altitude points": { status: "loading" },
        }));

        const zeroAltitudePoints: any[] = [];
        flightPlan?.features.forEach((feature: any) => {
          feature.geometry.coordinates.forEach((geometry: any) => {
            if (geometry.some((coordinate: any) => coordinate === 0)) {
              zeroAltitudePoints.push(geometry);
            }
          });
        });

        setStatuses((prev) => ({
          ...prev,
          "No zero altitude points": zeroAltitudePoints.length
            ? {
                status: "error",
                errorMessages: zeroAltitudePoints.map(
                  (point) => `Zero altitude found: ${JSON.stringify(point)}`
                ),
              }
            : { status: "success" },
        }));
      }
    };

    checkForZeros();
  }, [flightPlan]);

  // Duplicate waypoint check
  useEffect(() => {
    const checkForDuplicates = async () => {
      if (!flightPlan) return;
      if (flightPlan?.features && flightPlan.features.length > 0) {
        setStatuses((prev) => ({
          ...prev,
          "No duplicate waypoints": { status: "loading" },
        }));

        const duplicateEntries: any[] = [];
        flightPlan?.features.forEach((feature: any) => {
          const coordinatesSet = new Set();
          feature.geometry.coordinates.forEach((geometry: any) => {
            const coordString = JSON.stringify(geometry);
            if (coordinatesSet.has(coordString)) {
              duplicateEntries.push(geometry);
            }
            coordinatesSet.add(coordString);
          });
        });

        setStatuses((prev) => ({
          ...prev,
          "No duplicate waypoints":
            duplicateEntries.length > 0
              ? {
                  status: "error",
                  errorMessages: duplicateEntries.map(
                    (entry) =>
                      `Duplicate entry found: ${JSON.stringify(entry)}`
                  ),
                }
              : { status: "success" },
        }));
      }
    };

    checkForDuplicates();
  }, [flightPlan]);

  // Update overall final status based on individual checks
  useEffect(() => {
    if (Object.keys(statuses).length === 0) {
      setFinalStatus("loading");
      return;
    }
    const hasError = Object.values(statuses).some(
      (status) => status.status === "error"
    );
    setFinalStatus(hasError ? "error" : "success");
  }, [statuses]);

  const handleTerrainAnalysis = () => {
    const map = mapRef.current?.getMap();
    console.log("Terrain Analysis Handler:", {
      hasFlightPlan: !!flightPlan,
      mapRef: mapRef.current,
      map: map,
      isAnalyzing,
    });

    if (!flightPlan || !map) {
      console.log("Missing required data:", {
        hasFlightPlan: !!flightPlan,
        hasMap: !!map,
      });
      return;
    }

    setIsAnalyzing(true);
    setShowTerrainPopup(true);

    // Dispatch event to trigger terrain analysis
    const event = new CustomEvent("triggerTerrainAnalysis");
    window.dispatchEvent(event);
  };

  return (
    <div
      className="flex flex-col gap-4 items-center p-4 border rounded-lg shadow-md bg-white w-full transition-all"
      role="region"
      aria-labelledby="plan-verification-heading"
    >
      {/* Hidden ObstacleAssessment Component */}
      <div className="hidden">
        <ObstacleAssessment
          flightPlan={flightPlan}
          map={mapRef.current?.getMap() || null}
          onDataProcessed={(data) => {
            setAnalysisData(data);
            setIsAnalyzing(false);
          }}
        />
      </div>

      <h2 id="plan-verification-heading" className="text-lg font-medium">
        Plan Verification
      </h2>

      {/* Overall Status Section */}
      <section
        className="flex flex-col items-center"
        aria-label="Overall Status"
      >
        {!flightPlan && (
          <div className="mb-2 text-gray-700 text-center">
            Awaiting Flight Plan Upload
          </div>
        )}
        {finalStatus === "loading" ? (
          <Loader className="animate-spin text-gray-500 w-16 h-16" />
        ) : finalStatus === "success" ? (
          <CheckCircle className="text-green-500 w-16 h-16" />
        ) : (
          <XCircle className="text-red-500 w-16 h-16" />
        )}
      </section>

      {/* Plan Checks Section */}
      <section className="w-full max-w-md" aria-label="Plan Checks">
        <h3 className="text-md font-semibold mb-2">Plan Checks</h3>
        <ul className="space-y-2">
          {Object.keys(statuses).map((check) => (
            <StatusRow
              key={check}
              label={check}
              status={statuses[check].status}
              errorMessages={statuses[check].errorMessages}
            />
          ))}
        </ul>
      </section>

      {/* Terrain Clearance Verification Section */}
      <section
        className="w-full max-w-md"
        aria-label="Terrain Clearance Verification"
      >
        <h3 className="text-md font-semibold mb-2">
          Terrain Clearance Verification
        </h3>
        {analysisData ? (
          <div className="flex flex-col gap-2">
            {analysisData.minimumClearanceHeight >= 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle />
                <span>Flight plan clearance is safe (no terrain hit).</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle />
                <span>
                  Clearance below ground:{" "}
                  {analysisData.minimumClearanceHeight.toFixed(1)}m
                </span>
              </div>
            )}
            <div className="text-sm text-gray-700">
              <div>
                <strong>Minimum Clearance:</strong>{" "}
                {analysisData.minimumClearanceHeight.toFixed(1)}m
              </div>
              {getMinClearanceDistance() !== null && (
                <div>
                  <strong>Location of Closest Approach:</strong>{" "}
                  {getMinClearanceDistance()?.toFixed(2)} km along the route
                </div>
              )}
              {analysisData.minimumClearanceHeight < 0 && (
                <div className="text-sm text-red-600">
                  The flight path intersects the terrain. Please review and
                  adjust your plan.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Loader className="animate-spin text-gray-500 w-6 h-6" />
            <span>Waiting for terrain clearance data...</span>
          </div>
        )}
      </section>

      {/* Flight Plan Statistics Section */}
      <section className="w-full max-w-md" aria-label="Flight Plan Statistics">
        <h3 className="text-md font-semibold mb-2">
          Flight Plan Statistics
        </h3>
        <div className="flex justify-between text-sm text-gray-700">
          <span>Minimum Altitude:</span>
          <span>
            {analysisData
              ? `${Math.min(...analysisData.flightAltitudes).toFixed(1)}m`
              : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm text-gray-700">
          <span>Maximum Altitude:</span>
          <span>
            {analysisData
              ? `${Math.max(...analysisData.flightAltitudes).toFixed(1)}m`
              : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm text-red-600">
          <span>Lowest Clearance Height:</span>
          <span>
            {analysisData?.minimumClearanceHeight !== undefined
              ? `${analysisData.minimumClearanceHeight.toFixed(1)}m`
              : "--"}
          </span>
        </div>
        <div className="flex justify-between text-sm text-blue-600">
          <span>Highest Terrain Altitude:</span>
          <span>
            {analysisData?.highestObstacle !== undefined
              ? `${analysisData.highestObstacle.toFixed(1)}m`
              : "--"}
          </span>
        </div>
      </section>

      {/* Terrain Analysis Button */}
      <button
        onClick={handleTerrainAnalysis}
        disabled={!flightPlan || !mapRef.current?.getMap() || isAnalyzing}
        className={`px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90 focus:outline-none transition-all ${
          !flightPlan || !mapRef.current?.getMap() || isAnalyzing
            ? "opacity-50 cursor-not-allowed"
            : ""
        }`}
      >
        {isAnalyzing ? "Analyzing..." : "Run Terrain Analysis"}
      </button>

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
