/**
 * ObstacleRegistry.ts
 * 
 * Purpose:
 * This service provides a registry for obstacle layers that can be used in obstacle analysis.
 * It enables a flexible system where different types of obstacles (terrain, powerlines, etc.)
 * can be registered, configured, and managed centrally.
 * 
 * The registry allows for:
 * - Registering obstacle layer configurations
 * - Managing which layers are active for analysis
 * - Retrieving layer configurations for analysis and visualization
 * 
 * Initially, this is a simplified version focused on terrain analysis, but it's designed
 * to be extended for additional obstacle types in the future.
 * 
 * Related Files:
 * - ObstacleAnalysisContext.tsx: Uses registered layers for analysis
 * - useFlightPathSampling.ts: Provides data that obstacle analyzers use
 */

/**
 * Configuration for an obstacle layer
 */
export interface ObstacleLayerConfig {
    id: string;                   // Unique identifier
    name: string;                 // Display name
    type: 'terrain' | 'powerline' | 'vegetation' | 'airfield' | 'custom'; // Obstacle type
    heightProperty?: string;      // Property containing height/elevation data
    heightFunction?: (feature: GeoJSON.Feature) => number; // Custom height extraction
    bufferDistance?: number;      // Horizontal buffer in meters
    priority: number;             // For determining which obstacle takes precedence
    category: string;             // For grouping related obstacles
    colorCode: string;            // For visualization
    active: boolean;              // Whether to include in analysis
  }
  
  /**
   * Registry service for obstacle layers
   */
  class ObstacleRegistryService {
    private obstacleLayers: Map<string, ObstacleLayerConfig> = new Map();
    
    constructor() {
      // Register the built-in terrain layer by default
      this.registerObstacleLayer({
        id: 'terrain',
        name: 'Terrain',
        type: 'terrain',
        priority: 10,
        category: 'Terrain',
        colorCode: 'rgba(75,192,192,1)',
        active: true
      });
    }
    
    /**
     * Register a new obstacle layer
     * @param config Configuration for the obstacle layer
     */
    registerObstacleLayer(config: ObstacleLayerConfig): void {
      this.obstacleLayers.set(config.id, config);
    }
    
    /**
     * Update an existing obstacle layer
     * @param id ID of the layer to update
     * @param config Partial configuration to update
     * @returns Whether the update was successful
     */
    updateObstacleLayer(id: string, config: Partial<ObstacleLayerConfig>): boolean {
      if (!this.obstacleLayers.has(id)) return false;
      const currentConfig = this.obstacleLayers.get(id)!;
      this.obstacleLayers.set(id, { ...currentConfig, ...config });
      return true;
    }
    
    /**
     * Get all registered obstacle layers
     * @returns Array of obstacle layer configurations
     */
    getObstacleLayers(): ObstacleLayerConfig[] {
      return Array.from(this.obstacleLayers.values());
    }
    
    /**
     * Get layers that are active for analysis
     * @returns Array of active obstacle layer configurations
     */
    getActiveObstacleLayers(): ObstacleLayerConfig[] {
      return this.getObstacleLayers().filter(layer => layer.active);
    }
    
    /**
     * Get layers of a specific category
     * @param category Category to filter by
     * @returns Array of obstacle layer configurations in the category
     */
    getObstacleLayersByCategory(category: string): ObstacleLayerConfig[] {
      return this.getObstacleLayers().filter(layer => layer.category === category);
    }
    
    /**
     * Get a specific layer by ID
     * @param id ID of the layer to retrieve
     * @returns The layer configuration, or undefined if not found
     */
    getObstacleLayer(id: string): ObstacleLayerConfig | undefined {
      return this.obstacleLayers.get(id);
    }
    
    /**
     * Remove a layer from the registry
     * @param id ID of the layer to remove
     * @returns Whether the removal was successful
     */
    removeObstacleLayer(id: string): boolean {
      return this.obstacleLayers.delete(id);
    }
    
    /**
     * Set whether a layer is active for analysis
     * @param id ID of the layer
     * @param active Whether the layer should be active
     * @returns Whether the update was successful
     */
    setLayerActive(id: string, active: boolean): boolean {
      return this.updateObstacleLayer(id, { active });
    }
  }
  
  // Export singleton instance
  export const obstacleRegistry = new ObstacleRegistryService();