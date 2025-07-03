/**
 * Enhanced useTreeHeights.ts
 * 
 * Purpose:
 * Comprehensive tree height management hook that provides both display
 * and analysis functionality. Integrates with TreeHeightService for
 * querying capabilities while maintaining existing toggle functionality.
 * 
 * Related Files:
 * - TreeHeightService.ts: Core service for tree height querying
 * - LayerManager.ts: Manages tree height layer visibility
 * - AreaOfOpsContext.tsx: Provides AO geometry for analysis
 * - TerrainAnalysisDashboard.tsx: Uses queryTreeHeightsInAO function
 */

import { useCallback, useState } from 'react';
import { useMapContext } from '../context/mapcontext';
import { useAreaOfOpsContext } from '../context/AreaOfOpsContext';
import type { TreeHeightQueryResultsData } from '../services/TreeHeightService';
import { layerManager, MAP_LAYERS } from '../services/LayerManager';

export function useTreeHeights() {
  const { toggleLayer, layerVisibility, treeHeightService } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const [error, setError] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  
/**
 * Toggle tree height layer visibility (optimized for Studio layers)
 */
const toggleTreeHeights = useCallback(async () => {
  console.log('🌲 Toggling tree heights via LayerManager (Studio layer)');
  try {
    setError(null);
    
    // Since this is a Studio layer, use the Studio-optimized toggle
    const success = layerManager.toggleStudioLayer(MAP_LAYERS.TREE_HEIGHTS);
    
    if (!success) {
      // Fallback to regular toggle if Studio toggle fails
      console.log('🌲 Studio toggle failed, using regular toggle as fallback');
      toggleLayer(MAP_LAYERS.TREE_HEIGHTS);
    }
    
  } catch (error) {
    const errorMessage = `Failed to toggle tree heights: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('🌲', errorMessage);
    setError(errorMessage);
  }
}, [toggleLayer]);

/**
 * Query tree heights within the Area of Operations
 */
const queryTreeHeightsInAO = useCallback(async (): Promise<TreeHeightQueryResultsData | null> => {
  console.log('🌲 Starting tree height analysis in AO');
  
  if (!treeHeightService) {
    const errorMsg = 'Tree height service not available';
    console.error('🌲', errorMsg);
    setError(errorMsg);
    return null;
  }
  
  if (!aoGeometry || !aoGeometry.features.length) {
    const errorMsg = 'No Area of Operations defined';
    console.error('🌲', errorMsg);
    setError(errorMsg);
    return null;
  }
  
  try {
    setIsQuerying(true);
    setError(null);
    
    console.log('🌲 Calling treeHeightService.analyzeTreeHeightsInAO');
    const result = await treeHeightService.analyzeTreeHeightsInAO(
      aoGeometry,
      100, // 100m grid size
      (progress) => {
        console.log(`🌲 Analysis progress: ${progress}%`);
      }
    );
    
    console.log('🌲 Tree height analysis complete:', result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during tree height analysis';
    console.error('🌲 Tree height analysis error:', errorMessage);
    setError(errorMessage);
    return null;
  } finally {
    setIsQuerying(false);
  }
}, [treeHeightService, aoGeometry]);

  /**
   * Get tree height at a specific coordinate
   * Useful for click-to-query functionality
   */
  const queryTreeHeightAtPoint = useCallback(async (
    coordinates: [number, number]
  ) => {
    if (!treeHeightService) {
      throw new Error('Tree height service not available');
    }
    
    try {
      const result = await treeHeightService.queryTreeHeight(coordinates);
      return result;
    } catch (error) {
      console.error('Error querying tree height at point:', error);
      throw error;
    }
  }, [treeHeightService]);

  /**
   * Clear any errors
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isVisible = layerVisibility[MAP_LAYERS.TREE_HEIGHTS] || false;

  return {
    // Existing functionality (unchanged)
    toggleTreeHeights,
    isVisible,
    error,
    clearError,
    
    // New functionality for the dashboard
    queryTreeHeightsInAO,
    isQuerying,
    
    // Additional utilities
    queryTreeHeightAtPoint
  };
}