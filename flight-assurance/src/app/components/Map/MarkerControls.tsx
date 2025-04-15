// components/Map/Controls/MarkerControls.tsx
import React from 'react';
import { useMarkers } from '../../hooks/useMarkers';
import { useMapContext } from '../../context/MapContext';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';
const MarkerControls: React.FC = () => {
  const { map, isMapReady } = useMapContext();
  
  const {
    addGroundStation,
    addObserver,
    addRepeater,
    removeAllMarkers
  } = useMarkers({ 
    map, 
    terrainLoaded: isMapReady 
  });

  return (
    <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
      <button 
        onClick={() => {
          trackEvent("add_ground_station_click", { panel: "map.tsx" });
          addGroundStation();
        }} 
        className="map-button ground-station-icon"
      >
        Add Ground Station 📡
      </button>
      <button 
        onClick={() => {
          trackEvent("add_observer_click", { panel: "map.tsx" });
          addObserver();
        }} 
        className="map-button observer-icon"
      >
        Add Observer 🔭
      </button>
      <button 
        onClick={() => {
          trackEvent("add_repeater_click", { panel: "map.tsx" });
          addRepeater();
        }} 
        className="map-button repeater-icon"
      >
        Add Repeater ⚡️
      </button>
      <button 
        onClick={() => {
          trackEvent("reset_los_analyses_click", { panel: "map.tsx" });
          removeAllMarkers();
        }} 
        className="map-button"
      >
        Reset LOS Analyses 🚫
      </button>
    </div>
  );
};

export default MarkerControls;