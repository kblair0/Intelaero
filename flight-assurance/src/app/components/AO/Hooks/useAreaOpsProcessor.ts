// src/components/AO/Hooks/useAreaOpsProcessor.ts
import { useCallback } from 'react';
import * as turf from '@turf/turf';
import cleanCoords from '@turf/clean-coords';
import { useAreaOfOpsContext } from '../../../context/AreaOfOpsContext';
import { useMapContext } from '../../../context/mapcontext';
import { layerManager } from '../../../services/LayerManager';
import type { GridCell } from '../../../context/AreaOfOpsContext';
import type { FlightPlanData } from '../../../context/FlightPlanContext';

export const useAreaOpsProcessor = () => {
  const { 
    aoGeometry, 
    setAoGeometry, 
    setAoTerrainGrid,
    bufferDistance
  } = useAreaOfOpsContext();
  
  const { map, terrainLoaded } = useMapContext();

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
    
      if (coordinates.length > 0) {
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push(first);
        }
      }
      
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
      
      if (map && terrainLoaded) {
        layerManager.addAreaOfOperations(featureCollection);
        layerManager.fitToAreaOfOperations(featureCollection);
      }
      
      return featureCollection;
    } catch (error) {
      console.error("Error processing KML:", error);
      throw error;
    }
  }, [map, terrainLoaded, setAoGeometry]);

  const generateAOFromFlightPlan = useCallback(
    (flightPlan: FlightPlanData, makeVisible = false) => {
      console.log("Generating AO from flight plan...");
      
      if (!flightPlan?.features?.[0]?.geometry?.coordinates) {
        console.error("Invalid flight plan data for AO generation");
        return null;
      }
      
      try {
        const coordinates = flightPlan.features[0].geometry.coordinates;
        console.log("Flight plan coordinates:", JSON.stringify(coordinates));
        
        // Validate coordinates
        if (coordinates.length < 2) {
          console.error("Insufficient coordinates for LineString:", coordinates);
          return null;
        }
        const invalidCoords = coordinates.find(
          ([lon, lat]) => isNaN(lon) || isNaN(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90
        );
        if (invalidCoords) {
          console.error("Invalid coordinates detected:", invalidCoords);
          return null;
        }
        
        const line = turf.lineString(coordinates.map(coord => [coord[0], coord[1]]));
        const cleanedLine = cleanCoords(line);
        
        const buffered = turf.buffer(cleanedLine, bufferDistance / 1000, { units: 'kilometers' });
        
        const featureCollection = turf.featureCollection([buffered]);
        
        console.log(`Generated AO from flight plan with ${coordinates.length} points and ${bufferDistance}m buffer`);
        
        setAoGeometry(featureCollection);
        
        if (map && terrainLoaded) {
          if (makeVisible) {
            layerManager.addAreaOfOperations(featureCollection);
          } else {
            layerManager.addAreaOfOperations(featureCollection);
            layerManager.setLayerVisibility(layerManager.MAP_LAYERS.AREA_OF_OPERATIONS_FILL, false);
            layerManager.setLayerVisibility(layerManager.MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE, false);
          }
        }
        
        return featureCollection;
      } catch (error) {
        console.warn("Failed to generate AO, proceeding without AO:", error);
        setAoGeometry(null);
        return null;
      }
    },
    [map, terrainLoaded, setAoGeometry, bufferDistance]
  );

  const showAreaOfOperations = useCallback(() => {
    if (!map || !aoGeometry) return false;
    
    try {
      layerManager.setLayerVisibility(layerManager.MAP_LAYERS.AREA_OF_OPERATIONS_FILL, true);
      layerManager.setLayerVisibility(layerManager.MAP_LAYERS.AREA_OF_OPERATIONS_OUTLINE, true);
      return true;
    } catch (error) {
      console.error("Error showing Area of Operations:", error);
      return false;
    }
  }, [map, aoGeometry]);

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
      
      showAreaOfOperations();
      
      if (!aoGeometry.features || aoGeometry.features.length === 0) {
        console.error("Cannot generate terrain grid: AO geometry has no features");
        return null;
      }
      
      const sourceGeometry = aoGeometry.features[0];
      
      const bbox = turf.bbox(sourceGeometry);
      const grid = turf.pointGrid(bbox, gridSize, {
        units: "meters",
        mask: sourceGeometry,
      });
      
      const cells: GridCell[] = [];
      
      for (let i = 0; i < grid.features.length; i++) {
        const point = grid.features[i];
        try {
          const cell = turf.circle(point.geometry.coordinates, gridSize / 2, {
            units: "meters",
            steps: 4,
          });
          const center = turf.center(cell.geometry);
          
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
      
      setAoTerrainGrid(cells);
      
      layerManager.addAreaOfOperationsTerrain(cells);
      
      return cells;
    } catch (error) {
      console.error("Error generating terrain grid:", error);
      return null;
    }
  }, [aoGeometry, map, terrainLoaded, setAoTerrainGrid, showAreaOfOperations]);

  const processAreaOfOperations = useCallback(async () => {
    if (!map || !terrainLoaded) {
      console.error("Map not available for AO processing");
      return false;
    }
    
    if (aoGeometry) {
      layerManager.addAreaOfOperations(aoGeometry);
      layerManager.fitToAreaOfOperations(aoGeometry);
      
      await generateTerrainGrid();
      return true;
    }
    
    console.error("No AO geometry available to process");
    return false;
  }, [aoGeometry, map, terrainLoaded, generateTerrainGrid]);

  return {
    processKML,
    generateAOFromFlightPlan,
    generateTerrainGrid,
    processAreaOfOperations,
    showAreaOfOperations
  };
};