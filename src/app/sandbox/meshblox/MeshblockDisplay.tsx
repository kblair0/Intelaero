"use client";
import { useEffect } from "react";
import { useMeshblockContext } from "./MeshblockContext";
import { useFlightPlanContext } from "../../context/FlightPlanContext";
import { useMapContext } from "../../context/mapcontext";
import { layerManager } from "../../services/LayerManager";
import { calculateAnalysisBuffer } from "./utils/meshblockAnalysis";

/**
 * A component that handles displaying the Meshblock Analysis Buffer on the map.
 * Shows the analysis corridor around the flight path when meshblock analysis is active.
 */
const MeshblockDisplay: React.FC = () => {
  const { layersVisible, aircraftConfig, flightPathAnalysis } = useMeshblockContext();
  const { flightPlan } = useFlightPlanContext();
  const { map, terrainLoaded } = useMapContext();

  // Display analysis buffer ONLY when panel is open (layersVisible = true)
  useEffect(() => {
    const hasFlightPlan = flightPlan?.features?.[0]?.geometry;
    const hasAltitude = aircraftConfig?.operationAltitudeAGL;
    const mapReady = map && terrainLoaded;
    
    // Buffer shows ONLY when panel is open AND we have the required data
    const shouldShowBuffer = hasFlightPlan &&
                             hasAltitude &&
                             mapReady &&
                             layersVisible; // MUST have panel open
    
    if (shouldShowBuffer) {
      const bufferDistance = calculateAnalysisBuffer(aircraftConfig.operationAltitudeAGL);
      const flightPath = flightPlan.features[0].geometry as GeoJSON.LineString;
      
      layerManager.addMeshblockAnalysisBuffer(flightPath, bufferDistance);
    } else {
      layerManager.removeMeshblockAnalysisBuffer();
    }
  }, [flightPlan, aircraftConfig?.operationAltitudeAGL, map, terrainLoaded, layersVisible, flightPathAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        layerManager.removeMeshblockAnalysisBuffer();
      }
    };
  }, [map]);

  // This is a behavior-only component, so it doesn't render anything directly
  return null;
};

export default MeshblockDisplay;