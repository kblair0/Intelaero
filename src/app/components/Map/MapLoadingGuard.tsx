import React from 'react';
import { useMapContext } from '../../context/mapcontext';

interface MapLoadingGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const MapLoadingGuard: React.FC<MapLoadingGuardProps> = ({
  children,
  fallback = <div className="flex items-center justify-center p-4 text-gray-500">Loading map resources...</div>,
}) => {
  const { map, terrainLoaded } = useMapContext();

  if (!map || !terrainLoaded) {
    return (
      <div className="bg-white bg-opacity-80 backdrop-blur-sm rounded-lg shadow-md">
        {fallback}
      </div>
    );
  }

  return <>{children}</>;
};

export default MapLoadingGuard;