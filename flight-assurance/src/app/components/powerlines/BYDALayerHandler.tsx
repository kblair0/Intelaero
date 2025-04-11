import { useEffect } from "react";
import type mapboxgl from "mapbox-gl";

/**
 * Interface for the component props.
 *
 * @property {mapboxgl.Map | null} map - The Mapbox map instance to which sources and layers will be added.
 * @property {[number, number, number, number]} boundingBox - Bounding box coordinates in the format [minX, minY, maxX, maxY].
 */
interface BYDALayerHandlerProps {
  map: mapboxgl.Map | null;
  boundingBox: [number, number, number, number];
}

/**
 * List of ArcGIS services to query.
 * This array includes five services for HV, LV, SWER, Other, and Device.
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
 * This ensures that each service's data is added to a unique, descriptive source and layer.
 */
const serviceLayerMapping: Record<
  string,
  { sourceId: string; layerId: string }
> = {
  LUAL_Network_HV_Feature_Public: {
    sourceId: "byda-hv-source",
    layerId: "byda-hv-layer"
  },
  LUAL_Network_LV_Feature_Public: {
    sourceId: "byda-lv-source",
    layerId: "byda-lv-layer"
  },
  LUAL_Network_SWER_Feature_Public: {
    sourceId: "byda-swer-source",
    layerId: "byda-swer-layer"
  },
  LUAL_Network_Other_Feature_Public: {
    sourceId: "byda-other-source",
    layerId: "byda-other-layer"
  },
  LUAL_Network_Device_Feature_View: {
    sourceId: "byda-device-source",
    layerId: "byda-device-layer"
  }
};

/**
 * Base URL for ArcGIS REST services.
 */
const baseUrl =
  "https://services-ap1.arcgis.com/ug6sGLFkytbXYo4f/ArcGIS/rest/services";

/**
 * Custom query parameters for each service.
 * Defines the filtering ("where") and the fields to return ("outFields").
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
    where: "1=1", // No filtering; returns all records.
    outFields: "OWNER,ASSET_TYPE"
  }
};

/**
 * Common spatial parameters for every ArcGIS query.
 */
const geometryType = "esriGeometryEnvelope"; // Define the geometry as an envelope (i.e. a bounding box).
const inSR = "4326"; // Use WGS 84 spatial reference.
const spatialRel = "esriSpatialRelIntersects"; // Test if the geometry intersects with features.
const f = "geojson"; // Set the output format to GeoJSON.

/**
 * BYDALayerHandler Component
 *
 * This component fetches and displays data from multiple ArcGIS services. For each service, it builds a query using the provided
 * bounding box and adds the returned GeoJSON data as a layer to the given Mapbox map instance.
 *
 * @param {BYDALayerHandlerProps} props - Contains the map instance and bounding box.
 */
const BYDALayerHandler: React.FC<BYDALayerHandlerProps> = ({ map, boundingBox }) => {
  useEffect(() => {
    // Log the effect start and the bounding box.
    console.log("[BYDALayerHandler] Effect triggered with boundingBox:", boundingBox);

    // Return early if no map instance is provided.
    if (!map) {
      console.warn("[BYDALayerHandler] No map instance. Exiting effect.");
      return;
    }

    // Convert the bounding box array to a comma-separated string.
    const geometry = boundingBox.join(",");
    console.log("[BYDALayerHandler] Geometry string:", geometry);

    // Process each ArcGIS service.
    services.forEach((service) => {
      // Build query parameters and the query URL.
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
      console.log(`[BYDALayerHandler] Querying ${service}: ${queryUrl}`);

      // Fetch the GeoJSON data from the service.
      fetch(queryUrl)
        .then((res) => res.json())
        .then((data) => {
          // Look up the unique source and layer IDs.
          const mapping = serviceLayerMapping[service];
          if (!mapping) {
            console.warn(`[BYDALayerHandler] No mapping found for ${service}. Skipping.`);
            return;
          }
          const { sourceId, layerId } = mapping;

          // Add the source if it doesn't exist.
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: "geojson", data });
          }

          // Add the layer if it doesn't exist.
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: "line",
              source: sourceId,
              paint: { "line-color": "#f00", "line-width": 1.5 }
            });
          }
        })
        .catch((error) =>
          console.error(`[BYDALayerHandler] Error with ${service}:`, error)
        );
    });
  }, [map, boundingBox]);

  // This component performs side effects only and does not render any UI elements.
  return null;
};

export default BYDALayerHandler;