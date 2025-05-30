/**
 * PlanVerification/ToolsDashboard.tsx
 * 
 * Purpose:
 * Main container component for flight plan verification.
 * Orchestrates verification cards and manages shared state between verification components.
 * 
 * Changes:
 * - Added activePanel prop to TerrainAnalysisCard to reflect panel state for button labeling.
 * - Removed unused guide URLs and associated implementation.
 * 
 * Related Files:
 * - Card components: Rendered as children of this dashboard
 * - FlightPlanContext: Provides flight plan data
 * - ObstacleAnalysisContext: Provides terrain analysis functionality
 */

import React, { useState, useEffect } from "react";
import { 
  Loader, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronRight 
} from "lucide-react";
import { useFlightPlanContext } from "../../context/FlightPlanContext";
import { useObstacleAnalysis } from "../../context/ObstacleAnalysisContext";
import { useMapContext } from "../../context/mapcontext";
import { ToolsDashboardProps, VerificationStatus, VerificationSection } from "./Utils/types";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";
import { 
  BasicChecksCard, 
  EnergyAnalysisCard, 
  TerrainAnalysisCard,
  VisibilityAnalysisCard 
} from "./Cards";
import { useChecklistContext } from "../../context/ChecklistContext";
import ReloadButton from "../UI/ReloadButton";
import CompactDisclaimerWidget from "../../components/CompactDisclaimerWidget";

// Dynamic imports for map layer handlers
import dynamic from "next/dynamic";

// Only load layer handlers on client
const BYDALayerHandler = dynamic(
  () => import("../Map/BYDALayerHandler").then(m => m.default),
  { ssr: false }
);

/**
 * Main dashboard component for flight plan verification
 */
const ToolsDashboard: React.FC<ToolsDashboardProps & { activePanel?: string | null }> = ({ 
  onTogglePanel,
  activePanel 
}) => {
  const { map } = useMapContext();
  const { flightPlan, isProcessed } = useFlightPlanContext();
  const { status: analysisStatus } = useObstacleAnalysis();
  const { guidedTarget } = useChecklistContext();
  
  // State
  const [expandedSection, setExpandedSection] = useState<string | null>("basic");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [energyAnalysisOpened, setEnergyAnalysisOpened] = useState(false);

  // Effect: Update overall analyzing state
  useEffect(() => {
    setIsAnalyzing(analysisStatus === 'loading');
  }, [analysisStatus]);

  /**
   * Renders the status icon for a verification section
   */
  const renderStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <span className="text-yellow-500">⚠️</span>;
      case "loading":
        return <Loader className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <ChevronRight className="w-5 h-5 text-gray-400" />;
    }
  };

  /**
   * Handles toggling the energy analysis panel
   */
  const handleToggleEnergyPanel = () => {
    setEnergyAnalysisOpened(true);
    onTogglePanel("energy");
  };

  /**
   * Handles toggling the LOS analysis panel
   */
  const handleToggleLOSPanel = () => {
    onTogglePanel("los");
  };

  /**
   * Renders a verification section
   */
  const renderVerificationSection = (section: VerificationSection) => {
    return (
      <div key={section.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            {renderStatusIcon(section.status)}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900">{section.title}</h3>
              </div>
              <p className="text-sm text-gray-500">{section.description}</p>
            </div>
          </div>
          {expandedSection === section.id ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === section.id && section.subSections && (
          <div className="px-4 py-3 bg-gray-50 border-t space-y-4">
            {section.subSections.map((subSection, index) => (
              <div key={index} className="space-y-2">
                <h4 className="font-medium text-gray-700">{subSection.title}</h4>
                {subSection.content}
              </div>
            ))}
            {section.actions && (
              <div className="mt-3">{section.actions}</div>
            )}
            {section.action && section.actionLabel && (
              <div className="mt-3">
                <button
                  onClick={section.action}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                >
                  {section.actionLabel}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Special handling for terrain section's actions that should always be visible */}
        {section.id === "terrain" && section.actions && (
          <div className="px-4 py-3 bg-gray-50 border-t">
            {section.actions}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {isAnalyzing && (
        <div className="flex items-center gap-2 p-2 bg-blue-100 text-blue-700 rounded">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analysing flight plan...</span>
        </div>
      )}
      
      <div className="hidden">
        <BYDALayerHandler map={map || null} />
      </div>

      <VisibilityAnalysisCard
        isExpanded={expandedSection === 'los'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'los' ? null : 'los')}
        flightPlan={flightPlan}
        onTogglePanel={onTogglePanel}
      />
            
      <TerrainAnalysisCard
        isExpanded={expandedSection === 'terrain'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'terrain' ? null : 'terrain')}
        flightPlan={flightPlan}
        onTogglePanel={onTogglePanel}
        activePanel={activePanel} // Pass activePanel to reflect panel state
      />

      <div className="pt-4 border-t border-gray-200">
        <ReloadButton 
          variant="danger"
          size="md"
          text="Reset App"
          className="w-full"
          onBeforeReload={() => {
            localStorage.clear();
            sessionStorage.clear();
          }}
        />
      </div>

      <CompactDisclaimerWidget />

      {/* Energy Analysis Card Hidden For Now
      <EnergyAnalysisCard 
        isExpanded={expandedSection === 'energy'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'energy' ? null : 'energy')}
        flightPlan={flightPlan}
        onTogglePanel={onTogglePanel}
      />
      */}
      
      {/* Basic Checks Card Hidden For Now
      <BasicChecksCard 
        isExpanded={expandedSection === 'basic'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'basic' ? null : 'basic')}
        flightPlan={flightPlan}
      />
      */}
    </div>
  );
};

export default ToolsDashboard;