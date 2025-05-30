/**
 * useTreeHeights.ts
 * 
 * Purpose:
 * React hook that integrates the tree height visualization system with Mapbox.
 * Manages state, coordinates rendering, and provides clean interface to components.
 * 
 * This hook:
 * - Manages tree height visibility state
 * - Provides toggle functionality for UI components
 * - Handles click interactions for height queries
 * - Coordinates with Area of Operations boundaries
 * - Manages canvas lifecycle and cleanup
 * - Integrates with LayerManager for state tracking
 * 
 * Related Files:
 * - TreeHeightSystem.ts: Core rendering and tile management
 * - TreeHeightCanvas.ts: Canvas DOM management
 * - AreaOfOpsContext.tsx: AO boundary integration
 * - LayerManager.ts: Layer state management
 */
/**
 * useTreeHeights.ts - FIXED VERSION
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import { useAreaOfOpsContext } from '../context/AreaOfOpsContext';
import { layerManager } from '../services/LayerManager';
import { treeHeightSystem } from '../services/TreeHeightSystem';
import { TreeHeightCanvas } from '../services/TreeHeightCanvas';

type ExtendedMapboxMap = mapboxgl.Map & {
  __treeHeightsPopup?: mapboxgl.Popup | null;
};

interface UseTreeHeightsReturn {
  toggleTreeHeights: () => void;
  rerenderTreeHeights: () => void;
  handleTreeHeightClick: ((e: mapboxgl.MapMouseEvent) => void) | null;
  cleanup: () => void;
  isInitialized: boolean;
}

export function useTreeHeights(map: mapboxgl.Map | null): UseTreeHeightsReturn {
  const treeHeightVisibleRef = useRef<boolean>(false);
  const isRenderingRef = useRef<boolean>(false);
  const canvasInstanceRef = useRef<TreeHeightCanvas | null>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { aoGeometry } = useAreaOfOpsContext();

  // Check if point is within Area of Operations
  const isPointInAO = useCallback((lng: number, lat: number): boolean => {
    if (!aoGeometry || !aoGeometry.features || aoGeometry.features.length === 0) {
      return true; // If no AO defined, show everywhere
    }
    
    try {
      // Simple point-in-polygon check
      let minLng = Infinity, maxLng = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;
      
      aoGeometry.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach(coord => {
            minLng = Math.min(minLng, coord[0]);
            maxLng = Math.max(maxLng, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLat = Math.max(maxLat, coord[1]);
          });
        }
      });
      
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    } catch (error) {
      console.warn('Error checking point in AO:', error);
      return true;
    }
  }, [aoGeometry]);

  // Debounced render function
  const triggerRender = useCallback(() => {
    if (!map || !treeHeightVisibleRef.current || isRenderingRef.current) return;
    
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    
    renderTimeoutRef.current = setTimeout(async () => {
      if (!treeHeightVisibleRef.current || isRenderingRef.current) return;
      
      isRenderingRef.current = true;
      console.log("🎨 Starting tree height render");
      
      try {
        await treeHeightSystem.renderTreeHeights({
          isPointInAO,
          onProgress: (progress) => {
            console.log(`🎨 Render progress: ${Math.round(progress * 100)}%`);
          }
        });
        
        console.log("✅ Tree height render complete");
      } catch (error) {
        console.error("❌ Tree height render error:", error);
      } finally {
        isRenderingRef.current = false;
      }
    }, 300); // 300ms debounce
  }, [map, isPointInAO]);

  // SINGLE initialization useEffect - REMOVED DUPLICATE
  useEffect(() => {
  if (!map) return;

  // Initialize tree height system and canvas
  treeHeightSystem.initialize(map);
  canvasInstanceRef.current = new TreeHeightCanvas(map);
  layerManager.registerLayer("tree-height-raster", false);

  setIsInitialized(true);
  console.log("🌲 Tree height system initialized");

  // Simple cleanup
  return () => {
    console.log("🧹 Cleaning up tree heights initialization");
    if (canvasInstanceRef.current) {
      canvasInstanceRef.current.destroy();
      canvasInstanceRef.current = null;
    }
    treeHeightSystem.cleanup();
    setIsInitialized(false);
  };
  }, [map]); // Remove triggerRender dependency

  // Toggle tree heights visibility
  const toggleTreeHeights = useCallback(() => {
    if (!map || !canvasInstanceRef.current) {
      console.warn("Tree height system not initialized");
      return;
    }
    
    console.log('🌲 Toggle tree heights - current state:', treeHeightVisibleRef.current);
    
    treeHeightVisibleRef.current = !treeHeightVisibleRef.current;
    const newState = treeHeightVisibleRef.current;
    
    // Toggle canvas visibility
    canvasInstanceRef.current.setVisible(newState);
    
    // Update LayerManager state
    layerManager.setLayerVisibility("tree-height-raster", newState);
    
    // Trigger render if turning on
    if (newState) {
      console.log('🎨 Triggering initial render...');
      triggerRender();
    } else {
      // Clear canvas when turning off
      canvasInstanceRef.current.clear();
    }
    
    console.log('✅ Toggle complete - new state:', newState);
  }, [map, triggerRender]);

  // Manual re-render function
  const rerenderTreeHeights = useCallback(() => {
    if (treeHeightVisibleRef.current) {
      console.log('🔄 Manual re-render triggered');
      triggerRender();
    }
  }, [triggerRender]);

  // Handle tree height clicks
  const handleTreeHeightClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map || !treeHeightVisibleRef.current || !canvasInstanceRef.current) return;
    
    console.log('🖱️ Tree height click at:', e.lngLat);
    
    try {
      // Get height value at click point
      const heightValue = canvasInstanceRef.current.getHeightAtPoint(e.point.x, e.point.y);
      
      // Check if point is in AO
      const inAO = isPointInAO(e.lngLat.lng, e.lngLat.lat);
      
      let popupContent: string;
      
      if (!inAO) {
        popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <strong>🌲 Tree Height Data</strong><br/>
            <strong>Status:</strong> Outside Area of Operations<br/>
            <strong>Location:</strong> ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}
          </div>
        `;
      } else if (heightValue !== null && heightValue > 0) {
        popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <strong>🌲 Tree Height Data</strong><br/>
            <strong>Height:</strong> ${heightValue}m<br/>
            <strong>Location:</strong> ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}<br/>
            <strong>Canvas Coords:</strong> ${e.point.x}, ${e.point.y}
          </div>
        `;
      } else {
        popupContent = `
          <div style="padding: 8px; min-width: 200px;">
            <strong>🌲 Tree Height Data</strong><br/>
            <strong>Height:</strong> No trees detected<br/>
            <strong>Location:</strong> ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}<br/>
            <strong>Canvas Coords:</strong> ${e.point.x}, ${e.point.y}
          </div>
        `;
      }
      
      showTreePopup(e.lngLat, popupContent);
      
    } catch (clickError) {
      console.error('Tree height click error:', clickError);
      
      const errorContent = `
        <div style="padding: 8px;">
          <strong>🌲 Tree Height Error</strong><br/>
          <strong>Location:</strong> ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}<br/>
          <strong>Error:</strong> ${clickError instanceof Error ? clickError.message : String(clickError)}
        </div>
      `;
      
      showTreePopup(e.lngLat, errorContent);
    }
  }, [map, isPointInAO]);

  // Helper function to show popup
  const showTreePopup = useCallback((lngLat: mapboxgl.LngLat, content: string) => {
    if (!map) return;
    
    const extMap = map as ExtendedMapboxMap;
    
    // Remove existing popup
    if (extMap.__treeHeightsPopup) {
      extMap.__treeHeightsPopup.remove();
      extMap.__treeHeightsPopup = null;
    }
    
    // Create new popup - import mapbox-gl dynamically
    import("mapbox-gl").then((mapboxModule) => {
      const mapboxgl = mapboxModule.default;
      
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: "300px",
      })
        .setLngLat(lngLat)
        .setHTML(content)
        .addTo(map);
      
      extMap.__treeHeightsPopup = popup;
    });
  }, [map]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up tree heights system");
    
    // Clear render timeout
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
    
    // Reset state
    treeHeightVisibleRef.current = false;
    isRenderingRef.current = false;
    
    // Clean up canvas
    if (canvasInstanceRef.current) {
      canvasInstanceRef.current.destroy();
      canvasInstanceRef.current = null;
    }
    
    // Clean up popup
    if (map) {
      const extMap = map as ExtendedMapboxMap;
      if (extMap.__treeHeightsPopup) {
        extMap.__treeHeightsPopup.remove();
        extMap.__treeHeightsPopup = null;
      }
    }
    
    // Clean up tree height system
    treeHeightSystem.cleanup();
    
    console.log("✅ Tree heights cleanup complete");
  }, [map]);

  // Return hook interface
  return {
    toggleTreeHeights,
    rerenderTreeHeights,
    handleTreeHeightClick: map ? handleTreeHeightClick : null,
    cleanup,
    isInitialized,
  };
}