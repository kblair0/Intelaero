// components/Map/AnalysisStatus.tsx
import React from 'react';
import { Loader } from 'lucide-react';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { useObstacleAnalysis } from '../../context/ObstacleAnalysisContext';

interface AnalysisStatusProps {
  onStopLOS?: () => void;
  onStopObstacle?: () => void;
}

const AnalysisStatus: React.FC<AnalysisStatusProps> = ({ 
  onStopLOS, 
  onStopObstacle 
}) => {
  // Get status from both analysis contexts
  const { isAnalyzing: isLOSAnalyzing, error: losError, setError: setLOSError, progress: losProgress } = useLOSAnalysis();
  const { 
    status: obstacleStatus, 
    progress: obstacleProgress, 
    error: obstacleError, 
    cancelAnalysis 
  } = useObstacleAnalysis();

  const isObstacleAnalyzing = obstacleStatus === 'loading';
  
  // Debug log to verify obstacle analysis progress updates
  React.useEffect(() => {
    if (isObstacleAnalyzing && obstacleProgress > 0) {
      console.log("AnalysisStatus received obstacle progress:", obstacleProgress);
    }
  }, [isObstacleAnalyzing, obstacleProgress]);
  
  // If nothing is active, don't show anything
  if (!isLOSAnalyzing && !isObstacleAnalyzing && !losError && !obstacleError) return null;

  // Determine which analysis is active
  let activeAnalysis: {
    type: string;
    progress: number;
    message: string;
    note: string;
    onStop: () => void;
  } | null = null;
  
  if (isObstacleAnalyzing) {
    activeAnalysis = {
      type: 'Terrain Analysis',
      progress: obstacleProgress,
      message: 'Analyzing flight path...',
      note: 'This may take a moment for complex routes.',
      onStop: () => {
        if (onStopObstacle) onStopObstacle();
        cancelAnalysis();
      }
    };
  } else if (isLOSAnalyzing) {
    activeAnalysis = {
      type: 'Line of Sight',
      progress: losProgress,
      message: 'This may take a few moments...',
      note: 'Especially for terrain following missions.',
      onStop: onStopLOS || (() => {})
    };
  }

  return (
    <div className="analysis-status-container">
      {activeAnalysis && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white shadow-xl rounded-lg border border-gray-300 p-4 z-[1000] w-80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader className="w-5 h-5 animate-spin text-blue-500" />
              <div>
                <h3 className="font-medium text-gray-900 text-sm">{activeAnalysis.type}</h3>
                <p className="text-xs text-gray-600">{activeAnalysis.message}</p>
              </div>
            </div>
            <button 
              onClick={activeAnalysis.onStop}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Cancel
            </button>
          </div>
          
          <div className="mb-1">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-gray-600">Progress</span>
              <span className="text-xs font-medium">{Math.round(activeAnalysis.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${Math.round(activeAnalysis.progress)}%` }}
              ></div>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">{activeAnalysis.note}</p>
        </div>
      )}

      {losError && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-[1000]">
          <span>⚠️</span>
          <span className="ml-2">{losError}</span>
          <button onClick={() => setLOSError(null)} className="ml-2 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {obstacleError && !losError && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center z-[1000]">
          <span>⚠️</span>
          <span className="ml-2">{obstacleError}</span>
          <button onClick={() => cancelAnalysis()} className="ml-2 hover:opacity-75">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default AnalysisStatus;