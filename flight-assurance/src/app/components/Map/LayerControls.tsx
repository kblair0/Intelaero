import React, { useState, useRef } from 'react';
import { useMapContext } from '../../context/mapcontext';
import { MAP_LAYERS } from '../../services/LayerManager';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';
import { Battery, Radio, GripVertical } from 'lucide-react';
import { useAreaOpsProcessor } from '../AO/Hooks/useAreaOpsProcessor';

interface LayerControlsProps {
  onToggleDBYD?: () => void;
  activePanel?: 'energy' | 'los' | null;
  togglePanel?: (panel: 'energy' | 'los') => void;
  flightPlan?: any; // Replace with FlightPlan type if available
  setShowUploader?: (show: boolean) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({
  onToggleDBYD,
  activePanel,
  togglePanel,
  flightPlan,
  setShowUploader,
}) => {
  const { map, toggleLayer } = useMapContext();
  const { showAreaOfOperations, generateTerrainGrid } = useAreaOpsProcessor();
  const [isTerrainGridVisible, setIsTerrainGridVisible] = useState(false);
  const bydLayerHandlerRef = useRef<{ fetchLayers: () => void } | null>(null);

  if (!map) return null;

  const handleToggleTerrainGrid = async () => {
    // Make AO visible and generate terrain grid if not already visible
    if (!isTerrainGridVisible) {
      showAreaOfOperations();
      await generateTerrainGrid();
    }
    
    toggleLayer(MAP_LAYERS.AOTERRAIN_GRID);
    setIsTerrainGridVisible(!isTerrainGridVisible);
    trackEvent('toggle_terrain_grid_click', { panel: 'layer-controls' });
  };

  const handleDBYDPowerlines = () => {
    // Show Area of Operations when DBYD is requested
    showAreaOfOperations();
    
    if (onToggleDBYD) {
      onToggleDBYD();
    }
    trackEvent('DYBDpowerlines_add_overlay_click', { panel: 'layer-controls' });
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex gap-4">
      {/* Map Layer Controls */}
      <div className="flex flex-col space-y-2">
        {/* … Map layer buttons … */}
        <button
          onClick={() => {
            trackEvent('powerlines_add_overlay_click', { panel: 'layer-controls' });
            toggleLayer(MAP_LAYERS.POWERLINES);
            toggleLayer(MAP_LAYERS.POWERLINES_HITBOX);
          }}
          className="map-button"
        >
      Toggle Powerlines ⚡️
        </button>
        <button onClick={handleDBYDPowerlines} className="map-button">
          Toggle DBYD Powerlines 🏡
        </button>
        <button
          onClick={() => {
            trackEvent('airspace_add_overlay_click', { panel: 'layer-controls' });
            toggleLayer(MAP_LAYERS.AIRFIELDS);
            toggleLayer(MAP_LAYERS.AIRFIELDS_LABELS);
          }}
          className="map-button"
        >
          Toggle Airspace Overlay ✈️
        </button>
        <button onClick={handleToggleTerrainGrid} className="map-button">
          {isTerrainGridVisible ? 'Show AO Terrain Grid 🌍' : 'Hide AO Terrain Grid 🌍'}
        </button>
      </div>
  
      {/* Analysis Controls: Now in a row */}
      {togglePanel && setShowUploader && (
        <div className="flex flex-row gap-2 items-start">
          <button
            onClick={() => {
              trackEvent('map_energy_panel_click', { panel: 'layer-controls' });
              togglePanel('terrain');
            }}
            className={`map-button flex items-center gap-2 transition-colors ${
              activePanel === 'energy'
                ? 'bg-blue-100 border-blue-300 shadow-md'
                : 'hover:bg-gray-300/80'
            }`}
          >
            <Battery className="w-4 h-4" />
            Energy Analysis
          </button>
          <button
            onClick={() => {
              trackEvent('map_los_panel_click', { panel: 'layer-controls' });
              togglePanel('los');
            }}
            className={`map-button flex items-center gap-2 transition-colors ${
              activePanel === 'los'
                ? 'bg-blue-100 border-blue-300 shadow-md'
                : 'hover:bg-gray-300/80'
            }`}
          >
            <Radio className="w-4 h-4" />
            Visibility Tools
          </button>
          {flightPlan && (
            <button
              onClick={() => {
                trackEvent('upload_flight_plan_click', { panel: 'layer-controls' });
                setShowUploader(true);
              }}
              className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
            >
              Upload Flight Plan
            </button>
          )}
          <button
            onClick={() => {
              trackEvent('own_dem_data_request', { panel: 'layer-controls' });
              window.alert('Coming Soon!');
            }}
            className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
          >
            <GripVertical className="w-4 h-4" />
            Add Your Own DEM Data
          </button>
        </div>
      )}

    </div>
  );
  
};

export default LayerControls;