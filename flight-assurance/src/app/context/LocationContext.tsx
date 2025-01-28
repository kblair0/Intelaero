// contexts/LocationContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import { LocationData } from '../components/Map';

interface LocationContextType {
  gcsLocation: LocationData | null;
  setGcsLocation: (location: LocationData | null) => void;
  observerLocation: LocationData | null;
  setObserverLocation: (location: LocationData | null) => void;
  repeaterLocation: LocationData | null;
  setRepeaterLocation: (location: LocationData | null) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [gcsLocation, setGcsLocation] = useState<LocationData | null>(null);
  const [observerLocation, setObserverLocation] = useState<LocationData | null>(null);
  const [repeaterLocation, setRepeaterLocation] = useState<LocationData | null>(null);

  return (
    <LocationContext.Provider value={{
      gcsLocation,
      setGcsLocation,
      observerLocation,
      setObserverLocation,
      repeaterLocation,
      setRepeaterLocation,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}