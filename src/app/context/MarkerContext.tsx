// src/app/context/MarkerContext.tsx

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { LocationData } from '../types/LocationData';
import { v4 as uuidv4 } from 'uuid';
import { usePremium, TierLevel } from './PremiumContext';
import { TIER_CONFIG } from '../utils/premiumConfig'; // Import TIER_CONFIG directly

// Define marker types for type safety
export type MarkerType = 'gcs' | 'observer' | 'repeater';

// Define tower metadata interface
export interface TowerMetadata {
  originalTowerId?: string;
  carrier?: string;
  technology?: string;
  frequency?: string;
  height?: number;
  azimuth?: number;
  tilt?: number;
  eirp?: number;
  eirp_unit?: string;
}

// Extended interface for markers with ID and type
export interface Marker {
  id: string;
  type: MarkerType;
  location: LocationData;
  elevationOffset: number;
  // Add optional tower metadata for tower-derived markers
  towerMetadata?: TowerMetadata;
}

// Add return type for addMarker
interface AddMarkerResult {
  success: boolean;
  markerId?: string;
  error?: string;
}

// Context interface
interface MarkerContextType {
  // Core marker collection
  markers: Marker[];
  
  // Marker management functions
  addMarker: (type: MarkerType, location: LocationData, towerMetadata?: TowerMetadata) => AddMarkerResult;
  updateMarker: (id: string, updates: Partial<Marker>) => void;
  removeMarker: (id: string) => void;
  
  // Type-specific elevation offset defaults
  defaultElevationOffsets: Record<MarkerType, number>;
  setDefaultElevationOffset: (type: MarkerType, offset: number) => void;
  
  // Helper methods
  getMarkersByType: (type: MarkerType) => Marker[];
  
  // ADDED: Properties expected by useGridAnalysis
  gcsLocation: LocationData | null;
  observerLocation: LocationData | null;
  repeaterLocation: LocationData | null;
  gcsElevationOffset: number;
  observerElevationOffset: number;
  repeaterElevationOffset: number;
}

const MarkerContext = createContext<MarkerContextType | undefined>(undefined);

/**
 * Provider component for marker management
 */
export function MarkerProvider({ children }: { children: ReactNode }) {
  // Core state: collection of all markers
  const [markers, setMarkers] = useState<Marker[]>([]);
  
  // Default elevation offsets for each marker type
  const [defaultElevationOffsets, setDefaultElevationOffsets] = useState<Record<MarkerType, number>>({
    gcs: 2,
    observer: 2,
    repeater: 2
  });

  // Get premium context
  const { tierLevel, getTierName } = usePremium();

  /**
   * Adds a new marker of specified type if allowed by tier limitations
   * @param type The marker type (gcs, observer, repeater)
   * @param location The geographic location of the marker
   * @param towerMetadata Optional metadata if marker is derived from a tower
   * @returns Object with success status and either marker ID or error message
   */
  const addMarker = (
    type: MarkerType, 
    location: LocationData, 
    towerMetadata?: TowerMetadata
  ): AddMarkerResult => {
    // Get current count of markers of this type
    const typeCount = markers.filter(m => m.type === type).length;
    
    // Get the maximum allowed for this marker type at current tier
    const maxAllowed = TIER_CONFIG[tierLevel].maxMarkers[type];
    
    // Check if adding this marker is allowed by tier limitations
    if (typeCount >= maxAllowed) {
      const tierName = getTierName();
      
      // Create a user-friendly error message based on the limitation
      let errorMessage = '';
      if (maxAllowed === 0) {
        // This marker type is not available at this tier
        errorMessage = `${tierName} tier doesn't support ${type} markers. Upgrade to add this marker type.`;
      } else {
        // User has reached their limit for this marker type
        errorMessage = `${tierName} tier allows only ${maxAllowed} ${type} marker(s). Upgrade to add more.`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
    
    // If we get here, adding the marker is allowed
    const id = uuidv4();
    const newMarker: Marker = {
      id,
      type,
      location,
      elevationOffset: defaultElevationOffsets[type],
      // Include tower metadata if provided
      ...(towerMetadata && { towerMetadata })
    };
    
    setMarkers(prev => [...prev, newMarker]);
    
    return {
      success: true,
      markerId: id
    };
  };

  // Update an existing marker
  const updateMarker = (id: string, updates: Partial<Marker>): void => {
    setMarkers(prev => 
      prev.map(marker => {
        if (marker.id === id) {
          // Handle special case for towerMetadata to merge it properly
          if (updates.towerMetadata && marker.towerMetadata) {
            return { 
              ...marker, 
              ...updates, 
              towerMetadata: {
                ...marker.towerMetadata,
                ...updates.towerMetadata
              }
            };
          }
          return { ...marker, ...updates };
        }
        return marker;
      })
    );
  };

  // Remove a marker by ID
  const removeMarker = (id: string): void => {
    setMarkers(prev => prev.filter(marker => marker.id !== id));
  };

  // Set the default elevation offset for a marker type
  const setDefaultElevationOffset = (type: MarkerType, offset: number): void => {
    setDefaultElevationOffsets(prev => ({
      ...prev,
      [type]: offset
    }));
    
    // Also update any existing markers of this type
    setMarkers(prev => 
      prev.map(marker => 
        marker.type === type ? { ...marker, elevationOffset: offset } : marker
      )
    );
  };

  // Get markers filtered by type
  const getMarkersByType = (type: MarkerType): Marker[] => {
    return markers.filter(m => m.type === type);
  };

  // ADDED: Computed properties for backward compatibility
  const gcsLocation = markers.find(m => m.type === 'gcs')?.location || null;
  const observerLocation = markers.find(m => m.type === 'observer')?.location || null;
  const repeaterLocation = markers.find(m => m.type === 'repeater')?.location || null;
  
  const gcsElevationOffset = markers.find(m => m.type === 'gcs')?.elevationOffset || defaultElevationOffsets.gcs;
  const observerElevationOffset = markers.find(m => m.type === 'observer')?.elevationOffset || defaultElevationOffsets.observer;
  const repeaterElevationOffset = markers.find(m => m.type === 'repeater')?.elevationOffset || defaultElevationOffsets.repeater;

  return (
    <MarkerContext.Provider
      value={{
        markers,
        addMarker,
        updateMarker,
        removeMarker,
        defaultElevationOffsets,
        setDefaultElevationOffset,
        getMarkersByType,
        // ADDED: Computed properties
        gcsLocation,
        observerLocation,
        repeaterLocation,
        gcsElevationOffset,
        observerElevationOffset,
        repeaterElevationOffset
      }}
    >
      {children}
    </MarkerContext.Provider>
  );
}

/**
 * Custom hook to access marker context
 */
export function useMarkersContext() {
  const context = useContext(MarkerContext);
  if (context === undefined) {
    throw new Error('useMarkersContext must be used within a MarkerProvider');
  }
  return context;
}