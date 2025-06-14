/**
 * TerrainAnalysisCard.tsx - Enhanced Visual Design
 * 
 * Purpose: Provides a streamlined access point to terrain analysis tools
 * This simplified card focuses on a single responsibility - opening the terrain
 * analysis dashboard panel when clicked. All complex functionality has been moved
 * to the dashboard itself.
 * 
 * Visual Enhancements:
 * - Modern card design with gradients and hover effects
 * - Enhanced icon container with gradient background
 * - Better spacing and typography
 * - Consistent with enhanced dashboard theme
 * 
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - TerrainAnalysisDashboard: Contains the detailed terrain analysis tools
 */

'use client';
import React from "react";
import { Mountain, ChevronRight } from "lucide-react";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Enhanced Terrain Analysis Card
 * Provides direct access to terrain analysis tools
 */
const TerrainAnalysisCard: React.FC<VerificationCardProps> = ({
  onTogglePanel
}) => {
  /**
   * Opens the terrain analysis panel
   */
  const handleOpenTerrainPanel = () => {
    trackEvent("open_terrain_analysis", { panel: "terrainanalysis.tsx" });
    if (onTogglePanel) {
      onTogglePanel("terrain");
    }
  };

  return (
    <div 
      className="border-2 border-gray-200 m-1 rounded-xl bg-white shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-green-300 hover:bg-gradient-to-r hover:from-green-50 hover:to-white transition-all duration-200 transform hover:scale-[1.02]"
      onClick={handleOpenTerrainPanel}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm">
            <Mountain className="w-5 h-5" />
          </div>
          
          <div className="text-left flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Terrain Analysis Tools</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Analyse terrain and hazards</p>
          </div>
        </div>
        
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
      </div>
    </div>
  );
};

export default TerrainAnalysisCard;