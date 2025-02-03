import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useObstacleAnalysis } from "../context/ObstacleAnalysisContext";
import TerrainClearancePopup from "./TerrainClearancePopup";
import ObstacleAssessment from "./ObstacleAssessment";
import { MapRef } from "./Map";

interface PlanVerificationProps {
  mapRef: React.RefObject<MapRef>;
  checks: string[];
}

const PlanVerification: React.FC<PlanVerificationProps> = ({ mapRef, checks }) => {
  const { flightPlan } = useFlightPlanContext();
  const { analysisData, setAnalysisData } = useObstacleAnalysis();
  const [statuses, setStatuses] = useState<{
    [key: string]: {
      status: "loading" | "success" | "error";
      errorMessages?: string[];
    };
  }>({});
  const [finalStatus, setFinalStatus] = useState<"loading" | "success" | "error">("loading");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTerrainPopup, setShowTerrainPopup] = useState(false);

  const getMinClearanceDistance = (): number | null => {
    if (!analysisData) return null;
    const clearances = analysisData.flightAltitudes.map((alt, idx) => alt - analysisData.terrainElevations[idx]);
    const minClearance = Math.min(...clearances);
    const index = clearances.indexOf(minClearance);
    return analysisData.distances[index];
  };

  useEffect(() => {
    const map = mapRef.current?.getMap();
    console.log('State Update:');
    console.log('- Flight Plan:', !!flightPlan);
    console.log('- Map Reference:', !!mapRef.current?.getMap());
    console.log('- Map Ref Current:', mapRef.current);
    console.log('- getMap() returns:', map);
    console.log('- Is Analyzing:', isAnalyzing);
  }, [flightPlan, mapRef.current?.getMap(), isAnalyzing]);

  // Original zero altitude check
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
          return feature.geometry.coordinates.forEach((geometry: any) => {
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

  // Original duplicate check
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
          return feature.geometry.coordinates.forEach((geometry: any) => {
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
                    (entry) => `Duplicate entry found ${JSON.stringify(entry)}`
                  ),
                }
              : { status: "success" },
        }));
      }
    };

    checkForDuplicates();
  }, [flightPlan]);

  // Status effect
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
    console.log('Terrain Analysis Handler:', {
      hasFlightPlan: !!flightPlan,
      mapRef: mapRef.current,
      map: map,
      isAnalyzing
    });
    
    if (!flightPlan || !map) {
      console.log('Missing required data:', {
        hasFlightPlan: !!flightPlan,
        hasMap: !!map
      });
      return;
    }
    
    setIsAnalyzing(true);
    setShowTerrainPopup(true);
    
    const event = new CustomEvent('triggerTerrainAnalysis');
    window.dispatchEvent(event);
  };

  return (
    <div className="flex flex-col gap-4 items-center p-4 border rounded-lg shadow-md bg-white w-full">
      {/* Hidden ObstacleAssessment */}
      <div style={{ display: 'none' }}>
        <ObstacleAssessment
          flightPlan={flightPlan}
          map={mapRef.current?.getMap() || null}
          onDataProcessed={(data) => {
            setAnalysisData(data);
            setIsAnalyzing(false);
          }}
        />
      </div>

      <h2 className="text-lg font-medium">Plan Verification</h2>

      {/* Overall Status Indicator */}
      {finalStatus === "loading" ? (
        <Loader className="animate-spin text-gray-500 w-16 h-16" />
      ) : finalStatus === "success" ? (
        <CheckCircle className="text-green-500 w-16 h-16" />
      ) : (
        <XCircle className="text-red-500 w-16 h-16" />
      )}

      {/* List of checks with statuses */}
      <ul className="space-y-2 w-full max-w-md">
        {Object.keys(statuses).map((check) => (
          <li key={check} className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-gray-800">{check}</span>
              {statuses[check]?.status === "loading" && (
                <Loader className="animate-spin text-gray-500" />
              )}
              {statuses[check]?.status === "success" && (
                <CheckCircle className="text-green-500" />
              )}
              {statuses[check]?.status === "error" && (
                <XCircle className="text-red-500" />
              )}
            </div>
            {statuses[check]?.status === "error" &&
              statuses[check]?.errorMessages &&
              statuses[check]?.errorMessages.length > 0 && (
                <ul className="ml-6 list-disc text-red-500">
                  {statuses[check]?.errorMessages.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              )}
          </li>
        ))}
      </ul>

      <button 
      onClick={handleTerrainAnalysis}
      disabled={!flightPlan || !mapRef.current?.getMap() || isAnalyzing}
      className={`px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90 ${
        (!flightPlan || !mapRef.current?.getMap() || isAnalyzing) ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {isAnalyzing ? 'Analyzing...' : 'See Terrain Clearance Analysis'}
    </button>

    {/* New Terrain Clearance Check UI Section */}
    <div className="w-full max-w-md p-4 mt-4 border-t pt-3 bg-gray-100 rounded-md">
        <h3 className="text-md font-semibold mb-2">Terrain Clearance Verification</h3>
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
                  Clearance below ground: {analysisData.minimumClearanceHeight.toFixed(1)}m
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
                  The flight path intersects the terrain. Please review and adjust your plan.
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
      </div>

      {/* Stats Box */}
      <div className="w-full max-w-md p-4 mt-4 border-t pt-3 bg-gray-100 rounded-md">
        <h3 className="text-md font-semibold mb-2">Flight Plan Statistics</h3>
        <div className="flex justify-between text-sm text-gray-700">
          <span>Minimum Altitude:</span>
          <span>{analysisData ? `${Math.min(...analysisData.flightAltitudes).toFixed(1)}m` : '--'}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-700">
          <span>Maximum Altitude:</span>
          <span>{analysisData ? `${Math.max(...analysisData.flightAltitudes).toFixed(1)}m` : '--'}</span>
        </div>
        <div className="flex justify-between text-sm text-red-600">
          <span>Lowest Clearance Height:</span>
          <span>{analysisData?.minimumClearanceHeight ? `${analysisData.minimumClearanceHeight.toFixed(1)}m` : '--'}</span>
        </div>
        <div className="flex justify-between text-sm text-blue-600">
          <span>Highest Terrain Altitude:</span>
          <span>{analysisData?.highestObstacle ? `${analysisData.highestObstacle.toFixed(1)}m` : '--'}</span>
        </div>
      </div>

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