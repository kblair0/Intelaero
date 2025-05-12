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
// components/Map/Controls/MarkerControls.tsx
import React, { useRef } from 'react';
import { useMarkers } from './Hooks/useMarkers';
import { useMapContext } from '../../context/mapcontext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { GridAnalysisRef } from '../Analyses/Services/GridAnalysis/GridAnalysisController';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';

const MarkerControls: React.FC = () => {
  const { map, terrainLoaded } = useMapContext();
  const { markerConfigs } = useLOSAnalysis();
  
  // Reference to the grid analysis controller
  const gridAnalysisRef = useRef<GridAnalysisRef | null>(null);
  
  const {
    markers, // Get all markers from hook
    addGroundStation,
    addObserver,
    addRepeater,
    removeAllAnalysisLayers
  } = useMarkers({ 
    map, 
    terrainLoaded: terrainLoaded 
  });

  // Enhanced handlers to optionally trigger analysis
  const handleAddGroundStation = async () => {
    // Add marker and get location
    const location = await addGroundStation();
    
    // If auto-analysis is enabled and location was created successfully
    if (location && gridAnalysisRef.current) {
      try {
        // Find the marker we just created to get its ID
        const newMarker = markers.find(m => 
          m.type === 'gcs' && 
          m.location.lng === location.lng && 
          m.location.lat === location.lat
        );
        
        if (newMarker) {
          await gridAnalysisRef.current.runStationAnalysis({
            stationType: 'gcs',
            location,
            range: markerConfigs.gcs.gridRange,
            elevationOffset: newMarker.elevationOffset,
            markerId: newMarker.id
          });
        }
      } catch (error) {
        console.error("Failed to run GCS analysis:", error);
      }
    }
  };

  const handleAddObserver = async () => {
    const location = await addObserver();
    
    if (location && gridAnalysisRef.current) {
      try {
        // Find the marker we just created
        const newMarker = markers.find(m => 
          m.type === 'observer' && 
          m.location.lng === location.lng && 
          m.location.lat === location.lat
        );
        
        if (newMarker) {
          await gridAnalysisRef.current.runStationAnalysis({
            stationType: 'observer',
            location,
            range: markerConfigs.observer.gridRange,
            elevationOffset: newMarker.elevationOffset,
            markerId: newMarker.id
          });
        }
      } catch (error) {
        console.error("Failed to run Observer analysis:", error);
      }
    }
  };

  const handleAddRepeater = async () => {
    const location = await addRepeater();
    
    if (location && gridAnalysisRef.current) {
      try {
        // Find the marker we just created
        const newMarker = markers.find(m => 
          m.type === 'repeater' && 
          m.location.lng === location.lng && 
          m.location.lat === location.lat
        );
        
        if (newMarker) {
          await gridAnalysisRef.current.runStationAnalysis({
            stationType: 'repeater',
            location,
            range: markerConfigs.repeater.gridRange,
            elevationOffset: newMarker.elevationOffset,
            markerId: newMarker.id
          });
        }
      } catch (error) {
        console.error("Failed to run Repeater analysis:", error);
      }
    }
  };

  const handleResetAnalyses = () => {
    trackEvent("reset_los_analyses_click", { panel: "map.tsx" });
    removeAllAnalysisLayers();
    
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
        Clear All Visibility Analyses 🚫
      </button>
    </div>
  );
};

export default MarkerControls;