import React, { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleCardProps {
  children: ReactNode;
  title: string;
  defaultExpanded?: boolean;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  children,
  title,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="flex-1 bg-white shadow-lg rounded-lg border border-gray-200 p-3 m-3">
      {/* Header */}
      <div
        className="flex items-center border-b border-gray-200 cursor-pointer hover:bg-gray-50 pb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <button
          className="text-gray-500 hover:text-gray-700 transition-colors mr-2"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      {/* Content */}
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          isExpanded
            ? "opacity-100 mt-2"
            : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleCard;
