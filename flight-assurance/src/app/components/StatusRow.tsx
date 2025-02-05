// StatusRow.tsx
import React, { useState } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";

interface StatusRowProps {
  label: string;
  status: "loading" | "success" | "error";
  errorMessages?: string[];
}

const StatusRow: React.FC<StatusRowProps> = ({ label, status, errorMessages }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col gap-1" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-gray-800 font-medium">{label}</span>
        {status === "loading" && (
          <Loader className="animate-spin text-gray-500 transition-all" />
        )}
        {status === "success" && (
          <CheckCircle className="text-green-500 transition-all" />
        )}
        {status === "error" && (
          <XCircle className="text-red-500 transition-all" />
        )}
      </div>
      {status === "error" && errorMessages && errorMessages.length > 0 && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-6 text-xs text-red-600 underline focus:outline-none"
            aria-expanded={showDetails}
          >
            {showDetails
              ? "Hide Details"
              : `View Details (${errorMessages.length})`}
          </button>
          {showDetails && (
            <ul className="ml-8 list-disc text-red-600">
              {errorMessages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default StatusRow;
