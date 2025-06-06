/**
 * PlanVerification/Cards/VisibilityAnalysisCard.tsx
 * 
 * Purpose:
 * Provides a streamlined interface for accessing Line of Sight (LOS) analysis.
 * This component serves as a quick-access point to the LOS analysis system
 * from the verification dashboard.
 * 
 * This component:
 * - Displays a simple, informative card about visibility analysis
 * - Opens the LOS analysis panel with a single click
 * - Provides concise guidance on how visibility analysis can help planning
 * 
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - AnalysisDashboard: The detailed LOS analysis components
 * - LOSAnalysisContext: Provides analysis data and functionality
 */

'use client';
import React from "react";
import { Eye } from "lucide-react";
import { useAnalysisController } from "../../../context/AnalysisControllerContext";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Simplified Visibility Analysis Card
 * Provides direct access to LOS analysis tools
 */
const VisibilityAnalysisCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  onTogglePanel
}) => {
  /**
   * Opens the LOS analysis panel
   */
  const handleOpenLOSPanel = () => {
    trackEvent("open_los_analysis", { panel: "losanalysis.tsx" });
    if (onTogglePanel) {
      onTogglePanel("los");
    }
  };

  return (
    <div 
      className="border rounded-lg bg-white shadow-sm overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={handleOpenLOSPanel}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-blue-500" />
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Visibility Analysis Tools</h3>
              </div>
            <p className="text-sm text-gray-500">Analyse terrain visibility and signal coverage</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisibilityAnalysisCard;