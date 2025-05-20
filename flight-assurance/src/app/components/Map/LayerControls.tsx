/**
 * src/app/components/UI/LayerControls.tsx
 * 
 * Purpose:
 * Provides unified access to map layer controls with premium-feature awareness.
 * Controls visibility of various map layers (powerlines, airfields, terrain) and
 * provides access to analysis tools based on the user's subscription tier.
 * 
 * Related to:
 * - PremiumContext.tsx (for permission checks)
 * - PremiumButton.tsx (for access control UI)
 * - MapContext.tsx (for layer management)
 * - AreaOpsProcessor.tsx (for terrain operations)
 */

import React, { useState, useRef } from 'react';
import { useMapContext } from '../../context/mapcontext';
import { MAP_LAYERS } from '../../services/LayerManager';
import { trackEventWithForm as trackEvent } from '../tracking/tracking';
import { Mountain, Radio, GripVertical } from 'lucide-react';
import { useAreaOpsProcessor } from '../AO/Hooks/useAreaOpsProcessor';
import PremiumButton from '../UI/PremiumButton';
import { FeatureId } from '../../types/PremiumTypes';

interface LayerControlsProps {
  onToggleDBYD?: () => void;
  activePanel?: 'energy' | 'los' | 'terrain' | null;
  togglePanel?: (panel: 'energy' | 'los' | 'terrain') => void;
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

  const handleDBYDPowerlines = () => {
    // Show Area of Operations when DBYD is requested
    showAreaOfOperations();
    
    if (onToggleDBYD) {
      onToggleDBYD();
    }
    trackEvent('DYBDpowerlines_add_overlay_click', { panel: 'layer-controls' });
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
    <div className="absolute top-4 left-4 right-4 z-10 flex gap-4">
      {/* Map Layer Controls */}
      <div className="flex flex-col space-y-2">
        {/* HV Powerlines - Available in all tiers */}
        <PremiumButton
          featureId="hv_powerlines"
          onClick={() => {
            trackEvent('powerlines_add_overlay_click', { panel: 'layer-controls' });
            toggleLayer(MAP_LAYERS.POWERLINES);
            toggleLayer(MAP_LAYERS.POWERLINES_HITBOX);
          }}
          className="map-button"
          // No premium indicator needed since available to all
          showIndicator={false}
        >
          Toggle HV Powerlines ⚡️
        </PremiumButton>

        {/* Local Powerlines - Commercial tier only */}
        <PremiumButton
          featureId="local_powerlines"
          onClick={handleDBYDPowerlines}
          className="map-button"
          // Show premium indicator with default settings
        >
          Toggle Local Powerlines 🏡
        </PremiumButton>

        {/* Airfields - Free feature */}
        <PremiumButton
          featureId="airspace_analysis"
          onClick={() => {
            trackEvent('airspace_add_overlay_click', { panel: 'layer-controls' });
            toggleLayer(MAP_LAYERS.AIRFIELDS);
            toggleLayer(MAP_LAYERS.AIRFIELDS_LABELS);
          }}
          className="map-button"
          showIndicator={false}
        >
          Toggle Aerodrome Overlay ✈️
        </PremiumButton>

        {/* Terrain Grid - Feature ID depends on grid parameters */}
        <PremiumButton
          featureId={getTerrainFeatureId()}
          onClick={handleToggleTerrainGrid}
          className="map-button"
          permissionParams={{ 
            gridResolution: gridResolution,
            gridRange: gridRange
          }}
        >
          {isTerrainGridVisible ? 'Hide' : 'Show'} AO Terrain Grid 🌍
        </PremiumButton>
      </div>
  
      {/* Analysis Controls: Now in a row */}
      {togglePanel && setShowUploader && (
        <div className="flex flex-row gap-2 items-start">
          {/* Terrain Analysis Panel */}
          <PremiumButton
            featureId="terrain_analysis"
            onClick={() => {
              trackEvent('map_terrain_panel_click', { panel: 'layer-controls' });
              togglePanel('terrain');
            }}
            className={`map-button flex items-center gap-2 transition-colors ${
              activePanel === 'terrain'
                ? 'bg-blue-100 border-blue-300 shadow-md'
                : 'hover:bg-gray-300/80'
            }`}
            showIndicator={false}
          >
            <Mountain className="w-4 h-4" />
            Terrain Analysis Tools
          </PremiumButton>

          {/* LOS Analysis Panel */}
          <PremiumButton
            featureId="station_los_analysis"
            onClick={() => {
              trackEvent('map_los_panel_click', { panel: 'layer-controls' });
              togglePanel('los');
            }}
            className={`map-button flex items-center gap-2 transition-colors ${
              activePanel === 'los'
                ? 'bg-blue-100 border-blue-300 shadow-md'
                : 'hover:bg-gray-300/80'
            }`}
            showIndicator={false}
          >
            <Radio className="w-4 h-4" />
            Visibility Analysis Tools
          </PremiumButton>

          {/* Flight Plan Upload - Premium feature */}
          {flightPlan && (
            <PremiumButton
              featureId="flight_path_analysis"
              onClick={() => {
                trackEvent('upload_flight_plan_click', { panel: 'layer-controls' });
                setShowUploader(true);
              }}
              className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
            >
              Upload Flight Plan
            </PremiumButton>
          )}

          {/* DEM Data Upload - Premium feature */}
          <PremiumButton
            featureId="merged_analysis" // Using the most advanced feature for this premium content
            onClick={() => {
              trackEvent('own_dem_data_request', { panel: 'layer-controls' });
              window.alert('Coming Soon!');
            }}
            className="map-button flex items-center gap-2 transition-colors hover:bg-gray-300/80"
          >
            <GripVertical className="w-4 h-4" />
            Add Your Own DEM Data
          </PremiumButton>
        </div>
      )}
    </div>
  );
};

export default LayerControls;