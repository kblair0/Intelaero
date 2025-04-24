"use client";
import React, { useEffect, useRef, FC } from 'react';
import { useMap } from './Hooks/useMap';
import { useMapContext } from '../../context/mapcontext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { useAreaOfOpsContext } from '../../context/AreaOfOpsContext';
import { useFlightPlanProcessor } from '../Map/Hooks/useFlightPlanProcessor';
import { useMarkers } from './Hooks/useMarkers';
import { useLayers } from '../../hooks/useLayers';
import mapboxgl from 'mapbox-gl';

import MarkerControls from './MarkerControls';
import LayerControls from './LayerControls';
import MeasurementControls from './MeasurementControls';
import MapLegend from './MapLegend';
import AnalysisStatus from './AnalysisStatus';
import LOSModal from './LOSModal';
import FlightPathDisplay from './FlightPathDisplay';
import AODisplay from '../AO/AODisplay';

import MapboxLayerHandler from './MapboxLayerHandler';
import BYDALayerHandler from './BYDALayerHandler';
import GridAnalysisController, { GridAnalysisRef } from '../Analyses/Services/GridAnalysis/GridAnalysisController';
import { useAnalysisController } from "../../context/AnalysisControllerContext";
import { trackEventWithForm as trackEvent } from '../tracking/tracking';

/**
 * Props for the Map component
 */
interface MapProps {
  activePanel?: 'energy' | 'los' | null;
  togglePanel?: (panel: 'energy' | 'los') => void;
  flightPlan?: any;
  setShowUploader?: (show: boolean) => void;
}

/**
 * Map component that renders the Mapbox map and associated controls
 */
