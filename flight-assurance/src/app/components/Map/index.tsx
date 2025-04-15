import React, { useEffect, useRef, forwardRef } from 'react';
import { useMap } from '../../hooks/useMap';
import { useMapContext } from '../../context/MapContext';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useLOSAnalysis } from '../../context/LOSAnalysisContext';
import { useAreaOfOpsContext } from '../../context/AreaOfOpsContext';
import { useFlightPlanProcessor } from '../../hooks/useFlightPlanProcessor';
import { useMarkers } from '../../hooks/useMarkers';
import { useLayers } from '../../hooks/useLayers';

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
import ELOSGridAnalysis from '../ELOSGridAnalysis';

import { trackEventWithForm as trackEvent } from '../tracking/tracking';

interface MapProps {
  activePanel?: 'energy' | 'los' | null;
  togglePanel?: (panel: 'energy' | 'los') => void;
  flightPlan?: any;
  setShowUploader?: (show: boolean) => void;
}

const Map = forwardRef<MapRef, MapProps>(({ activePanel, togglePanel, flightPlan, setShowUploader }, ref) => {
  const { setMap } = useMapContext();
  const { setFlightPlan, setDistance } = useFlightPlanContext();
  const { isAnalyzing, setIsAnalyzing, setResults, setError, error } = useLOSAnalysis();
  const { aoGeometry } = useAreaOfOpsContext();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const bydaLayerHandlerRef = useRef<{ fetchLayers: () => void } | null>(null);
  const elosGridRef = useRef<any>(null);
  const hasSetMapRef = useRef(false);

  const { map, terrainLoaded } = useMap('map-container', {
    style: 'mapbox://styles/intelaero/cm7pqu42s000601svdp7m3h0b',
    center: [0, 0],
    zoom: 2.5,
    projection: 'globe',
  });

  const { processFlightPlan } = useFlightPlanProcessor();
  const { updateMarkerPopups } = useMarkers({ map, terrainLoaded });
  const { addFlightPath, resetLayers } = useLayers();

  useEffect(() => {
    if (map && terrainLoaded && !hasSetMapRef.current) {
      setMap(map, terrainLoaded);
      hasSetMapRef.current = true;
      trackEvent('map_initialized', { mapLoaded: true });
    }
  }, [map, terrainLoaded, setMap]);

  useEffect(() => {
    if (!flightPlan || flightPlan.properties?.processed || !map || !terrainLoaded) {
      return;
    }

    const handleProcessedPlan = (processedPlan: any) => {
      setFlightPlan(processedPlan);
      if (processedPlan.properties.totalDistance) {
        setDistance(processedPlan.properties.totalDistance);
      }

      addFlightPath(processedPlan);

      trackEvent('flight_plan_processing_completed', {
        planId: processedPlan.properties?.id || 'unknown',
        distance: processedPlan.properties.totalDistance,
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

    processFlightPlan(map, flightPlan)
      .then(handleProcessedPlan)
      .catch(handleProcessingError);
  }, [flightPlan, map, terrainLoaded, processFlightPlan, setFlightPlan, setDistance, setError, addFlightPath]);

  useEffect(() => {
    if (map && terrainLoaded) {
      updateMarkerPopups();
    }
  }, [updateMarkerPopups, map, terrainLoaded]);

  const runElosAnalysis = async () => {
    if (!map || !elosGridRef.current) return;

    try {
      setIsAnalyzing(true);
      setError(null);
      trackEvent('elos_analysis_started', {});

      resetLayers();

      await elosGridRef.current.runAnalysis();

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
          <ELOSGridAnalysis
            ref={elosGridRef}
            map={map}
            flightPath={flightPlan?.properties?.processed ? flightPlan : undefined}
            onError={(error) => {
              console.error('ELOS Analysis error:', error);
              setError(error.message);
            }}
            onSuccess={(result) => {
              console.log('ELOS Analysis completed:', result);
              setResults(result);
            }}
          />
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
      <AnalysisStatus />
      <LOSModal onRunAnalysis={runElosAnalysis} />
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
    </div>
  );
});

Map.displayName = 'Map';

export default Map;
export type { MapRef };