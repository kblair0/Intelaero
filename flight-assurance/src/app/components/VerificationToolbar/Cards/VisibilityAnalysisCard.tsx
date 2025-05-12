/**
 * PlanVerification/Cards/VisibilityAnalysisCard.tsx
 * 
 * Purpose:
 * Provides a verification interface for Line of Sight (LOS) analysis.
 * This component serves as a bridge between the verification dashboard and the 
 * full LOS analysis system, showing coverage summary and providing quick access
 * to detailed analysis tools.
 * 
 * This component:
 * - Displays communication coverage summary from LOS analysis
 * - Shows station-to-station LOS status if available
 * - Provides quick access to the full LOS analysis panel
 * - Integrates with existing LOS analysis systems
 * 
 * Related Components:
 * - PlanVerificationDashboard: Renders this as a verification card
 * - AnalysisDashboard: The detailed LOS analysis components
 * - LOSAnalysisContext: Provides analysis data and functionality
 */
'use client';
import React, { useState, useEffect } from "react";
import { 
  Radio, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Radio as RadioIcon,
  Link
} from "lucide-react";
import { useLOSAnalysis } from "../../../context/LOSAnalysisContext";
import { useMarkersContext } from "../../../context/MarkerContext";
import { useAnalysisController } from "../../../context/AnalysisControllerContext";
import { VerificationCardProps, VerificationStatus } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";

/**
 * Provides LOS communication verification
 */
const LOSAnalysisCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan,
  onTogglePanel
}) => {
  const { results, setError } = useLOSAnalysis();
  const { gridAnalysisRef } = useAnalysisController();
  
  const { markers } = useMarkersContext();

// Count markers by type
const gcsMarkers = markers.filter(m => m.type === 'gcs');
const observerMarkers = markers.filter(m => m.type === 'observer');
const repeaterMarkers = markers.filter(m => m.type === 'repeater');

// Available station types
const availableStations = [
  gcsMarkers.length > 0 && "GCS",
  observerMarkers.length > 0 && "Observer",
  repeaterMarkers.length > 0 && "Repeater"
].filter(Boolean);

  // Local state
  const [stationLOSStatus, setStationLOSStatus] = useState<'success' | 'error' | 'pending'>('pending');
  const [flightCoverage, setFlightCoverage] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  

  // Update flight path coverage when results change
  useEffect(() => {
    if (results?.stats) {
      setFlightCoverage(results.stats.averageVisibility);
    } else {
      setFlightCoverage(null);
    }
    
    // Check station-to-station LOS result if available
    if (results?.stationLOSResult) {
      setStationLOSStatus(results.stationLOSResult.clear ? 'success' : 'error');
    } else {
      setStationLOSStatus('pending');
    }
  }, [results]);

  /**
   * Opens the LOS analysis panel
   */
  const handleOpenLOSPanel = () => {
    trackEvent("open_los_analysis", { panel: "losanalysis.tsx" });
    if (onTogglePanel) {
      onTogglePanel("los");
    }
  };

  /**
   * Quick-run station-to-station LOS check if appropriate
   */
  const handleQuickLOSCheck = async () => {
    // Only run if exactly 2 station types are available
    if (availableStations.length !== 2 || !gridAnalysisRef.current) {
      setLocalError("Need exactly 2 types of stations placed for quick LOS check");
      return;
    }
    
    try {
      // Find one marker of each available type
      const markersByType: Record<string, any> = {};
      if (gcsMarkers.length > 0) markersByType.gcs = gcsMarkers[0];
      if (observerMarkers.length > 0) markersByType.observer = observerMarkers[0];
      if (repeaterMarkers.length > 0) markersByType.repeater = repeaterMarkers[0];
      
      const stationTypes = Object.keys(markersByType) as Array<"gcs" | "observer" | "repeater">;
      
      if (stationTypes.length !== 2) return;
      
      const [sourceType, targetType] = stationTypes;
      const sourceMarker = markersByType[sourceType];
      const targetMarker = markersByType[targetType];
      
      trackEvent("quick_station_los_check", { 
        sourceType, 
        targetType,
        sourceId: sourceMarker.id,
        targetId: targetMarker.id
      });
      
      setLocalError(null);
      setError(null);
      
      // Run the analysis with marker IDs
      const losData = await gridAnalysisRef.current.checkStationToStationLOS(
        sourceMarker.id, 
        targetMarker.id
      );
      
      // Update status based on result
      setStationLOSStatus(losData.result.clear ? 'success' : 'error');
      
      // Open the full panel if there's an obstruction
      if (!losData.result.clear) {
        handleOpenLOSPanel();
      }
    } catch (err: any) {
      console.error("Quick LOS check failed:", err);
      setLocalError(err.message || "LOS check failed");
    }
  };

  /**
   * Get the verification status based on analysis results
   */
  const getVerificationStatus = (): VerificationStatus => {
    if (!flightPlan) return 'pending';
    
    if (availableStations.length === 0) {
      return 'warning'; // No stations placed
    }
    
    // If we have station-to-station LOS results
    if (stationLOSStatus !== 'pending') {
      if (stationLOSStatus === 'error') {
        return 'error';
      }
    }
    
    // If we have flight path coverage results
    if (flightCoverage !== null) {
      if (flightCoverage < 50) {
        return 'error';
      }
      if (flightCoverage < 80) {
        return 'warning';
      }
      return 'success';
    }
    
    // Default case - show as pending verification
    return 'warning';
  };
  
  /**
   * Generate appropriate guidance based on station configuration
   */
  const getLOSGuidance = (): React.ReactNode => {
    if (availableStations.length === 0) {
      return (
        <div className="text-yellow-600 text-sm">
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            <span>No communication stations placed on map</span>
          </div>
          <p className="ml-5 text-xs mt-1">
            Place GCS/Observer/Repeater markers to analyze communication coverage
          </p>
        </div>
      );
    }
    
    if (availableStations.length === 1) {
      return (
        <div className="text-yellow-600 text-sm">
          <div className="flex items-center gap-1">
            <RadioIcon className="w-4 h-4" />
            <span>One station placed: {availableStations[0]}</span>
          </div>
          <p className="ml-5 text-xs mt-1">
            Place at least one more station to check Line-of-Sight between stations
          </p>
        </div>
      );
    }
    
    if (availableStations.length >= 2 && stationLOSStatus === 'pending') {
      return (
        <div className="text-yellow-600 text-sm">
          <div className="flex items-center gap-1">
            <Link className="w-4 h-4" />
            <span>{availableStations.length} stations placed</span>
          </div>
          <button
            onClick={handleQuickLOSCheck}
            className="ml-5 text-xs mt-1 text-blue-600 hover:underline cursor-pointer"
          >
            Run quick LOS check between stations
          </button>
        </div>
      );
    }
    
    if (stationLOSStatus === 'success') {
      return (
        <div className="text-green-600 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            <span>Clear line of sight between stations</span>
          </div>
        </div>
      );
    }
    
    if (stationLOSStatus === 'error') {
      return (
        <div className="text-red-600 text-sm">
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            <span>Line of sight between stations is obstructed</span>
          </div>
          <p className="ml-5 text-xs mt-1">
            Open the LOS Analysis panel for details and to view obstruction point
          </p>
        </div>
      );
    }
    
    return null;
  };

  /**
   * Format coverage percentage for display
   */
  const formatCoverage = (coverage: number | null): string => {
    if (coverage === null) return 'N/A';
    return `${coverage.toFixed(1)}%`;
  };

  return (
    <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {getVerificationStatus() === "success" && <CheckCircle className="w-5 h-5 text-green-500" />}
          {getVerificationStatus() === "error" && <XCircle className="w-5 h-5 text-red-500" />}
          {getVerificationStatus() === "warning" && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
          {getVerificationStatus() === "pending" && <Radio className="w-5 h-5 text-gray-400" />}
          
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Visibility Tools</h3>
              <a
                href="https://youtu.be/u-WPwwh1tpA"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex gap-1 items-center"
                aria-label="Watch YouTube guide for LOS Analysis"
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
            <p className="text-sm text-gray-500">Verify visibility and communication coverage</p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          {/* LOS Status Section */}
          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Communication Status</h4>
            
            {/* Station Guidance */}
            {getLOSGuidance()}
            
            {/* Coverage Data if Available */}
            {flightCoverage !== null && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>Flight Path Coverage:</div>
                <div className={
                  flightCoverage < 50 ? "text-red-600" :
                  flightCoverage < 80 ? "text-yellow-600" :
                  "text-green-600"
                }>
                  {formatCoverage(flightCoverage)}
                </div>
                
                <div>Communication Risk:</div>
                <div className={
                  flightCoverage < 50 ? "text-red-600" :
                  flightCoverage < 80 ? "text-yellow-600" :
                  "text-green-600"
                }>
                  {flightCoverage < 50 ? "High" :
                   flightCoverage < 80 ? "Moderate" :
                   "Low"}
                </div>
                
                <div>Stations Available:</div>
                <div>{availableStations.length}</div>
              </div>
            )}
            
            {localError && (
              <div className="mt-2 text-xs text-red-500">{localError}</div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleOpenLOSPanel}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
            >
              <Radio className="w-4 h-4" />
              Open LOS Analysis
            </button>
            
            <button
              onClick={() => {
                trackEvent("view_flight_visibility", { panel: "losanalysis.tsx" });
                handleOpenLOSPanel();
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Flight Visibility Map
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LOSAnalysisCard;