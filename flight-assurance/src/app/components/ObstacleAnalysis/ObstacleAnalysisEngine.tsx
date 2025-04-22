// src/services/ObstacleAnalysis/ObstacleAnalysisEngine.ts

export interface AnalysisOptions {
    samplingResolution: number;   // Distance between sampling points in meters
    verticalBuffer: number;       // Vertical safety margin in meters
    horizontalBuffer: number;     // Horizontal safety margin in meters
    maxDistance: number;          // Maximum distance to check for obstacles in meters
  }
  
  export interface ObstacleAnalysisResult {
    pointsOfInterest: PointOfInterest[];
    minimumClearance: number;
    criticalObstacles: CriticalObstacle[];
    samplePoints: SamplePoint[];
    layerResults: Map<string, LayerAnalysisResult>;
  }
  
  export interface PointOfInterest {
    type: 'collision' | 'minimumClearance' | 'waypoint';
    position: GeoJSON.Position;
    distanceFromStart: number;
    clearance: number;
    obstacleLayerId?: string;
    obstacleFeature?: GeoJSON.Feature;
  }
  
  export class ObstacleAnalysisEngine {
    constructor(private map: mapboxgl.Map) {}
    
    // Main analysis method
    async analyzeFlightPath(
      flightPath: GeoJSON.LineString,
      options: AnalysisOptions
    ): Promise<ObstacleAnalysisResult> {
      // 1. Get all active obstacle layers
      const activeLayers = obstacleRegistry.getActiveObstacleLayers();
      
      // 2. Sample points along flight path
      const samplePoints = this.samplePathPoints(flightPath, options.samplingResolution);
      
      // 3. Process terrain data (special case - always included)
      const terrainData = await this.processTerrainData(samplePoints);
      
      // 4. Analyze each obstacle layer
      const layerResults = new Map<string, LayerAnalysisResult>();
      for (const layer of activeLayers) {
        try {
          const result = await this.analyzeObstacleLayer(layer, samplePoints, options);
          layerResults.set(layer.id, result);
        } catch (error) {
          console.error(`Error analyzing obstacle layer ${layer.id}:`, error);
          // Continue with other layers even if one fails
        }
      }
      
      // 5. Combine results and find critical points
      const criticalObstacles = this.findCriticalObstacles(layerResults, terrainData);
      const pointsOfInterest = this.identifyPointsOfInterest(samplePoints, layerResults, terrainData);
      const minimumClearance = this.calculateMinimumClearance(pointsOfInterest);
      
      return {
        pointsOfInterest,
        minimumClearance,
        criticalObstacles,
        samplePoints,
        layerResults
      };
    }
    
    // Implementation details for helper methods...
    private samplePathPoints(path: GeoJSON.LineString, resolution: number): SamplePoint[] {
      // Implementation
    }
    
    private async processTerrainData(samplePoints: SamplePoint[]): Promise<TerrainData> {
      // Implementation using map.queryTerrainElevation
    }
    
    private async analyzeObstacleLayer(
      layer: ObstacleLayerConfig, 
      samplePoints: SamplePoint[],
      options: AnalysisOptions
    ): Promise<LayerAnalysisResult> {
      // Implementation - query features, calculate clearances
    }
    
    // Other helper methods
  }
  