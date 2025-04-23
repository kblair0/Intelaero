/**
 * PlanVerification/PlanVerificationDashboard.tsx
 * 
 * Purpose:
 * Main container component for flight plan verification.
 * Acts as the orchestrator for all verification cards and manages
 * shared state between verification components.
 * 
 * This component:
 * - Controls which verification sections are expanded
 * - Passes flight plan data to child components
 * - Coordinates panel toggling (energy/LOS)
 * - Manages overall analysis state
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
import { PlanVerificationDashboardProps, VerificationStatus, VerificationSection } from "./Utils/types";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";
import { 
  BasicChecksCard, 
  EnergyAnalysisCard, 
  TerrainAnalysisCard, 
  LOSAnalysisCard 
} from "./Cards";

// Dynamic imports for map layer handlers
import dynamic from "next/dynamic";

// Only load layer handlers on client
const BYDALayerHandler = dynamic(
  () => import("../Map/BYDALayerHandler").then(m => m.default),
  { ssr: false }
);

/**
 * Card components will be imported and rendered here once implemented
 * These imports will be uncommented as each card is developed
 */
// import BasicChecksCard from "./Cards/BasicChecksCard";
// import EnergyAnalysisCard from "./Cards/EnergyAnalysisCard";
// import TerrainAnalysisCard from "./Cards/TerrainAnalysisCard";
// import LOSAnalysisCard from "./Cards/LOSAnalysisCard";

/**
 * Main dashboard component for flight plan verification
 */
const PlanVerificationDashboard: React.FC<PlanVerificationDashboardProps> = ({ 
  onTogglePanel 
}) => {
  const { map } = useMapContext();
  const { flightPlan, isProcessed } = useFlightPlanContext();
  const { status: analysisStatus } = useObstacleAnalysis();
  
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
    const guideUrls: Record<string, string> = {
      basic: "https://youtu.be/iUYkmdUv46A",
      energy: "https://youtu.be/mJTWGmtgtZg",
      terrain: "https://youtu.be/H1JveIqB_v4",
      los: "https://youtu.be/u-WPwwh1tpA",
    };
    const guideUrl = guideUrls[section.id] || "https://www.youtube.com/channel/UCstd7Ks-s7hlZA8zmAxMlvw";

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
                <a
                  href={guideUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex gap-1 items-center"
                  aria-label={`Watch YouTube guide for ${section.title}`}
                >
                  <svg
                    className="w-5 h-5 text-red-600 hover:text-red-700 transition-colors"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23.5 6.2c-.3-1.1-1.1-2-2.2-2.3C19.1 3.5 12 3.5 12 3.5s-7.1 0-9.3.4c-1.1.3-1.9 1.2-2.2 2.3C.5 8.4.5 12 .5 12s0 3.6.4 5.8c.3 1.1 1.1 2 2.2 2.3 2.2.4 9.3.4 9.3.4s7.1 0 9.3-.4c-1.1-.3 1.9-1.2 2.2-2.3.4-2.2.4-5.8.4-5.8s0-3.6-.4-5.8zM9.8 15.5V8.5l6.2 3.5-6.2 3.5z" />
                  </svg>
                  <span className="text-xs text-red-600 hover:text-red-700 transition-colors">Guide</span>
                </a>
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
  
      <BasicChecksCard 
        isExpanded={expandedSection === 'basic'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'basic' ? null : 'basic')}
        flightPlan={flightPlan}
      />

      <LOSAnalysisCard
        isExpanded={expandedSection === 'los'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'los' ? null : 'los')}
        flightPlan={flightPlan}
        onTogglePanel={onTogglePanel}
      />
            
      <TerrainAnalysisCard
        isExpanded={expandedSection === 'terrain'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'terrain' ? null : 'terrain')}
        flightPlan={flightPlan}
      />
      
      <EnergyAnalysisCard 
        isExpanded={expandedSection === 'energy'}
        onToggleExpanded={() => setExpandedSection(expandedSection === 'energy' ? null : 'energy')}
        flightPlan={flightPlan}
        onTogglePanel={onTogglePanel}
      />

    </div>
  );
};

export default PlanVerificationDashboard;