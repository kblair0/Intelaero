//LayerManager.ts  (new - in services folder)
// src/services/LayerManager.ts
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

export const MAP_LAYERS = {
  ELOS_GRID: 'elos-grid-layer',
  FLIGHT_PATH: 'flight-path-layer',
  TERRAIN: 'terrain-layer',
  GCS_GRID: 'gcs-grid-layer',
  OBSERVER_GRID: 'observer-grid-layer',
  REPEATER_GRID: 'repeater-grid-layer',
  MERGED_VISIBILITY: 'merged-visibility-layer',
  AOTERRAIN_GRID: "AOterrain-grid-layer",
  AREA_OF_OPERATIONS_FILL: "area-of-operations-fill",
  AREA_OF_OPERATIONS_OUTLINE: "area-of-operations-outline",
  POWERLINES: "Electricity Transmission Lines",
  POWERLINES_HITBOX: "Electricity Transmission Lines Hitbox",
  AIRFIELDS: "Airfields",
  AIRFIELDS_LABELS: "Airfields Labels",
  BYDA_HV: "byda-hv-layer",
  BYDA_LV: "byda-lv-layer",
  BYDA_SWER: "byda-swer-layer",
  BYDA_OTHER: "byda-other-layer",
  BYDA_DEVICE: "byda-device-layer",
} as const;

export type LayerId = typeof MAP_LAYERS[keyof typeof MAP_LAYERS];
export type LayerVisibilityMap = Record<LayerId, boolean>;

// Layer events
export type LayerEventType = 'visibilityChange' | 'layerAdded' | 'layerRemoved';
export type LayerEventListener = (event: LayerEventType, layerId: string, visible?: boolean) => void;

/**
 * Manages map layers with an event system for React integration
 */
class LayerManager {
  private map: mapboxgl.Map | null = null;
  private layers: Map<string, boolean> = new Map();
  private listeners: Set<LayerEventListener> = new Set();

  /**
   * Set the map instance
   */
  setMap(map: mapboxgl.Map) {
    this.map = map;
    return this;
  }

  /**
   * Add an event listener for layer changes
   */
  addEventListener(listener: LayerEventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener); // Return cleanup function
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: LayerEventType, layerId: string, visible?: boolean) {
    this.listeners.forEach(listener => listener(event, layerId, visible));
  }

  /**
   * Register a layer for tracking
   */
  registerLayer(layerId: string, initialVisibility: boolean = false) {
    this.layers.set(layerId, initialVisibility);
    this.notifyListeners('layerAdded', layerId, initialVisibility);
    return this;
  }

  /**
   * Register all predefined layers
   */
  registerKnownLayers() {
    Object.values(MAP_LAYERS).forEach(layerId => {
      this.registerLayer(layerId, false);
    });
    return this;
  }

  /**
   * Toggle a layer's visibility
   */
  toggleLayerVisibility(layerId: string): boolean {
    if (!this.ensureMap()) return false;
    
    try {
      if (!this.map!.getLayer(layerId)) {
        console.warn(`Layer ${layerId} does not exist in the map`);
        return false;
      }
      
      const currentVisibility = this.map!.getLayoutProperty(layerId, 'visibility');
      const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
      this.map!.setLayoutProperty(layerId, 'visibility', newVisibility);
      
      const isVisible = newVisibility === 'visible';
      this.layers.set(layerId, isVisible);
      this.notifyListeners('visibilityChange', layerId, isVisible);
      
      return true;
    } catch (error) {
      console.error(`Error toggling layer ${layerId}:`, error);
      return false;
    }
  }

  /**
   * Set a layer's visibility directly
   */
  setLayerVisibility(layerId: string, visible: boolean): boolean {
    if (!this.ensureMap()) return false;
    
    try {
      if (!this.map!.getLayer(layerId)) {
        console.warn(`Layer ${layerId} does not exist in the map`);
        return false;
      }
      
      const newVisibility = visible ? 'visible' : 'none';
      this.map!.setLayoutProperty(layerId, 'visibility', newVisibility);
      
      this.layers.set(layerId, visible);
      this.notifyListeners('visibilityChange', layerId, visible);
      
      return true;
    } catch (error) {
      console.error(`Error setting layer ${layerId} visibility:`, error);
      return false;
    }
  }

  /**
   * Remove a layer and its source
   */
  removeLayer(layerId: string): boolean {
    if (!this.ensureMap()) return false;
    
    try {
      if (this.map!.getLayer(layerId)) {
        this.map!.removeLayer(layerId);
      }
      
      if (this.map!.getSource(layerId)) {
        this.map!.removeSource(layerId);
      }
      
      this.layers.delete(layerId);
      this.notifyListeners('layerRemoved', layerId);
      
      return true;
    } catch (error) {
      console.error(`Error removing layer ${layerId}:`, error);
      return false;
    }
  }

  /**
   * Check if a layer is visible
   */
  isLayerVisible(layerId: string): boolean {
    if (!this.map?.getLayer(layerId)) return false;
    return this.map.getLayoutProperty(layerId, 'visibility') === 'visible';
  }

  /**
   * Add a layer to the map
   */
  addLayer(
    layerId: string,
    source: mapboxgl.AnySourceData,
    layerConfig: mapboxgl.AnyLayer,
    sourceId?: string,
    initialVisibility: boolean = true
  ): boolean {
    if (!this.ensureMap()) return false;
    
    const effectiveSourceId = sourceId || layerId;
    
    try {
      // Add source if it doesn't exist
      if (!this.map!.getSource(effectiveSourceId)) {
        this.map!.addSource(effectiveSourceId, source);
      }
      
      // Remove layer if it already exists
      if (this.map!.getLayer(layerId)) {
        this.map!.removeLayer(layerId);
      }
      
      // Add the layer
      this.map!.addLayer({
        ...layerConfig,
        id: layerId,
        source: effectiveSourceId,
        layout: {
          ...layerConfig.layout,
          visibility: initialVisibility ? 'visible' : 'none'
        }
      });
      
      // Register and notify
      this.registerLayer(layerId, initialVisibility);
      
      return true;
    } catch (error) {
      console.error(`Error adding layer ${layerId}:`, error);
      return false;
    }
  }

  /**
   * Get the current layer visibility state
   */
  getLayerState(): LayerVisibilityMap {
    const state: Partial<LayerVisibilityMap> = {};
    
    // First add all tracked layers
    for (const [layerId, isVisible] of this.layers.entries()) {
      state[layerId as LayerId] = isVisible;
    }
    
    // Then check actual map state for layers that exist
    if (this.map) {
      for (const layerId of Object.values(MAP_LAYERS)) {
        if (this.map.getLayer(layerId)) {
          const visible = this.map.getLayoutProperty(layerId, 'visibility') === 'visible';
          state[layerId] = visible;
        }
      }
    }
    
    return state as LayerVisibilityMap;
  }

  /**
   * Adds or updates an Area of Operations to the map
   */
  addAreaOfOperations(geometry: GeoJSON.FeatureCollection): boolean {
    if (!this.ensureMap()) return false;
    
    try {
      // Remove existing layers if present
      this.removeLayer(MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE);
      this.removeLayer(MAP_LAYERS.AREA_OF_OPERATIONS_FILL);
      
      // Add outline layer
      this.addLayer(
        MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE,
        {
          type: "geojson",
          data: geometry
        },
        {
          id: MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE,
          type: "line",
          source: MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE,
          layout: { visibility: "visible" },
          paint: {
            "line-color": "#0000FF",
            "line-width": 3,
            "line-opacity": 0.9,
            "line-dasharray": [2, 2]
          }
        },
        undefined,
        true // Make visible initially
      );
      
      // Add fill layer
      this.addLayer(
        MAP_LAYERS.AREA_OF_OPERATIONS_FILL,
        {
          type: "geojson",
          data: geometry
        },
        {
          id: MAP_LAYERS.AREA_OF_OPERATIONS_FILL,
          type: "fill",
          source: MAP_LAYERS.AREA_OF_OPERATIONS_FILL,
          layout: { visibility: "visible" },
          paint: {
            "fill-color": "#ADD8E6",
            "fill-opacity": 0.2
          }
        },
        undefined,
        true // Make visible initially
      );
      
      // Notify listeners
      this.notifyListeners('layerAdded', MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE, true);
      this.notifyListeners('layerAdded', MAP_LAYERS.AREA_OF_OPERATIONS_FILL, true);
      
      return true;
    } catch (error) {
      console.error("Error adding AO layers:", error);
      return false;
    }
  }

/**
 * Adds or updates an AO terrain grid to the map
 */
