import { forwardRef, useImperativeHandle, useCallback, useEffect } from "react";
import type mapboxgl from "mapbox-gl";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import * as turf from "@turf/turf";

/**
 * Interface for the component props.
 */
interface BYDALayerHandlerProps {
  map: mapboxgl.Map | null;
}

/**
 * List of ArcGIS services to query.
 */
const services = [
  "LUAL_Network_HV_Feature_Public",
  "LUAL_Network_LV_Feature_Public",
  "LUAL_Network_SWER_Feature_Public",
  "LUAL_Network_Other_Feature_Public",
  "LUAL_Network_Device_Feature_View"
];

/**
 * A mapping from service names to predetermined source and layer IDs.
 */
const serviceLayerMapping: Record<
  string,
  { sourceId: string; layerId: string; color: string }
> = {
  LUAL_Network_HV_Feature_Public: {
    sourceId: "byda-hv-source",
    layerId: "byda-hv-layer",
    color: "#ff0000"
  },
  LUAL_Network_LV_Feature_Public: {
    sourceId: "byda-lv-source",
    layerId: "byda-lv-layer",
    color: "#ff0000"
  },
  LUAL_Network_SWER_Feature_Public: {
    sourceId: "byda-swer-source",
    layerId: "byda-swer-layer",
    color: "#ff0000"
  },
  LUAL_Network_Other_Feature_Public: {
    sourceId: "byda-other-source",
    layerId: "byda-other-layer",
    color: "#ff0000"
  },
  LUAL_Network_Device_Feature_View: {
    sourceId: "byda-device-source",
    layerId: "byda-device-layer",
    color: "#ff0000"
  }
};

/**
 * Base URL for ArcGIS REST services.
 */
const baseUrl =
  "https://services-ap1.arcgis.com/ug6sGLFkytbXYo4f/ArcGIS/rest/services";

/**
 * Custom query parameters for each service.
 */
const serviceQueryParams: Record<string, { where: string; outFields: string }> = {
  "LUAL_Network_HV_Feature_Public": {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OPERATING_VOLTAGE,OWNER"
  },
  "LUAL_Network_LV_Feature_Public": {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OPERATING_VOLTAGE,OWNER"
  },
  "LUAL_Network_SWER_Feature_Public": {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OWNER,OPERATING_VOLTAGE"
  },
  "LUAL_Network_Other_Feature_Public": {
    where: "ASSET_TYPE IN ('US','OH')",
    outFields: "OWNER,OPERATING_VOLTAGE"
  },
  "LUAL_Network_Device_Feature_View": {
    where: "1=1",
    outFields: "OWNER,ASSET_TYPE"
  }
};

// Common spatial parameters
const geometryType = "esriGeometryEnvelope";
const inSR = "4326";
const spatialRel = "esriSpatialRelIntersects";
const f = "geojson";

/**
 * BYDALayerHandler Component
 *
 * This component exposes the fetchLayers function via a ref.
 * It does not automatically fetch layers on changes.
 */
const BYDALayerHandler = forwardRef(
  ({ map }: BYDALayerHandlerProps, ref) => {
    const { aoGeometry } = useAreaOfOpsContext();

    useEffect(() => {
      console.log("[BYDALayerHandler] Component mounted. Map:", map, "AO Geometry:", aoGeometry);
    }, [map, aoGeometry]);

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
      console.log("[BYDALayerHandler] Geometry string:", geometry);

      // Clean up existing layers and sources.
      services.forEach((service) => {
        const mapping = serviceLayerMapping[service];
        if (!mapping) return;
        if (map.getLayer(mapping.layerId)) {
          console.log(`[BYDALayerHandler] Removing layer ${mapping.layerId}`);
          map.removeLayer(mapping.layerId);
        }
        if (map.getSource(mapping.sourceId)) {
          console.log(`[BYDALayerHandler] Removing source ${mapping.sourceId}`);
          map.removeSource(mapping.sourceId);
        }
      });

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
          f
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
            const { sourceId, layerId, color } = mapping;

            if (data.features && data.features.length > 0) {
              console.log(`[BYDALayerHandler] Adding ${service} with ${data.features.length} features`);

              if (map.getLayer(layerId)) {
                console.log(`[BYDALayerHandler] Removing existing layer ${layerId}`);
                map.removeLayer(layerId);
              }
              if (map.getSource(sourceId)) {
                console.log(`[BYDALayerHandler] Removing existing source ${sourceId}`);
                map.removeSource(sourceId);
              }

              map.addSource(sourceId, {
                type: "geojson",
                data,
              });
              console.log(`[BYDALayerHandler] Source ${sourceId} added successfully.`);

              map.addLayer({
                id: layerId,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": color,
                  "line-width": 2,
                },
              });
              console.log(`[BYDALayerHandler] Layer ${layerId} added successfully.`);
            } else {
              console.log(`[BYDALayerHandler] No features found for ${service}`);
            }
          })
          .catch((error) => {
            console.error(`[BYDALayerHandler] Error with ${service}:`, error);
          });
      });
    }, [map, aoGeometry]);

    // Expose the fetchLayers function to the parent via ref.
    useImperativeHandle(ref, () => ({
      fetchLayers,
    }), [fetchLayers]);

    return null;
  }
);

BYDALayerHandler.displayName = "BYDALayerHandler";
export default BYDALayerHandler;
