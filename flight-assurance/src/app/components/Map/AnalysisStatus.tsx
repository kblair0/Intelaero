// components/map/flAnalysisStatus.tsx
import React from 'react';
import { Loader } from 'lucide-react';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { ProgressBar } from './UI/ProgressBar';

interface AnalysisStatusProps {
  onStop: () => void;
}

const AnalysisStatus: React.FC<AnalysisStatusProps> = ({ onStop }) => {
  const { isAnalyzing, error, setError, progress } = useLOSAnalysis();

  if (!isAnalyzing && !error) return null;

  return (
    <>
      {isAnalyzing && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-gray-200 px-4 py-2 rounded-lg border-l-4 border-yellow-500 shadow-lg flex flex-col gap-3 z-50 animate-slide-down min-w-[150px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Loader className="w-5 h-5 animate-spin text-yellow-400" />
              <div className="flex flex-col text-sm">
                <span className="font-medium text-gray-900">Analysing</span>
                <span className="text-gray-500">
                  This may take a few moments... {Math.round(progress)}%
                </span>
                <span className="text-gray-500 text-xxs">Especially for terrain following missions.</span>
              </div>
            </div>
            <button
              onClick={onStop}
              className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded text-xs"
            >
              Stop
            </button>
          </div>
          <div className="relative mt-2 w-full">
            <ProgressBar progress={Math.round(progress)} />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <span>⚠️</span>
          <span className="ml-2">{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-75">
            ✕
          </button>
        </div>
      )}
    </>
  );
};

export default AnalysisStatus;
