/**
 * EnergyAnalysisCard.tsx - Enhanced Visual Design
 *
 * Purpose: Provides a streamlined access point to flight energy analysis tools
 * This simplified card focuses on a single responsibility - opening the energy
 * analysis dashboard panel when clicked. All complex functionality and detailed
 * metrics display has been moved to the dashboard itself.
 *
 * Visual Enhancements:
 * - Modern card design with orange/amber gradients for energy theme
 * - Enhanced icon container with gradient background
 * - Better spacing and typography
 * - Consistent with enhanced dashboard theme
 * - Removed expandable functionality for cleaner design
 *
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - EnergyAnalysisDashboard: Contains the detailed energy analysis tools and metrics
 * - FlightConfigurationContext: Provides battery and flight metrics (used in dashboard)
 *
 * Migration Notes:
 * - Detailed metrics display moved to EnergyAnalysisDashboard
 * - Expandable functionality removed in favor of dedicated dashboard
 * - YouTube guide link moved to dashboard
 * - File upload functionality moved to dashboard
 */
'use client';
import React from "react";
import { Battery, ChevronRight } from "lucide-react";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Enhanced Energy Analysis Card
 * Provides direct access to flight energy analysis and battery validation tools
 */
const EnergyAnalysisCard: React.FC<VerificationCardProps> = ({
  onTogglePanel
}) => {
  /**
   * Opens the energy analysis panel
   */
  const handleOpenEnergyPanel = () => {
    trackEvent("open_energy_analysis", { panel: "energyanalysis.tsx" });
    if (onTogglePanel) {
      onTogglePanel("energy");
    }
  };

  return (
    <div
      className="border-2 border-gray-200 m-1 rounded-xl bg-white shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-orange-300 hover:bg-gradient-to-r hover:from-orange-50 hover:to-white transition-all duration-200 transform hover:scale-[1.02]"
      onClick={handleOpenEnergyPanel}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-sm">
            <Battery className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Energy Analysis</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Battery & flight time validation</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
      </div>
    </div>
  );
};

export default EnergyAnalysisCard;