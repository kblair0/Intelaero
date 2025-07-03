/**
 * TreeHeightContext.tsx
 * 
 * Purpose:
 * Global context for managing tree height modal state and functionality.
 * Lifts modal state from TerrainAnalysisDashboard to enable full-screen rendering at Map level.
 * 
 * State Management:
 * - Modal visibility and results data
 * - Query functionality and loading states
 * - Error handling for tree height operations
 * 
 * Related Files:
 * - Map/index.tsx: Renders modal using this context
 * - TerrainAnalysisDashboard.tsx: Triggers modal via context
 * - useTreeHeights.ts: Integrated with context functionality
 * - TreeHeightQueryResults.tsx: Modal component
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useTreeHeights } from '../hooks/useTreeHeights';
import type { TreeHeightQueryResultsData } from '../services/TreeHeightService';

interface TreeHeightContextType {
  // Modal state
  treeHeightResults: TreeHeightQueryResultsData | null;
  showTreeHeightModal: boolean;
  
  // Actions
  showModal: (results: TreeHeightQueryResultsData) => void;
  hideModal: () => void;
  queryTreeHeightsInAO: () => Promise<void>;
  
  // Hook functionality pass-through
  toggleTreeHeights: () => Promise<void>;
  isVisible: boolean;
  isQuerying: boolean;
  error: string | null;
  clearError: () => void;
}

const TreeHeightContext = createContext<TreeHeightContextType | undefined>(undefined);

export const useTreeHeightContext = () => {
  const context = useContext(TreeHeightContext);
  if (!context) {
    throw new Error('useTreeHeightContext must be used within TreeHeightProvider');
  }
  return context;
};

interface TreeHeightProviderProps {
  children: ReactNode;
}

export const TreeHeightProvider: React.FC<TreeHeightProviderProps> = ({ children }) => {
  // Modal state
  const [treeHeightResults, setTreeHeightResults] = useState<TreeHeightQueryResultsData | null>(null);
  const [showTreeHeightModal, setShowTreeHeightModal] = useState(false);
  
  // Use the existing hook for core functionality
  const {
    toggleTreeHeights,
    isVisible,
    isQuerying,
    error,
    clearError,
    queryTreeHeightsInAO: hookQueryTreeHeights
  } = useTreeHeights();

  // Modal management
  const showModal = useCallback((results: TreeHeightQueryResultsData) => {
    setTreeHeightResults(results);
    setShowTreeHeightModal(true);
  }, []);

  const hideModal = useCallback(() => {
    setShowTreeHeightModal(false);
    // Don't clear results immediately to allow for re-opening
  }, []);

  // Enhanced query function that manages modal state
  const queryTreeHeightsInAO = useCallback(async () => {
    try {
      const result = await hookQueryTreeHeights();
      if (result) {
        showModal(result);
      }
    } catch (error) {
      console.error('Tree height query failed:', error);
      // Error is already handled by the hook
    }
  }, [hookQueryTreeHeights, showModal]);

  const value: TreeHeightContextType = {
    // Modal state
    treeHeightResults,
    showTreeHeightModal,
    
    // Actions
    showModal,
    hideModal,
    queryTreeHeightsInAO,
    
    // Hook functionality pass-through
    toggleTreeHeights,
    isVisible,
    isQuerying,
    error,
    clearError
  };

  return (
    <TreeHeightContext.Provider value={value}>
      {children}
    </TreeHeightContext.Provider>
  );
};