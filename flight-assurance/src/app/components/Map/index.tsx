/**
 * Map/index.tsx
 * 
 * The main Map component that serves as a container for all map-related functionality.
 * This component coordinates between different sub-components and hooks to provide
 * a complete mapping experience, including:
 * - Map initialization and rendering
 * - Flight plan processing and display
 * - Marker management (Ground Control Stations, Observers, Repeaters)
 * - Layer controls (powerlines, airspace, etc.)
 * - Line-of-sight analysis
 * - Measurement tools
 * 
 * Rather than implementing these features directly, this component composes smaller,
 * focused components and leverages custom hooks for business logic.
 * 
 * Related files:
 * - context/mapcontext.tsx - Provides map instance and state across components
 * - hooks/useMap.ts - Manages map initialization
 * - hooks/useMarkers.ts - Handles marker creation and management
 * - hooks/useLayers.ts - Controls layer visibility and management
 * - hooks/useFlightPlanProcessor.ts - Processes uploaded flight plans
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useMap } from '../../hooks/useMap';
import { useMapContext } from '../../context/MapContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext'; 
import { useAreaOfOpsContext } from '../../context/AreaOfOpsContext';
import { useFlightPlanProcessor } from '../../hooks/useFlightPlanProcessor';
import { useMarkers } from '../../hooks/useMarkers';
import { useLayers } from '../../hooks/useLayers';

// Child components
import MarkerControls from './MarkerControls';
import LayerControls from './LayerControls';
import MeasurementControls from './MeasurementControls';
import MapLegend from './MapLegend';
import AnalysisStatus from './AnalysisStatus';
import LOSModal from './LOSModal';
import FlightPathDisplay from './FlightPathDisplay';
import AODisplay from '../AO/AODisplay';

// Types
import type { MapRef } from "../../types/MapTypes";


// Other required components
import MapboxLayerHandler from './MapboxLayerHandler';
import BYDALayerHandler from './BYDALayerHandler';
import ELOSGridAnalysis from '../ELOSGridAnalysis';

// Service for tracking events
import { trackEventWithForm as trackEvent } from '../tracking/tracking';

const Map = () => {
  // Contexts
  const { setMap } = useMapContext();
  const { flightPlan, setFlightPlan, setDistance } = useFlightPlanContext();
  const { isAnalyzing, setIsAnalyzing, setResults, setError, error } = useLOSAnalysis();
  const { aoGeometry } = useAreaOfOpsContext();
  
  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const bydaLayerHandlerRef = useRef<{ fetchLayers: () => void } | null>(null);
  const elosGridRef = useRef<any>(null);
  
  // Custom hooks
  const { map, terrainLoaded } = useMap('map-container', {
    style: 'mapbox://styles/intelaero/cm7pqu42s000601svdp7m3h0b',
    center: [0, 0],
    zoom: 2.5,
    projection: 'globe',
  });
  
  const { processFlightPlan } = useFlightPlanProcessor();
  const { updateMarkerPopups } = useMarkers({ map, terrainLoaded });
  const { addFlightPath, resetLayers } = useLayers();

  // Set map reference in context when available
  useEffect(() => {
    if (map) {
      setMap(map);
      trackEvent("map_initialized", { mapLoaded: true });
    }
  }, [map, setMap]);

  // Process flight plan when available
  useEffect(() => {
    if (!flightPlan || flightPlan.properties?.processed || !map || !terrainLoaded) return;
    
    const handleProcessedPlan = (processedPlan) => {
      setFlightPlan(processedPlan);
      if (processedPlan.properties.totalDistance) {
        setDistance(processedPlan.properties.totalDistance);
      }
      
      // Add flight path to map
      addFlightPath(processedPlan);
      
      trackEvent("flight_plan_processing_completed", { 
        planId: processedPlan.properties?.id || "unknown",
        distance: processedPlan.properties.totalDistance
      });
    };
    
    const handleProcessingError = (error) => {
      console.error("Failed to process flight plan:", error);
      setError("Failed to process flight plan. Please try again.");
      trackEvent("flight_plan_processing_error", { 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    };
    
    trackEvent("flight_plan_processing_started", { 
      planId: flightPlan.properties?.id || "unknown" 
    });
    
    // Use the hook to process the flight plan
    processFlightPlan(map, flightPlan)
      .then(handleProcessedPlan)
      .catch(handleProcessingError);
      
  }, [flightPlan, map, terrainLoaded, processFlightPlan, setFlightPlan, setDistance, setError, addFlightPath]);

  // Update marker popups when needed
  useEffect(() => {
    if (map && terrainLoaded) {
      updateMarkerPopups();
    }
  }, [updateMarkerPopups, map, terrainLoaded]);

  // Function to run ELOS analysis
  const runElosAnalysis = async () => {
    if (!map || !elosGridRef.current) return;
    
    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent("elos_analysis_started", {});
      
      // Reset any previous analysis layers
      resetLayers();
      
      await elosGridRef.current.runAnalysis();
      
      trackEvent("elos_analysis_completed", {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      trackEvent("elos_analysis_error", { 
        error: err instanceof Error ? err.message : "Unknown error" 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative">
      {/* Map container */}
      <div
        id="map-container"
        ref={mapContainerRef}
        className="w-full h-screen"
      />
      
      {/* Layer handlers and analysis components */}
      {map && (
        <>
          <MapboxLayerHandler map={map} />
          {aoGeometry && <BYDALayerHandler ref={bydaLayerHandlerRef} map={map} />}
          <ELOSGridAnalysis
            ref={elosGridRef}
            map={map}
            flightPath={flightPlan?.properties?.processed ? flightPlan : undefined}
            onError={(error) => {
              console.error("ELOS Analysis error:", error);
              setError(error.message);
            }}
            onSuccess={(result) => {
              console.log("ELOS Analysis completed:", result);
              setResults(result);
            }}
          />
        </>
      )}
      
      {/* UI Components */}
      <MarkerControls />
      <LayerControls 
        onToggleDBYD={() => {
          if (bydaLayerHandlerRef.current) {
            trackEvent("dbyd_powerlines_requested", {});
            bydaLayerHandlerRef.current.fetchLayers();
          }
        }} 
      />
      <MeasurementControls />
      <MapLegend />
      <AnalysisStatus />
      <LOSModal onRunAnalysis={runElosAnalysis} />
      <FlightPathDisplay />
      <AODisplay />
      
      {/* Error display */}
      {error && (
        <div className="absolute bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <span>⚠️</span>
          <span className="ml-2">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default Map;
export type { MapRef };