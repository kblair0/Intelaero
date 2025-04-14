//LayerManager.ts  (new - in services folder)
// src/services/LayerManager.ts
import mapboxgl from 'mapbox-gl';

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