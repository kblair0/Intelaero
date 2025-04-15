// src/hooks/useAreaOpsProcessor.ts
import { useCallback } from 'react';
import * as turf from '@turf/turf';
import { useAreaOfOpsContext } from '../context/AreaOfOpsContext';
import { useMapContext } from '../context/MapContext';
import { layerManager } from '../services/LayerManager';
import type { GridCell } from '../context/AreaOfOpsContext';

/**
 * A hook for processing Area of Operations data
 * Handles grid generation, elevation sampling, and map visualization
 */
export const useAreaOpsProcessor = () => {
  const { 
    aoGeometry, 
    setAoGeometry, 
    setAoTerrainGrid 
  } = useAreaOfOpsContext();
  
  const { map, terrainLoaded } = useMapContext();
  
  /**
   * Process KML text into an Area of Operations
   */
  const processKML = useCallback((kmlText: string) => {
    try {
      console.log("Processing KML text...");
      const parser = new DOMParser();
      const kmlDom = parser.parseFromString(kmlText, "text/xml");
      const coordsElement = kmlDom.querySelector("Polygon > outerBoundaryIs > LinearRing > coordinates");
    
      if (!coordsElement || !coordsElement.textContent) {
        throw new Error("No polygon coordinates found in KML");
      }
      
      const coordsText = coordsElement.textContent.trim();
      const coordinates = coordsText.split(/\s+/).map((pair) => {
        const [lon, lat] = pair.split(",").map(Number);
        return [lon, lat];
      });
    
      // Ensure the polygon is closed
      if (coordinates.length > 0) {
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push(first);
        }
      }
      
      // Create the polygon and its feature collection
      const polygon = turf.polygon([coordinates]);
      const featureCollection = turf.featureCollection([polygon]);
      
      console.log("Processed KML into polygon with coordinates:", coordinates.length);
      
      if (map && terrainLoaded) {
        setAoGeometry(featureCollection);
      } else {
        console.log("Waiting for map and terrain to load before setting AO");
        const checkReady = setInterval(() => {
          if (map && terrainLoaded) {
            setAoGeometry(featureCollection);
            clearInterval(checkReady);
          }
        }, 100);
      }
      
      // Render on map if available
      if (map && terrainLoaded) {
        // Add to map via layer manager
        layerManager.addAreaOfOperations(featureCollection);
        layerManager.fitToAreaOfOperations(featureCollection);
      }
      
      return featureCollection;
    } catch (error) {
      console.error("Error processing KML:", error);
      throw error;
    }
  }, [map, terrainLoaded, setAoGeometry]);
  
  /**
   * Generate a terrain grid for the Area of Operations
   */
  const generateTerrainGrid = useCallback(async (gridSize = 30) => {
    if (!aoGeometry) {
      console.error("Cannot generate terrain grid: Missing AO geometry");
      return null;
    }
    
    if (!map) {
      console.error("Cannot generate terrain grid: Map not available");
      return null;
    }
    
    if (!terrainLoaded) {
      console.error("Cannot generate terrain grid: Terrain Not Available");
      return null;
    }
    
    try {
      console.log("Generating AO terrain grid...");
      
      // Check if aoGeometry has features
      if (!aoGeometry.features || aoGeometry.features.length === 0) {
        console.error("Cannot generate terrain grid: AO geometry has no features");
        return null;
      }
      
      const sourceGeometry = aoGeometry.features[0];
      
      // Generate point grid
      const bbox = turf.bbox(sourceGeometry);
      const grid = turf.pointGrid(bbox, gridSize, {
        units: "meters",
        mask: sourceGeometry,
      });
      
      // Generate cells with error handling
      const cells: GridCell[] = [];
      
      for (let i = 0; i < grid.features.length; i++) {
        const point = grid.features[i];
        try {
          const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
            units: "meters",
            steps: 4,
          });
          const center = turf.center(cell.geometry);
          
          // Query elevation with error handling
          let elevation = 0;
          try {
            elevation = map.queryTerrainElevation(center.geometry.coordinates as [number, number]) ?? 0;
          } catch (elevationError) {
            console.warn(`Error querying elevation for cell ${i}:`, elevationError);
          }
          
          cells.push({
            id: `terrain-cell-${i}`,
            geometry: cell.geometry as GeoJSON.Polygon,
            properties: {
              elevation,
              lastAnalyzed: Date.now(),
            },
          });
        } catch (cellError) {
          console.warn(`Error generating cell ${i}:`, cellError);
        }
      }
      
      console.log(`Generated terrain grid with ${cells.length} cells`);
      
      // Update context
      setAoTerrainGrid(cells);
      
      // Add to map via layer manager
      layerManager.addAreaOfOperationsTerrain(cells);
      
      return cells;
    } catch (error) {
      console.error("Error generating terrain grid:", error);
      return null;
    }
  }, [aoGeometry, map, terrainLoaded, setAoTerrainGrid]);
  
  /**
   * Process an existing AO geometry or generate a new one from a flight plan
   */
  const processAreaOfOperations = useCallback(async () => {
    if (!map || !terrainLoaded) {
      console.error("Map not available for AO processing");
      return false;
    }
    
    if (aoGeometry) {
      // Render existing AO on map
      layerManager.addAreaOfOperations(aoGeometry);
      layerManager.fitToAreaOfOperations(aoGeometry);
      
      // Generate terrain grid
      await generateTerrainGrid();
      return true;
    }
    
    console.error("No AO geometry available to process");
    return false;
  }, [aoGeometry, map, terrainLoaded, generateTerrainGrid]);
  
  return {
    processKML,
    generateTerrainGrid,
    processAreaOfOperations
  };
};