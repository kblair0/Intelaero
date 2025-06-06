// components/Map/Displays/MapLegend.tsx
import React from 'react';

const MapLegend: React.FC = () => {
  return (
    <div className="map-legend absolute bottom-4 right-4 bg-white bg-opacity-80 p-3 rounded-lg shadow-md">
      <h4 className="font-semibold mb-2">Legend</h4>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-[#d32f2f] block rounded"></span>
          <span>0% Visibility (Red)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-[#f57c00] block rounded"></span>
          <span>25% Visibility (Orange)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-[#fbc02d] block rounded"></span>
          <span>50% Visibility (Yellow)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-[#7cb342] block rounded"></span>
          <span>75% Visibility (Green)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-[#1976d2] block rounded"></span>
          <span>100% Visibility (Blue)</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend;