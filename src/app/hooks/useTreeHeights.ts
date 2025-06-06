/**
 * useTreeHeights.ts
 * 
 * Purpose:
 * React hook that integrates the tree height visualization system with Mapbox.
 * Uses LAZY INITIALIZATION - systems only initialize when user first activates them.
 * 
 * This hook:
 * - Manages tree height visibility state
 * - Provides toggle functionality for UI components
 * - Handles click interactions with subtle tooltip
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

import { useRef, useCallback, useState, useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import { useAreaOfOpsContext } from '../context/AreaOfOpsContext';
import { layerManager } from '../services/LayerManager';
import { treeHeightSystem } from '../services/TreeHeightSystem';
import { TreeHeightCanvas } from '../services/TreeHeightCanvas';

interface UseTreeHeightsReturn {
  toggleTreeHeights: () => void;
  rerenderTreeHeights: () => void;
  handleTreeHeightClick: ((e: mapboxgl.MapMouseEvent) => void) | null;
  cleanup: () => void;
  isInitialized: boolean;
}

export function useTreeHeights(map: mapboxgl.Map | null): UseTreeHeightsReturn {
  // State management
  const treeHeightVisibleRef = useRef<boolean>(false);
  const isRenderingRef = useRef<boolean>(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Lazy initialization refs - systems only created when needed
  const systemsRef = useRef<{
    canvas: TreeHeightCanvas | null;
    systemInitialized: boolean;
  }>({
    canvas: null,
    systemInitialized: false
  });
  
  const { aoGeometry } = useAreaOfOpsContext();

  // Check if point is within Area of Operations
  const isPointInAO = useCallback((lng: number, lat: number): boolean => {
    if (!aoGeometry || !aoGeometry.features || aoGeometry.features.length === 0) {
      return true;
    }
    
    try {
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

  // Lazy initialization - only create systems when first needed
  const ensureSystemsInitialized = useCallback(() => {
    if (!map || systemsRef.current.systemInitialized) return;
    
    treeHeightSystem.initialize(map);
    systemsRef.current.canvas = new TreeHeightCanvas(map);
    systemsRef.current.systemInitialized = true;
  }, [map]);

  // Debounced render function
  const triggerRender = useCallback(() => {
    if (!map || !treeHeightVisibleRef.current || isRenderingRef.current) return;
    
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    
    renderTimeoutRef.current = setTimeout(async () => {
      if (!treeHeightVisibleRef.current || isRenderingRef.current) return;
      
      isRenderingRef.current = true;
      
      try {
        await treeHeightSystem.renderTreeHeights({
          isPointInAO,
          onProgress: (progress) => {
            // Optional: Log progress for debugging
          }
        });
      } catch (error) {
        console.error("Tree height render error:", error);
      } finally {
        isRenderingRef.current = false;
      }
    }, 300);
  }, [map, isPointInAO]);

  // Lightweight initialization - only register layer capability
  useEffect(() => {
    if (!map) return;

    layerManager.registerLayer("tree-height-raster", false);
    setIsInitialized(true);

    return () => {
      if (systemsRef.current.canvas) {
        systemsRef.current.canvas.destroy();
        systemsRef.current.canvas = null;
      }
      if (systemsRef.current.systemInitialized) {
        treeHeightSystem.cleanup();
        systemsRef.current.systemInitialized = false;
      }
      setIsInitialized(false);
    };
  }, [map]);

  // Toggle tree heights visibility
  const toggleTreeHeights = useCallback(() => {
    if (!map) {
      console.warn("Map not available");
      return;
    }
    
    // Lazy initialization on first use
    ensureSystemsInitialized();
    
    if (!systemsRef.current.canvas) {
      console.error("Failed to initialize tree height systems");
      return;
    }
    
    treeHeightVisibleRef.current = !treeHeightVisibleRef.current;
    const newState = treeHeightVisibleRef.current;
    
    systemsRef.current.canvas.setVisible(newState);
    layerManager.setLayerVisibility("tree-height-raster", newState);
    
    if (newState) {
      triggerRender();
    } else {
      systemsRef.current.canvas.clear();
    }
  }, [map, ensureSystemsInitialized, triggerRender]);

  // Helper function to show subtle tooltip
  const showSubtleTooltip = useCallback((content: string) => {
    if (!map) return;
    
    const mapContainer = map.getContainer();
    
    // Remove existing tooltip
    const existingTooltip = mapContainer.querySelector('[data-tree-tooltip]');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // Create subtle corner tooltip
    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-tree-tooltip', 'true');
    tooltip.innerHTML = content;
    
    Object.assign(tooltip.style, {
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'system-ui, sans-serif',
      zIndex: '1000',
      maxWidth: '200px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease',
      opacity: '0'
    });
    
    mapContainer.appendChild(tooltip);
    
    // Fade in
    requestAnimationFrame(() => {
      tooltip.style.opacity = '1';
    });
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      if (tooltip.parentNode) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
          }
        }, 200);
      }
    }, 3000);
  }, [map]);

  // Manual re-render function
  const rerenderTreeHeights = useCallback(() => {
    if (treeHeightVisibleRef.current) {
      triggerRender();
    }
  }, [triggerRender]);

  // Handle tree height clicks
  const handleTreeHeightClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map || !treeHeightVisibleRef.current || !systemsRef.current.canvas) return;
    
    try {
      const heightValue = systemsRef.current.canvas.getHeightAtPoint(e.point.x, e.point.y);
      const inAO = isPointInAO(e.lngLat.lng, e.lngLat.lat);
      
      let tooltipContent: string;
      
      if (!inAO) {
        tooltipContent = `
          <div>
            <strong>🌲 Outside Area</strong><br/>
            ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}
          </div>
        `;
      } else if (heightValue !== null && heightValue > 0) {
        tooltipContent = `
          <div>
            <strong>🌲 Tree Height: ${heightValue}m</strong><br/>
            ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}
          </div>
        `;
      } else {
        tooltipContent = `
          <div>
            <strong>🌲 No Trees</strong><br/>
            ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}
          </div>
        `;
      }
      
      showSubtleTooltip(tooltipContent);
      
    } catch (clickError) {
      console.error('Tree height click error:', clickError);
      showSubtleTooltip(`
        <div>
          <strong>🌲 Error</strong><br/>
          ${clickError instanceof Error ? clickError.message : 'Unknown error'}
        </div>
      `);
    }
  }, [map, isPointInAO, showSubtleTooltip]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
    
    treeHeightVisibleRef.current = false;
    isRenderingRef.current = false;
    
    if (systemsRef.current.canvas) {
      systemsRef.current.canvas.destroy();
      systemsRef.current.canvas = null;
    }

    // Clean up tooltip
    const mapContainer = map?.getContainer();
    if (mapContainer) {
      const tooltip = mapContainer.querySelector('[data-tree-tooltip]');
      if (tooltip) {
        tooltip.remove();
      }
    }
    
    if (systemsRef.current.systemInitialized) {
      treeHeightSystem.cleanup();
      systemsRef.current.systemInitialized = false;
    }
  }, [map]);

  return {
    toggleTreeHeights,
    rerenderTreeHeights,
    handleTreeHeightClick: map ? handleTreeHeightClick : null,
    cleanup,
    isInitialized,
  };
}