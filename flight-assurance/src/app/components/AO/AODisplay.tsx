"use client";
import { useEffect } from "react";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import { useMapContext } from "../../context/MapContext";
import { layerManager } from "../../services/LayerManager";

/**
 * A component that handles displaying the Area of Operations on the map.
 * Automatically updates when AO geometry changes or the map becomes ready.
 */
const AODisplay: React.FC = () => {
  const { aoGeometry, aoTerrainGrid } = useAreaOfOpsContext();
  const { map, isMapReady } = useMapContext();
  
  // Display AO when geometry changes or map becomes ready
  useEffect(() => {
    if (aoGeometry && map && isMapReady) {
      console.log("Displaying AO on map");
      layerManager.addAreaOfOperations(aoGeometry);
      layerManager.fitToAreaOfOperations(aoGeometry);
    }
  }, [aoGeometry, map, isMapReady]);
  
  // Display terrain grid when it changes
  useEffect(() => {
    if (aoTerrainGrid && aoTerrainGrid.length > 0 && map && isMapReady) {
      console.log("Displaying AO terrain grid on map");
      layerManager.addAreaOfOperationsTerrain(aoTerrainGrid);
    }
  }, [aoTerrainGrid, map, isMapReady]);
  
  // This is a behavior-only component, so it doesn't render anything directly
  return null;
};

export default AODisplay;