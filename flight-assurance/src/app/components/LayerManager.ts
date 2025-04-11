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
  AREA_OF_OPERATIONS_OUTLINE: "area-of-operations-outline"
} as const;

class LayerManager {
  private map: mapboxgl.Map | null = null;
  private layers: Map<string, boolean> = new Map();

  setMap(map: mapboxgl.Map) {
    this.map = map;
    return this;
  }

  registerLayer(layerId: string, initialVisibility: boolean = true) {
    this.layers.set(layerId, initialVisibility);
    return this;
  }

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
      this.layers.set(layerId, newVisibility === 'visible');
      return true;
    } catch (error) {
      console.error(`Error toggling layer ${layerId}:`, error);
      return false;
    }
  }

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
      return true;
    } catch (error) {
      console.error(`Error removing layer ${layerId}:`, error);
      return false;
    }
  }

  resetLayers(): boolean {
    if (!this.ensureMap()) return false;

    try {
      for (const layerId of this.layers.keys()) {
        if (this.map!.getLayer(layerId)) {
          this.map!.removeLayer(layerId);
        }
        if (this.map!.getSource(layerId)) {
          this.map!.removeSource(layerId);
        }
      }
      this.layers.clear();
      return true;
    } catch (error) {
      console.error('Error resetting layers:', error);
      return false;
    }
  }

  isLayerVisible(layerId: string): boolean {
    if (!this.map?.getLayer(layerId)) return false;
    return this.map.getLayoutProperty(layerId, 'visibility') === 'visible';
  }

  addLayer(
    layerId: string,
    source: mapboxgl.AnySourceData,
    layerConfig: mapboxgl.AnyLayer,
    sourceId?: string
  ): boolean {
    if (!this.ensureMap()) return false;

    const effectiveSourceId = sourceId || layerId;

    try {
      if (!this.map!.getSource(effectiveSourceId)) {
        this.map!.addSource(effectiveSourceId, source);
      }
      if (!this.map!.getLayer(layerId)) {
        this.map!.addLayer({
          ...layerConfig,
          source: effectiveSourceId, // Ensure layer uses the correct source ID
        });
      }
      this.registerLayer(layerId, true);
      return true;
    } catch (error) {
      console.error(`Error adding layer ${layerId} with source ${effectiveSourceId}:`, error);
      return false;
    }
  }

  private ensureMap(): boolean {
    if (!this.map) {
      console.warn('Map not initialized');
      return false;
    }
    return true;
  }
}

export const layerManager = new LayerManager();