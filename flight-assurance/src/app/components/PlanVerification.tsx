// components/PlanVerification.tsx
import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";

interface PlanVerificationProps {
  checks: string[];
}

const PlanVerification: React.FC<PlanVerificationProps> = ({ checks }) => {
  const [statuses, setStatuses] = useState<{ [key: string]: "loading" | "success" | "error" }>(
    {}
  );
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
    <div className="flex flex-col gap-4 items-center">
      <h2 className="text-lg font-medium">Plan Verification</h2>

      {/* Display massive tick or cross based on final status */}
      {finalStatus === "loading" ? (
        <Loader className="animate-spin text-gray-500 w-16 h-16" />
      ) : finalStatus === "success" ? (
        <CheckCircle className="text-green-500 w-16 h-16" />
      ) : (
        <XCircle className="text-red-500 w-16 h-16" />
      )}

      {/* List of checks with individual statuses */}
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
    </div>
  );
};

export default PlanVerification;
