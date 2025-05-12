/**
 * BYDAService.ts
 * 
 * Purpose:
 * Encapsulates logic for fetching DBYD (Dial Before You Dig) powerline data from ArcGIS services.
 * Provides a reusable function to fetch and update map layers, ensuring DRY and Maintainability.
 * 
 * Dependencies:
 * - mapbox-gl: For map instance and GeoJSON sources.
 * - @turf/turf: For bounding box calculations.
 * 
 * Usage:
 * Imported in useLayers.ts to support toggleDBYDPowerlines.
 */

/**
 * Fetches DBYD powerline data and updates map layers.
 * @param map - Mapbox map instance.
 * @param aoGeometry - Area of Operations geometry for bounding box.
 * @param setLayerVisibility - Function to set layer visibility.
 * @returns Promise resolving to true on success, false on failure.
 */
export async function fetchBYDALayers(
    map: mapboxgl.Map,
    aoGeometry: GeoJSON.FeatureCollection,
    setLayerVisibility: (layerId: string, visible: boolean) => void
  ): Promise<boolean> {
    const services = [
      'LUAL_Network_HV_Feature_Public',
      'LUAL_Network_LV_Feature_Public',
      'LUAL_Network_SWER_Feature_Public',
      'LUAL_Network_Other_Feature_Public',
      'LUAL_Network_Device_Feature_View',
    ];
  
    const serviceLayerMapping: Record<
      string,
      { sourceId: string; layerId: string; color: string }
    > = {
      LUAL_Network_HV_Feature_Public: {
        sourceId: 'byda-hv-source',
        layerId: 'byda-hv-layer',
        color: '#ff0000',
      },
      LUAL_Network_LV_Feature_Public: {
        sourceId: 'byda-lv-source',
        layerId: 'byda-lv-layer',
        color: '#ff0000',
      },
      LUAL_Network_SWER_Feature_Public: {
        sourceId: 'byda-swer-source',
        layerId: 'byda-swer-layer',
        color: '#ff0000',
      },
      LUAL_Network_Other_Feature_Public: {
        sourceId: 'byda-other-source',
        layerId: 'byda-other-layer',
        color: '#ff0000',
      },
      LUAL_Network_Device_Feature_View: {
        sourceId: 'byda-device-source',
        layerId: 'byda-device-layer',
        color: '#ff0000',
      },
    };
  
    const baseUrl = 'https://services-ap1.arcgis.com/ug6sGLFkytbXYo4f/ArcGIS/rest/services';
  
    const serviceQueryParams: Record<string, { where: string; outFields: string }> = {
      LUAL_Network_HV_Feature_Public: {
        where: "ASSET_TYPE IN ('US','OH')",
        outFields: 'OPERATING_VOLTAGE,OWNER',
      },
      LUAL_Network_LV_Feature_Public: {
        where: "ASSET_TYPE IN ('US','OH')",
        outFields: 'OPERATING_VOLTAGE,OWNER',
      },
      LUAL_Network_SWER_Feature_Public: {
        where: "ASSET_TYPE IN ('US','OH')",
        outFields: 'OWNER,OPERATING_VOLTAGE',
      },
      LUAL_Network_Other_Feature_Public: {
        where: "ASSET_TYPE IN ('US','OH')",
        outFields: 'OWNER,OPERATING_VOLTAGE',
      },
      LUAL_Network_Device_Feature_View: {
        where: '1=1',
        outFields: 'OWNER,ASSET_TYPE',
      },
    };
  
    const geometryType = 'esriGeometryEnvelope';
    const inSR = '4326';
    const spatialRel = 'esriSpatialRelIntersects';
    const f = 'geojson';
  
    try {
      // Calculate bounding box from AO geometry
      const turf = await import('@turf/turf');
      const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
      const geometry = boundingBox.join(',');
  
      // Fetch data for each service
      const fetchPromises = services.map(async (service) => {
        const params = serviceQueryParams[service];
        const queryParams = new URLSearchParams({
          where: params.where,
          geometry,
          geometryType,
          inSR,
          spatialRel,
          outFields: params.outFields,
          returnGeometry: 'true',
          f,
        });
        const queryUrl = `${baseUrl}/${service}/FeatureServer/0/query?${queryParams.toString()}`;
  
        try {
          const res = await fetch(queryUrl);
          const data = await res.json();
          const { sourceId, layerId } = serviceLayerMapping[service];
  
          // Ensure source exists
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            });
          }
  
          // Update source data
          const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
          if (existingSource) {
            existingSource.setData(
              data.features && data.features.length > 0
                ? data
                : { type: 'FeatureCollection', features: [] }
            );
            setLayerVisibility(layerId, data.features && data.features.length > 0);
          } else {
            console.warn(`[BYDAService] Source "${sourceId}" not found after adding.`);
          }
        } catch (error) {
          console.error(`[BYDAService] Error fetching ${service}:`, error);
          throw error;
        }
      });
  
      await Promise.all(fetchPromises);
      console.log('[BYDAService] All DBYD layers fetched successfully');
      return true;
    } catch (error) {
      console.error('[BYDAService] Failed to fetch DBYD layers:', error);
      return false;
    }
  }