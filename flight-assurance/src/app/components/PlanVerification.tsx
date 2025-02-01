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
    [key: string]: "loading" | "success" | "error";
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
          "No zero altitude points": "loading",
        }));

        const hasZeros = flightPlan?.features.some((feature: any) => {
          return feature.geometry.coordinates.some((geometry: any) => {
            return geometry.some((coordinate: any) => coordinate === 0);
          });
        });
        setStatuses((prev) => ({
          ...prev,
          "No zero altitude points": hasZeros ? "error" : "success",
        }));
        return;
      } else {
        setStatuses((prev) => ({
          ...prev,
          "No zero altitude points": "success",
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
          "No duplicate waypoints": "loading",
        }));

        const hasDuplicates = flightPlan?.features.some((feature: any) => {
          const coordinatesSet = new Set();
          return feature.geometry.coordinates.some((geometry: any) => {
            const coordString = JSON.stringify(geometry);
            if (coordinatesSet.has(coordString)) {
              console.log("Duplicate coordinate found:", geometry);
              return true;
            }
            coordinatesSet.add(coordString);
            return false;
          });
        });

        setStatuses((prev) => ({
          ...prev,
          "No duplicate waypoints": hasDuplicates ? "error" : "success",
        }));
        return;
      } else {
        setStatuses((prev) => ({
          ...prev,
          "No duplicate waypoints": "success",
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
    const hasError = Object.values(statuses).includes("error");
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
          <li key={check} className="flex items-center gap-3">
            <span className="flex-1 text-gray-800">{check}</span>
            {statuses[check] === "loading" && (
              <Loader className="animate-spin text-gray-500" />
            )}
            {statuses[check] === "success" && (
              <CheckCircle className="text-green-500" />
            )}
            {statuses[check] === "error" && (
              <XCircle className="text-red-500" />
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
