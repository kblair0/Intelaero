// src/components/AnalysisWizard.tsx
"use client";
import React, { useState, useCallback, useMemo } from "react";
import { 
  X, Eye, Radio, Link as LinkIcon, User, MapPin, FileUp, Search, Zap, Plane, PlaneTakeoff, 
  ChevronRight, ChevronLeft, CheckCircle, Settings
} from "lucide-react";
import { trackEventWithForm as trackEvent } from "../components/tracking/tracking";
import FlightPlanUploader from "./FlightPlanUploader";
import AreaOpsUploader from "./AO/AreaOpsUploader";
import { useMarkersContext } from "../context/MarkerContext";
import { useLOSAnalysis } from "../context/LOSAnalysisContext";
import { useFlightPlanContext } from "../context/FlightPlanContext";
import { useAreaOfOpsContext } from "../context/AreaOfOpsContext";
import { useChecklistContext } from "../context/ChecklistContext";



/**
 * Props for AnalysisWizard component
 */
interface AnalysisWizardProps {
  onClose: () => void;
  onStartMapSelection?: (mode: "map" | "search") => void;
  onShowAreaOpsUploader?: () => void; // Add this prop
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
 * Custom SVG component for Drone icon
 */
const DroneIcon = ({ className }: { className?: string }) => (
  <svg className={className || "w-4 h-4 text-orange-500"} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h4m4 0h8m-4 8h4m-8 0H4m8-12v4m0 4v4" />
  </svg>
);

/**
 * Tooltip component for displaying explanations
 */
interface TooltipProps {
  content: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content }) => (
  <div className="relative ml-1 group">
    <div 
      className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs hover:bg-gray-300 cursor-help"
      aria-label="Show explanation"
      role="button"
      tabIndex={0}
    >
      ?
    </div>
    <div className="absolute z-50 w-64 px-4 py-3 text-sm text-left bg-white border border-gray-200 rounded-lg shadow-lg 
                  invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-300 
                  bottom-full right-0 transform translate-y-[-8px]">
      <div className="absolute w-3 h-3 bg-white border-b border-r border-gray-200 transform rotate-45 
                     -bottom-1.5 right-4"></div>
      <p className="text-gray-700">{content}</p>
    </div>
  </div>
);

/**
 * Interface for parameter options in ButtonGroup
 */
interface ParameterOption {
  value: number | string;
  label: string;
  tooltip?: string;
}

/**
 * Reusable ButtonGroup component for selecting predefined values
 */
interface ButtonGroupProps {
  label: string;
  options: ParameterOption[];
  selectedValue: number | string;
  onChange: (value: number) => void;
  ariaLabel: string;
  unit?: string;
  min?: number;
  max?: number;
  showWarning?: (value: number) => boolean;
  warningMessage?: string;
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({
  label,
  options,
  selectedValue,
  onChange,
  ariaLabel,
  unit = "m",
  min = 0,
  max = Infinity,
  showWarning,
  warningMessage,
}) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState<number | string>(selectedValue);

