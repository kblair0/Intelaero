// LayerManager.ts
import mapboxgl from 'mapbox-gl';

export const MAP_LAYERS = {
  ELOS_GRID: 'elos-grid-layer',
  FLIGHT_PATH: 'flight-path-layer',
  TERRAIN: 'terrain-layer',
  GCS_GRID: 'gcs-grid-layer',
  OBSERVER_GRID: 'observer-grid-layer',
  REPEATER_GRID: 'repeater-grid-layer',
  MERGED_VISIBILITY: 'merged-visibility-layer'
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
    if (!this.map) {
      console.warn('Map not initialized');
      return false;
    }

    try {
      // Check if layer exists in the map
      const layer = this.map.getLayer(layerId);
      if (!layer) {
        console.warn(`Layer ${layerId} does not exist in the map`);
        return false;
      }

      const currentVisibility = this.map.getLayoutProperty(layerId, 'visibility');
      console.log(`Before toggling, ${layerId} visibility is ${currentVisibility}`);
      const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
      
      this.map.setLayoutProperty(layerId, 'visibility', newVisibility);
      this.layers.set(layerId, newVisibility === 'visible');
      
      console.log(`Layer ${layerId} visibility set to ${newVisibility}`);
      return true;
    } catch (error) {
      console.error(`Error toggling layer ${layerId}:`, error);
      return false;
    }
  }

  isLayerVisible(layerId: string): boolean {
    if (!this.map?.getLayer(layerId)) return false;
    return this.map.getLayoutProperty(layerId, 'visibility') === 'visible';
  }
}

export const layerManager = new LayerManager();