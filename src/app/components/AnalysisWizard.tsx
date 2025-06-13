// src/components/AnalysisWizard.tsx
"use client";
import React, { useState, useCallback, useMemo } from "react";
import {
  X, Eye, Radio, Link as LinkIcon, User, MapPin, FileUp, Signal, Search, Zap, Plane, Trees, PlaneTakeoff,
  ChevronRight, ChevronLeft, CheckCircle, Settings, PlayCircle, Navigation, Map, Compass, ChevronDown, ChevronUp
} from "lucide-react";
import { trackEventWithForm as trackEvent } from "../components/tracking/tracking";
import FlightPlanUploader from "./FlightPlanUploader";
import AreaOpsUploader from "./AO/AreaOpsUploader";
import { useMarkersContext } from "../context/MarkerContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useAreaOfOpsContext } from "../context/AreaOfOpsContext";
import { useChecklistContext } from "../context/ChecklistContext";
import CompactDisclaimerWidget from "./CompactDisclaimerWidget";
import SmartUploader, { UploadResult } from './SmartUploader';

/**
 * Props for AnalysisWizard component
 */
interface AnalysisWizardProps {
  onClose: () => void;
  onStartMapSelection?: (mode: "map" | "search") => void;
  onShowAreaOpsUploader?: () => void;
}

/**
 * Custom SVG component for Mountain icon
 */
const Mountain = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9-6 9 6v12H3V8z" />
  </svg>
);

/**
 * Wizard Steps enum - Simplified to 2 main steps
 */
enum WizardStep {
  QuickStart = 0,
  FlightMission = 1,
  GeographicSurvey = 2
}

/**
 * Interface for quick start options
 */
interface QuickStartOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  action: () => void;
  commitment: 'low' | 'medium' | 'high';
  benefits: string[];
}

/**
 * Enhanced AnalysisWizard component with Use Case First approach
 */
