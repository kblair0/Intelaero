/**
 * BasicChecksCard.tsx - Enhanced Visual Design
 *
 * Purpose: Provides essential validation for flight plans with modern UI
 * This enhanced card maintains expandable functionality while adopting the modern
 * card design pattern. It performs comprehensive flight plan validation including
 * zero altitude checks, duplicate waypoints, height mode validation, and terrain analysis.
 *
 * Visual Enhancements:
 * - Modern card design with blue gradients for validation theme
 * - Enhanced icon container with gradient background
 * - Improved expandable content layout with better visual hierarchy
 * - Status badges for quick scanning of validation results
 * - Better organized validation sections with clear visual separation
 * - Consistent with enhanced dashboard theme
 *
 * Validation Features:
 * - Zero altitude waypoint detection
 * - Duplicate waypoint identification
 * - Height mode validation
 * - 120m AGL compliance checking
 * - KMZ-specific safety warnings
 * - Terrain profile analysis integration
 *
 * Related Components:
 * - ToolsDashboard: Renders this as a verification card
 * - ObstacleAnalysisContext: Provides terrain elevation data
 * - FlightPlanContext: Provides flight plan data for validation
 * - ObstacleChartModal: Shows detailed terrain analysis
 */
'use client';
import React, { useState, useEffect } from "react";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Plane, 
  Mountain,
  ChevronDown,
  ChevronRight,
  Shield
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
 * Enhanced Basic Flight Plan Validation Card
 * Provides comprehensive flight plan validation with modern UI
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

  // Status badge component for validation results
  const StatusBadge: React.FC<{ status: 'success' | 'warning' | 'error', children: React.ReactNode }> = ({ status, children }) => {
    const bgColor = status === 'success' ? 'bg-green-100 text-green-800' : 
                   status === 'warning' ? 'bg-yellow-100 text-yellow-800' : 
                   'bg-red-100 text-red-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${bgColor}`}>
        {children}
      </span>
    );
  };

  // Render height check content based on analysis results
  const renderHeightCheckContent = () => {
    if (!results) {
      return (
        <StatusBadge status="warning">Pending</StatusBadge>
      );
    }

    const clearances = results.flightAltitudes.map(
      (alt, idx) => alt - results.terrainElevations[idx]
    );
    
    const maxClearance = Math.max(...clearances.filter((c) => !isNaN(c)));
    const exceedsHeightLimit = maxClearance > 120;
    
    if (exceedsHeightLimit) {
      return (
        <div className="flex flex-col items-end">
          <StatusBadge status="warning">Exceeds limit</StatusBadge>
          <span className="text-xs text-gray-600 mt-1">{maxClearance.toFixed(1)}m AGL</span>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-end">
          <StatusBadge status="success">Within limits</StatusBadge>
          <span className="text-xs text-gray-600 mt-1">{maxClearance.toFixed(1)}m AGL</span>
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

  const handleToggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    }
  };

  return (
    <div className="border-2 border-gray-200 m-1 rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-blue-300 transition-all duration-200">
      <button
        onClick={handleToggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50 hover:to-white transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
            {getOverallStatus() === "success" && <CheckCircle className="w-5 h-5" />}
            {getOverallStatus() === "error" && <XCircle className="w-5 h-5" />}
            {getOverallStatus() === "warning" && <AlertTriangle className="w-5 h-5" />}
            {getOverallStatus() === "pending" && <Shield className="w-5 h-5" />}
          </div>
          
          <div className="text-left flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm">Flight Plan Validation</h3>
            </div>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Essential safety & compliance checks</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 py-4 bg-gradient-to-br from-gray-50 to-blue-50/30 border-t border-gray-200">
          {/* Validation Results Grid */}
          <div className="grid gap-2 mb-4">
            
            {/* Height Mode Check */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800 text-sm">Height Mode Validation</h4>
                {!heightModeInfo.isValid ? (
                  <StatusBadge status="warning">Not detected</StatusBadge>
                ) : (
                  <StatusBadge status="success">Valid</StatusBadge>
                )}
              </div>
              <p className="text-xs text-gray-600">
                {heightModeInfo.isValid ? heightModeInfo.display : "Height mode not explicitly set"}
              </p>
            </div>

            {/* Zero Altitude Check */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800 text-sm">Zero Altitude Check</h4>
                {zeroAltitudePoints.length > 0 ? (
                  <StatusBadge status="error">{zeroAltitudePoints.length} issues</StatusBadge>
                ) : (
                  <StatusBadge status="success">All valid</StatusBadge>
                )}
              </div>
              {zeroAltitudePoints.length > 0 && (
                <div className="space-y-1">
                  {zeroAltitudePoints.slice(0, 3).map((point, idx) => (
                    <div key={idx} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      Waypoint {point.index + 1}: ({point.coord.map((v) => v.toFixed(2)).join(", ")})
                    </div>
                  ))}
                  {zeroAltitudePoints.length > 3 && (
                    <div className="text-xs text-gray-500">...and {zeroAltitudePoints.length - 3} more</div>
                  )}
                </div>
              )}
              {kmzTakeoffWarning && (
                <div className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded mt-2">
                  {kmzTakeoffWarning}
                </div>
              )}
            </div>

            {/* 120m AGL Height Check */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800 text-sm">120m AGL Compliance</h4>
                {renderHeightCheckContent()}
              </div>
              <p className="text-xs text-gray-600">
                Maximum allowed height above ground level
              </p>
            </div>

            {/* Duplicate Waypoints Check */}
            <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800 text-sm">Duplicate Waypoints</h4>
                {duplicateWaypoints.length > 0 ? (
                  <StatusBadge status="error">{duplicateWaypoints.length} duplicates</StatusBadge>
                ) : (
                  <StatusBadge status="success">None found</StatusBadge>
                )}
              </div>
              {duplicateWaypoints.length > 0 && (
                <div className="space-y-1">
                  {duplicateWaypoints.slice(0, 3).map((point, idx) => (
                    <div key={idx} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      Waypoint {point.index + 1}: ({point.coord.map((v) => v.toFixed(2)).join(", ")})
                    </div>
                  ))}
                  {duplicateWaypoints.length > 3 && (
                    <div className="text-xs text-gray-500">...and {duplicateWaypoints.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Terrain Analysis Action */}
          <div className="pt-3 border-t border-gray-200">
            <button
              onClick={handleRunTerrainAnalysis}
              disabled={!flightPlan || status === 'loading'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-sm"
            >
              <Mountain className="w-4 h-4" />
              {status === 'loading' ? 'Analyzing Terrain...' : 'Show Terrain Profile'}
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