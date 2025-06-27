/**
 * VerificationToolbar/ToolsDashboard.tsx
 * 
 * Purpose:
 * Main container component for flight plan verification.
 * Orchestrates verification cards and manages shared state between verification components.
 * 
 * Changes:
 * - CLEANED UP: Unified panel toggling with proper TypeScript types
 * - FIXED: TypeScript errors for panel type mismatches
 * - SEPARATED: Panel toggling vs section expansion responsibilities
 * - REMOVED: Redundant toggle functions
 * 
 * Toggle System:
 * 1. Panel Toggling: Opens/closes side panels (energy, los, terrain, meshblock)
 * 2. Section Expansion: Expands/collapses cards within this dashboard
 * 
 * Related Files:
 * - Card components: Rendered as children of this dashboard
 * - FlightPlanContext: Provides flight plan data
 * - ObstacleAnalysisContext: Provides terrain analysis functionality
 * - MeshblockDashboard: New meshblock feature integration
 */

import React, { useState, useEffect } from "react";
import { 
  Loader, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Beaker
} from "lucide-react";
import { useFlightPlanContext } from "../../context/FlightPlanContext";
import { useObstacleAnalysis } from "../../context/ObstacleAnalysisContext";
import { useMapContext } from "../../context/mapcontext";
import { ToolsDashboardProps, VerificationStatus, VerificationSection } from "./Utils/types";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";
import { 
  BasicChecksCard, 
  EnergyAnalysisCard, 
  SandboxCard, 
  TerrainAnalysisCard,
  VisibilityAnalysisCard 
} from "./Cards";
import { useChecklistContext } from "../../context/ChecklistContext";
import ReloadButton from "../UI/ReloadButton";
import CompactDisclaimerWidget from "../../components/CompactDisclaimerWidget";

// Dynamic imports for map layer handlers
import dynamic from "next/dynamic";

// Only load layer handlers on client
const DBYDLayerHandler = dynamic(
  () => import("../Map/DBYDLayerHandler").then(m => m.default),
  { ssr: false }
);

// ========================================
// TYPES - Panel and Section Management
// ========================================

/**
 * Valid panel types that can be toggled (includes null for "close all panels")
 */
type PanelType = "energy" | "los" | "terrain" | "meshblock" | null;

/**
 * Valid section types that can be expanded within the dashboard
 */
type SectionType = "basic" | "energy" | "los" | "terrain" | "sandbox";

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
  
  // ========================================
  // STATE MANAGEMENT
  // ========================================
  
  // Section expansion state (for cards within this dashboard)
  const [expandedSection, setExpandedSection] = useState<SectionType | null>("basic");
  
  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // UI state
  const [showExperimental, setShowExperimental] = useState(false);

  // Effect: Update overall analyzing state
  useEffect(() => {
    setIsAnalyzing(analysisStatus === 'loading');
  }, [analysisStatus]);

  // ========================================
  // PANEL TOGGLING (Side Panels)
  // ========================================

  /**
   * Unified panel toggle handler for all side panels
   * This opens/closes the side panels (energy, los, terrain, meshblock)
   * @param panelType - Panel to toggle, or null to close all panels
   */
  const toggleSidePanel = (panelType: PanelType) => {
    // Handle null case - close all panels
    if (panelType === null) {
      trackEvent("close_all_panels", { 
        source: "ToolsDashboard"
      });
      onTogglePanel(null);
      return;
    }

    // Handle specific panel toggle
    trackEvent("open_panel", { 
      source: "ToolsDashboard", 
      panelType 
    });
    
    // Call the parent's panel toggle function with proper typing
    onTogglePanel(panelType);
  };

  // ========================================
  // SECTION EXPANSION (Dashboard Cards)
  // ========================================

  /**
   * Toggles the expansion state of cards within this dashboard
   */
  const toggleSectionExpansion = (sectionType: SectionType) => {
    setExpandedSection(prev => prev === sectionType ? null : sectionType);
    
    trackEvent("toggle_section_expansion", { 
      source: "ToolsDashboard", 
      sectionType,
      expanded: expandedSection !== sectionType
    });
  };

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

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
   * Renders a verification section (legacy function - might be removed if unused)
   */
  const renderVerificationSection = (section: VerificationSection) => {
    return (
      <div key={section.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === section.id ? section.id as SectionType : null)}
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

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="flex flex-col gap-2">
      {/* Analysis Status Indicator */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 p-2 bg-blue-100 text-blue-700 rounded">
          <Loader className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analysing flight plan...</span>
        </div>
      )}
      
      {/* Hidden Layer Handler */}
      <div className="hidden">
        <DBYDLayerHandler map={map || null} />
      </div>

      {/* ========================================
          MAIN VERIFICATION CARDS
          ======================================== */}

      {/* Visibility Analysis Card */}
      <VisibilityAnalysisCard
        isExpanded={expandedSection === 'los'}
        onToggleExpanded={() => toggleSectionExpansion('los')}
        flightPlan={flightPlan}
        onTogglePanel={toggleSidePanel} // Properly typed function
      />
            
      {/* Terrain Analysis Card */}
      <TerrainAnalysisCard
        isExpanded={expandedSection === 'terrain'}
        onToggleExpanded={() => toggleSectionExpansion('terrain')}
        flightPlan={flightPlan}
        onTogglePanel={toggleSidePanel}
      />

      {/* ========================================
          APP RESET SECTION
          ======================================== */}

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
      
      {/* ========================================
          EXPERIMENTAL FEATURES SECTION
          ======================================== */}

      {/* Experimental Features Toggle */}
      <div className="flex justify-center py-1">
        <button
          onClick={() => setShowExperimental(!showExperimental)}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors opacity-30 hover:opacity-100"
          title="Experimental"
        >
          <Beaker className={`w-3 h-3 ${showExperimental ? 'text-green-500' : 'text-gray-400'}`} />
        </button>
      </div>

      {/* Experimental Cards */}
      {showExperimental && (
        <>
          {/* Meshblock Sandbox Card */}
          <SandboxCard 
            isExpanded={expandedSection === 'sandbox'}
            onToggleExpanded={() => toggleSectionExpansion('sandbox')}
            flightPlan={flightPlan}
            onTogglePanel={toggleSidePanel} 
          />
          
          {/* Energy Analysis Card */}
          <EnergyAnalysisCard 
            isExpanded={expandedSection === 'energy'}
            onToggleExpanded={() => toggleSectionExpansion('energy')}
            flightPlan={flightPlan}
            onTogglePanel={toggleSidePanel} // Properly typed function
          />
          
          {/* Basic Checks Card */}
          <BasicChecksCard 
            isExpanded={expandedSection === 'basic'}
            onToggleExpanded={() => toggleSectionExpansion('basic')}
            flightPlan={flightPlan}
          />
        </>
      )}
    </div>
  );
};

export default ToolsDashboard;