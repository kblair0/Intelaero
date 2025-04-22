/**
 * ObstacleChartModal.tsx
 * 
 * Purpose:
 * A modal popup that displays the obstacle chart in an overlay.
 * This component focuses on modal functionality, delegating chart rendering
 * to the ObstacleChart component, while providing additional analysis controls.
 * 
 * Related Files:
 * - ObstacleChart.tsx: Chart component used within the modal
 * - ObstacleAnalysisContext.tsx: Provides chart data and analysis methods
 */

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useObstacleAnalysis } from "../../context/ObstacleAnalysisContext";
import { CheckCircle, XCircle, RefreshCw, Loader, Mountain } from "lucide-react";
import ObstacleChart from "./ObstacleChart";
import { useFlightPlanContext } from "../../context/FlightPlanContext";

interface ObstacleChartModalProps {
  onClose: () => void;
  title?: string;
}

const ObstacleChartModal: React.FC<ObstacleChartModalProps> = ({ 
  onClose,
  title = "Terrain Clearance Analysis" 
}) => {
  const chartRef = useRef<any>(null);
  const { 
    chartData, 
    results, 
    status, 
    error, 
    runAnalysis, 
    clearResults 
  } = useObstacleAnalysis();
  const { flightPlan } = useFlightPlanContext();
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Cleanup effect for chart instance
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.options.onHover = () => {};
          chartRef.current.stop();
          chartRef.current.destroy();
        } catch (error) {
          console.error("Error destroying chart:", error);
        }
      }
    };
  }, []);

  // Handle rerunning analysis
  const handleRunAnalysis = () => {
    console.log("Running terrain analysis...");
    runAnalysis();
  };

  // Handle clearing results
  const handleClearResults = () => {
    console.log("Clearing analysis results...");
    clearResults();
  };

  // Early return if required data is missing
  if (!flightPlan) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6">
          <p>No flight plan available for analysis.</p>
          <button 
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Show loading state
  if (status === 'loading') {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-lg">
          <h2 className="text-xl font-semibold mb-4">Analyzing Terrain...</h2>
          <div className="flex items-center gap-3 mb-4">
            <Loader className="w-6 h-6 text-blue-500 animate-spin" />
            <p>Processing terrain elevation data for your flight plan.</p>
          </div>
          <button 
            onClick={onClose}
            className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Show error state
  if (status === 'error') {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-lg">
          <h2 className="text-xl font-semibold mb-4 text-red-600">Analysis Error</h2>
          <p className="mb-4">{error || "An error occurred during terrain analysis."}</p>
          <div className="flex gap-3">
            <button 
              onClick={handleRunAnalysis}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Analysis
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Early return if no analysis data yet
  if (!chartData || !results) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-lg">
          <h2 className="text-xl font-semibold mb-4">Terrain Analysis</h2>
          <p className="mb-4">No analysis has been run yet for this flight plan.</p>
          <div className="flex gap-3">
            <button 
              onClick={handleRunAnalysis}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Mountain className="w-4 h-4" />
              Run Analysis
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Render popup with results
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-4xl max-h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="flex gap-2 items-center">
            <button
              onClick={handleRunAnalysis}
              className="text-blue-500 hover:text-blue-700 focus:outline-none flex items-center gap-1"
              title="Re-run Analysis"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">Use mouse wheel to zoom, drag to pan.</p>

        <div className="mb-4">
          <ObstacleChart
            height={400}
            showControls={true}
            chartRef={chartRef}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="stats-card bg-gray-50 p-3 rounded">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Flight Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Total Distance:</span>
              <span>{(chartData.distances[chartData.distances.length - 1] || 0).toFixed(2)} km</span>
              
              <span className="text-gray-600">Max Flight Altitude:</span>
              <span>{Math.max(...chartData.flightAltitudes).toFixed(1)} m</span>
              
              <span className="text-gray-600">Min Flight Altitude:</span>
              <span>{Math.min(...chartData.flightAltitudes).toFixed(1)} m</span>
            </div>
          </div>
          
          <div className="stats-card bg-gray-50 p-3 rounded">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Terrain Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Minimum Clearance:</span>
              <span className={results.minimumClearance < 0 ? 'text-red-600' : 'text-green-600'}>
                {results.minimumClearance.toFixed(1)} m
              </span>
              
              <span className="text-gray-600">Highest Terrain:</span>
              <span>{results.highestObstacle.toFixed(1)} m</span>
              
              <span className="text-gray-600">Critical Point:</span>
              <span>
                {results.criticalPointDistance !== null 
                  ? `${(results.criticalPointDistance / 1000).toFixed(2)} km along route` 
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Terrain Clearance Verification</h3>
          {results.minimumClearance >= 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle />
              <span>Clearance is safe (no terrain hit).</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle />
              <span>Clearance below ground: {results.minimumClearance.toFixed(2)} m</span>
            </div>
          )}
          {results.minimumClearance < 0 && (
            <div className="text-sm text-red-600 mt-2">
              The flight path intersects the terrain. Please adjust your plan.
            </div>
          )}
        </div>

        <div className="mt-4 pt-2 flex justify-between">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </button>
          <button 
            onClick={handleClearResults}
            className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100"
          >
            Clear Results
          </button>
        </div>

        {showAdvancedOptions && (
          <div className="mt-2 p-3 bg-gray-50 rounded border">
            <h4 className="font-medium mb-2">Advanced Analysis Options</h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm flex-1">
                  Sampling Resolution (m):
                </label>
                <select 
                  className="border rounded p-1 text-sm"
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      runAnalysis({ samplingResolution: value });
                    }
                  }}
                  defaultValue="10"
                >
                  <option value="5">5m (High Detail)</option>
                  <option value="10">10m (Default)</option>
                  <option value="20">20m (Faster)</option>
                  <option value="50">50m (Very Fast)</option>
                </select>
              </div>
              <button
                onClick={() => runAnalysis()}
                className="mt-2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
              >
                Rerun Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ObstacleChartModal;