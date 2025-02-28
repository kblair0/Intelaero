// contexts/LocationContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import { LocationData } from '../components/Map';

/**
 * Defines the shape of our Location Context.
 * In addition to storing station locations, we now track the elevation offset
 * for each station, allowing these values to be centrally managed.
 */
interface LocationContextType {
  // Station Locations
  gcsLocation: LocationData | null;
  setGcsLocation: (location: LocationData | null) => void;
  observerLocation: LocationData | null;
  setObserverLocation: (location: LocationData | null) => void;
  repeaterLocation: LocationData | null;
  setRepeaterLocation: (location: LocationData | null) => void;

  // Elevation Offsets (source of truth for station elevation offsets)
  gcsElevationOffset: number;
  setGcsElevationOffset: (offset: number) => void;
  observerElevationOffset: number;
  setObserverElevationOffset: (offset: number) => void;
  repeaterElevationOffset: number;
  setRepeaterElevationOffset: (offset: number) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  // Station location state
  const [gcsLocation, setGcsLocation] = useState<LocationData | null>(null);
  const [observerLocation, setObserverLocation] = useState<LocationData | null>(null);
  const [repeaterLocation, setRepeaterLocation] = useState<LocationData | null>(null);

  // Elevation offset state (default set to 3, matching previous defaults)
  const [gcsElevationOffset, setGcsElevationOffset] = useState<number>(3);
  const [observerElevationOffset, setObserverElevationOffset] = useState<number>(3);
  const [repeaterElevationOffset, setRepeaterElevationOffset] = useState<number>(3);

  return (
    <LocationContext.Provider
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
    </LocationContext.Provider>
  );
}

/**
 * Custom hook to consume the LocationContext.
 * Throws an error if used outside a LocationProvider.
 */
export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
