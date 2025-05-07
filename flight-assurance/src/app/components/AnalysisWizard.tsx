"use client";
import React, { useState, useCallback } from "react";
import { X, Eye, Radio, Link, User, MapPin, Zap, Plane } from "lucide-react";
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
}

/**
 * Custom SVG component for Mountain icon
 */
const Mountain = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9-6 9 6v12H3V8z" />
  </svg>
);

/**
 * Custom SVG component for Drone icon
 */
const DroneIcon = () => (
  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h4m4 0h8m-4 8h4m-8 0H4m8-12v4m0 4v4" />
  </svg>
);

/**
 * Reusable ButtonGroup component for selecting predefined values or custom input
 */
interface ButtonGroupProps {
  label: string;
  options: (number | string)[];
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

  const handleButtonClick = (value: number | string) => {
    if (value === "Other") {
      setShowCustomInput(true);
      setCustomValue(selectedValue);
    } else {
      setShowCustomInput(false);
      onChange(Number(value));
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

  const getButtonLabel = (option: number | string) => {
    if (option === "Other") return "Other";
    if (option === 30 && label.includes("Grid Size")) return "30m SRTM";
    return `${option}${unit}`;
  };

  return (
    <div>
      <div className="mb-1">
        <label className="block text-sm font-medium text-gray-800">{label}</label>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => handleButtonClick(option)}
            className={`px-3 py-1 rounded text-sm ${
              (option !== "Other" && selectedValue === option && !showCustomInput) ||
              (option === "Other" && showCustomInput)
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            aria-label={`${ariaLabel} ${option}`}
          >
            {getButtonLabel(option)}
          </button>
        ))}
      </div>
      {showCustomInput && (
        <input
          type="number"
          value={customValue}
          onChange={handleCustomInputChange}
          className="mt-2 w-16 h-6 p-1 border rounded text-sm"
          min={min}
          max={max}
          aria-label={`${ariaLabel} custom input`}
        />
      )}
      {showWarning && typeof selectedValue === "number" && showWarning(selectedValue) && warningMessage && (
        <p className="mt-2 text-xs text-red-500">{warningMessage}</p>
      )}
    </div>
  );
};

/**
 * Wizard component for flight planning, displaying a single scrollable page with three sections:
 * 1. Select Analysis Type (Operating Area or Flight Plan, mutually exclusive),
 * 2. Select Analyses (Vs Terrain and Visibility rows, with left-justified headings and centered buttons),
 * 3. Configure Parameters (Analysis Fidelity, Area Analysis Dist, Antenna Height for Flight Plan; Observer Height for Operating Area),
 * Followed by buttons to show the appropriate uploader or reset filters.
 * Triggers checklist population on successful upload and closes the wizard.
 */
const AnalysisWizard: React.FC<AnalysisWizardProps> = ({ onClose }) => {
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<string | null>(null);
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
  const [gridSize, setGridSize] = useState<number>(30);
  const [bufferDistance, setBufferDistance] = useState<number>(500);
  const [antennaHeight, setAntennaHeight] = useState<number>(2);
  const [observerHeight, setObserverHeight] = useState<number>(2);
  const [showUploader, setShowUploader] = useState<"flightPlan" | "operatingArea" | null>(null);

  const { setGcsElevationOffset, setRepeaterElevationOffset } = useMarkersContext();
  const { setGridSize: setContextGridSize } = useLOSAnalysis();
  const { flightPlan, setFlightPlan } = useFlightPlanContext();
  const { aoGeometry, setAoGeometry, setBufferDistance: setContextBufferDistance } = useAreaOfOpsContext();
  const { addChecks } = useChecklistContext();

  /**
   * Toggles the analysis type, ensuring mutual exclusivity
   */
  const toggleAnalysisType = (type: string) => {
    setSelectedAnalysisType(type === selectedAnalysisType ? null : type);
    setShowUploader(null); // Reset uploader when changing analysis type
    trackEvent("wizard_analysis_type_toggled", { type });
  };

  /**
   * Toggles the selection state of an analysis
   */
  const toggleAnalysis = (analysis: string) => {
    setSelectedAnalyses((prev) =>
      prev.includes(analysis) ? prev.filter((a) => a !== analysis) : [...prev, analysis]
    );
    trackEvent("wizard_analysis_toggled", { analysis });
  };

  /**
   * Resets all filters and selections
   */
  const resetFilters = () => {
    setSelectedAnalysisType(null);
    setSelectedAnalyses([]);
    setGridSize(30);
    setBufferDistance(500);
    setAntennaHeight(2);
    setObserverHeight(2);
    setShowUploader(null);
    setGcsElevationOffset(2);
    setRepeaterElevationOffset(2);
    setContextGridSize(30);
    trackEvent("wizard_filters_reset", {});
  };

  /**
   * Handles Antenna Height changes, updating both GCS and Repeater elevation offsets
   */
  const handleAntennaHeightChange = useCallback(
    (value: number) => {
      setAntennaHeight(value);
      setGcsElevationOffset(value);
      setRepeaterElevationOffset(value);
    },
    [setGcsElevationOffset, setRepeaterElevationOffset]
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
   * Handles button click to show the appropriate uploader
   */
  const handleButtonClick = () => {
    if (selectedAnalysisType === "flightPlan") {
      setShowUploader("flightPlan");
    } else if (selectedAnalysisType === "operatingArea" && selectedAnalyses.length > 0) {
      setShowUploader("operatingArea");
    }
  };

  /**
   * Handles back button click to hide uploader
   */
  const handleBackClick = () => {
    setShowUploader(null);
    trackEvent("wizard_back_clicked", { uploader: showUploader });
  };

  /**
   * Handles successful flight plan upload
   */
  const handleFlightPlanUploaded = (flightData: any) => {
    setFlightPlan(flightData);
    addChecks(selectedAnalyses); // Populate checklist
    onClose(); // Close wizard
    trackEvent("flight_plan_uploaded", {});
  };

  /**
   * Handles successful AO upload
   */
  const handleAOUploaded = (aoData: any) => {
    setAoGeometry(aoData);
    addChecks(selectedAnalyses); // Populate checklist
    // Delay closure handled by AreaOpsUploader
    trackEvent("area_ops_uploaded", {});
  };

  /**
   * Array defining the buttons for Section 2, split into Vs Terrain and Visibility rows
   */
  const vsTerrainButtons = [
    {
      id: "terrainProfile",
      label: "Terrain Profile",
      icon: <Mountain className="w-4 h-4 text-green-600" />,
      iconBg: "bg-green-200",
    },
    {
      id: "observerVsTerrain",
      label: "Observer Vs Terrain",
      icon: <User className="w-4 h-4 text-gray-600" />,
      iconBg: "bg-gray-200",
    },
    {
      id: "gcsRepeaterVsTerrain",
      label: "GCS/Repeater vs Terrain",
      icon: <Radio className="w-4 h-4 text-yellow-600" />,
      iconBg: "bg-yellow-200",
    },
    {
      id: "flightPathVsTerrain",
      label: "FlightPath vs Terrain",
      icon: <MapPin className="w-4 h-4 text-indigo-600" />,
      iconBg: "bg-indigo-200",
    },
    {
      id: "powerline",
      label: "Powerlines",
      icon: <Zap className="w-4 h-4 text-red-600" />,
      iconBg: "bg-red-200",
    },
    {
      id: "airspace",
      label: "Airspace",
      icon: <Plane className="w-4 h-4 text-red-600" />,
      iconBg: "bg-red-200",
    },
  ];

  const visibilityButtons = [
    {
      id: "observerToDrone",
      label: "Observer to Drone",
      icon: <Eye className="w-4 h-4 text-blue-600" />,
      iconBg: "bg-blue-200",
    },
    {
      id: "antennaToDrone",
      label: "Antenna to Drone",
      icon: <Radio className="w-4 h-4 text-purple-500" />,
      iconBg: "bg-purple-100",
    },
    {
      id: "droneToGround",
      label: "Drone to Ground",
      icon: <DroneIcon />,
      iconBg: "bg-orange-100",
    },
    {
      id: "antennaToAntenna",
      label: "Antenna to Antenna",
      icon: <Link className="w-4 h-4 text-teal-600" />,
      iconBg: "bg-teal-200",
    },
  ];

  return (
    <div className="relative bg-white rounded-lg p-4 max-w-full mx-auto shadow-lg max-h-[90vh] overflow-y-auto">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
        aria-label="Close wizard"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Section 1: Select Analysis Type */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Choose your type of analysis:</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => toggleAnalysisType("operatingArea")}
            className={`p-4 border rounded-lg text-center hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 ${
              selectedAnalysisType === "operatingArea" ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
            aria-label="Select Operating Area"
          >
            <div className="p-1 bg-green-100 rounded-full">
              <svg
                className="w-6 h-6 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447-2.724A1 1 0 0021 13.382V2.618a1 1 0 00-1.447-.894L15 4m0 13l-6-3"
                />
              </svg>
            </div>
            <h3 className="text-md font-medium text-gray-800">Operating Area Analysis</h3>
            <p className="text-sm text-green-500">Ideal for local flying (VLOS) and mission planning.</p>
          </button>
          <button
            onClick={() => toggleAnalysisType("flightPlan")}
            className={`p-4 border rounded-lg text-center hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 ${
              selectedAnalysisType === "flightPlan" ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
            aria-label="Select Flight Plan"
          >
            <div className="p-1 bg-blue-100 rounded-full">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-md font-medium text-gray-800">Flight Plan and Operating Area Analysis</h3>
            <p className="text-sm text-blue-500">Suitable for VLOS, EVLOS, and BVLOS missions.</p>
          </button>
        </div>
      </section>

      {/* Section 2: Select Analyses */}
      <section className="mb-2">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Analyses</h2>
        <div className="flex flex-col gap-2">
          <div className="w-full">
            <h3 className="text-md font-medium text-gray-800 mb-2 text-left">Vs Terrain</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {vsTerrainButtons.map((button) => (
                <div key={button.id} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => toggleAnalysis(button.id)}
                    className={`w-12 h-12 border rounded-lg flex items-center justify-center transition-colors ${
                      selectedAnalyses.includes(button.id)
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-300 bg-gray-50"
                    }`}
                    aria-label={`Toggle ${button.label}`}
                  >
                    <div className={`p-1 ${button.iconBg} rounded-full flex items-center justify-center`}>
                      {button.icon}
                    </div>
                  </button>
                  <span className="text-sm text-gray-700 text-center w-20">{button.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full">
            <h3 className="text-md font-medium text-gray-800 mb-2 text-left">Visibility</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {visibilityButtons.map((button) => (
                <div key={button.id} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => toggleAnalysis(button.id)}
                    className={`w-12 h-12 border rounded-lg flex items-center justify-center transition-colors ${
                      selectedAnalyses.includes(button.id)
                        ? "border-blue-600 bg-blue-600"
                        : "border-gray-300 bg-gray-50"
                    }`}
                    aria-label={`Toggle ${button.label}`}
                  >
                    <div className={`p-1 ${button.iconBg} rounded-full flex items-center justify-center`}>
                      {button.icon}
                    </div>
                  </button>
                  <span className="text-sm text-gray-700 text-center w-20">{button.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Configure Parameters */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Configure Parameters</h2>
        {selectedAnalysisType === "flightPlan" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ButtonGroup
              label="Analysis Fidelity (Grid Size, m):"
              options={[10, 30, "Other"]}
              selectedValue={gridSize}
              onChange={handleGridSizeChange}
              ariaLabel="Analysis Fidelity"
              min={1}
              max={100}
              showWarning={(value: number) => value < 30}
              warningMessage="Warning: Fidelity less than 30m is not 100% accurate. Use with caution."
            />
            <ButtonGroup
              label="Area Analysis Dist from Flight Plan (m):"
              options={[500, 1000, 2000, "Other"]}
              selectedValue={bufferDistance}
              onChange={handleBufferDistanceChange}
              ariaLabel="Area Analysis Distance"
              min={0}
              max={5000}
            />
            <ButtonGroup
              label="Default Antenna Height (m):"
              options={[2, 5, 10, "Other"]}
              selectedValue={antennaHeight}
              onChange={handleAntennaHeightChange}
              ariaLabel="Antenna Height"
              min={1}
              max={50}
            />
          </div>
        ) : selectedAnalysisType === "operatingArea" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ButtonGroup
              label="Observer Height Above Ground (m):"
              options={[2, 5, 10, "Other"]}
              selectedValue={observerHeight}
              onChange={setObserverHeight}
              ariaLabel="Observer Height Above Ground"
              min={0}
              max={10}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-600">Please select an analysis type to configure parameters.</p>
        )}
      </section>

      {/* Conditional Uploader Section */}
      {showUploader && (
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {showUploader === "flightPlan" ? "Upload Flight Plan" : "Set Operating Area"}
            </h2>
            <button
              onClick={handleBackClick}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              aria-label="Back to wizard"
            >
              Back
            </button>
          </div>
          <div className="bg-white p-4 rounded-lg w-full max-w-4xl mx-auto">
            {showUploader === "flightPlan" ? (
              <FlightPlanUploader
                onClose={onClose}
                onPlanUploaded={handleFlightPlanUploaded}
              />
            ) : (
              <AreaOpsUploader
                onClose={onClose}
                onAOUploaded={handleAOUploaded}
              />
            )}
          </div>
        </section>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex justify-between">
        <button
          onClick={resetFilters}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          aria-label="Reset Filters"
        >
          Reset Filters
        </button>
        <button
          onClick={handleButtonClick}
          className={`px-6 py-2 rounded-lg shadow transition-colors text-white ${
            selectedAnalysisType && selectedAnalyses.length > 0
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
          disabled={!selectedAnalysisType || selectedAnalyses.length === 0}
          aria-label={selectedAnalysisType === "flightPlan" ? "Upload Flight Plan" : "Set Operating Area"}
        >
          {selectedAnalysisType === "flightPlan" ? "Upload Flight Plan" : "Set Operating Area"}
        </button>
      </div>
      {selectedAnalysisType && selectedAnalyses.length === 0 && !showUploader && (
        <p className="mt-2 text-xs text-red-500 text-center">Please select at least one analysis option</p>
      )}
    </div>
  );
};

export default AnalysisWizard;