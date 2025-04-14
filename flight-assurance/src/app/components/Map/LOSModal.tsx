// components/Map/LOSModal.tsx
import React, { useState, useEffect } from 'react';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { AlertTriangle } from 'lucide-react';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';

/**
 * Modal to prompt the user to run Line of Sight analysis when a flight plan is loaded
 * Appears when a new flight plan is loaded and processed
 */
const LOSModal: React.FC = () => {
  const { flightPlan } = useFlightPlanContext();
  const { isAnalyzing, runAnalysis, setError } = useLOSAnalysis();
  const [showModal, setShowModal] = useState(false);

  // Show modal when flight plan is loaded and processed
  useEffect(() => {
    if (flightPlan && flightPlan.properties?.processed && !isAnalyzing) {
      setShowModal(true);
    }
  }, [flightPlan, isAnalyzing]);

  // Auto-hide modal when analysis starts
  useEffect(() => {
    if (isAnalyzing) {
      setShowModal(false);
    }
  }, [isAnalyzing]);

  const handleRunAnalysis = async () => {
    try {
      setError(null);
      await runAnalysis();
      trackEvent("full_elos_analysis_from_modal_click", { panel: "map" });
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
  };

  const handleDismiss = () => {
    trackEvent("dismiss_los_modal_click", { panel: "map" });
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-xl z-50 max-w-md w-full animate-slide-down border-l-4 border-yellow-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-yellow-500 h-8 w-8" />
          <p className="text-sm text-gray-900 mr-2 leading-tight">
            <span className="font-semibold text-gray-900">Start Here:</span> Check your flight path visibility to begin your mission.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunAnalysis}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium shadow-sm"
          >
            Run
          </button>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-700 text-lg font-semibold"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default LOSModal;