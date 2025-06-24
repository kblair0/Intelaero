/**
 * SandboxCard.tsx - Experimental Features Access Point
 *
 * Purpose: Provides a streamlined access point to experimental and demonstration features
 * This card follows the single responsibility principle - opening the sandbox
 * dashboard panel when clicked. All experimental functionality will be contained
 * within the sandbox dashboard itself.
 *
 * Visual Design:
 * - Modern card design with purple/blue gradients for experimental theme
 * - Enhanced icon container with gradient background
 * - Hover effects and smooth transitions
 * - Consistent with overall dashboard design patterns
 *
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - SandboxDashboard: Will contain experimental and demonstration tools
 * - Future experimental components will be accessed through this entry point
 *
 * Dependencies:
 * - VerificationCardProps interface from types
 * - Lucide React icons
 * - Tracking system for analytics
 */
'use client';
import React from "react";
import { Beaker, ChevronRight } from "lucide-react";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Enhanced Sandbox Card
 * Provides direct access to experimental and demonstration features
 */
const SandboxCard: React.FC<VerificationCardProps> = ({
  onTogglePanel
}) => {
  /**
   * Opens the sandbox panel for experimental features
   */
  const handleOpenSandboxPanel = () => {
    trackEvent("open_sandbox", { panel: "sandbox.tsx" });
    if (onTogglePanel) {
      onTogglePanel("sandbox");
    }
  };

  return (
    <div
      className="border-2 border-gray-200 m-1 rounded-xl bg-white shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-purple-300 hover:bg-gradient-to-r hover:from-purple-50 hover:to-white transition-all duration-200 transform hover:scale-[1.02]"
      onClick={handleOpenSandboxPanel}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-sm">
            <Beaker className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Sandbox Features</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Experimental & demo tools</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
      </div>
    </div>
  );
};

export default SandboxCard;