"use client";

import { forwardRef, useImperativeHandle, useCallback, useState, useEffect } from "react";
import type mapboxgl from "mapbox-gl";
import { useMapContext } from "../../context/mapcontext";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import * as turf from "@turf/turf";
import { useAreaOpsProcessor } from "../AO/Hooks/useAreaOpsProcessor";


interface DBYDLayerHandlerProps {
  map: mapboxgl.Map | null;
}

const services = [
  "LUAL_Network_HV_Feature_Public",
  "LUAL_Network_LV_Feature_Public",
  "LUAL_Network_SWER_Feature_Public",
  "LUAL_Network_Other_Feature_Public",
  "LUAL_Network_Device_Feature_View",
];

const serviceLayerMapping: Record<
  string,
  { sourceId: string; layerId: string; color: string }
> = {
  LUAL_Network_HV_Feature_Public: {
    sourceId: "byda-hv-source",
    layerId: "byda-hv-layer",
    color: "#ff0000",
  },
  LUAL_Network_LV_Feature_Public: {
    sourceId: "byda-lv-source",
    layerId: "byda-lv-layer",
    color: "#ff0000",
  },
  LUAL_Network_SWER_Feature_Public: {
    sourceId: "byda-swer-source",
    layerId: "byda-swer-layer",
    color: "#ff0000",
  },
  LUAL_Network_Other_Feature_Public: {
    sourceId: "byda-other-source",
    layerId: "byda-other-layer",
    color: "#ff0000",
  },
  LUAL_Network_Device_Feature_View: {
    sourceId: "byda-device-source",
    layerId: "byda-device-layer",
    color: "#ff0000",
  },
};

const baseUrl =
  "https://services-ap1.arcgis.com/ug6sGLFkytbXYo4f/ArcGIS/rest/services";

const serviceQueryParams: Record<string, { where: string; outFields: string }> = {
  LUAL_Network_HV_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OPERATING_VOLTAGE,OWNER",
  },
  LUAL_Network_LV_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OPERATING_VOLTAGE,OWNER",
  },
  LUAL_Network_SWER_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OWNER,OPERATING_VOLTAGE",
  },
  LUAL_Network_Other_Feature_Public: {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OWNER,OPERATING_VOLTAGE",
  },
  LUAL_Network_Device_Feature_View: {
    where: "1=1",
    outFields: "OWNER,ASSET_TYPE",
  },
};

const DBYDLayerHandler = forwardRef<
  { fetchLayers: () => void },
  DBYDLayerHandlerProps
>(({ map }, ref) => {
  const geometryType = "esriGeometryEnvelope";
  const inSR = "4326";
  const spatialRel = "esriSpatialRelIntersects";
  const f = "geojson";
  // Instead of destructuring "layerManager", extract the functions provided by the context.
  const { setLayerVisibility } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { showAreaOfOperations } = useAreaOpsProcessor();
  const [error, setError] = useState<string | null>(null);

  // Initialize layers on mount
  useEffect(() => {
    if (!map) return;

    services.forEach((service) => {
      const { sourceId, layerId, color } = serviceLayerMapping[service];

      // Add empty GeoJSON source if it doesn't exist
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      // Add layer if it doesn't exist
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: { visibility: "none" },
          paint: {
            "line-color": color,
            "line-width": 2,
          },
        });
        
        // If you need to register this layer in a centralized LayerManager, consider calling that here.
      }
    });

    // Cleanup: Optionally remove layers and sources on unmount
    return () => {
      // Add comprehensive map validation before cleanup
      if (!map || !map.getStyle || !map.getLayer || !map.getSource) {
        console.warn("[DBYDLayerHandler] Map not available or already destroyed during cleanup");
        return;
      }
      
      try {
        // Check if map is still loaded
        if (!map.loaded()) {
          console.warn("[DBYDLayerHandler] Map not loaded during cleanup");
          return;
        }
      } catch (mapStateError) {
        console.warn("[DBYDLayerHandler] Error checking map state during cleanup:", mapStateError);
        return;
      }
      
      services.forEach((service) => {
        const { sourceId, layerId } = serviceLayerMapping[service];
        
        try {
          if (map.getLayer && map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        } catch (layerError) {
          console.warn(`[DBYDLayerHandler] Error removing layer ${layerId}:`, layerError);
        }
        
        try {
          if (map.getSource && map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
        } catch (sourceError) {
          console.warn(`[DBYDLayerHandler] Error removing source ${sourceId}:`, sourceError);
        }
      });
    };
  }, [map]);

  const fetchLayers = useCallback(() => {
    if (!map) {
      console.warn("[DBYDLayerHandler] No map instance. Aborting fetch.");
      return;
    }
    if (!aoGeometry) {
      console.warn("[DBYDLayerHandler] No AO geometry. Aborting fetch.");
      return;
    }

    // Show Area of Operations when BYDA layers are fetched
    try {
      showAreaOfOperations();
    } catch (error) {
      console.warn("[DBYDLayerHandler] Failed to show Area of Operations:", error);
    }

    const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
    const geometry = boundingBox.join(",");

    services.forEach((service) => {
      const params = serviceQueryParams[service];
      const queryParams = new URLSearchParams({
        where: params.where,
        geometry,
        geometryType,
        inSR,
        spatialRel,
        outFields: params.outFields,
        returnGeometry: "true",
        f,
      });
      const queryUrl = `${baseUrl}/${service}/FeatureServer/0/query?${queryParams.toString()}`;

      fetch(queryUrl)
        .then((res) => {
          return res.json();
        })
        .then((data) => {
          const mapping = serviceLayerMapping[service];
          if (!mapping) return;
          const { sourceId, layerId } = mapping;

          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            });
          }

          if (data.features && data.features.length > 0) {
            const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
            if (existingSource) {
              existingSource.setData(data);
              setLayerVisibility(layerId, true);
            } else {
              console.warn(`[DBYDLayerHandler] Source "${sourceId}" not found after re-adding.`);
            }
          } else {
            const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
            if (existingSource) {
              existingSource.setData({ type: "FeatureCollection", features: [] });
            }
          }
        })
        .catch((error) => {
          console.error(`[DBYDLayerHandler] Error with ${service}:`, error);
          setError(`Failed to fetch ${service}: ${error.message}`);
        });
    });
  }, [map, aoGeometry, setLayerVisibility, showAreaOfOperations]);

  // Expose fetchLayers to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      fetchLayers,
    }),
    [fetchLayers]
  );

  return null;
});

DBYDLayerHandler.displayName = "DBYDLayerHandler";
export default DBYDLayerHandler;