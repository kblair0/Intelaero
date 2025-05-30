/**
 * VisibilityAnalysisDashboard.tsx
 * 
 * Purpose:
 * Main dashboard component for Line of Sight (LOS) analysis.
 * Organizes different analysis modes into collapsible sections and
 * provides a consistent interface for all LOS analysis capabilities.
 * 
 * This component:
 * - Manages expandable analysis sections
 * - Coordinates between different analysis card components
 * - Provides a unified UI for all LOS analysis features
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
  Signal, MapPin
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
 * Button component for viewing all marker locations
 * Uses AnalysisControllerContext to trigger the marker locations modal at the app level
 */
const ViewAllLocationsButton: React.FC = () => {
  const { markers } = useMarkersContext();
  const { setShowMarkerLocationsModal } = useAnalysisController();

  const handleViewLocations = useCallback(() => {
    // Instead of managing modal locally, trigger it at the app level
    setShowMarkerLocationsModal(true);
    trackEvent("view_all_marker_locations", { 
      totalMarkers: markers.length
    });
  }, [markers.length, setShowMarkerLocationsModal]);

  // Only show button if there are markers
  if (markers.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={handleViewLocations}
        className="w-full px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
        title="View all marker locations"
        aria-label="View all marker locations"
      >
        <MapPin className="w-4 h-4" />
        View All Marker Locations ({markers.length})
      </button>
    </div>
  );
};

/**
 * Collapsible section component for each analysis type
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div className="flex-grow">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Main LOS Analysis Dashboard component
 */
const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ initialSection = null }) => {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState({
    flight: initialSection === 'flight',
    station: initialSection === 'station',
    merged: initialSection === 'merged',
    stationLOS: initialSection === 'stationLOS',
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
    <div className="space-y-4 p-1">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Verify communication coverage and visibility for your flight plan
        </p>
      </div>
      
      <AnalysisSection
        title="Observer/Comms Visibility Analysis"
        description={descriptions.station}
        icon={<RadioTower className="w-4 h-4" />}
        isExpanded={expandedSections.station}
        onToggle={() => toggleSection("station")}
      >
        <div className="mb-3 p-2 bg-blue-50 rounded-md border border-blue-100">
          <div className="flex items-start gap-2">
            <Signal className="w-4 h-4 text-blue-500 mt-0.5" />
            <p className="text-xs text-blue-700">
              This analysis shows the ground features visible to each station. Place stations on the map and configure their parameters.
            </p>
          </div>
        </div>

        <ViewAllLocationsButton />
        
        <div className="space-y-4">
          <StationAnalysisCard key="gcs" gridAnalysisRef={gridAnalysisRef} stationType="gcs" />
          <StationAnalysisCard key="observer" gridAnalysisRef={gridAnalysisRef} stationType="observer" />
          <StationAnalysisCard key="repeater" gridAnalysisRef={gridAnalysisRef} stationType="repeater" />
        </div>
      </AnalysisSection>
      
      <AnalysisSection
        title="Merged Analysis"
        description={descriptions.merged}
        icon={<Layers className="w-4 h-4" />}
        isExpanded={expandedSections.merged}
        onToggle={() => toggleSection("merged")}
      >
        <MergedAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>
      
      <AnalysisSection
        title="Observer/Comms Line of Sight Analysis"
        description={descriptions.stationLOS}
        icon={<Link className="w-4 h-4" />}
        isExpanded={expandedSections.stationLOS}
        onToggle={() => toggleSection("stationLOS")}
      >
        <StationLOSAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>

      <AnalysisSection
        title="Flight Path Analysis"
        description={descriptions.flight}
        icon={<Plane className="w-4 h-4" />}
        isExpanded={expandedSections.flight}
        onToggle={() => toggleSection("flight")}
      >
        <FlightPathAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>

      <AnalysisSection
        title="Mobile Tower Coverage"
        description="View 3G, 4G, and 5G mobile towers in your operating area"
        icon={<Signal className="w-4 h-4" />}
        isExpanded={expandedSections.mobileTowers}
        onToggle={() => toggleSection("mobileTowers")}
      >
        <MobileTowerAnalysisCard />
      </AnalysisSection>
      
      <div className="mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
        <div className="flex items-start gap-2">
          <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
          <p>
            Each analysis type will be displayed on the map when run. Use the toggle switches in each card to show/hide map layers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;