addAreaOfOperationsTerrain(gridCells: GridCell[]): boolean {
  if (!this.ensureMap()) return false;
  
  try {
    // Remove existing terrain grid if present
    this.removeLayer(MAP_LAYERS.AOTERRAIN_GRID);
    
    if (!gridCells || gridCells.length === 0) {
      console.warn("Empty grid cells provided to addAreaOfOperationsTerrain");
      return false;
    }
    
    // Calculate elevation range for color scaling
    const elevations = gridCells.map(cell => cell.properties.elevation);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    
    // Convert grid cells to GeoJSON FeatureCollection
    const features = gridCells.map(cell => ({
      type: "Feature" as const,
      geometry: cell.geometry,
      properties: cell.properties
    }));
    
    const gridFeatureCollection = {
      type: "FeatureCollection" as const,
      features
    };
    
    // First add the source safely
    const sourceId = MAP_LAYERS.AOTERRAIN_GRID;
    
    if (this.map!.getSource(sourceId)) {
      try {
        (this.map!.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(gridFeatureCollection);
      } catch (sourceError) {
        console.warn("Error updating source, removing and recreating:", sourceError);
        this.map!.removeSource(sourceId);
        this.map!.addSource(sourceId, {
          type: "geojson",
          data: gridFeatureCollection
        });
      }
    } else {
      this.map!.addSource(sourceId, {
        type: "geojson",
        data: gridFeatureCollection
      });
    }
    
    // Then add the layer
    try {
      if (this.map!.getLayer(sourceId)) {
        this.map!.removeLayer(sourceId);
      }
      
      this.map!.addLayer({
        id: sourceId,
        type: "fill",
        source: sourceId,
        layout: { visibility: "visible" },
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "elevation"],
            minElevation, "#0000FF", // Lowest elevation -> Blue
            minElevation + (maxElevation - minElevation) * 0.33, "#00FF00", // 33% -> Green
            minElevation + (maxElevation - minElevation) * 0.66, "#FFFF00", // 66% -> Yellow
            maxElevation, "#FF0000" // Highest elevation -> Red
          ],
          "fill-opacity": 0.5
        }
      });
      
      // Notify listeners
      this.notifyListeners('layerAdded', sourceId, true);
      
      return true;
    } catch (layerError) {
      console.error("Error adding terrain grid layer:", layerError);
      return false;
    }
  } catch (error) {
    console.error("Error adding AO terrain grid:", error);
    return false;
  }
}

/**
 * Fit the map to AO bounds
 */
fitToAreaOfOperations(geometry: GeoJSON.FeatureCollection): boolean {
  if (!this.ensureMap()) return false;
  
  try {
    if (!geometry || !geometry.features || geometry.features.length === 0) {
      console.warn("Empty geometry provided to fitToAreaOfOperations");
      return false;
    }
    
    // Calculate bounds manually without turf as a fallback
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    
    try {
      // First try with turf
      const bbox = turf.bbox(geometry);
      this.map!.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]]
        ],
        { padding: 50, duration: 1000 }
      );
      return true;
    } catch (turfError) {
      console.warn("Turf bbox calculation failed, using manual calculation:", turfError);
      
      // Manual calculation as fallback
      geometry.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          const coordinates = feature.geometry.coordinates[0];
          coordinates.forEach(coord => {
            minLng = Math.min(minLng, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLng = Math.max(maxLng, coord[0]);
            maxLat = Math.max(maxLat, coord[1]);
          });
        }
      });
      
      if (minLng !== Infinity && minLat !== Infinity && maxLng !== -Infinity && maxLat !== -Infinity) {
        this.map!.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          { padding: 50, duration: 1000 }
        );
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error("Error fitting to AO bounds:", error);
    return false;
  }
}



  /**
   * Reset all layers
   */
  resetLayers(): boolean {
    if (!this.ensureMap()) return false;
    
    try {
      for (const layerId of this.layers.keys()) {
        this.removeLayer(layerId);
      }
      
      this.layers.clear();
      return true;
    } catch (error) {
      console.error('Error resetting layers:', error);
      return false;
    }
  }

  /**
   * Ensure map is initialized
   */
  private ensureMap(): boolean {
    if (!this.map) {
      console.warn('Map not initialized');
      return false;
    }
    return true;
  }
}

// Singleton instance
export const layerManager = new LayerManager();