const Map: FC<MapProps> = ({ activePanel, togglePanel, flightPlan, setShowUploader }) => {
  const { setMap, elevationService } = useMapContext();
  const { setFlightPlan, setDistance, setProcessed } = useFlightPlanContext();
  const { isAnalyzing, setIsAnalyzing, setResults, setError, error, resetAnalysis } = useLOSAnalysis();
  const { aoGeometry } = useAreaOfOpsContext();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const bydaLayerHandlerRef = useRef<{ fetchLayers: () => void } | null>(null);
  const { gridAnalysisRef } = useAnalysisController();
  const hasSetMapRef = useRef(false);

  const { map, terrainLoaded } = useMap(
    'map-container',
    {
      style: 'mapbox://styles/intelaero/cm7pqu42s000601svdp7m3h0b',
      center: [0, 0],
      zoom: 2.5,
      projection: 'globe',
    } as any
  );

  const { processFlightPlan } = useFlightPlanProcessor();
  const { updateMarkerPopups } = useMarkers({ map, terrainLoaded });
  const { addFlightPath, resetLayers } = useLayers();

  /**
   * Set map instance when map and terrain are loaded
   */
  useEffect(() => {
    if (map && terrainLoaded && !hasSetMapRef.current) {
      setMap(map, terrainLoaded);
      hasSetMapRef.current = true;
      trackEvent('map_initialized', { mapLoaded: true });
    }
  }, [map, terrainLoaded, setMap]);

/**
 * Process flight plan when available
 */
useEffect(() => {
  if (!flightPlan || flightPlan.properties?.processed || !map || !elevationService) {
    console.log('Skipping flight plan processing:', {
      hasFlightPlan: !!flightPlan,
      isProcessed: flightPlan?.properties?.processed,
      mapLoaded: !!map,
      elevationServiceAvailable: !!elevationService,
    });
    return;
  }

  console.log(
    `Starting flight plan processing: elevationService=${!!elevationService}, ` +
    `mapbox-dem loaded=${map?.isSourceLoaded('mapbox-dem') ?? false}`
  );

  const handleProcessedPlan = (processedPlan: any) => {
    console.log('Flight plan processed:', {
      planId: processedPlan.properties?.id || 'unknown',
      distance: processedPlan.properties?.totalDistance,
      hasFeatures: processedPlan.features?.length > 0,
    });

    if (processedPlan.properties?.totalDistance) {
      setDistance(processedPlan.properties.totalDistance);
    }
    addFlightPath(processedPlan);
    trackEvent('flight_plan_processing_completed', {
      planId: processedPlan.properties?.id || 'unknown',
      distance: processedPlan.properties?.totalDistance,
    });
  };

  const handleProcessingError = (error: unknown) => {
    console.error('Failed to process flight plan:', error);
    setError('Failed to process flight plan. Please try again.');
    trackEvent('flight_plan_processing_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  };

  trackEvent('flight_plan_processing_started', {
    planId: flightPlan.properties?.id || 'unknown',
  });

  console.time('FlightPlanProcessing');
  elevationService
    .ensureTerrainReady()
    .then(() => {
      console.log('Terrain ready');
      return elevationService.preloadArea(flightPlan.features[0].geometry.coordinates);
    })
    .then(() => {
      console.log('Terrain area preloaded');
      return processFlightPlan(flightPlan);
    })
    .then((processedPlan) => {
      console.log('processFlightPlan completed:', processedPlan);
      return processedPlan;
    })
    .then(handleProcessedPlan)
    .catch((error) => {
      console.error('Processing pipeline error:', error);
      handleProcessingError(error);
    })
    .finally(() => {
      console.timeEnd('FlightPlanProcessing');
    });
}, [flightPlan, map, elevationService, processFlightPlan, setFlightPlan, setDistance, setProcessed, setError, addFlightPath]);

  /**
   * Update marker popups when map or terrain changes
   */
  useEffect(() => {
    if (map && terrainLoaded) {
      updateMarkerPopups();
    }
  }, [updateMarkerPopups, map, terrainLoaded]);

  /**
   * Run ELOS analysis
   */
  const runElosAnalysis = async () => {
    if (!map || !gridAnalysisRef.current) return;

    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent('elos_analysis_started', {});

      resetLayers();
      // Import useAreaOpsProcessor here as a local import if used only in this function
      const { showAreaOfOperations } = require('../AO/Hooks/useAreaOpsProcessor').useAreaOpsProcessor();
      
      // Show Area of Operations for the analysis
      showAreaOfOperations();

      await gridAnalysisRef.current.runFlightPathAnalysis();

      trackEvent('elos_analysis_completed', {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      trackEvent('elos_analysis_error', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative">
      <div
        id="map-container"
        ref={mapContainerRef}
        className="w-full h-screen"
      />
      {map && (
        <>
          <MapboxLayerHandler map={map} />
          {aoGeometry && <BYDALayerHandler ref={bydaLayerHandlerRef} map={map} />}
        </>
      )}
      <MarkerControls />
      <LayerControls
        onToggleDBYD={() => {
          if (bydaLayerHandlerRef.current) {
            trackEvent('dbyd_powerlines_requested', {});
            bydaLayerHandlerRef.current.fetchLayers();
          }
        }}
        activePanel={activePanel}
        togglePanel={togglePanel}
        flightPlan={flightPlan}
        setShowUploader={setShowUploader}
      />
      <MeasurementControls />
      <MapLegend />
      <AnalysisStatus 
        onStopLOS={() => {
          // LOS analysis cancel logic
        }}
        onStopObstacle={() => {
          // Any additional logic beyond calling cancelAnalysis
        }} 
      />
      {/* <LOSModal /> Disbaled For Now Unitl I fix it.*/}

      <FlightPathDisplay />
      <AODisplay />
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

      {map && (
        <GridAnalysisController
          ref={gridAnalysisRef}
          flightPlan={flightPlan?.properties?.processed ? flightPlan : undefined}
          onProgress={(progress) => {
          }}
          onError={(error) => {
            console.error("ELOS Analysis error:", error);
            setError(error.message);
          }}
          onComplete={(result) => {
            console.log("ELOS Analysis completed:", result);
            setResults(result);
          }}
        />
      )}
    </div>
  );
};

Map.displayName = 'Map';

export default Map;