// src/app/types/MapTypes.ts

import mapboxgl from "mapbox-gl";
import { GeoJSON } from "geojson";

/**
 * MapRef - Interface for the Map component's imperative handle
 * 
 * This interface defines the methods that can be called on the Map component
 * through a React ref. It's used by components that need direct map interaction.
 */
export interface MapRef {
  getMap: () => mapboxgl.Map | null;
  addGeoJSONToMap: (geojson: GeoJSON.FeatureCollection) => void;
  runElosAnalysis: (options?: any) => Promise<any>;
  toggleLayerVisibility: (layerId: string) => void;
}