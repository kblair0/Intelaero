// components/Map/Controls/MarkerControls.tsx
/**
 * MarkerControls.tsx
 * 
 * This component provides UI controls for adding and managing map markers (GCS, Observer, Repeater).
 * It integrates with the useMarkers hook for marker management and the GridAnalysisController
 * for running station-specific LOS analyses when markers are placed.
 * 
 * Related to:
 * - useMarkers hook (marker management)
 * - GridAnalysisController (station analysis)
 * - MarkerContext (marker state)
 * - LOSAnalysisContext (analysis configuration)
 */

import React, { useRef, useContext } from 'react';
import { useMarkers } from '../../hooks/useMarkers';
import { useMapContext } from '../../context/mapcontext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { GridAnalysisRef } from '../Analysis/GridAnalysisController';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';

const MarkerControls: React.FC = () => {
  const { map, terrainLoaded } = useMapContext();
  const { markerConfigs } = useLOSAnalysis();
  
  // Reference to the grid analysis controller
  const gridAnalysisRef = useRef<GridAnalysisRef | null>(null);
  
  const {
    addGroundStation,
    addObserver,
    addRepeater,
    removeAllMarkers
  } = useMarkers({ 
    map, 
    terrainLoaded: terrainLoaded 
  });

  // Enhanced handlers to optionally trigger analysis
  const handleAddGroundStation = async () => {
    trackEvent("add_ground_station_click", { panel: "map.tsx" });
    const location = await addGroundStation();
    
    // If auto-analysis is enabled and location was created successfully
    if (location && gridAnalysisRef.current) {
      try {
        await gridAnalysisRef.current.runStationAnalysis({
          stationType: 'gcs',
          location,
          range: markerConfigs.gcs.gridRange,
        });
      } catch (error) {
        console.error("Failed to run GCS analysis:", error);
      }
    }
  };

  const handleAddObserver = async () => {
    trackEvent("add_observer_click", { panel: "map.tsx" });
    const location = await addObserver();
    
    // If auto-analysis is enabled and location was created successfully
    if (location && gridAnalysisRef.current) {
      try {
        await gridAnalysisRef.current.runStationAnalysis({
          stationType: 'observer',
          location,
          range: markerConfigs.observer.gridRange,
        });
      } catch (error) {
        console.error("Failed to run Observer analysis:", error);
      }
    }
  };

  const handleAddRepeater = async () => {
    trackEvent("add_repeater_click", { panel: "map.tsx" });
    const location = await addRepeater();
    
    // If auto-analysis is enabled and location was created successfully
    if (location && gridAnalysisRef.current) {
      try {
        await gridAnalysisRef.current.runStationAnalysis({
          stationType: 'repeater',
          location,
          range: markerConfigs.repeater.gridRange,
        });
      } catch (error) {
        console.error("Failed to run Repeater analysis:", error);
      }
    }
  };

  const handleResetAnalyses = () => {
    trackEvent("reset_los_analyses_click", { panel: "map.tsx" });
    removeAllMarkers();
    
    // If analysis is in progress, abort it
    if (gridAnalysisRef.current) {
      gridAnalysisRef.current.abortAnalysis();
    }
  };

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
      <button 
        onClick={handleAddGroundStation} 
        className="map-button ground-station-icon"
      >
        Add Ground Station 📡
      </button>
      <button 
        onClick={handleAddObserver}
        className="map-button observer-icon"
      >
        Add Observer 🔭
      </button>
      <button 
        onClick={handleAddRepeater}
        className="map-button repeater-icon"
      >
        Add Repeater ⚡️
      </button>
      <button 
        onClick={handleResetAnalyses}
        className="map-button"
      >
        Reset LOS Analyses 🚫
      </button>
    </div>
  );
};

export default MarkerControls;