const AnalysisWizard: React.FC<AnalysisWizardProps> = ({
  onClose,
  onStartMapSelection
}) => {
  // State for wizard progression
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.QuickStart);

  // State for analysis setup
  const [selectedPreset, setSelectedPreset] = useState<string>('visual');
  const [showAdvancedAnalyses, setShowAdvancedAnalyses] = useState(false);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
  const [showAreaOptions, setShowAreaOptions] = useState(false);

  // Access context values
  const { setDefaultElevationOffset } = useMarkersContext();
  const { setGridSize } = useLOSAnalysis();
  const { setFlightPlan } = useFlightPlanContext();
  const { setBufferDistance } = useAreaOfOpsContext();
  const { addChecks } = useChecklistContext();

  /**
   * Handles demo flight plan loading - straight to map with Visual preset
   */
  const handleTryDemo = useCallback(async () => {
    trackEvent("wizard_try_demo", { source: "quick_start" });
    
    // Set smart defaults for demo
    setDefaultElevationOffset('observer', 2);
    setDefaultElevationOffset('gcs', 2);
    setDefaultElevationOffset('repeater', 2);
    setGridSize(30);
    setBufferDistance(500);
    
    // Set up Visual preset checklist
    const visualAnalyses = ["terrainProfile", "observerVsTerrain", "observerToDrone", "powerline", "airspace"];
    addChecks(visualAnalyses);
    
    // Load example.geojson using fetch (similar to existing pattern)
    try {
      const response = await fetch("/example.geojson");
      if (!response.ok) {
        throw new Error("Failed to fetch example flight plan");
      }
      
      const exampleData = await response.json();
      setFlightPlan(exampleData);
      
      // Close wizard immediately - user goes straight to map
      onClose();
    } catch (error) {
      console.error("Error loading demo:", error);
      // Fallback to flight mission setup if example loading fails
      setCurrentStep(WizardStep.FlightMission);
    }
  }, [setDefaultElevationOffset, setGridSize, setBufferDistance, addChecks, setFlightPlan, onClose]);

  /**
   * Handles flight mission analysis setup
   */
  const handleFlightMission = useCallback(() => {
    trackEvent("wizard_flight_mission", { source: "quick_start" });
    
    // Set smart defaults for flight mission analysis
    setDefaultElevationOffset('observer', 2);
    setDefaultElevationOffset('gcs', 2);
    setDefaultElevationOffset('repeater', 2);
    setGridSize(30);
    setBufferDistance(500);
    
    // Set up with EVLOS preset (typical for flight missions)
    setSelectedPreset('evlos');
    const missionAnalyses = ["terrainProfile", "observerVsTerrain", "observerToDrone", "gcsRepeaterVsTerrain", "antennaToDrone", "antennaToAntenna", "powerline", "airspace"];
    setSelectedAnalyses(missionAnalyses);
    
    // Go to flight mission setup
    setCurrentStep(WizardStep.FlightMission);
  }, [setDefaultElevationOffset, setGridSize, setBufferDistance]);

  /**
   * Handles geographic survey area analysis setup
   */
  const handleGeographicSurvey = useCallback(() => {
    trackEvent("wizard_geographic_survey", { source: "quick_start" });
    
    // Set defaults for area surveying
    setDefaultElevationOffset('observer', 2);
    setDefaultElevationOffset('gcs', 2);
    setDefaultElevationOffset('repeater', 2);
    setGridSize(30);
    
    // Set up with Visual preset (typical for area surveys)
    setSelectedPreset('visual');
    const surveyAnalyses = ["terrainProfile", "observerVsTerrain", "powerline", "airspace", "treeHeights"];
    setSelectedAnalyses(surveyAnalyses);
    
    // Go to geographic survey setup
    setCurrentStep(WizardStep.GeographicSurvey);
  }, [setDefaultElevationOffset, setGridSize]);

  /**
   * Use case focused quick start options
   */
  const quickStartOptions: QuickStartOption[] = useMemo(() => [
    {
      id: 'demo',
      title: 'Try Demo',
      description: 'See analysis in action',
      icon: <PlayCircle className="w-5 h-5 text-green-600" />,
      iconBg: 'bg-green-100',
      action: handleTryDemo,
      commitment: 'low',
      benefits: ['Instant results', 'No data required', 'Complete example']
    },
    {
      id: 'flight-mission',
      title: 'Analyse Flight Mission',
      description: 'Upload flight plan, analyse path + surrounding area',
      icon: <div className="flex -space-x-1"><Navigation className="w-3 h-3 text-blue-600" /><Map className="w-3 h-3 text-blue-600" /></div>,
      iconBg: 'bg-blue-100',
      action: handleFlightMission,
      commitment: 'medium',
      benefits: ['Mission-specific analysis', 'Flight path optimisation', 'Communication planning']
    },
    {
      id: 'geographic-survey',
      title: 'Survey Geographic Area',
      description: 'Analyse terrain, obstacles, coverage in a region',
      icon: <div className="flex -space-x-1"><Map className="w-3 h-3 text-purple-600" /><Search className="w-3 h-3 text-purple-600" /></div>,
      iconBg: 'bg-purple-100',
      action: handleGeographicSurvey,
      commitment: 'medium',
      benefits: ['Site exploration', 'Terrain analysis', 'Coverage planning']
    }
  ], [handleTryDemo, handleFlightMission, handleGeographicSurvey]);

  /**
   * Preset analysis configurations
   */
  const analysisPresets = useMemo(() => ({
    visual: {
      label: "Visual (VLOS)",
      icon: <Eye className="w-4 h-4 text-blue-600" />,
      iconBg: "bg-blue-100",
      description: "Local visual operations - observer can see drone",
      analyses: ["terrainProfile", "observerVsTerrain", "observerToDrone", "powerline", "airspace"]
    },
    evlos: {
      label: "Extended Visual",
      icon: <Radio className="w-4 h-4 text-purple-600" />,
      iconBg: "bg-purple-100", 
      description: "Extended operations using observers or technology",
      analyses: ["terrainProfile", "observerVsTerrain", "observerToDrone", "gcsRepeaterVsTerrain", "antennaToDrone", "antennaToAntenna", "powerline", "airspace"]
    },
    bvlos: {
      label: "Beyond Visual",
      icon: <Signal className="w-4 h-4 text-green-600" />,
      iconBg: "bg-green-100",
      description: "Remote operations with full communication analysis",
      analyses: ["terrainProfile", "gcsRepeaterVsTerrain", "antennaToDrone", "antennaToAntenna", "mobileTowerCoverage", "powerline", "airspace", "treeHeights"]
    }
  }), []);

  /**
   * Individual analysis options for advanced users
   */
  const individualAnalyses = useMemo(() => [
    { id: "terrainProfile", label: "Terrain Profile", icon: <Mountain className="w-3 h-3 text-green-600" />, iconBg: "bg-green-100" },
    { id: "observerVsTerrain", label: "Observer vs Terrain", icon: <User className="w-3 h-3 text-gray-600" />, iconBg: "bg-gray-100" },
    { id: "gcsRepeaterVsTerrain", label: "GCS/Repeater vs Terrain", icon: <Radio className="w-3 h-3 text-yellow-600" />, iconBg: "bg-yellow-100" },
    { id: "observerToDrone", label: "Observer to Drone", icon: <Eye className="w-3 h-3 text-blue-600" />, iconBg: "bg-blue-100" },
    { id: "antennaToDrone", label: "Antenna to Drone", icon: <Radio className="w-3 h-3 text-purple-600" />, iconBg: "bg-purple-100" },
    { id: "antennaToAntenna", label: "Antenna to Antenna", icon: <LinkIcon className="w-3 h-3 text-teal-600" />, iconBg: "bg-teal-100" },
    { id: "powerline", label: "Powerlines", icon: <Zap className="w-3 h-3 text-red-600" />, iconBg: "bg-red-100" },
    { id: "airspace", label: "Airspace", icon: <Plane className="w-3 h-3 text-red-600" />, iconBg: "bg-red-100" },
    { id: "treeHeights", label: "Tree Heights", icon: <Trees className="w-3 h-3 text-green-600" />, iconBg: "bg-green-100" },
    { id: "mobileTowerCoverage", label: "Mobile Towers", icon: <Signal className="w-3 h-3 text-purple-600" />, iconBg: "bg-purple-100" }
  ], []);

  /**
   * Handles preset selection
   */
  const handlePresetSelect = useCallback((presetKey: string) => {
    const preset = analysisPresets[presetKey as keyof typeof analysisPresets];
    if (preset) {
      setSelectedPreset(presetKey);
      setSelectedAnalyses(preset.analyses);
      trackEvent("wizard_preset_selected", { preset: presetKey, analyses: preset.analyses });
    }
  }, [analysisPresets]);

  /**
   * Handles individual analysis toggle
   */
  const toggleAnalysis = useCallback((analysisId: string) => {
    setSelectedAnalyses(prev => 
      prev.includes(analysisId) 
        ? prev.filter(id => id !== analysisId)
        : [...prev, analysisId]
    );
  }, []);

  /**
   * Handles upload completion from SmartUploader
   */
  const handleUploadComplete = useCallback((result: UploadResult) => {
    addChecks(selectedAnalyses);
    
    // Optional: Different handling based on upload type
    if (result.type === 'flight-plan') {
      trackEvent("wizard_flight_plan_uploaded", { analyses: selectedAnalyses });
    } else {
      trackEvent("wizard_area_uploaded", { analyses: selectedAnalyses });
    }
    
    onClose();
  }, [selectedAnalyses, addChecks, onClose]);

  /**
   * Handles map area definition
   */
  const handleMapAreaDefinition = useCallback(() => {
    if (onStartMapSelection) {
      addChecks(selectedAnalyses);
      onStartMapSelection("map");
    }
  }, [selectedAnalyses, addChecks, onStartMapSelection]);

  /**
   * Quick start option component
   */
  const QuickStartOptionCard: React.FC<{ option: QuickStartOption }> = ({ option }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all">
      <div className="flex items-start gap-2 mb-2">
        <div className={`p-1.5 ${option.iconBg} rounded-full`}>
          {option.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm text-gray-900">{option.title}</h3>
          <p className="text-xs text-gray-600 mt-0.5">{option.description}</p>
        </div>
      </div>
      
      <ul className="space-y-0.5 mb-3">
        {option.benefits.map((benefit, index) => (
          <li key={index} className="flex items-center text-xs text-gray-600">
            <CheckCircle className="w-2.5 h-2.5 text-green-500 mr-1.5" />
            {benefit}
          </li>
        ))}
      </ul>
      
      <button
        onClick={option.action}
        className={`w-full py-2 px-3 rounded-md text-xs font-medium transition-colors ${
          option.commitment === 'low' 
            ? 'bg-green-600 hover:bg-green-700 text-white' 
            : option.commitment === 'medium'
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {option.title}
      </button>
    </div>
  );

  /**
   * Compact preset option component
   */
  const CompactPresetCard: React.FC<{ presetKey: string; preset: any }> = ({ presetKey, preset }) => (
    <div className={`border rounded-lg p-2 cursor-pointer transition-all ${
      selectedPreset === presetKey 
        ? 'border-blue-600 bg-blue-50 shadow-sm' 
        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
    }`} onClick={() => handlePresetSelect(presetKey)}>
      <div className="flex items-center gap-2">
        <div className={`p-1 ${preset.iconBg} rounded-full`}>
          {preset.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-xs text-gray-900">{preset.label}</h3>
          <p className="text-xs text-gray-500">{preset.analyses.length} analyses</p>
        </div>
        {selectedPreset === presetKey && (
          <CheckCircle className="w-3 h-3 text-blue-600" />
        )}
      </div>
    </div>
  );

  /**
   * Individual analysis toggle component
   */
  const AnalysisToggle: React.FC<{ analysis: any }> = ({ analysis }) => (
    <button
      onClick={() => toggleAnalysis(analysis.id)}
      className={`flex items-center gap-2 p-2 rounded-md border text-xs transition-all ${
        selectedAnalyses.includes(analysis.id)
          ? 'border-blue-300 bg-blue-50 text-blue-900'
          : 'border-gray-200 hover:border-gray-300 text-gray-700'
      }`}
    >
      <div className={`p-1 ${analysis.iconBg} rounded-full`}>
        {analysis.icon}
      </div>
      <span className="flex-1 text-left">{analysis.label}</span>
      {selectedAnalyses.includes(analysis.id) && (
        <CheckCircle className="w-3 h-3 text-blue-600" />
      )}
    </button>
  );

  /**
   * Render step content based on current step
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case WizardStep.QuickStart:
        return (
          <div className="space-y-4">
            {/* Hero Section */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 mb-1">What's Your Starting Point?</h2>
              <p className="text-sm text-gray-600">Choose the option that best fits your situation</p>
            </div>

            {/* Use Case Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {quickStartOptions.map((option) => (
                <QuickStartOptionCard key={option.id} option={option} />
              ))}
            </div>
          </div>
        );

      case WizardStep.FlightMission:
        return (
          <div className="space-y-4">
            {/* Back Button */}
            <button
              onClick={() => setCurrentStep(WizardStep.QuickStart)}
              className="flex items-center text-xs text-blue-600 hover:text-blue-800 mb-2"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Back to Options
            </button>

            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Flight Mission Analysis</h2>
              <p className="text-sm text-gray-600">Upload your flight plan and configure analysis settings</p>
            </div>

            {/* Analysis Type Selection */}
            <div>
              <h3 className="font-medium text-sm text-gray-900 mb-2">Analysis Type</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {Object.entries(analysisPresets).map(([key, preset]) => (
                  <CompactPresetCard key={key} presetKey={key} preset={preset} />
                ))}
              </div>
              
              {/* Advanced Options */}
              <button
                onClick={() => setShowAdvancedAnalyses(!showAdvancedAnalyses)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 mb-2"
              >
                <Settings className="w-3 h-3" />
                Advanced Options (Individual Analysis Selection)
                {showAdvancedAnalyses ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              {showAdvancedAnalyses && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-lg mb-4">
                  {individualAnalyses.map((analysis) => (
                    <AnalysisToggle key={analysis.id} analysis={analysis} />
                  ))}
                </div>
              )}
            </div>

            {/* Flight Plan Upload */}
            <div>
              <h3 className="font-medium text-sm text-gray-900 mb-2">Upload Flight Plan</h3>
              <div className="border rounded-lg p-3 bg-gray-50">
                <SmartUploader
                  mode="compact"
                  uploadType="flight-plan"
                  onUploadComplete={handleUploadComplete}
                  onClose={onClose}
                />
              </div>
            </div>

            {/* Optional Custom Boundary */}
            <div>
              <button
                onClick={() => setShowAreaOptions(!showAreaOptions)}
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 mb-2"
              >
                <Settings className="w-4 h-4" />
                Advanced: Custom Analysis Boundary
                {showAreaOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {showAreaOptions && (
                <div className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                  <p className="text-xs text-yellow-700 mb-2">
                    By default, we'll analyze the area around your flight path. Upload a KML file to define a custom boundary.
                  </p>
                  <SmartUploader
                    mode="compact"
                    uploadType="area"
                    onUploadComplete={handleUploadComplete}
                    onClose={onClose}
                  />
                </div>
              )}
            </div>

          </div>
        );

      case WizardStep.GeographicSurvey:
        return (
          <div className="space-y-4">
            {/* Back Button */}
            <button
              onClick={() => setCurrentStep(WizardStep.QuickStart)}
              className="flex items-center text-xs text-blue-600 hover:text-blue-800 mb-2"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Back to Options
            </button>

            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Geographic Area Survey</h2>
              <p className="text-sm text-gray-600">Define your area and configure analysis settings</p>
            </div>

            {/* Analysis Type Selection */}
            <div>
              <h3 className="font-medium text-sm text-gray-900 mb-2">Analysis Type</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {Object.entries(analysisPresets).map(([key, preset]) => (
                  <CompactPresetCard key={key} presetKey={key} preset={preset} />
                ))}
              </div>
              
              {/* Advanced Options */}
              <button
                onClick={() => setShowAdvancedAnalyses(!showAdvancedAnalyses)}
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 mb-2"
              >
                <Settings className="w-3 h-3" />
                Advanced Options
                {showAdvancedAnalyses ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              
              {showAdvancedAnalyses && (
                <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-lg mb-4">
                  {individualAnalyses.map((analysis) => (
                    <AnalysisToggle key={analysis.id} analysis={analysis} />
                  ))}
                </div>
              )}
            </div>

            {/* Area Definition Options */}
            <div>
              <h3 className="font-medium text-sm text-gray-900 mb-3">Define Your Area</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Upload KML Option */}
                <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileUp className="w-4 h-4 text-blue-600" />
                    <h4 className="font-medium text-sm text-blue-900">Upload KML Boundary</h4>
                  </div>
                  <p className="text-xs text-blue-700 mb-3">
                    Upload a KML file with your survey area boundaries
                  </p>
                  <SmartUploader
                    mode="compact"
                    uploadType="area"
                    onUploadComplete={handleUploadComplete}
                    onClose={onClose}
                  />
                </div>

                {/* Draw on Map Option */}
                <div className="border rounded-lg p-3 bg-purple-50 border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Compass className="w-4 h-4 text-purple-600" />
                    <h4 className="font-medium text-sm text-purple-900">Draw on Map</h4>
                  </div>
                  <p className="text-xs text-purple-700 mb-3">
                    Click on the map to define a circular survey area
                  </p>
                  <button
                    onClick={handleMapAreaDefinition}
                    className="w-full py-2 px-3 bg-purple-600 text-white rounded-md text-xs font-medium hover:bg-purple-700 transition-colors"
                  >
                    Start Map Selection
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full flex flex-col max-h-[85vh] sm:max-h-[90vh]">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-white rounded-t-lg flex-shrink-0">
        <h2 className="text-base font-semibold text-gray-800">
          {currentStep === WizardStep.QuickStart ? "Analysis Wizard" : 
           currentStep === WizardStep.FlightMission ? "Flight Mission Setup" : "Geographic Survey Setup"}
        </h2>
      </div>

      {/* Main content area */}
      <div className="flex-grow overflow-y-auto">
        <div className="p-4">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer - Only show disclaimer on first page */}
      {currentStep === WizardStep.QuickStart && (
        <div className="border-t border-gray-200 bg-white rounded-b-lg flex-shrink-0">
          <div className="p-3">
            <CompactDisclaimerWidget />
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisWizard;