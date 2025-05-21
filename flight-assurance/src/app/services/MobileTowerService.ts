/**
 * MobileTowerService.ts
 * 
 * Purpose:
 * Provides functionality to display and interact with mobile tower data from
 * Mapbox tilesets, with filtering and styling capabilities.
 * 
 * This service:
 * - Loads mobile tower data from Mapbox tilesets
 * - Creates and manages map layers for towers and clusters
 * - Handles styling based on carrier (Telstra, Optus, Vodafone) and technology (3G, 4G, 5G)
 * - Implements zoom-responsive sizing for better performance at different zoom levels
 * - Provides filtering by carrier, technology, and frequency bands
 * - Manages interactive elements like popups and hover states
 */

import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { MobileTowerFilters, FrequencyBand } from '../types/mobileTowers';

// Constants for styling and filtering
// Replace with your actual Mapbox tileset URL after uploading the data
const MAPBOX_SOURCE_URL = 'mapbox://intelaero.3zahha0o';
const MAPBOX_SOURCE_LAYER = 'mobile_towers-cniu5j'; // The source layer name in your tileset

// Frequency bands for filtering (in MHz)
export const FREQUENCY_BANDS: Record<FrequencyBand, { min: number, max: number, label: string }> = {
  LOW_BAND: { min: 700, max: 900, label: 'Low Band (700-900 MHz)' },
  MID_BAND_1: { min: 1800, max: 2100, label: 'Mid Band (1800-2100 MHz)' },
  MID_BAND_2: { min: 2300, max: 2600, label: 'Mid Band (2300-2600 MHz)' },
  HIGH_BAND: { min: 3300, max: 3800, label: 'High Band (3.5 GHz)' },
  MMWAVE: { min: 24000, max: 40000, label: 'mmWave (>24 GHz)' },
};

// Layer and source IDs
const TOWER_SOURCE_ID = 'mobile-towers-source';
const TOWER_LAYER_ID = 'mobile-towers-unclustered-point';
const TOWER_LABELS_LAYER_ID = 'mobile-towers-labels';

/**
 * Main function to display mobile towers on the map using Mapbox tilesets
 * 
 * @param map Mapbox map instance
 * @param aoGeometry Area of Operations GeoJSON
 * @param setLayerVisibility Function to control layer visibility
 * @returns Promise<boolean> Success status
 */
export async function displayMobileTowers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection,
  setLayerVisibility: (layerId: string, visible: boolean) => void
): Promise<boolean> {
  console.log('displayMobileTowers: starting', {
    timestamp: new Date().toISOString(),
    message: 'Setting up mobile tower display using Mapbox tilesets'
  });

  try {
    // If layers already exist, just make them visible
    if (map.getLayer(TOWER_LAYER_ID)) {
      setLayerVisibility(TOWER_LAYER_ID, true);
      if (map.getLayer(TOWER_LABELS_LAYER_ID)) {
        setLayerVisibility(TOWER_LABELS_LAYER_ID, true);
      }
      
      console.log('displayMobileTowers: toggling existing layers', {
        timestamp: new Date().toISOString(),
        message: 'Showing existing tower layers'
      });
      
      return true;
    }
    
    // Add Mapbox vector tile source
    if (!map.getSource(TOWER_SOURCE_ID)) {
      map.addSource(TOWER_SOURCE_ID, {
        type: 'vector',
        url: MAPBOX_SOURCE_URL
      });
      
      console.log('displayMobileTowers: added Mapbox vector tile source', {
        timestamp: new Date().toISOString(),
        sourceId: TOWER_SOURCE_ID,
        url: MAPBOX_SOURCE_URL,
        message: 'Added Mapbox vector tile source for mobile towers'
      });
    }
    
    // Add layer for individual towers with zoom-based sizing
    if (!map.getLayer(TOWER_LAYER_ID)) {
      map.addLayer({
        id: TOWER_LAYER_ID,
        type: 'circle',
        source: TOWER_SOURCE_ID,
        'source-layer': MAPBOX_SOURCE_LAYER,
        paint: {
          // Style based on technology and zoom level
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 1,  // Very small at zoom level 6
            8, 2,  // Small at zoom level 8
            10, [  // Medium at zoom level 10
              'case',
              ['==', ['get', 'technology'], '5g'], 6,
              ['==', ['get', 'technology'], '4g'], 4,
              ['==', ['get', 'technology'], '3g'], 3,
              3 // Default for unknown
            ],
            14, [  // Full size at zoom level 14+
              'case',
              ['==', ['get', 'technology'], '5g'], 10,
              ['==', ['get', 'technology'], '4g'], 8,
              ['==', ['get', 'technology'], '3g'], 6,
              6 // Default for unknown
            ]
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'technology'], '5g'], '#9932CC', // Purple for 5G
            ['==', ['get', 'technology'], '4g'], '#4682B4', // Blue for 4G
            ['==', ['get', 'technology'], '3g'], '#FFA500', // Orange for 3G
            '#888888' // Gray for unknown
          ],
          // Opacity based on zoom level
          'circle-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6, 0.5,  // More transparent at low zoom
            10, 0.8   // More opaque at high zoom
          ],
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0.5,  // Thinner stroke at low zoom
            12, 2    // Thicker stroke at high zoom
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'carrier'], 'telstra'], '#0066CC', // Telstra blue
            ['==', ['get', 'carrier'], 'optus'], '#00CC00', // Optus green
            ['==', ['get', 'carrier'], 'vodafone'], '#FF0000', // Vodafone red
            '#FFFFFF' // White for others
          ]
        }
      });
      
      console.log('displayMobileTowers: added tower layer', {
        timestamp: new Date().toISOString(),
        layerId: TOWER_LAYER_ID,
        message: 'Added tower point layer with zoom-based sizing'
      });
    }
    
    // Add tower labels layer (shown only when zoomed in)
    if (!map.getLayer(TOWER_LABELS_LAYER_ID)) {
      map.addLayer({
        id: TOWER_LABELS_LAYER_ID,
        type: 'symbol',
        source: TOWER_SOURCE_ID,
        'source-layer': MAPBOX_SOURCE_LAYER,
        layout: {
          'text-field': [
            'concat',
            ['get', 'name'],
            '\n',
            ['get', 'technology'],
            ' - ',
            ['get', 'carrier']
          ],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'visibility': 'none' // Hidden by default, toggled based on zoom
        },
        paint: {
          'text-color': '#333',
          'text-halo-color': '#fff',
          'text-halo-width': 1
        }
      });
      
      console.log('displayMobileTowers: added label layer', {
        timestamp: new Date().toISOString(),
        layerId: TOWER_LABELS_LAYER_ID,
        message: 'Added tower label layer'
      });
    }
    
    // Show labels only when zoomed in
    map.on('zoom', () => {
      const zoom = map.getZoom();
      if (zoom > 12) {
        if (map.getLayer(TOWER_LABELS_LAYER_ID)) {
          map.setLayoutProperty(TOWER_LABELS_LAYER_ID, 'visibility', 'visible');
        }
      } else {
        if (map.getLayer(TOWER_LABELS_LAYER_ID)) {
          map.setLayoutProperty(TOWER_LABELS_LAYER_ID, 'visibility', 'none');
        }
      }
    });
    
    // Set up click handler for tower popups
    map.on('click', TOWER_LAYER_ID, handleTowerClick);
    
    // Change cursor to pointer when hovering over interactive elements
    map.on('mouseenter', TOWER_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', TOWER_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
    
    // Ensure all layers are visible
    setLayerVisibility(TOWER_LAYER_ID, true);
    
    console.log('displayMobileTowers: layers added and configured', {
      timestamp: new Date().toISOString(),
      layers: [TOWER_LAYER_ID, TOWER_LABELS_LAYER_ID],
      message: 'Successfully added tower layers to map'
    });
    
    return true;
  } catch (error) {
    console.error('displayMobileTowers: error', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to display mobile tower data'
    });
    return false;
  }
}

/**
 * Handle click on an individual tower
 */
function handleTowerClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
  if (!e.features || e.features.length === 0) return;
  
  const map = e.target;
  const feature = e.features[0];
  const props = feature.properties;
  
  if (!props) return;
  
  // Use the click event's coordinates instead of properties
  // Vector tiles don't store coordinates in properties
  const coordinates = e.lngLat;
  
  // Calculate frequency in MHz for display (converting from Hz)
  const frequency = props.frequency / 1000000;
  const frequencyBand = getFrequencyBandLabel(props.frequency);
  
  // Create popup content with detailed information
  const content = `
    <div class="text-xs p-1 max-w-xs">
      <h3 class="font-bold text-base">${props.name || 'Unknown Site'}</h3>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
        <div class="font-semibold">Carrier:</div>
        <div>${capitalizeFirstLetter(props.carrier)}</div>
        
        <div class="font-semibold">Technology:</div>
        <div>${props.technology.toUpperCase()}</div>
        
        <div class="font-semibold">Frequency:</div>
        <div>${frequency.toFixed(1)} MHz</div>
        
        <div class="font-semibold">Band:</div>
        <div>${frequencyBand}</div>
        
        ${props.height ? `
          <div class="font-semibold">Height:</div>
          <div>${props.height} m</div>
        ` : ''}
        
        ${props.azimuth ? `
          <div class="font-semibold">Azimuth:</div>
          <div>${props.azimuth}°</div>
        ` : ''}
        
        ${props.tilt ? `
          <div class="font-semibold">Tilt:</div>
          <div>${props.tilt}°</div>
        ` : ''}
        
        ${props.eirp ? `
          <div class="font-semibold">Power (EIRP):</div>
          <div>${props.eirp} ${props.eirp_unit || 'W'}</div>
        ` : ''}
        
        ${props.elevation ? `
          <div class="font-semibold">Elevation:</div>
          <div>${props.elevation} m</div>
        ` : ''}
        
        ${props.state ? `
          <div class="font-semibold">State:</div>
          <div>${props.state}</div>
        ` : ''}
      </div>
      
      <!-- Add Create Repeater Button -->
      <div class="mt-3 pt-2 border-t border-gray-200">
        <button 
          id="create-repeater-btn" 
          class="w-full bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded text-xs font-medium flex items-center justify-center"
          data-tower-id="${props.id || ''}"
          data-tower-lng="${coordinates.lng}"
          data-tower-lat="${coordinates.lat}"
          data-tower-elevation="${props.elevation || 0}"
          data-tower-height="${props.height || 2}"
          data-tower-carrier="${props.carrier || ''}"
          data-tower-technology="${props.technology || ''}"
          data-tower-frequency="${frequency.toFixed(1)}"
          data-tower-azimuth="${props.azimuth || ''}"
          data-tower-tilt="${props.tilt || ''}"
          data-tower-eirp="${props.eirp || ''}"
          data-tower-eirp-unit="${props.eirp_unit || ''}"
        >
          <span class="mr-1">⚡️</span> Create Repeater From Tower
        </button>
      </div>
    </div>
  `;
  
  // Create and display popup at the event's coordinates
  const popup = new mapboxgl.Popup()
    .setLngLat(coordinates)
    .setHTML(content)
    .addTo(map);
    
  // Add event listener to the button after popup is added to the map
  setTimeout(() => {
    const createRepeaterBtn = document.getElementById('create-repeater-btn');
    if (createRepeaterBtn) {
      createRepeaterBtn.addEventListener('click', (clickEvent) => {
        const target = clickEvent.currentTarget as HTMLButtonElement;
        const towerData = {
          id: target.dataset.towerId,
          lng: parseFloat(target.dataset.towerLng || '0'),
          lat: parseFloat(target.dataset.towerLat || '0'),
          elevation: parseFloat(target.dataset.towerElevation || '0'),
          height: parseFloat(target.dataset.towerHeight || '2'),
          carrier: target.dataset.towerCarrier,
          technology: target.dataset.towerTechnology,
          frequency: target.dataset.towerFrequency,
          azimuth: target.dataset.towerAzimuth ? parseFloat(target.dataset.towerAzimuth) : undefined,
          tilt: target.dataset.towerTilt ? parseFloat(target.dataset.towerTilt) : undefined,
          eirp: target.dataset.towerEirp ? parseFloat(target.dataset.towerEirp) : undefined,
          eirp_unit: target.dataset.towerEirpUnit
        };
        
        // Dispatch custom event to be caught by the useTowerToMarker hook
        // Fixed: Changed variable name to avoid conflict with the event parameter
        const customEvent = new CustomEvent('tower:createRepeater', { detail: towerData });
        window.dispatchEvent(customEvent);
        
        // Close the popup
        popup.remove();
      });
    }
  }, 100); // Small timeout to ensure DOM is ready
}

/**
 * Apply filters to the mobile towers layers
 * 
 * @param map Mapbox map instance
 * @param filters Tower filter criteria
 * @returns Success status
 */
export function filterMobileTowers(
  map: mapboxgl.Map,
  filters: MobileTowerFilters
): boolean {
  console.log('filterMobileTowers: applying filters', {
    timestamp: new Date().toISOString(),
    filters,
    message: 'Applying filters to mobile tower layers'
  });

  // Find all tower-related layers that need filtering
  const towerLayers = [
    TOWER_LAYER_ID,
    TOWER_LABELS_LAYER_ID
  ];
  
  try {
    // Build filter expression
    let filterParts: any[] = ['all'];
    
    // Add carrier filter if specified
    if (filters.carriers && filters.carriers.length > 0) {
      // Use 'match' expression for better performance
      filterParts.push([
        'match',
        ['get', 'carrier'],
        filters.carriers,
        true,
        false
      ]);
    }
    
    // Add technology filter if specified
    if (filters.technologies && filters.technologies.length > 0) {
      // Use 'match' expression for better performance
      filterParts.push([
        'match',
        ['get', 'technology'],
        filters.technologies,
        true,
        false
      ]);
    }
    
    // Add frequency band filter if specified
    if (filters.frequencyBands && filters.frequencyBands.length > 0) {
      const frequencyFilter: any[] = ['any'];
      
      for (const band of filters.frequencyBands) {
        const bandRange = FREQUENCY_BANDS[band];
        if (bandRange) {
          frequencyFilter.push([
            'all',
            ['>=', ['/', ['get', 'frequency'], 1000000], bandRange.min],
            ['<=', ['/', ['get', 'frequency'], 1000000], bandRange.max]
          ]);
        }
      }
      
      filterParts.push(frequencyFilter);
    }
    
    console.log('filterMobileTowers: filter expression', {
      timestamp: new Date().toISOString(),
      expression: JSON.stringify(filterParts),
      message: 'Created filter expression'
    });
    
    // Apply filter to all tower layers
    for (const layerId of towerLayers) {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, filterParts);
      }
    }
    
    return true;
  } catch (error) {
    console.error('filterMobileTowers: error', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to apply filters to tower layers'
    });
    return false;
  }
}

/**
 * Get the frequency band label for a given frequency
 * 
 * @param frequency Frequency in Hz
 * @returns Frequency band label
 */
export function getFrequencyBandLabel(frequency: number): string {
  // Convert to MHz for comparison
  const freqMHz = frequency / 1000000;
  
  for (const [band, range] of Object.entries(FREQUENCY_BANDS)) {
    if (freqMHz >= range.min && freqMHz <= range.max) {
      return range.label;
    }
  }
  return 'Other';
}

/**
 * Utility function to capitalize the first letter of a string
 */
function capitalizeFirstLetter(string: string): string {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}