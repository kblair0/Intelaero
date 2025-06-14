/**
 * VisibilityAnalysisDashboard.tsx - Enhanced Visual Design
 * 
 * Purpose:
 * Main dashboard component for Line of Sight (LOS) analysis.
 * Organizes different analysis modes into collapsible sections and
 * provides a consistent interface for all LOS analysis capabilities.
 * 
 * Visual Enhancements:
 * - Modern card design with subtle shadows and gradients
 * - Improved color hierarchy and visual feedback
 * - Enhanced spacing and typography
 * - Better visual separation between sections
 * - Consistent with compact checklist theme
 * 
 * Related Components:
 * - FlightPathAnalysisCard: Analyzes visibility along flight path
 * - StationAnalysisCard: Analyzes visibility from individual stations
 * - MergedAnalysisCard: Analyzes combined visibility from all stations
 * - StationLOSAnalysisCard: Analyzes line of sight between stations
 */

"use client";
import React, { useState, useCallback, useEffect } from "react";
import FlightPathAnalysisCard from "./FlightPathAnalysisCard";
import StationAnalysisCard from "./StationAnalysisCard";
import MergedAnalysisCard from "./MergedAnalysisCard";
import StationLOSAnalysisCard from "./StationLOSAnalysisCard";
import MobileTowerAnalysisCard from "./MobileTowerAnalysisCard";
import { useAnalysisController } from "../../../../context/AnalysisControllerContext";
import { 
  Plane, 
  RadioTower, 
  Layers, 
  Link, 
  ChevronDown, 
  Eye,
  Signal, 
  MapPin,
  Info
} from "lucide-react";
import { useMarkersContext } from "../../../../context/MarkerContext";
import { trackEventWithForm as trackEvent } from "../../../tracking/tracking";

/**
 * Props for a collapsible analysis section
 */
interface AnalysisSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Props for AnalysisDashboard
 */
interface AnalysisDashboardProps {
  initialSection?: 'flight' | 'station' | 'merged' | 'stationLOS' | null;
}

/**
 * Enhanced button component for viewing all marker locations
 */
const ViewAllLocationsButton: React.FC = () => {
  const { markers } = useMarkersContext();
  const { setShowMarkerLocationsModal } = useAnalysisController();

  const handleViewLocations = useCallback(() => {
    setShowMarkerLocationsModal(true);
    trackEvent("view_all_marker_locations", { 
      totalMarkers: markers.length
    });
  }, [markers.length, setShowMarkerLocationsModal]);

  // Only show button if there are markers
  if (markers.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={handleViewLocations}
        className="w-full px-2 py-2 text-xs bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium flex items-center justify-center gap-2 shadow-sm hover:shadow-md transform hover:scale-[1.02]"
        title="View all marker locations"
        aria-label="View all marker locations"
      >
        <MapPin className="w-4 h-4" />
        View All Coordinates ({markers.length})
      </button>
    </div>
  );
};

/**
 * Enhanced collapsible section component for each analysis type
 */
const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  title,
  description,
  icon,
  children,
  isExpanded,
  onToggle,
}) => {
    return (
      <div className={`
        bg-white rounded-xl shadow-sm border-2 overflow-hidden hover:shadow-md transition-all duration-200
        ${isExpanded 
          ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-white' 
          : 'border-gray-200'}
      `}>    
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 transition-all duration-200"
        onClick={onToggle}
      >
        <div className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl shadow-sm transition-all duration-200 ${
          isExpanded 
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
            : 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 hover:from-blue-100 hover:to-blue-200'
        }`}>
          {icon}
        </div>
        <div className="flex-grow">
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          {description && (
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      
      {isExpanded && (
        <div className="p-1 bg-gradient-to-b from-gray-50 to-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Enhanced LOS Analysis Dashboard component
 */
const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ initialSection = null }) => {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState({
    flight: initialSection === 'flight',
    station: initialSection === 'station',
    merged: initialSection === 'merged',
    stationLOS: initialSection === 'stationLOS',
    mobileTowers: false, 
  });
  
  const { gridAnalysisRef } = useAnalysisController();

  // Update expanded sections when initialSection changes
  useEffect(() => {
    if (initialSection) {
      setExpandedSections({
        flight: initialSection === 'flight',
        station: initialSection === 'station',
        merged: initialSection === 'merged',
        stationLOS: initialSection === 'stationLOS',
        mobileTowers: false, 
      });
    }
  }, [initialSection]);

  // Toggle a section's expanded state
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Section descriptions
  const descriptions = {
    flight: "Analyse visibility along the flight path",
    station: "Analyse visibility from individual stations",
    merged: "Analyse combined visibility from selected stations",
    stationLOS: "Check line of sight between selected observer and comms stations"
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-900 text-sm">Visibility & Communication Analysis</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Verify communication coverage and visibility for your flight operations
        </p>
      </div>
      
      <AnalysisSection
        title="Observer/Comms Visibility Analysis"
        description={descriptions.station}
        icon={<RadioTower className="w-5 h-5" />}
        isExpanded={expandedSections.station}
        onToggle={() => toggleSection("station")}
      >
        {/* Enhanced info box */}
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Signal className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              This analysis shows the ground features visible to each station. Place stations on the map and configure their parameters for comprehensive coverage analysis.
            </p>
          </div>
        </div>

        <ViewAllLocationsButton />
        
        <div className="space-y-3">
          <StationAnalysisCard key="gcs" gridAnalysisRef={gridAnalysisRef} stationType="gcs" />
          <StationAnalysisCard key="observer" gridAnalysisRef={gridAnalysisRef} stationType="observer" />
          <StationAnalysisCard key="repeater" gridAnalysisRef={gridAnalysisRef} stationType="repeater" />
        </div>
      </AnalysisSection>
      
      <AnalysisSection
        title="Merged Analysis"
        description={descriptions.merged}
        icon={<Layers className="w-5 h-5" />}
        isExpanded={expandedSections.merged}
        onToggle={() => toggleSection("merged")}
      >
        <MergedAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>
      
      <AnalysisSection
        title="Observer/Comms Line of Sight Analysis"
        description={descriptions.stationLOS}
        icon={<Link className="w-5 h-5" />}
        isExpanded={expandedSections.stationLOS}
        onToggle={() => toggleSection("stationLOS")}
      >
        <StationLOSAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>

      <AnalysisSection
        title="Flight Path Analysis"
        description={descriptions.flight}
        icon={<Plane className="w-5 h-5" />}
        isExpanded={expandedSections.flight}
        onToggle={() => toggleSection("flight")}
      >
        <FlightPathAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>

      <AnalysisSection
        title="Mobile Tower Coverage"
        description="View 3G, 4G, and 5G mobile towers in your operating area"
        icon={<Signal className="w-5 h-5" />}
        isExpanded={expandedSections.mobileTowers}
        onToggle={() => toggleSection("mobileTowers")}
      >
        <MobileTowerAnalysisCard />
      </AnalysisSection>
      
      {/* Enhanced footer info */}
      <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-700 leading-relaxed">
            Each analysis type will be displayed on the map when run. Use the toggle switches in each card to show/hide map layers for better visualization.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;