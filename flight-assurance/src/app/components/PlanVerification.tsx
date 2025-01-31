import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";

interface PlanVerificationProps {
  checks: string[];
}

const PlanVerification: React.FC<PlanVerificationProps> = ({ checks }) => {
  const [statuses, setStatuses] = useState<{ [key: string]: "loading" | "success" | "error" }>({});
  const [finalStatus, setFinalStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const runChecks = async () => {
      const results: { [key: string]: "success" | "error" } = {};

      for (const check of checks) {
        setStatuses((prev) => ({ ...prev, [check]: "loading" }));

        // Simulate an asynchronous check
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Randomly determine if the check passed or failed (replace this with real logic)
        const passed = Math.random() > 0.5;
        results[check] = passed ? "success" : "error";

        setStatuses((prev) => ({ ...prev, [check]: results[check] }));
      }

      // Determine final status
      setFinalStatus(Object.values(results).includes("error") ? "error" : "success");
    };

    runChecks();
  }, [checks]);

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
        {checks.map((check) => (
          <li key={check} className="flex items-center gap-3">
            <span className="flex-1 text-gray-800">{check}</span>
            {statuses[check] === "loading" && <Loader className="animate-spin text-gray-500" />}
            {statuses[check] === "success" && <CheckCircle className="text-green-500" />}
            {statuses[check] === "error" && <XCircle className="text-red-500" />}
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
