/**
 * PlanVerification/Cards/BasicChecksCard.tsx
 * 
 * Purpose:
 * Provides essential validation for flight plans, checking for common issues
 * like zero altitude points, duplicate waypoints, and validating the height mode.
 * 
 * This component:
 * - Checks for zero altitude waypoints
 * - Validates flight plan height modes
 * - Detects duplicate waypoints
 * - Checks for KMZ-specific issues
 * - Displays analyzed terrain height data when available
 * 
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - ObstacleAnalysisContext: Provides terrain elevation data
 * - FlightPlanContext: Provides flight plan data for validation
 */

import React, { useState, useEffect } from "react";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Plane, Mountain
} from "lucide-react";
import { useObstacleAnalysis } from "../../../context/ObstacleAnalysisContext";
import ObstacleChartModal from "../../Analyses/ObstacleAnalysis/ObstacleChartModal";
import { VerificationCardProps, VerificationStatus, WaypointCoordinate } from "../Utils/types";
import { 
  findZeroAltitudePoints, 
  findDuplicateWaypoints, 
  checkKmzTakeoffSafety,
  getHeightModeInfo
} from "../Utils/flightPlanChecks";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";
import { useMapContext } from "../../../context/mapcontext";



/**
 * Provides basic flight plan validation
 */
const BasicChecksCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan
}) => {
  const { results } = useObstacleAnalysis();
  const { runAnalysis, status } = useObstacleAnalysis(); 
  const [showTerrainModal, setShowTerrainModal] = useState(false);
  
  const { toggleLayer } = useMapContext();
  
  // Local state for validation results
  const [zeroAltitudePoints, setZeroAltitudePoints] = useState<WaypointCoordinate[]>([]);
  const [duplicateWaypoints, setDuplicateWaypoints] = useState<WaypointCoordinate[]>([]);
  const [kmzTakeoffWarning, setKmzTakeoffWarning] = useState<string | null>(null);
  const [heightModeInfo, setHeightModeInfo] = useState<{mode: string; display: string; isValid: boolean}>({
    mode: "unknown",
    display: "Unknown Height Mode",
    isValid: false
  });

  // Run validations when flight plan changes
  useEffect(() => {
    if (!flightPlan) {
      resetValidations();
      return;
    }

    // Run all checks
    setZeroAltitudePoints(findZeroAltitudePoints(flightPlan));
    setDuplicateWaypoints(findDuplicateWaypoints(flightPlan));
    setKmzTakeoffWarning(checkKmzTakeoffSafety(flightPlan));
    setHeightModeInfo(getHeightModeInfo(flightPlan));
  }, [flightPlan]);

  // Reset all validation states
  const resetValidations = () => {
    setZeroAltitudePoints([]);
    setDuplicateWaypoints([]);
    setKmzTakeoffWarning(null);
    setHeightModeInfo({
      mode: "unknown",
      display: "Unknown Height Mode",
      isValid: false
    });
  };

  // Calculate overall status
  const getOverallStatus = (): VerificationStatus => {
    if (!flightPlan) return "pending";
    
    const hasZeroAltitudes = zeroAltitudePoints.length > 0;
    const hasDuplicates = duplicateWaypoints.length > 0;
    const hasKmzTakeoffIssue = kmzTakeoffWarning !== null;
    
    if (hasZeroAltitudes || hasDuplicates) {
      return "error";
    }
    
    if (hasKmzTakeoffIssue || !heightModeInfo.isValid) {
      return "warning";
    }
    
    // Check terrain data if available
    if (results) {
      const hasExcessiveHeight = results.flightAltitudes.some(
        (alt, idx) => (alt - results.terrainElevations[idx]) > 120
      );
      
      return hasExcessiveHeight ? "warning" : "success";
    }
    
    return "success";
  };

  // Render height check content based on analysis results
  const renderHeightCheckContent = () => {
    if (!results) {
      return (
        <div className="text-sm text-gray-500">Terrain analysis pending</div>
      );
    }

    const clearances = results.flightAltitudes.map(
      (alt, idx) => alt - results.terrainElevations[idx]
    );
    
    const maxClearance = Math.max(...clearances.filter((c) => !isNaN(c)));
    const exceedsHeightLimit = maxClearance > 120;
    
    if (exceedsHeightLimit) {
      return (
        <div className="text-sm text-yellow-600">
          ⚠️ Maximum height above ground exceeds 120m: {maxClearance.toFixed(1)}m AGL
        </div>
      );
    } else {
      return (
        <div className="text-sm text-green-600">
          ✓ Maximum height above ground: {maxClearance.toFixed(1)}m AGL (within 120m limit)
        </div>
      );
    }
  };

  const handleRunTerrainAnalysis = async () => {
    trackEvent("run_terrain_analysis", { panel: "basicchecks.tsx" });
    try {
      await runAnalysis();
      setShowTerrainModal(true);
    } catch (error) {
      console.error("Terrain analysis failed:", error);
    }
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {getOverallStatus() === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
          {getOverallStatus() === "error" && <XCircle className="w-5 h-5 text-red-500" />}
          {getOverallStatus() === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          {getOverallStatus() === "pending" && <Plane className="w-5 h-5 text-gray-400" />}
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Basic Flight Plan Checks</h3>
              <a
                href="https://youtu.be/iUYkmdUv46A"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex gap-1 items-center"
                aria-label="Watch YouTube guide for Basic Flight Plan Checks"
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
            <p className="text-sm text-gray-500">Essential flight plan validation</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t space-y-4">
          {/* Height Mode Check */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Explicit Height Mode</h4>
            <div className="text-sm">
              {!heightModeInfo.isValid ? (
                <span className="text-yellow-600">⚠️ Height mode not detected</span>
              ) : (
                <span className="text-green-600">✓ {heightModeInfo.display}</span>
              )}
            </div>
          </div>

          {/* Zero Altitude Check */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Zero Altitude Check</h4>
            <div>
              {zeroAltitudePoints.length > 0 ? (
                <div className="text-sm text-red-600">
                  Found {zeroAltitudePoints.length} zero altitude points:
                  {zeroAltitudePoints.map((point, idx) => (
                    <div key={idx} className="ml-2">
                      • Waypoint {point.index + 1}: (
                      {point.coord.map((v) => v.toFixed(2)).join(", ")})
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-green-600">✓ All waypoints have valid altitudes</div>
              )}
              {kmzTakeoffWarning && (
                <div className="text-sm text-yellow-600 mt-2">⚠️ {kmzTakeoffWarning}</div>
              )}
            </div>
          </div>

          {/* 120m AGL Height Check */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">120m AGL Height Check</h4>
            {renderHeightCheckContent()}
          </div>

          {/* Duplicate Waypoints Check */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-700">Duplicate Waypoints Check</h4>
            {duplicateWaypoints.length > 0 ? (
              <div className="text-sm text-red-600">
                Found {duplicateWaypoints.length} duplicate waypoints:
                {duplicateWaypoints.map((point, idx) => (
                  <div key={idx} className="ml-2">
                    • Waypoint {point.index + 1}: (
                    {point.coord.map((v) => v.toFixed(2)).join(", ")})
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-green-600">✓ No duplicate waypoints found</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 mt-3">
            <button
              onClick={handleRunTerrainAnalysis}
              disabled={!flightPlan || status === 'loading'}
              className="flex gap-2 px-3 py-1.5 bg-green-500 justify-center text-white text-sm rounded-md hover:bg-green-600 transition-colors disabled:bg-gray-300"
            >
              <Mountain className="w-4 h-4" />
              {status === 'loading' ? 'Analyzing...' : 'Show Terrain Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Terrain Analysis Modal */}
      {showTerrainModal && (
        <ObstacleChartModal
          onClose={() => setShowTerrainModal(false)}
          title="Flight Path Terrain Analysis"
        />
      )}
    </div>
  );
};

export default BasicChecksCard;