  const handleButtonClick = (option: ParameterOption) => {
    if (option.value === "custom") {
      setShowCustomInput(true);
      setCustomValue(selectedValue);
    } else {
      setShowCustomInput(false);
      onChange(Number(option.value));
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value >= min && value <= max) {
      setCustomValue(value);
      onChange(value);
    } else {
      setCustomValue(e.target.value);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-800">{label}</label>
        {showWarning && typeof selectedValue === "number" && showWarning(selectedValue) && (
          <div className="flex items-center text-amber-600 text-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {warningMessage}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleButtonClick(option)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              (option.value !== "custom" && selectedValue === option.value && !showCustomInput) ||
              (option.value === "custom" && showCustomInput)
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
            aria-label={`${ariaLabel} ${option.label}`}
            title={option.tooltip}
          >
            {option.label}
          </button>
        ))}
      </div>
      {showCustomInput && (
        <div className="flex items-center mt-2">
          <input
            type="number"
            value={customValue}
            onChange={handleCustomInputChange}
            className="w-20 p-1.5 border rounded text-sm"
            min={min}
            max={max}
            aria-label={`${ariaLabel} custom input`}
          />
          <span className="ml-2 text-sm text-gray-600">{unit}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Button for analysis selection
 */
interface AnalysisButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  selected: boolean;
  description: string;
  onClick: () => void;
}

const AnalysisButton: React.FC<AnalysisButtonProps> = ({ 
  id, 
  label, 
  icon, 
  iconBg, 
  selected, 
  description, 
  onClick 
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded-lg transition-all flex items-center gap-3 w-full ${
      selected ? "bg-blue-50 border border-blue-300" : "border border-gray-200 hover:bg-gray-50"
    }`}
    aria-label={`Toggle ${label}`}
  >
    <div className={`flex-shrink-0 p-1.5 ${iconBg} rounded-full flex items-center justify-center`}>
      {icon}
    </div>
    <span className="text-sm font-medium text-gray-700 flex-grow text-left">{label}</span>
    
    <div className="flex-shrink-0 flex items-center gap-2">
      <Tooltip content={description} />
      {selected && <CheckCircle className="w-4 h-4 text-blue-600" />}
    </div>
  </button>
);

/**
 * Wizard Steps enum to improve the flow
 */
enum WizardStep {
  AnalysisType = 0,
  SelectAnalyses = 1,
  ConfigureParameters = 2,
  UploadData = 3
}


/**
 * Improved AnalysisWizard component with a multi-step flow
 */
const AnalysisWizard: React.FC<AnalysisWizardProps> = ({ 
  onClose, 
  onStartMapSelection 
}) => {
  // State for wizard progression
  const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.AnalysisType);
  
  // State for user selections
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<string | null>(null);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
  
  // State for parameters
  const [gridSize, setGridSize] = useState<number>(30);
  const [bufferDistance, setBufferDistance] = useState<number>(500);
  
  // Combined antennaHeight for both GCS/Repeater and Observer (using a common height value)
  const [commsAntennaHeight, setCommsAntennaHeight] = useState<number>(2);

  // Access context values
  const { 
    defaultElevationOffsets,
    setDefaultElevationOffset
  } = useMarkersContext();
  
  const { setGridSize: setContextGridSize } = useLOSAnalysis();
  const { flightPlan, setFlightPlan } = useFlightPlanContext();
  const { aoGeometry, setAoGeometry, setBufferDistance: setContextBufferDistance } = useAreaOfOpsContext();
  const { addChecks } = useChecklistContext();


  const [showKmlUploader, setShowKmlUploader] = useState(false);

  /**
   * Toggles the analysis type selection
   */
  const toggleAnalysisType = useCallback((type: string) => {
    setSelectedAnalysisType(type === selectedAnalysisType ? null : type);
    trackEvent("wizard_analysis_type_toggled", { type });
  }, [selectedAnalysisType]);

  /**
   * Toggles the selection state of an analysis
   */
  const toggleAnalysis = useCallback((analysis: string) => {
    setSelectedAnalyses((prev) =>
      prev.includes(analysis) ? prev.filter((a) => a !== analysis) : [...prev, analysis]
    );
    trackEvent("wizard_analysis_toggled", { analysis });
  }, []);

  /**
   * Reset all selections and return to the first step
   */
  const resetWizard = useCallback(() => {
    setSelectedAnalysisType(null);
    setSelectedAnalyses([]);
    setGridSize(30);
    setBufferDistance(500);
    setCommsAntennaHeight(2);
    setCurrentStep(WizardStep.AnalysisType);
    trackEvent("wizard_reset", {});
  }, []);

  /**
   * Updates all antenna height values (GCS, Observer, and Repeater)
   * using a single common value for simplicity
   */
  const handleCommsAntennaHeightChange = useCallback(
    (value: number) => {
      console.log(`[AnalysisWizard] Updating all antenna heights to ${value}m`);
      setCommsAntennaHeight(value);
      
      // Update all default elevation offsets with the same value
      setDefaultElevationOffset('gcs', value);
      setDefaultElevationOffset('repeater', value);
      setDefaultElevationOffset('observer', value);
      
      trackEvent("antenna_height_changed", { value });
    },
    [setDefaultElevationOffset]
  );

  /**
   * Handles Grid Size changes, updating LOSAnalysisContext
   */
  const handleGridSizeChange = useCallback(
    (value: number) => {
      setGridSize(value);
      setContextGridSize(value);
    },
    [setContextGridSize]
  );

  /**
   * Handles Buffer Distance changes, updating AreaOfOpsContext
   */
  const handleBufferDistanceChange = useCallback(
    (value: number) => {
      setBufferDistance(value);
      setContextBufferDistance(value);
    },
    [setContextBufferDistance]
  );

  /**
   * Handles successful flight plan upload
   */
  const handleFlightPlanUploaded = useCallback((flightData: any) => {
    setFlightPlan(flightData);
    addChecks(selectedAnalyses);
    onClose();
    trackEvent("flight_plan_uploaded", {});
  }, [setFlightPlan, addChecks, selectedAnalyses, onClose]);

  /**
   * Handles successful AO upload
   */
  const handleAOUploaded = useCallback((aoData: any) => {
    setAoGeometry(aoData);
    addChecks(selectedAnalyses);
    onClose();
    trackEvent("area_ops_uploaded", {});
  }, [setAoGeometry, addChecks, selectedAnalyses, onClose]);

  /**
   * Move to the next step if possible
   */
const goToNextStep = useCallback(() => {
  if (
    (currentStep === WizardStep.AnalysisType && selectedAnalysisType) ||
    (currentStep === WizardStep.SelectAnalyses && selectedAnalyses.length > 0) ||
    currentStep === WizardStep.ConfigureParameters
  ) {
    // Just proceed to the next step without special handling
    setCurrentStep((prev) => prev + 1);
    trackEvent("wizard_next_step", { from: currentStep, to: currentStep + 1 });
  }
}, [currentStep, selectedAnalysisType, selectedAnalyses.length, trackEvent]);

  /**
   * Move to the previous step
   */
  const goToPreviousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      trackEvent("wizard_previous_step", { from: currentStep, to: currentStep - 1 });
    }
  }, [currentStep]);

  /**
   * Check if the next button should be disabled
   */
  const isNextButtonDisabled = useMemo(() => {
    if (currentStep === WizardStep.AnalysisType) return !selectedAnalysisType;
    if (currentStep === WizardStep.SelectAnalyses) return selectedAnalyses.length === 0;
    return false;
  }, [currentStep, selectedAnalysisType, selectedAnalyses.length]);

  /**
   * Get step title based on current step
   */
  const getStepTitle = useMemo(() => {
    switch (currentStep) {
      case WizardStep.AnalysisType:
        return "1. Choose Analysis Type";
      case WizardStep.SelectAnalyses:
        return "2. Select Analyses";
      case WizardStep.ConfigureParameters:
        return "3. Configure Parameters";
      case WizardStep.UploadData:
        return selectedAnalysisType === "flightPlan" 
          ? "4. Upload Flight Plan" 
          : "4. Set Operating Area";
      default:
        return "Analysis Wizard";
    }
  }, [currentStep, selectedAnalysisType]);

  /**
   * Definition for Vs Terrain analysis buttons with descriptions
   */
  const vsTerrainButtons = useMemo(() => [
    {
      id: "terrainProfile",
      label: "Terrain Profile",
      icon: <Mountain className="w-4 h-4 text-green-600" />,
      iconBg: "bg-green-100",
      description: "Shows a terrain height map of your operating area. Helpful for understanding the topography of the area and selecting vanatge points."
    },
    {
      id: "observerVsTerrain",
      label: "Observer Vs Terrain",
      icon: <User className="w-4 h-4 text-gray-600" />,
      iconBg: "bg-gray-100",
      description: "Evaluates where observers can see in the surrounding terrain, helping identify and test optimal observation points with clear views."
    },
    {
      id: "gcsRepeaterVsTerrain",
      label: "GCS/Repeater vs Terrain",
      icon: <Radio className="w-4 h-4 text-yellow-600" />,
      iconBg: "bg-yellow-100",
      description: "Evaluates ground control station or signal repeater positioning and line of sight relative to terrain. Helpful for optimising communication range and reliability."
    },
    {
      id: "powerline",
      label: "Powerlines",
      icon: <Zap className="w-4 h-4 text-red-600" />,
      iconBg: "bg-red-100",
      description: "Shows known local HV and LV powerline infrastructure in the operating area to help prevent collisions with these critical hazards."
    },
    {
      id: "airspace",
      label: "Airports",
      icon: <Plane className="w-4 h-4 text-red-600" />,
      iconBg: "bg-red-100",
      description: "Shows aerodromes and landing areas to ensure compliance with aviation regulations and avoid restricted areas."
    },
  ], []);

  /**
   * Definition for Visibility analysis buttons with descriptions
   */
  const visibilityButtons = useMemo(() => [
    {
      id: "observerToDrone",
      label: "Observer to Drone",
      icon: <Eye className="w-4 h-4 text-blue-600" />,
      iconBg: "bg-blue-100",
      description: "Shows segments along the flight path where the drone will be visible to the observer, accounting for terrain and obstacles. Essential for maintaining visual line of sight (VLOS) operations."
    },
    {
      id: "antennaToDrone",
      label: "Antenna to Drone",
      icon: <Radio className="w-4 h-4 text-purple-600" />,
      iconBg: "bg-purple-100",
      description: "Calculates radio frequency line of sight between control antennas and the drone, showing areas where signal may be compromised by terrain."
    },
    {
      id: "droneToGround",
      label: "Drone to Ground",
      icon: <DroneIcon />,
      iconBg: "bg-orange-100",
      description: "Analyses what areas of the ground will be visible from the drone's perspective at the flight planned altitudes, important for survey and monitoring missions."
    },
    {
      id: "antennaToAntenna",
      label: "Antenna to Antenna/Observer",
      icon: <LinkIcon className="w-4 h-4 text-teal-600" />,
      iconBg: "bg-teal-100",
      description: "Evaluates line of sight between multiple communication antennas/observers or relays to optimise positioning for maximum coverage and signal redundancy."
    },
  ], []);

  /**
   * Common parameter options for ButtonGroup components
   */
  const parameterOptions = useMemo(() => ({
    gridSize: [
      { value: 10, label: "10m (High)", tooltip: "High resolution, may be slower" },
      { value: 30, label: "30m (SRTM)", tooltip: "Standard SRTM resolution" },
      { value: 60, label: "60m (Low)", tooltip: "Lower resolution, faster processing" },
      { value: "custom", label: "Custom", tooltip: "Enter a custom grid size" },
    ],
    bufferDistance: [
      { value: 250, label: "250m", tooltip: "Short range" },
      { value: 500, label: "500m", tooltip: "Medium range" },
      { value: 1000, label: "1km", tooltip: "Long range" },
      { value: 2000, label: "2km", tooltip: "Extended range" },
      { value: "custom", label: "Custom", tooltip: "Enter a custom distance" },
    ],
    height: [
      { value: 2, label: "2m", tooltip: "Standard standing height" },
      { value: 5, label: "5m", tooltip: "Elevated position" },
      { value: 10, label: "10m", tooltip: "Tall structure" },
      { value: "custom", label: "Custom", tooltip: "Enter a custom height" },
    ],
  }), []);

  /**
   * Progress indicators for the wizard steps
   */
  const renderProgressIndicators = () => (
    <div className="flex justify-around w-full mb-6">
      {[WizardStep.AnalysisType, WizardStep.SelectAnalyses, WizardStep.ConfigureParameters, WizardStep.UploadData].map((step) => (
        <div key={step} className="flex flex-col items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              currentStep === step 
                ? "bg-blue-600 text-white" 
                : currentStep > step 
                  ? "bg-green-100 text-green-600 border border-green-600" 
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {currentStep > step ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <span>{step + 1}</span>
            )}
          </div>
          
          <span className={`text-xs font-medium mt-2 text-center ${
            currentStep === step ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {step === WizardStep.AnalysisType && "Type"}
            {step === WizardStep.SelectAnalyses && "Analyses"}
            {step === WizardStep.ConfigureParameters && "Parameters"}
            {step === WizardStep.UploadData && "Upload"}
          </span>
        </div>
      ))}
    </div>
  );

  /**
   * Render content based on current step
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case WizardStep.AnalysisType:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => toggleAnalysisType("operatingArea")}
              className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                selectedAnalysisType === "operatingArea" ? "border-blue-600 bg-blue-50 shadow-sm" : "border-gray-200"
              }`}
              aria-label="Select Operating Area Analysis"
            >
              <div className="flex items-start">
                <div className="p-2 bg-green-100 rounded-full">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg text-left font-medium text-gray-800">Operating Area Analysis</h3>
                  <p className="text-sm text-gray-600 text-left mt-1">Analyse a defined area for VLOS operations</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-500">
                    <li className="flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-500" />
                      Ideal for local flying (VLOS)
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-500" />
                      Terrain and visibility analysis
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-500" />
                      Mission planning
                    </li>
                  </ul>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => toggleAnalysisType("flightPlan")}
              className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                selectedAnalysisType === "flightPlan" ? "border-blue-600 bg-blue-50 shadow-sm" : "border-gray-200"
              }`}
              aria-label="Select Flight Plan Analysis"
            >
              <div className="flex items-start">
                <div className="p-2 bg-blue-100 rounded-full">
                  <PlaneTakeoff className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-left text-gray-800">Flight Plan Analysis</h3>
                  <p className="text-sm text-gray-600 text-left mt-1">Upload and analyse detailed flight paths</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-500">
                    <li className="flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-500" />
                      Suitable for VLOS, EVLOS, BVLOS
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-500" />
                      Terrain and obstacle analysis
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-500" />
                      Communication coverage analysis
                    </li>
                  </ul>
                </div>
              </div>
            </button>
          </div>
        );

      case WizardStep.SelectAnalyses:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Terrain Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {vsTerrainButtons.map((button) => (
                  <AnalysisButton
                    key={button.id}
                    id={button.id}
                    label={button.label}
                    icon={button.icon}
                    iconBg={button.iconBg}
                    description={button.description}
                    selected={selectedAnalyses.includes(button.id)}
                    onClick={() => toggleAnalysis(button.id)}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3">Visibility Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {visibilityButtons.map((button) => (
                  <AnalysisButton
                    key={button.id}
                    id={button.id}
                    label={button.label}
                    icon={button.icon}
                    iconBg={button.iconBg}
                    description={button.description}
                    selected={selectedAnalyses.includes(button.id)}
                    onClick={() => toggleAnalysis(button.id)}
                  />
                ))}
              </div>
            </div>
            
            {selectedAnalyses.length === 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                <p className="text-sm text-amber-700">Please select at least one analysis type to continue</p>
              </div>
            )}
          </div>
        );

      case WizardStep.ConfigureParameters:
        return (
          <div>
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Settings className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Configure these parameters to optimise your analysis. Default values are recommended for most scenarios.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              {selectedAnalysisType === "flightPlan" ? (
                <div className="grid grid-cols-1 gap-6">
                  <ButtonGroup
                    label="Terrain Height Resolution"
                    options={parameterOptions.gridSize}
                    selectedValue={gridSize}
                    onChange={handleGridSizeChange}
                    ariaLabel="Terrain Height Resolution (DEM)"
                    unit="m"
                    min={1}
                    max={100}
                    showWarning={(value: number) => value < 30}
                    warningMessage="Resolution less than 30m may affect accuracy unless using high-res DEM"
                  />
                  <ButtonGroup
                    label="Area Analysis Distance from Flight Plan"
                    options={parameterOptions.bufferDistance}
                    selectedValue={bufferDistance}
                    onChange={handleBufferDistanceChange}
                    ariaLabel="Area Analysis Distance"
                    unit="m"
                    min={0}
                    max={5000}
                  />
                  <ButtonGroup
                    label="Observer/Comms Antenna Height Above Ground"
                    options={parameterOptions.height}
                    selectedValue={commsAntennaHeight}
                    onChange={handleCommsAntennaHeightChange}
                    ariaLabel="Observer/Comms Antenna Height"
                    unit="m"
                    min={1}
                    max={50}
                  />
                </div>
              ) : selectedAnalysisType === "operatingArea" ? (
                <div className="grid grid-cols-1 gap-6">
                  <ButtonGroup
                    label="Observer/Comms Antenna Height Above Ground"
                    options={parameterOptions.height}
                    selectedValue={commsAntennaHeight}
                    onChange={handleCommsAntennaHeightChange}
                    ariaLabel="Observer/Comms Antenna Height"
                    unit="m"
                    min={0}
                    max={20}
                  />
                  <ButtonGroup
                    label="Terrain Height Resolution"
                    options={parameterOptions.gridSize}
                    selectedValue={gridSize}
                    onChange={handleGridSizeChange}
                    ariaLabel="Terrain Height Resolution (DEM)"
                    unit="m"
                    min={1}
                    max={100}
                    showWarning={(value: number) => value < 30}
                    warningMessage="Fidelity less than 30m may affect accuracy unless using high-res DEM"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-600">Please select an analysis type to configure parameters.</p>
              )}
            </div>
          </div>
        );

      case WizardStep.UploadData:            
  return (
    <div className="w-full">
      {selectedAnalysisType === "flightPlan" ? (
        <FlightPlanUploader
          onClose={onClose}
          onPlanUploaded={handleFlightPlanUploaded}
        />
      ) : (
        <div>
          {/* Only show the header when not showing KML uploader */}
          {!showKmlUploader && (
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-800 mb-2">Define Area of Operations</h3>
              <p className="text-sm text-gray-600">
                Choose a method to define your operational area
              </p>
            </div>
          )}
          
          {/* Only show the grid when not showing KML uploader */}
          {!showKmlUploader ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* File Upload Option */}
              <button
                onClick={() => {
                  // Show the KML uploader component directly in the wizard
                  setShowKmlUploader(true);
                }}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-200 transition-all flex flex-col items-center text-center"
              >
                <div className="p-3 bg-blue-100 rounded-full mb-3">
                  <FileUp className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Upload KML File</h4>
                <p className="text-sm text-gray-600">
                  Upload a KML file containing your operation area
                </p>
              </button>
              
              {/* Map Selection Option */}
              <button
                onClick={() => {
                  if (onStartMapSelection) {
                    trackEvent("wizard_start_map_selection", { analyses: selectedAnalyses });
                    onStartMapSelection("map");
                  }
                }}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-green-200 transition-all flex flex-col items-center text-center"
              >
                <div className="p-3 bg-green-100 rounded-full mb-3">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Select on Map</h4>
                <p className="text-sm text-gray-600">
                  Click on the map to define a circular operational area
                </p>
              </button>
              
              {/* Location Search Option */}
              <button
                onClick={() => {
                  if (onStartMapSelection) {
                    trackEvent("wizard_start_map_selection", { analyses: selectedAnalyses });
                    onStartMapSelection("search");
                  }
                }}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-purple-200 transition-all flex flex-col items-center text-center"
              >
                <div className="p-3 bg-purple-100 rounded-full mb-3">
                  <Search className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-medium text-gray-800 mb-1">Search Location</h4>
                <p className="text-sm text-gray-600">
                  Search for an address or location to use as center point
                </p>
              </button>
            </div>
          ) : (
            <div>
              <button 
                onClick={() => setShowKmlUploader(false)} 
                className="mb-4 flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to selection methods
              </button>
              <AreaOpsUploader
                onClose={onClose}
                onAOUploaded={handleAOUploaded}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between bg-white rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-800">{getStepTitle}</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100"
          aria-label="Close wizard"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Main content area with progress indicators and step content */}
      <div className="p-6 overflow-y-auto flex-grow">
        {/* Progress indicators */}
        {renderProgressIndicators()}
        
        {/* Step content */}
        {renderStepContent()}
      </div>

      {/* Footer with action buttons */}
      <div className="p-4 border-t border-gray-200 flex justify-between items-center bg-white rounded-b-lg">
        <button
          onClick={resetWizard}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors flex items-center"
          aria-label="Reset Wizard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
        
        <div className="flex space-x-3">
          {currentStep > 0 && currentStep < WizardStep.UploadData && (
            <button
              onClick={goToPreviousStep}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center"
              aria-label="Previous Step"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </button>
          )}
          
          {currentStep < WizardStep.UploadData && (
            <button
              onClick={goToNextStep}
              className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors flex items-center ${
                isNextButtonDisabled
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
              disabled={isNextButtonDisabled}
              aria-label="Next Step"
            >
              {currentStep === WizardStep.ConfigureParameters ? "Finish" : "Next"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisWizard;