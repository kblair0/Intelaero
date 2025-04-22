"use client";

import { forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import type mapboxgl from "mapbox-gl";
import { useMapContext } from "../../context/mapcontext";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import * as turf from "@turf/turf";

interface BYDALayerHandlerProps {
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

const geometryType = "esriGeometryEnvelope";
const inSR = "4326";
const spatialRel = "esriSpatialRelIntersects";
const f = "geojson";

const BYDALayerHandler = forwardRef(
  ({ map }: BYDALayerHandlerProps, ref) => {
    // Instead of destructuring "layerManager", extract the functions provided by the context.
    const { setLayerVisibility } = useMapContext();
    const { aoGeometry } = useAreaOfOpsContext();

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
          console.log(`[BYDALayerHandler] Added source "${sourceId}".`);
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
        services.forEach((service) => {
          const { sourceId, layerId } = serviceLayerMapping[service];
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
            console.log(`[BYDALayerHandler] Removed layer "${layerId}".`);
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
            console.log(`[BYDALayerHandler] Removed source "${sourceId}".`);
          }
        });
      };
    }, [map]);

    const fetchLayers = useCallback(() => {
      console.log("[BYDALayerHandler] fetchLayers() called.");

      if (!map) {
        console.warn("[BYDALayerHandler] No map instance. Aborting fetch.");
        return;
      }
      if (!aoGeometry) {
        console.warn("[BYDALayerHandler] No AO geometry. Aborting fetch.");
        return;
      }

      const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
      console.log("[BYDALayerHandler] Calculated AO bounding box:", boundingBox);
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
        console.log(`[BYDALayerHandler] Querying ${service} with URL:`, queryUrl);

        fetch(queryUrl)
          .then((res) => {
            console.log(`[BYDALayerHandler] Response received for ${service}`);
            return res.json();
          })
          .then((data) => {
            const mapping = serviceLayerMapping[service];
            if (!mapping) return;
            const { sourceId, layerId } = mapping;

            // Ensure source exists before updating
            if (!map.getSource(sourceId)) {
              map.addSource(sourceId, {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
              });
              console.log(`[BYDALayerHandler] Re-added source "${sourceId}" during fetch.`);
            }

            if (data.features && data.features.length > 0) {
              console.log(
                `[BYDALayerHandler] Updating ${service} with ${data.features.length} features`
              );

              const existingSource = map.getSource(sourceId);
              console.log(
                `[BYDALayerHandler] Debug: Retrieved source for "${sourceId}":`,
                existingSource
              );

              if (existingSource) {
                (existingSource as mapboxgl.GeoJSONSource).setData(data);
                console.log(
                  `[BYDALayerHandler] Source "${sourceId}" updated successfully.`
                );
                // Set the layer to visible using the context-provided function
                setLayerVisibility(layerId, true);
              } else {
                console.warn(
                  `[BYDALayerHandler] Warning: Source "${sourceId}" not found after re-adding.`
                );
              }
            } else {
              console.log(`[BYDALayerHandler] No features found for ${service}`);
              // Clear source data if no features are found
              const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
              if (existingSource) {
                existingSource.setData({ type: "FeatureCollection", features: [] });
              }
            }
          })
          .catch((error) => {
            console.error(`[BYDALayerHandler] Error with ${service}:`, error);
          });
      });
    }, [map, aoGeometry, setLayerVisibility]);

    // Expose fetchLayers to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        fetchLayers,
      }),
      [fetchLayers]
    );

    return null;
  }
);

BYDALayerHandler.displayName = "BYDALayerHandler";
export default BYDALayerHandler;
