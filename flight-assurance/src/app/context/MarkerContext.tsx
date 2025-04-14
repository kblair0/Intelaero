// src/app/context/MarkerContext.tsx

import { createContext, useContext, useState, ReactNode } from 'react';
import { LocationData } from '../types/LocationData';

interface MarkerContextType {
  gcsLocation: LocationData | null;
  setGcsLocation: (location: LocationData | null) => void;
  observerLocation: LocationData | null;
  setObserverLocation: (location: LocationData | null) => void;
  repeaterLocation: LocationData | null;
  setRepeaterLocation: (location: LocationData | null) => void;
  gcsElevationOffset: number;
  setGcsElevationOffset: (offset: number) => void;
  observerElevationOffset: number;
  setObserverElevationOffset: (offset: number) => void;
  repeaterElevationOffset: number;
  setRepeaterElevationOffset: (offset: number) => void;
}

const MarkerContext = createContext<MarkerContextType | undefined>(undefined);

export function MarkerProvider({ children }: { children: ReactNode }) {
  const [gcsLocation, setGcsLocation] = useState<LocationData | null>(null);
  const [observerLocation, setObserverLocation] = useState<LocationData | null>(null);
  const [repeaterLocation, setRepeaterLocation] = useState<LocationData | null>(null);
  const [gcsElevationOffset, setGcsElevationOffset] = useState<number>(3);
  const [observerElevationOffset, setObserverElevationOffset] = useState<number>(3);
  const [repeaterElevationOffset, setRepeaterElevationOffset] = useState<number>(3);

  return (
    <MarkerContext.Provider
      value={{
        gcsLocation,
        setGcsLocation,
        observerLocation,
        setObserverLocation,
        repeaterLocation,
        setRepeaterLocation,
        gcsElevationOffset,
        setGcsElevationOffset,
        observerElevationOffset,
        setObserverElevationOffset,
        repeaterElevationOffset,
        setRepeaterElevationOffset,
      }}
    >
      {children}
    </MarkerContext.Provider>
  );
}

export function useMarkersContext() {
  const context = useContext(MarkerContext);
  if (context === undefined) {
    throw new Error('useMarkersContext must be used within a MarkerProvider');
  }
  return context;
}
