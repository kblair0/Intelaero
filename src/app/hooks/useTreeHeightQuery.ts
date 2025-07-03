/**
 * useTreeHeightQuery.ts
 * 
 * Purpose:
 * Hook for interactive tree height querying via map clicks.
 * Follows the useMeasurement pattern for consistent event handling
 * and provides click-to-query functionality for tree heights.
 * 
 * Related Files:
 * - useMeasurement.ts: Pattern reference for map interaction
 * - TreeHeightService.ts: Core service for tree height queries
 * - useTreeHeights.ts: Main tree height hook
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import { useMapContext } from '../context/mapcontext';
import mapboxgl from 'mapbox-gl';
import { trackEventWithForm as trackEvent } from '../components/tracking/tracking';
import type { TreeHeightQueryResult } from '../services/TreeHeightService';
import { useTreeHeights } from './useTreeHeights';

export const useTreeHeightQuery = () => {
  const { map, treeHeightService } = useMapContext();
  const [isQuerying, setIsQuerying] = useState(false);
  const [lastResult, setLastResult] = useState<TreeHeightQueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // - get tree layer visibility
  const { isVisible: isTreeLayerVisible } = useTreeHeights();
  
  // Use ref to maintain popup reference
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  /**
   * Format tree height result for display
   */
  const formatResult = useCallback((result: TreeHeightQueryResult): string => {
    switch (result.type) {
      case 'tree':
        return result.height !== null 
          ? `Tree Height: ${result.height.toFixed(1)}m`
          : 'Tree Height: No data';
      case 'water':
        return 'Water body';
      case 'snow':
        return 'Snow/Ice covered';
      case 'nodata':
      default:
        return 'No tree height data';
    }
  }, []);

  /**
   * Handle map click to query tree height
   */
  const handleClick = useCallback(async (e: mapboxgl.MapMouseEvent) => {
    if (!map || !isQuerying || !treeHeightService) return;
    
    const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    
    try {
      setError(null);
      
      // Query tree height at clicked location
      const result = await treeHeightService.queryTreeHeight(coordinates);
      setLastResult(result);
      
      // Remove existing popup
      if (popupRef.current) {
        popupRef.current.remove();
      }
      
      // Create new popup with result
      const popupContent = `
        <div style="padding: 8px; min-width: 160px;">
          <div style="font-weight: 600; margin-bottom: 4px; color: #1a202c;">
            🌲 Tree Height Query
          </div>
          <div style="font-size: 14px; color: #4a5568;">
            ${formatResult(result)}
          </div>
          <div style="font-size: 11px; color: #718096; margin-top: 4px;">
            ${coordinates[1].toFixed(4)}°, ${coordinates[0].toFixed(4)}°
          </div>
        </div>
      `;
      
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 25
      })
        .setLngLat(e.lngLat)
        .setHTML(popupContent)
        .addTo(map);
      
      // Auto-close popup after 5 seconds
      setTimeout(() => {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      }, 5000);
      
      trackEvent('tree_height_point_query', {
        coordinates,
        result: result.type,
        height: result.height
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error('Tree height query error:', error);
    }
  }, [map, isQuerying, treeHeightService, formatResult]);

  /**
   * Clear error and last result
   */
  const clearResults = useCallback(() => {
    setError(null);
    setLastResult(null);
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, []);

    // Auto-activate querying when tree layer is visible
  useEffect(() => {
    if (isTreeLayerVisible && map && treeHeightService) {
      // Auto-start querying when layer is visible
      setIsQuerying(true);
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = 'crosshair';
      }
      console.log('🌲 Auto-enabled tree height querying (layer visible)');
    } else {
      // Auto-stop when layer is hidden
      setIsQuerying(false);
      if (map && map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      console.log('🌲 Auto-disabled tree height querying (layer hidden)');
    }
  }, [isTreeLayerVisible, map, treeHeightService]);

  // Set up and clean up event listeners
  useEffect(() => {
    if (!map) return;
    
    if (isQuerying) {
      map.on('click', handleClick);
    }
    
    return () => {
      if (map) {
        map.off('click', handleClick);
      }
    };
  }, [map, isQuerying, handleClick]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, []);

  return {
    isQuerying,
    lastResult,
    error,
    clearResults,
    formatResult
  };
};