// src/app/context/MarkerContext.tsx

import { createContext, useContext, useState, ReactNode } from 'react';
import { LocationData } from '../types/LocationData';
import { v4 as uuidv4 } from 'uuid'; // You may need to install this package

// Define marker types for type safety
export type MarkerType = 'gcs' | 'observer' | 'repeater';

// Extended interface for markers with ID and type
export interface Marker {
  id: string;
  type: MarkerType;
  location: LocationData;
  elevationOffset: number;
}

// Context interface
interface MarkerContextType {
  // Core marker collection
  markers: Marker[];
  
  // Marker management functions
  addMarker: (type: MarkerType, location: LocationData) => string; // Returns ID
  updateMarker: (id: string, updates: Partial<Marker>) => void;
  removeMarker: (id: string) => void;
  removeAllMarkers: (type?: MarkerType) => void;
  
  // Type-specific elevation offset defaults
  defaultElevationOffsets: Record<MarkerType, number>;
  setDefaultElevationOffset: (type: MarkerType, offset: number) => void;
  
  // Helper methods
  getMarkersByType: (type: MarkerType) => Marker[];
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
    gcs: 3,
    observer: 3,
    repeater: 3
  });

  /**
   * Adds a new marker of specified type
   * @returns The ID of the created marker
   */
  const addMarker = (type: MarkerType, location: LocationData): string => {
    const id = uuidv4();
    const newMarker: Marker = {
      id,
      type,
      location,
      elevationOffset: defaultElevationOffsets[type]
    };
    
    setMarkers(prev => [...prev, newMarker]);
    return id;
  };

  /**
   * Updates an existing marker by ID
   */
  const updateMarker = (id: string, updates: Partial<Marker>): void => {
    setMarkers(prev => 
      prev.map(marker => 
        marker.id === id ? { ...marker, ...updates } : marker
      )
    );
  };

  /**
   * Removes a marker by ID
   */
  const removeMarker = (id: string): void => {
    setMarkers(prev => prev.filter(marker => marker.id !== id));
  };

  /**
   * Removes all markers, optionally filtered by type
   */
  const removeAllMarkers = (type?: MarkerType): void => {
    if (type) {
      setMarkers(prev => prev.filter(marker => marker.type !== type));
    } else {
      setMarkers([]);
    }
  };

  /**
   * Updates the default elevation offset for a marker type
   */
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

  /**
   * Gets all markers of a specified type
   */
  const getMarkersByType = (type: MarkerType): Marker[] => {
    return markers.filter(m => m.type === type);
  };

  return (
    <MarkerContext.Provider
      value={{
        markers,
        addMarker,
        updateMarker,
        removeMarker,
        removeAllMarkers,
        defaultElevationOffsets,
        setDefaultElevationOffset,
        getMarkersByType
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