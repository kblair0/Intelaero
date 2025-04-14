// components/Map/Controls/LayerControls.tsx
import React, { useState, useRef } from 'react';
import { useMapContext } from '../../context/MapContext';
import { MAP_LAYERS } from '../../services/LayerManager';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';

interface LayerControlsProps {
  onToggleDBYD?: () => void; // Optional callback for DBYD toggle
}

const LayerControls: React.FC<LayerControlsProps> = ({ onToggleDBYD }) => {
  const { map, toggleLayer, layerVisibility } = useMapContext();
  const [isTerrainGridVisible, setIsTerrainGridVisible] = useState(false);
  
  // Reference for any layer handlers if needed
  const bydLayerHandlerRef = useRef<{ fetchLayers: () => void } | null>(null);

  if (!map) return null;

  const handleToggleTerrainGrid = () => {
    toggleLayer(MAP_LAYERS.AOTERRAIN_GRID);
    setIsTerrainGridVisible(!isTerrainGridVisible);
    trackEvent("toggle_terrain_grid_click", { panel: "map.tsx" });
  };

  const handleDBYDPowerlines = () => {
    if (onToggleDBYD) {
      onToggleDBYD();
    }
    trackEvent("DYBDpowerlines_add_overlay_click", { panel: "map.tsx" });
  };

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
      <button 
        onClick={() => {
          trackEvent("powerlines_add_overlay_click", { panel: "map.tsx" });
          toggleLayer(MAP_LAYERS.POWERLINES);
          toggleLayer(MAP_LAYERS.POWERLINES_HITBOX);
        }} 
        className="map-button"
      >
        Add Powerlines ⚡️
      </button>
      <button 
        onClick={handleDBYDPowerlines}
        className="map-button"
      >
        Add DBYD Powerlines 🏡
      </button>
      <button 
        onClick={() => {
          trackEvent("airspace_add_overlay_click", { panel: "map.tsx" });
          toggleLayer(MAP_LAYERS.AIRFIELDS);
          toggleLayer(MAP_LAYERS.AIRFIELDS_LABELS);
        }} 
        className="map-button"
      >
        Add Airspace Overlay ✈️
      </button>
      <button 
        onClick={handleToggleTerrainGrid} 
        className="map-button"
      >
        {isTerrainGridVisible ? "Hide AO Terrain Grid 🌍" : "Show AO Terrain Grid 🌍"}
      </button>
    </div>
  );
};

export default LayerControls;