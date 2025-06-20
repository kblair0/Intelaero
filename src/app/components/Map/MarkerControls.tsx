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
import React, { useRef, useCallback, useEffect } from 'react';
import { useMarkers } from './Hooks/useMarkers';
import { useMapContext } from '../../context/mapcontext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { GridAnalysisRef } from '../Analyses/Services/GridAnalysis/GridAnalysisController';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';
import PremiumButton from '../../components/UI/PremiumButton';
import { Wifi, Radio, Eye, XCircle } from 'lucide-react';
import { useChecklistContext } from '../../context/ChecklistContext';
import { useMarkersContext } from '../../context/MarkerContext';
import { DEMO_CONFIG } from '../../context/DemoOrchestrationContext';

const MarkerControls: React.FC<{ 
  onCreateDemoObserver?: () => Promise<void>;
  gridAnalysisRef: React.RefObject<GridAnalysisRef>;
}> = ({ 
  onCreateDemoObserver,
  gridAnalysisRef
}) => {
  const { map, terrainLoaded } = useMapContext();
  const { markerConfigs } = useLOSAnalysis();
  const { highlightMarkers, setHighlightMarkers } = useChecklistContext();
  const { addMarker } = useMarkersContext();

    // Clear highlight when any marker button is clicked
  const clearHighlight = () => setHighlightMarkers(false);
  
  const {
    markers, // Get all markers from hook
    addGroundStation,
    addObserver,
    addRepeater,
    removeAllAnalysisLayers,
    markerRefs,
    error // This will be displayed to the user
  } = useMarkers({ 
    map, 
    terrainLoaded: terrainLoaded 
  });

  // Enhanced handlers to optionally trigger analysis
  const handleAddGroundStation = async () => {
    clearHighlight();
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
  // Apply conditional class to all buttons:
  const buttonClass = `map-button ${highlightMarkers ? 'pulse-highlight' : ''}`;

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

  // Get marker counts for permission parameters
  const gcsCount = markers.filter(m => m.type === 'gcs').length;
  const observerCount = markers.filter(m => m.type === 'observer').length;
  const repeaterCount = markers.filter(m => m.type === 'repeater').length;

//demo observer creation handler
const createDemoObserver = useCallback(async (): Promise<void> => {
  clearHighlight();
  
  const demoCoords = DEMO_CONFIG.OBSERVER_COORDINATES;
  
  if (map) {
    console.log('[MarkerControls] Panning map to demo coordinates:', demoCoords);
    map.flyTo({
      center: [demoCoords.lng, demoCoords.lat],
      zoom: 15,  // Or whatever zoom level you prefer
      duration: 1000
    });
    
    await new Promise(resolve => {
      const onMoveEnd = () => {
        map.off('moveend', onMoveEnd);
        resolve(void 0);
      };
      map.on('moveend', onMoveEnd);
    });
  }
  
  // Create the observer (this opens the popup)
  await handleAddObserver();
  
  // 🔥 ADD: Auto-close popup after 1 second for demo only
  setTimeout(() => {
    try {
      // Find the most recently created observer marker
      const observerMarkers = markers.filter(m => m.type === 'observer');
      if (observerMarkers.length > 0) {
        // Get the marker ref for the most recent observer
        const latestObserver = observerMarkers[observerMarkers.length - 1];
        const markerRef = markerRefs.current.find(ref => ref.id === latestObserver.id);
        
        if (markerRef && markerRef.marker.getPopup()?.isOpen()) {
          markerRef.marker.togglePopup();
          console.log('[MarkerControls] Demo observer popup auto-closed');
        }
      }
    } catch (error) {
      console.debug('Demo popup auto-close: marker no longer exists');
    }
  }, 1000);
  
  console.log('[MarkerControls] Demo observer created with analysis');
}, [handleAddObserver, clearHighlight, map, markers, markerRefs]);

  // ADD this useEffect to expose the function to parent:
  useEffect(() => {
    if (onCreateDemoObserver) {
      // This is a bit of a hack, but we need to expose the function to the parent
      (window as any).createDemoObserver = createDemoObserver;
    }
  }, [createDemoObserver, onCreateDemoObserver]);  

  return (
    <>
      {/* Error notification display */}
      {error && (
        <div className="absolute top-20 right-4 z-30 bg-red-50 border border-red-200 text-red-700 
                      px-4 py-2 rounded-md shadow-md max-w-xs animate-fadeIn">
          <div className="flex items-start">
            <XCircle size={16} className="mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
        {/* Ground Station Button */}
        <PremiumButton 
          featureId="add_gcs"
          onClick={handleAddGroundStation} 
          className={`map-button ground-station-icon flex items-center justify-center ${highlightMarkers ? 'pulse-highlight' : ''}`}
          permissionParams={{ currentCount: gcsCount }}
          showIndicator={true}
        >
          <Wifi size={16} className="mr-2" />
          Add Ground Station
        </PremiumButton>
        
        {/* Repeater Button */}
        <PremiumButton 
          featureId="add_repeater"
          onClick={handleAddRepeater}
          className={`map-button repeater-icon flex items-center justify-center ${highlightMarkers ? 'pulse-highlight' : ''}`}
          permissionParams={{ currentCount: repeaterCount }}
          showIndicator={true}
        >
          <Radio size={16} className="mr-2" />
          Add Repeater
        </PremiumButton>
     
        {/* Observer Button */}
        <PremiumButton 
          featureId="add_observer"
          onClick={handleAddObserver}
          className={`map-button observer-icon flex items-center justify-center ${highlightMarkers ? 'pulse-highlight' : ''}`}
          permissionParams={{ currentCount: observerCount }}
          showIndicator={true}
        >
          <Eye size={16} className="mr-2" />
          Add Observer
        </PremiumButton>
        
        {/* Clear Analysis Button - not premium restricted */}
        <button 
          onClick={handleResetAnalyses}
          className="map-button flex items-center justify-center"
        >
          <XCircle size={16} className="mr-2" />
          Clear All Analyses
        </button>
      </div>
    </>
  );
};

export default MarkerControls;