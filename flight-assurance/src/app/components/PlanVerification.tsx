/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { useFlightPlanContext } from "../context/FlightPlanContext";

// Checks to do
// checks={[
//   "No zero altitude points",
//   "Terrain clearance",
//   "No duplicate waypoints",
//   "Regulatory Altitude Limits",
// ]}

const PlanVerification: React.FC = () => {
  const { flightPlan } = useFlightPlanContext();
  const [statuses, setStatuses] = useState<{
    [key: string]: {
      status: "loading" | "success" | "error";
      errorMessages?: string[];
    };
  }>({});
  const [finalStatus, setFinalStatus] = useState<
    "loading" | "success" | "error"
  >("loading");

  useEffect(() => {
    const checkForZeros = async () => {
      if (!flightPlan) return;
      if (
        flightPlan &&
        flightPlan?.features &&
        flightPlan.features.length > 0
      ) {
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
        return;
      } else {
        setStatuses((prev) => ({
          ...prev,
          "No zero altitude points": { status: "success" },
        }));
      }
    };

    checkForZeros();
  }, [flightPlan]);

  useEffect(() => {
    const checkForDuplicates = async () => {
      if (!flightPlan) return;
      if (
        flightPlan &&
        flightPlan?.features &&
        flightPlan.features.length > 0
      ) {
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
        return;
      } else {
        setStatuses((prev) => ({
          ...prev,
          "No duplicate waypoints": { status: "success" },
        }));
      }
    };

    checkForDuplicates();
  }, [flightPlan]);

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

  return (
    <div className="flex flex-col gap-4 items-center p-4 border rounded-lg shadow-md bg-white w-full">
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

      <button className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90">
        See Terrain Clearance Analysis
      </button>

      {/* Simple Stats Box (Visual Placeholder) */}
      <div className="w-full max-w-md p-4 mt-4 border-t pt-3 bg-gray-100 rounded-md">
        <h3 className="text-md font-semibold mb-2">Flight Plan Statistics</h3>
        <div className="flex justify-between text-sm text-gray-700">
          <span>Minimum Altitude:</span>
          <span>--</span>
        </div>
        <div className="flex justify-between text-sm text-gray-700">
          <span>Maximum Altitude:</span>
          <span>--</span>
        </div>
        <div className="flex justify-between text-sm text-red-600">
          <span>Lowest Clearance Height:</span>
          <span>--</span>
        </div>
        <div className="flex justify-between text-sm text-blue-600">
          <span>Highest Terrain Altitude (within 3000m):</span>
          <span>--</span>
        </div>
      </div>
    </div>
  );
};

export default PlanVerification;
