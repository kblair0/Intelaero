"use client";

import React, { useState } from "react";
import FlightPathAnalysisCard from "./FlightPathAnalysisCard";
import StationAnalysisCard from "./StationAnalysisCard";
import MergedAnalysisCard from "./MergedAnalysisCard";
import StationLOSAnalysisCard from "./StationLOSAnalysisCard";
import { useAnalysisController } from "../../../../context/AnalysisControllerContext";
import { Plane, RadioTower, Layers, Link, ChevronDown } from "lucide-react";

interface AnalysisSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({
  title,
  icon,
  children,
  isExpanded,
  onToggle,
}) => {
  return (
    <div className="bg-white rounded border-b border-gray-200">
      <button
        className="w-full flex items-center gap-2 p-3 text-sm font-semibold text-left hover:bg-gray-50"
        onClick={onToggle}
      >
        {icon}
        <span className="flex-grow">{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      {isExpanded && <div className="p-1">{children}</div>}
    </div>
  );
};

const AnalysisDashboard: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState({
    flight: true,
    station: false,
    merged: false,
    stationLOS: false,
  });
  const { gridAnalysisRef } = useAnalysisController();
  console.log("AnalysisDashboard gridAnalysisRef:", gridAnalysisRef.current);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-2">
      <AnalysisSection
        title="Flight Path Analysis"
        icon={<Plane className="w-4 h-4" />}
        isExpanded={expandedSections.flight}
        onToggle={() => toggleSection("flight")}
      >
        <FlightPathAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>
      <AnalysisSection
      
        title="Station Analysis"
        icon={<RadioTower className="w-4 h-4" />}
        isExpanded={expandedSections.station}
        onToggle={() => toggleSection("station")}
      >
        <p className="text-xs p-2 mb-2">This analysis shows the ground features visible to the station within the specific analysis range.</p>
      
        <div className="p-0 space-y-3">
          <StationAnalysisCard gridAnalysisRef={gridAnalysisRef} stationType="gcs" />
          <StationAnalysisCard gridAnalysisRef={gridAnalysisRef} stationType="observer" />
          <StationAnalysisCard gridAnalysisRef={gridAnalysisRef} stationType="repeater" />
        </div>
      </AnalysisSection>
      <AnalysisSection
        title="Merged Analysis"
        icon={<Layers className="w-4 h-4" />}
        isExpanded={expandedSections.merged}
        onToggle={() => toggleSection("merged")}
      >
        <MergedAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>
      <AnalysisSection
        title="Station-to-Station LOS"
        icon={<Link className="w-4 h-4" />}
        isExpanded={expandedSections.stationLOS}
        onToggle={() => toggleSection("stationLOS")}
      >
        <StationLOSAnalysisCard gridAnalysisRef={gridAnalysisRef} />
      </AnalysisSection>
    </div>
  );
};

export default AnalysisDashboard;