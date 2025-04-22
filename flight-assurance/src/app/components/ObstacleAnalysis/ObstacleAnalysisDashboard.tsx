/**
 * ObstacleAnalysisDashboard.tsx
 * 
 * Purpose:
 * This component serves as the main UI for obstacle analysis, providing a comprehensive
 * dashboard that displays the results of the analysis and controls for running it.
 * 
 * The dashboard includes:
 * - Status indicators for the analysis process
 * - The TerrainProfileChart for visualizing results
 * - Summary statistics (minimum clearance, highest obstacle, etc.)
 * - Controls for running and configuring the analysis
 * 
 * This is a simplified version focused on terrain analysis, but designed to be
 * extended for additional obstacle types in the future.
 * 
 * Related Files:
 * - ObstacleAnalysisContext.tsx: Provides state and methods for analysis
 * - TerrainProfileChart.tsx: Visualization component used within the dashboard
 * - useFlightPathSampling.ts: Generates the data for analysis
 */

import React, { useEffect } from 'react';
import { useObstacleAnalysis } from '../../context/ObstacleAnalysisContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { AlertTriangle, CheckCircle, Loader, RefreshCw } from 'lucide-react';

interface ObstacleAnalysisDashboardProps {
  onClose?: () => void;
  autoRun?: boolean;
}

const ObstacleAnalysisDashboard: React.FC<ObstacleAnalysisDashboardProps> = ({ 
  onClose,
  autoRun = true
}) => {
  const { 
    results, status, progress, error, 
    runAnalysis, cancelAnalysis, clearResults 
  } = useObstacleAnalysis();
  
  const { flightPlan } = useFlightPlanContext();
  
  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex items-center bg-blue-50 p-3 rounded mb-4">
            <Loader className="w-5 h-5 text-blue-500 animate-spin mr-2" />
            <div className="flex-1">
              <p className="text-blue-700">Analyzing terrain obstacles...</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
            <button 
              onClick={cancelAnalysis}
              className="ml-auto text-blue-700 hover:text-blue-900"
            >
              Cancel
            </button>
          </div>
        );
        
      case 'error':
        return (
          <div className="flex items-center bg-red-50 p-3 rounded mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700 flex-1">{error || 'An error occurred during analysis'}</p>
            <button 
              onClick={() => runAnalysis()}
              className="ml-auto flex items-center text-red-700 hover:text-red-900"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </button>
          </div>
        );
        
      case 'success':
        if (!results) return null;
        
        const isSafe = results.minimumClearance >= 0;
        return (
          <div className={`flex items-center ${isSafe ? 'bg-green-50' : 'bg-red-50'} p-3 rounded mb-4`}>
            {isSafe ? (
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
            )}
            <div className="flex-1">
              <p className={isSafe ? 'text-green-700' : 'text-red-700'}>
                {isSafe 
                  ? `Safe flight path with minimum clearance of ${results.minimumClearance.toFixed(1)}m` 
                  : `Flight path has collision with minimum clearance of ${results.minimumClearance.toFixed(1)}m`}
              </p>
              {results.criticalPointDistance !== null && (
                <p className="text-sm mt-1">
                  Critical point at {(results.criticalPointDistance / 1000).toFixed(2)}km along the route
                </p>
              )}
            </div>
            <button 
              onClick={() => runAnalysis()}
              className="ml-auto flex items-center text-gray-700 hover:text-gray-900"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </button>
          </div>
        );
        
      default:
        if (!flightPlan) {
          return (
            <div className="bg-yellow-50 p-3 rounded mb-4">
              <p className="text-yellow-700">Please upload a flight plan to analyze terrain obstacles.</p>
            </div>
          );
        }
        return null;
    }
  };
  
  return (
    <div className="obstacle-analysis-dashboard p-4 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Terrain Obstacle Analysis</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        )}
      </div>
      
      {renderStatus()}
      
      <div className="mb-4">
        <TerrainProfileChart height={350} />
      </div>
      
      {results && results.samplePoints && results.samplePoints.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="stats-card bg-gray-50 p-3 rounded">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Flight Stats</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-600">Total Distance:</span>
              <span>{(results.samplePoints[results.samplePoints.length - 1].distanceFromStart / 1000).toFixed(2)} km</span>
              
              <span className="text-gray-600">Max Flight Altitude:</span>
              <span>{Math.max(...results.samplePoints.map(p => p.flightElevation)).toFixed(1)} m</span>
              
              <span className="text-gray-600">Min Flight Altitude:</span>
              <span>{Math.min(...results.samplePoints.map(p => p.flightElevation)).toFixed(1)} m</span>
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
              
              <span className="text-gray-600">Closest Approach:</span>
              <span>
                {results.criticalPointDistance !== null 
                  ? `${(results.criticalPointDistance / 1000).toFixed(2)} km along route` 
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-end mt-4">
        <button 
          onClick={() => runAnalysis()}
          className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 mr-2"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Analyzing...' : 'Run Analysis'}
        </button>
        
        {results && (
          <button 
            onClick={clearResults}
            className="border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-100"
          >
            Clear Results
          </button>
        )}
      </div>
    </div>
  );
};

export default ObstacleAnalysisDashboard;