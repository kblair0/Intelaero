/**
 * src/app/components/UI/LayerControls.tsx - Fixed Version
 * 
 * Purpose:
 * Provides unified access to map layer controls with premium-feature awareness.
 * Controls visibility of various map layers (powerlines, airfields, terrain) and
 * provides access to analysis tools based on the user's subscription tier.
 * 
 * Key Changes:
 * - Removed onToggleDBYD prop dependency
 * - Uses useLayers hook directly for DBYD powerlines
 * - Proper React hook usage pattern
 * 
 * Related to:
 * - PremiumContext.tsx (for permission checks)
 * - PremiumButton.tsx (for access control UI)
 * - MapContext.tsx (for layer management)
 * - useLayers.ts (for DBYD powerlines)
 * - AreaOpsProcessor.tsx (for terrain operations)
 */

import React, { useState, useRef } from 'react';
import { useMapContext } from '../../context/mapcontext';
import { MAP_LAYERS } from '../../services/LayerManager';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';
import { Mountain, Radio, GripVertical } from 'lucide-react';
import { useAreaOpsProcessor } from '../AO/Hooks/useAreaOpsProcessor';
import { useLayers } from '../../hooks/useLayers'; // Add this import
import PremiumButton from '../UI/PremiumButton';
import { FeatureId } from '../../types/PremiumTypes';

interface LayerControlsProps {
  onToggleDBYD?: () => void;
  activePanel?: 'energy' | 'los' | 'terrain' | 'meshblock' | "cadastre" | null;
  togglePanel?: (panel: 'energy' | 'los' | 'terrain' | 'meshblock') => void;

  flightPlan?: any; // Replace with FlightPlan type if available
  setShowUploader?: (show: boolean) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({
  activePanel,
  togglePanel,
  flightPlan,
  setShowUploader,
}) => {
  const { map, toggleLayer } = useMapContext();
  const { showAreaOfOperations, generateTerrainGrid } = useAreaOpsProcessor();
  const { toggleDBYDPowerlines } = useLayers(); // Add this hook
  const [isTerrainGridVisible, setIsTerrainGridVisible] = useState(false);
  const [gridResolution, setGridResolution] = useState(30); // Default grid resolution in meters
  const [gridRange, setGridRange] = useState(500); // Default grid range in meters
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

  // Fixed DBYD handler - now uses useLayers hook properly
  const handleDBYDPowerlines = async () => {
    // Show Area of Operations when DBYD is requested
    showAreaOfOperations();
    
    try {
      await toggleDBYDPowerlines();
      trackEvent('DYBDpowerlines_add_overlay_click', { panel: 'layer-controls' });
    } catch (error) {
      console.error('Error toggling DBYD powerlines from LayerControls:', error);
    }
  };

  // Determine which terrain feature ID to use based on parameters
  const getTerrainFeatureId = (): FeatureId => {
    if (gridResolution < 30) {
      return 'high_resolution_grid';
    }
    if (gridRange > 500) {
      return 'extended_grid_range';
    }
    return 'terrain_analysis';
  };

return (
  <div className="flex flex-col gap-2 w-fit rounded-md shadow-md">
    {/* Map Layer Controls */}
        <PremiumButton
      featureId={getTerrainFeatureId()}
      onClick={handleToggleTerrainGrid}
      className="map-button bg-gray-100 hover:bg-gray-200 flex items-center justify-start"
      permissionParams={{ 
        gridResolution: gridResolution,
        gridRange: gridRange
      }}
    >
      {isTerrainGridVisible ? 'Hide' : 'Show'} AO Terrain Grid 🌍
    </PremiumButton>
    
    <PremiumButton
      featureId="hv_powerlines"
      onClick={() => {
        trackEvent('powerlines_add_overlay_click', { panel: 'layer-controls' });
        toggleLayer(MAP_LAYERS.POWERLINES);
        toggleLayer(MAP_LAYERS.POWERLINES_HITBOX);
      }}
      className="map-button bg-gray-100 hover:bg-gray-200 flex items-center justify-start"
      showIndicator={false}
    >
      Toggle HV Powerlines ⚡️
    </PremiumButton>

    <PremiumButton
      featureId="local_powerlines"
      onClick={handleDBYDPowerlines}
      className="map-button bg-gray-100 hover:bg-gray-200 flex items-center justify-start"
    >
      Toggle Local Powerlines 🏡
    </PremiumButton>

        <PremiumButton
      featureId="airspace_analysis"
      onClick={() => {
        trackEvent('airspace_add_overlay_click', { panel: 'layer-controls' });
        toggleLayer(MAP_LAYERS.AIRFIELDS);
        toggleLayer(MAP_LAYERS.AIRFIELDS_LABELS);
      }}
      className="map-button bg-gray-100 hover:bg-gray-200 flex items-center justify-start"
      showIndicator={false}
    >
      Toggle Aerodrome Overlay ✈️
    </PremiumButton>

    {/* Analysis Controls */}
    {togglePanel && setShowUploader && (
      <>
        {flightPlan && (
          <PremiumButton
            featureId="flight_path_analysis"
            onClick={() => {
              trackEvent('upload_flight_plan_click', { panel: 'layer-controls' });
              setShowUploader(true);
            }}
            className="map-button bg-gray-100 hover:bg-gray-200 flex items-center justify-start gap-2"
          >
            Upload Flight Plan
          </PremiumButton>
        )}

        <PremiumButton
          featureId="merged_analysis"
          onClick={() => {
            trackEvent('own_dem_data_request', { panel: 'layer-controls' });
            window.alert('Coming Soon!');
          }}
          className="map-button bg-gray-100 hover:bg-gray-200 flex items-center justify-start gap-2"
        >
          Add Your Own DEM Data
        </PremiumButton>
      </>
    )}
  </div>
);
};

export default LayerControls;