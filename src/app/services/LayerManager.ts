//LayerManager.ts  (new - in services folder)
// src/services/LayerManager.ts
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { GridCell } from '../components/Analyses/Types/GridAnalysisTypes';

export const MAP_LAYERS = {
  ELOS_GRID: 'elos-grid-layer',
  FLIGHT_PATH: 'flight-path-layer',
  FLIGHT_PATH_VISIBILITY: 'flight-path-visibility-layer',
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
  MOBILE_TOWERS: "mobile-towers-layer",
  TREE_HEIGHTS: 'tree-height-raster',
  MESHBLOCK_LANDUSE: "meshblock-landuse-layer",
  MESHBLOCK_POPULATION: "meshblock-population-layer",
  MESHBLOCK_FLIGHT_INTERSECT: "meshblock-flight-intersect-layer",
  MESHBLOCK_ANALYSIS_BUFFER_FILL: "meshblock-analysis-buffer-fill",
  MESHBLOCK_ANALYSIS_BUFFER_OUTLINE: "meshblock-analysis-buffer-outline",
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
  public readonly MAP_LAYERS = MAP_LAYERS;

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
     * Update the opacity of a terrain layer
     * @param layerId - The layer ID to update
     * @param opacity - Opacity value between 0 and 1
     * @returns boolean indicating success
     */
    updateLayerOpacity(layerId: string, opacity: number): boolean {
      if (!this.ensureMap()) return false;
      
      try {
        if (!this.map!.getLayer(layerId)) {
          console.warn(`Layer ${layerId} does not exist in the map`);
          return false;
        }
        
        // Clamp opacity between 0 and 1
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        
        // Update the fill-opacity paint property
        this.map!.setPaintProperty(layerId, 'fill-opacity', clampedOpacity);
        
        return true;
      } catch (error) {
        console.error(`Error updating opacity for layer ${layerId}:`, error);
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
 * Adds or updates a Meshblock Analysis Buffer to the map
 */
addMeshblockAnalysisBuffer(flightPath: GeoJSON.LineString, bufferDistance: number): boolean {
  if (!this.ensureMap()) return false;
  
  try {
    // Remove existing buffer layers if present
    this.removeLayer(MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_OUTLINE);
    this.removeLayer(MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_FILL);
    
    // Create buffer geometry around flight path
    const flightLine = turf.lineString(flightPath.coordinates);
    const bufferedGeometry = turf.buffer(flightLine, bufferDistance, { units: 'meters' });
    
    const bufferFeatureCollection = {
      type: "FeatureCollection" as const,
      features: [bufferedGeometry]
    };
    
    // Add outline layer
    this.addLayer(
      MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_OUTLINE,
      {
        type: "geojson",
        data: bufferFeatureCollection
      },
      {
        id: MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_OUTLINE,
        type: "line",
        source: MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_OUTLINE,
        layout: { visibility: "visible" },
        paint: {
          "line-color": "#9333EA", // Purple color to match meshblock theme
          "line-width": 2,
          "line-opacity": 0.8,
          "line-dasharray": [3, 3]
        }
      },
      undefined,
      true // Make visible initially
    );
    
    // Add fill layer
    this.addLayer(
      MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_FILL,
      {
        type: "geojson",
        data: bufferFeatureCollection
      },
      {
        id: MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_FILL,
        type: "fill",
        source: MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_FILL,
        layout: { visibility: "visible" },
        paint: {
          "fill-color": "#9333EA", // Purple to match meshblock theme
          "fill-opacity": 0.15 // Very subtle fill
        }
      },
      undefined,
      true // Make visible initially
    );
    
    // Notify listeners
    this.notifyListeners('layerAdded', MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_OUTLINE, true);
    this.notifyListeners('layerAdded', MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_FILL, true);
    
    return true;
  } catch (error) {
    console.error("Error adding meshblock analysis buffer:", error);
    return false;
  }
}

/**
 * Remove meshblock analysis buffer layers
 */
removeMeshblockAnalysisBuffer(): boolean {
  try {
    this.removeLayer(MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_OUTLINE);
    this.removeLayer(MAP_LAYERS.MESHBLOCK_ANALYSIS_BUFFER_FILL);
    return true;
  } catch (error) {
    console.error("Error removing meshblock analysis buffer:", error);
    return false;
  }
}
  /**
   * Adds or updates an AO terrain grid to the map with improved persistence
   * FIXED: Better source management and layer persistence
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
      
      console.log(`Processing ${gridCells.length} terrain grid cells for visualization`);
      
      // RENDERING OPTIMIZATION: Use a sampling approach for visualization only
      // This doesn't affect analysis, only how many cells we display on the map
      if (gridCells.length > 20000) {
        console.warn(`Rendering a very large number of cells (${gridCells.length}). Consider reducing buffer size if performance issues occur.`);
      }
      // Use all cells for visualization
      const visualizationCells = gridCells;
      
      // Calculate elevation range for color scaling using ALL cells for accurate representation
      let minElevation = Infinity;
      let maxElevation = -Infinity;
      
      for (const cell of gridCells) {
        const elevation = cell.properties.elevation;
        if (elevation < minElevation) minElevation = elevation;
        if (elevation > maxElevation) maxElevation = elevation;
      }
      
      // Convert the SAMPLED grid cells to GeoJSON for visualization
      const features = visualizationCells.map(cell => ({
        type: "Feature" as const,
        geometry: cell.geometry,
        properties: {
          elevation: cell.properties.elevation
        }
      }));
      
      const gridFeatureCollection = {
        type: "FeatureCollection" as const,
        features
      };
      
      // FIXED: Better source management
      const sourceId = MAP_LAYERS.AOTERRAIN_GRID;
      
      // Always remove and recreate source to prevent stale data issues
      if (this.map!.getSource(sourceId)) {
        console.log("Removing existing terrain grid source");
        this.map!.removeSource(sourceId);
      }
      
      // Add fresh source
      this.map!.addSource(sourceId, {
        type: "geojson",
        data: gridFeatureCollection
      });
      
      // FIXED: Always remove layer before adding
      if (this.map!.getLayer(sourceId)) {
        this.map!.removeLayer(sourceId);
      }
      
      // Determine the best color scale approach based on elevation range
      const elevationRange = maxElevation - minElevation;
      const medianElevation = this.calculateMedianElevation(gridCells);
      const useEnhancedScale = elevationRange > 300; // For areas with large elevation differences
      
      // Create color expression based on distribution
      let colorExpression;
      if (useEnhancedScale) {
        // Enhanced scale for large elevation differences
        // This uses quantiles rather than linear interpolation
        const quartile1 = minElevation + (medianElevation - minElevation) * 0.5;
        const quartile3 = medianElevation + (maxElevation - medianElevation) * 0.5;
        const highPoint = medianElevation + (maxElevation - medianElevation) * 0.8;
        
        colorExpression = [
          "interpolate",
          ["linear"],
          ["get", "elevation"],
          minElevation, "#0000FF",     // Lowest elevation (Blue)
          quartile1, "#00AAFF",        // 1st quartile (Light Blue)
          medianElevation, "#00FF00",  // Median elevation (Green)
          quartile3, "#FFFF00",        // 3rd quartile (Yellow)
          highPoint, "#FF0000",        // High elevation (Red)
          maxElevation, "#800080"      // Highest elevation (Purple)
        ];
      } else {
        // Standard linear scale for areas with moderate elevation change
        colorExpression = [
          "interpolate",
          ["linear"],
          ["get", "elevation"],
          minElevation, "#0000FF",                                             // Lowest (Blue)
          minElevation + (maxElevation - minElevation) * 0.2, "#00AAFF",       // 20% (Light Blue)
          minElevation + (maxElevation - minElevation) * 0.4, "#00FF00",       // 40% (Green)
          minElevation + (maxElevation - minElevation) * 0.6, "#FFFF00",       // 60% (Yellow)
          minElevation + (maxElevation - minElevation) * 0.8, "#FF0000",       // 80% (Red)
          maxElevation, "#800080"                                              // 100% (Purple)
        ];
      }
      
      // Add the layer with improved color mapping and PERSISTENCE
      this.map!.addLayer({
        id: sourceId,
        type: "fill",
        source: sourceId,
        layout: { 
          visibility: "visible" // FIXED: Ensure always visible when added
        },
        paint: {
          "fill-color": colorExpression,
          "fill-opacity": 0.7,  // Increased opacity for better visibility
          "fill-outline-color": [  // Add outline color for better cell connection
            "interpolate",
            ["linear"],
            ["get", "elevation"],
            minElevation, "#0000AA",  // Dark blue for low elevations
            maxElevation, "#550055"   // Dark purple for high elevations
          ]
        }
      }); 
      
      // FIXED: Properly register the layer for tracking
      this.registerLayer(sourceId, true);
      
      // Notify listeners
      this.notifyListeners('layerAdded', sourceId, true);
      
      console.log(`Successfully added terrain grid layer with ${features.length} features`);
      
      return true;
    } catch (error) {
      console.error("Error adding AO terrain grid:", error);
      return false;
    }
  }

    /**
   * Helper method to calculate median elevation from grid cells
   * @private
   */
  private calculateMedianElevation(cells: GridCell[]): number {
    // Extract all elevations and sort them
    const elevations = cells.map(cell => cell.properties.elevation).sort((a, b) => a - b);
    
    // Get the middle value
    const mid = Math.floor(elevations.length / 2);
    if (elevations.length % 2 === 0) {
      // Even number of elements - take the average of the two middle values
      return (elevations[mid - 1] + elevations[mid]) / 2;
    } else {
      // Odd number of elements - take the middle value
      return elevations[mid];
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
        if (bbox && bbox.length === 4) {
          this.map!.fitBounds(
            [
              [bbox[0], bbox[1]],
              [bbox[2], bbox[3]]
            ],
            { padding: 50, duration: 200 }
          );
          return true;
        }
      } catch (turfError) {
        console.warn("Turf bbox calculation failed, using manual calculation:", turfError);
        // manual calculation fallback
        
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
            { padding: 50, duration: 200 }
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
 * Debug method to check terrain layer status
 * Add this method to LayerManager class
 */
debugTerrainLayer(): void {
  if (!this.map) {
    console.log("No map available for debugging");
    return;
  }
  
  const layerId = MAP_LAYERS.AOTERRAIN_GRID;
  const hasSource = !!this.map.getSource(layerId);
  const hasLayer = !!this.map.getLayer(layerId);
  const visibility = hasLayer ? this.map.getLayoutProperty(layerId, 'visibility') : 'unknown';
  const isTracked = this.layers.has(layerId);
  
  console.log("Terrain Layer Debug:", {
    layerId,
    hasSource,
    hasLayer,
    visibility,
    isTracked,
    trackedVisibility: this.layers.get(layerId)
  });
  
  // Also check if source has data
  if (hasSource) {
    const source = this.map.getSource(layerId) as mapboxgl.GeoJSONSource;
    console.log("Source data available:", !!source._data);
  }
}

/**
 * Initialize Studio layers that already exist in the map style
 * Call this after map loads to register pre-existing layers
 */
initializeStudioLayers(): boolean {
  if (!this.ensureMap()) return false;
  
  try {
    // Check if forest-height layer exists in Studio style
    const forestLayer = this.map!.getLayer('forest-height');
    if (forestLayer) {
      // Start hidden and register with LayerManager
      this.map!.setLayoutProperty('forest-height', 'visibility', 'none');
      this.registerLayer('forest-height', false);
      console.log('✅ Registered Studio forest-height layer');
      return true;
    } else {
      console.warn('⚠️ forest-height layer not found in Studio style');
      return false;
    }
  } catch (error) {
    console.error('❌ Error initializing Studio layers:', error);
    return false;
  }
}

/**
 * Enhanced toggle for Studio layers that need special handling
 */
toggleStudioLayer(layerId: string): boolean {
  if (!this.ensureMap()) return false;
  
  try {
    if (!this.map!.getLayer(layerId)) {
      console.warn(`Studio layer ${layerId} does not exist`);
      return false;
    }
    
    // Get current actual visibility (not tracked state)
    const currentVisibility = this.map!.getLayoutProperty(layerId, 'visibility');
    const newVisibility = currentVisibility === 'visible' ? 'none' : 'visible';
    
    // Set new visibility
    this.map!.setLayoutProperty(layerId, 'visibility', newVisibility);
    
    // Move to top when making visible (for Studio layers)
    if (newVisibility === 'visible') {
      this.map!.moveLayer(layerId);
    }
    
    // Update tracking
    const isVisible = newVisibility === 'visible';
    this.layers.set(layerId, isVisible);
    this.notifyListeners('visibilityChange', layerId, isVisible);
    
    console.log(`✅ Studio layer ${layerId} toggled to: ${newVisibility}`);
    return true;
  } catch (error) {
    console.error(`❌ Error toggling Studio layer ${layerId}:`, error);
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