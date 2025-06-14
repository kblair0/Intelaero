/**
 * VisibilityAnalysisCard.tsx - Enhanced Visual Design
 * 
 * Purpose:
 * Provides a streamlined interface for accessing Line of Sight (LOS) analysis.
 * This component serves as a quick-access point to the LOS analysis system
 * from the verification dashboard.
 * 
 * Visual Enhancements:
 * - Modern card design with gradients and hover effects  
 * - Enhanced icon container with gradient background
 * - Better spacing and typography
 * - Consistent with enhanced dashboard theme
 * 
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - AnalysisDashboard: The detailed LOS analysis components
 * - LOSAnalysisContext: Provides analysis data and functionality
 */

'use client';
import React from "react";
import { Eye, ChevronRight } from "lucide-react";
import { useAnalysisController } from "../../../context/AnalysisControllerContext";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Enhanced Visibility Analysis Card
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
      className="border-2 border-gray-200 m-1 rounded-xl bg-white shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-white transition-all duration-200 transform hover:scale-[1.02]"
      onClick={handleOpenLOSPanel}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
            <Eye className="w-5 h-5" />
          </div>
          
          <div className="text-left flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Visibility Analysis Tools</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Analyse terrain visibility and signal coverage</p>
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
      </div>
    </div>
  );
};

export default VisibilityAnalysisCard;