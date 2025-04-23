/**
 * PlanVerification/Cards/EnergyAnalysisCard.tsx
 * 
 * Purpose:
 * Analyzes flight energy requirements against battery capacity.
 * Validates if the flight plan is feasible given the configured battery.
 * 
 * This component:
 * - Displays battery requirements and capacity
 * - Shows flight time estimates
 * - Provides battery reserve calculations
 * - Offers quick access to detailed energy analysis
 * 
 * Related Components:
 * - PlanVerificationDashboard: Renders this as a verification card
 * - FlightConfigurationContext: Provides battery and flight metrics
 * - Calculator: Detailed energy analysis component opened from this card
 */

import React, { useState, useEffect } from "react";
import { 
  Battery, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Upload,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useFlightConfiguration } from "../../../context/FlightConfigurationContext";
import { VerificationCardProps, VerificationStatus } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Provides flight energy analysis and battery validation
 */
const EnergyAnalysisCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan,
  onTogglePanel
}) => {
  const { metrics } = useFlightConfiguration();
  const [energyAnalysisOpened, setEnergyAnalysisOpened] = useState(false);
  
  // Track when energy panel is opened
  useEffect(() => {
    // Reset state when flight plan changes
    setEnergyAnalysisOpened(false);
  }, [flightPlan]);

  /**
   * Open the energy analysis panel
   */
  const handleOpenEnergyAnalysis = () => {
    trackEvent("open_energy_analysis", { panel: "energyanalysis.tsx" });
    setEnergyAnalysisOpened(true);
    if (onTogglePanel) {
      onTogglePanel("energy");
    }
  };

  /**
   * Calculate the verification status based on metrics
   */
  const getEnergyStatus = (): VerificationStatus => {
    if (!flightPlan) return "pending";
    
    if (!metrics) return "pending";
    
    if (energyAnalysisOpened) {
      return metrics.isFeasible ? "success" : "error";
    }
    
    // If not yet opened, show warning to prompt review
    return "warning";
  };

  /**
   * Format time string for display
   */
  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return "N/A";
    return timeString;
  };

  /**
   * Format capacity for display
   */
  const formatCapacity = (capacity: number | undefined): string => {
    if (capacity === undefined) return "N/A";
    return `${capacity} mAh`;
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {getEnergyStatus() === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
          {getEnergyStatus() === "error" && <XCircle className="w-5 h-5 text-red-500" />}
          {getEnergyStatus() === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          {getEnergyStatus() === "pending" && <Battery className="w-5 h-5 text-gray-400" />}
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Energy Analysis</h3>
              <a
                href="https://youtu.be/mJTWGmtgtZg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex gap-1 items-center"
                aria-label="Watch YouTube guide for Energy Analysis"
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
            <p className="text-sm text-gray-500">Battery and flight time verification</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t space-y-4">
          {/* Battery Requirements */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Battery Requirements</h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Required Capacity:</div>
                <div>{formatCapacity(metrics?.expectedBatteryConsumption)}</div>
                
                <div>Available Capacity:</div>
                <div>{formatCapacity(metrics?.availableBatteryCapacity)}</div>
                
                <div>Flight Time:</div>
                <div>{formatTime(metrics?.flightTime)}</div>
                
                <div>Reserve Required:</div>
                <div>{formatCapacity(metrics?.batteryReserve)}</div>
                
                <div>Status:</div>
                <div
                  className={
                    energyAnalysisOpened
                      ? metrics?.isFeasible
                        ? "text-green-600"
                        : "text-red-600"
                      : "text-yellow-600"
                  }
                >
                  {energyAnalysisOpened
                    ? metrics?.isFeasible
                      ? "✓ Flight plan within battery capacity"
                      : "✗ Flight plan exceeds battery capacity"
                    : "⚠️ Review energy analysis for details"}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleOpenEnergyAnalysis}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
            >
              <Battery className="w-4 h-4" />
              Open Energy Analysis
            </button>
            
            <button
              onClick={() => {
                trackEvent("upload_bin_ulg_click", { panel: "energyanalysis.tsx" });
                if (typeof window !== "undefined") {
                  window.alert("Coming Soon!");
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload BIN/ULG File for Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnergyAnalysisCard;