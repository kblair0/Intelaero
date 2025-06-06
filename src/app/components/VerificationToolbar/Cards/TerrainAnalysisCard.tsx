/**
 * TerrainAnalysisCard.tsx
 * 
 * Purpose: Provides a streamlined access point to terrain analysis tools
 * This simplified card focuses on a single responsibility - opening the terrain
 * analysis dashboard panel when clicked. All complex functionality has been moved
 * to the dashboard itself.
 * 
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - TerrainAnalysisDashboard: Contains the detailed terrain analysis tools
 */

'use client';
import React from "react";
import { Mountain } from "lucide-react";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Simplified Terrain Analysis Card
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
      className="border rounded-lg bg-white shadow-sm overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={handleOpenTerrainPanel}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mountain className="w-5 h-5 text-blue-500" />
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Terrain Analysis Tools</h3>
            </div>
            <p className="text-sm text-gray-500">Analyse terrain and hazards</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerrainAnalysisCard;