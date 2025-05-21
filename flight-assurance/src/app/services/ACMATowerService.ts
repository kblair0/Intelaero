/**
 * ACMATowerService.ts
 * 
 * Purpose:
 * Provides functionality to fetch, process, and filter mobile tower data from 
 * the ACMA Radiocommunications License Register (RRL) API.
 * 
 * This service:
 * - Fetches tower data within the Area of Operations
 * - Classifies towers by carrier (Telstra, Optus, Vodafone)
 * - Identifies technology types (3G, 4G, 5G)
 * - Converts the API data to GeoJSON for map rendering
 * - Provides filtering capabilities for interactive display
 */

import * as turf from '@turf/turf';
import { parseXML } from '../utils/xmlUtils';

/**
 * Interfaces for tower data and filtering
 */
export interface MobileTowerFilters {
  carriers?: string[]; // 'telstra', 'optus', 'vodafone'
  technologies?: string[]; // '3g', '4g', '5g'
  frequencyMin?: number;
  frequencyMax?: number;
}

interface TowerData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  carrier: string;
  carrierRaw: string;
  technology: string;
  assignments: number;
  elevation?: number;
  state?: string;
  location?: string;
}

/**
 * Constants for API queries and data classification
 */
const CARRIER_IDENTIFIERS = {
  TELSTRA: {
    clientId: '20053843',
    namePatterns: ['telstra']
  },
  OPTUS: {
    clientId: 'Singtel Optus Pty Ltd',
    namePatterns: ['optus', 'singtel']
  },
  VODAFONE: {
    clientId: 'Vodafone Hutchison Australia',
    namePatterns: ['vodafone', 'tpg', 'hutchison']
  }
};

const TECHNOLOGY_INDICATORS = {
  '5G': {
    namePatterns: ['5g', 'amplitel monopole'],
    frequencyBands: [
      [3300, 3800], // 3.5 GHz band
      [24250, 27500], // mmWave band
      [700, 800] // Low-band 5G can also use 700 MHz
    ],
    emissionDesignators: ['50M0G7W', '100M0G7W']
  },
  '4G': {
    namePatterns: ['4g', 'lte'],
    frequencyBands: [
      [700, 800], // 700 MHz band
      [824, 894], // 850 MHz band
      [880, 960], // 900 MHz band
      [1710, 1880] // 1800 MHz band
    ],
    emissionDesignators: ['5M00G7W', '10M0G7W', '15M0G7W', '20M0G7W']
  },
  '3G': {
    namePatterns: ['3g', 'umts', 'hspa'],
    frequencyBands: [
      [824, 894], // 850 MHz band
      [880, 960] // 900 MHz band
    ],
    emissionDesignators: ['5M00F9W']
  }
};

/**
 * Main function to fetch mobile tower data from ACMA RRL API
 * 
 * @param map Mapbox map instance
 * @param aoGeometry Area of Operations GeoJSON
 * @param setLayerVisibility Function to control layer visibility
 * @returns Promise<boolean> Success status

export async function fetchMobileTowers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection,
  setLayerVisibility: (layerId: string, visible: boolean) => void
): Promise<boolean> {
  console.log('fetchMobileTowers: starting', {
    timestamp: new Date().toISOString(),
    message: 'Fetching mobile tower data from ACMA API'
  });

  try {
    // Calculate bounding box from AO geometry for spatial filtering
    const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
    const centroid = turf.centroid(aoGeometry);
    const centroidCoords = centroid.geometry.coordinates;
    
    console.log('fetchMobileTowers: calculated bounding box', {
      timestamp: new Date().toISOString(),
      bbox: boundingBox,
      centroid: centroidCoords,
      message: 'Bounding box and centroid calculated from AO geometry'
    });
    
    // Calculate an appropriate search radius based on the AO size
    // This ensures we capture towers relevant to the AO
    const aoArea = turf.area(aoGeometry);
    const searchRadius = Math.min(Math.max(Math.sqrt(aoArea) / 1000 * 1.5, 5), 100);
    
    // Construct the ACMA RRL API URL for PTS (mobile tower) sites
    // We use site_search.findSites with PTS license type and proximity search
    const baseUrl = 'https://web.acma.gov.au/rrl/site_search.findSites';
    const queryParams = new URLSearchParams({
      pLICENCE_SUBTYPE: 'Licence Type',
      pLICENCE_EXACT_IND: 'matches',
      pLICENCE_QRY: 'PTS',
      pSUB_TYPE: `<${Math.ceil(searchRadius)}km+from`,
      pEXACT_IND: 'matches',
      pQRY: `${centroidCoords[1]},${centroidCoords[0]}`
    });
    
    const queryUrl = `${baseUrl}?${queryParams.toString()}`;
    
    console.log('fetchMobileTowers: API URL constructed', {
      timestamp: new Date().toISOString(),
      url: queryUrl,
      searchRadius: `${Math.ceil(searchRadius)} km`,
      message: 'Requesting data from ACMA API'
    });
    
    // Fetch data from ACMA API
    const response = await fetch(queryUrl, {
      headers: {
        'Accept': 'application/xml'
      }
    });
    
    if (!response.ok) {
      throw new Error(`ACMA API error: ${response.status} ${response.statusText}`);
    }
    
    const xmlData = await response.text();
    
    // Process the XML/KML response to extract tower data
    const towerData = processKmlResponse(xmlData);
    
    console.log('fetchMobileTowers: processed API response', {
      timestamp: new Date().toISOString(),
      towerCount: towerData.length,
      message: 'Successfully parsed tower data from ACMA'
    });
    
    // Filter towers to ensure they're within or close to the AO
    const filteredTowers = filterTowersByAO(towerData, aoGeometry);
    
    console.log('fetchMobileTowers: filtered by AO', {
      timestamp: new Date().toISOString(),
      originalCount: towerData.length,
      filteredCount: filteredTowers.length,
      message: 'Filtered towers by AO proximity'
    });
    
    // Convert to GeoJSON for map display
    const towerGeoJSON = convertToGeoJSON(filteredTowers);
    
    // Add/update source
    const sourceId = 'mobile-towers-source';
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(towerGeoJSON);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: towerGeoJSON
      });
    }
    
    // Add the main tower layer with styling
    const layerId = 'mobile-towers-layer';
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        // Style based on technology
        'circle-radius': [
          'case',
          ['==', ['get', 'technology'], '5g'], 10,
          ['==', ['get', 'technology'], '4g'], 8,
          ['==', ['get', 'technology'], '3g'], 6,
          6 // Default for unknown
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'technology'], '5g'], '#9932CC', // Purple for 5G
          ['==', ['get', 'technology'], '4g'], '#4682B4', // Blue for 4G
          ['==', ['get', 'technology'], '3g'], '#FFA500', // Orange for 3G
          '#888888' // Gray for unknown
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'carrier'], 'telstra'], '#0066CC', // Telstra blue
          ['==', ['get', 'carrier'], 'optus'], '#00CC00', // Optus green
          ['==', ['get', 'carrier'], 'vodafone'], '#FF0000', // Vodafone red
          '#FFFFFF' // White for others
        ]
      },
      layout: {
        visibility: 'visible'
      }
    });
    
    // Add a layer for tower labels to show when zoomed in
    const labelLayerId = 'mobile-towers-labels';
    if (map.getLayer(labelLayerId)) {
      map.removeLayer(labelLayerId);
    }
    
    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': [
          'concat',
          ['get', 'name'],
          '\n',
          ['get', 'technology'],
          ' - ',
          ['get', 'carrier']
        ],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'visibility': 'none' // Hidden by default, toggle with zoom
      },
      paint: {
        'text-color': '#333',
        'text-halo-color': '#fff',
        'text-halo-width': 1
      }
    });
    
    // Show labels only when zoomed in
    map.on('zoom', () => {
      const zoom = map.getZoom();
      if (zoom > 12) {
        if (map.getLayer(labelLayerId)) {
          map.setLayoutProperty(labelLayerId, 'visibility', 'visible');
        }
      } else {
        if (map.getLayer(labelLayerId)) {
          map.setLayoutProperty(labelLayerId, 'visibility', 'none');
        }
      }
    });
    
    // Set up click handler for tower popups
    map.on('click', layerId, (e) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const props = feature.properties;
      
      // Create popup content
      const content = `
        <div class="text-xs p-1">
          <h3 class="font-bold">${props.name}</h3>
          <p><strong>Carrier:</strong> ${capitalizeFirstLetter(props.carrier)}</p>
          <p><strong>Technology:</strong> ${props.technology.toUpperCase()}</p>
          <p><strong>Assignments:</strong> ${props.assignments}</p>
          ${props.elevation ? `<p><strong>Elevation:</strong> ${props.elevation} m</p>` : ''}
          ${props.location ? `<p><strong>Location:</strong> ${props.location}</p>` : ''}
        </div>
      `;
      
      new mapboxgl.Popup()
        .setLngLat([props.longitude, props.latitude])
        .setHTML(content)
        .addTo(map);
    });
    
    // Change cursor to pointer when hovering over towers
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
    
    setLayerVisibility(layerId, true);
    
    console.log('fetchMobileTowers: layers added to map', {
      timestamp: new Date().toISOString(),
      layers: [layerId, labelLayerId],
      message: 'Successfully added tower layers to map'
    });
    
    return true;
  } catch (error) {
    console.error('fetchMobileTowers: error', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to fetch mobile tower data'
    });
    return false;
  }
}
   */

export async function fetchMobileTowers(
  map: mapboxgl.Map,
  aoGeometry: GeoJSON.FeatureCollection,
  setLayerVisibility: (layerId: string, visible: boolean) => void
): Promise<boolean> {
  console.log('fetchMobileTowers: starting', {
    timestamp: new Date().toISOString(),
    message: 'Fetching mobile tower data from ACMA API'
  });

  try {
    // Calculate bounding box from AO geometry for spatial filtering
    const boundingBox = turf.bbox(aoGeometry) as [number, number, number, number];
    const centroid = turf.centroid(aoGeometry);
    const centroidCoords = centroid.geometry.coordinates;
    
    console.log('fetchMobileTowers: calculated bounding box', {
      timestamp: new Date().toISOString(),
      bbox: boundingBox,
      centroid: centroidCoords,
      message: 'Bounding box and centroid calculated from AO geometry'
    });
    
    // Calculate an appropriate search radius based on the AO size
    const aoArea = turf.area(aoGeometry);
    const searchRadius = Math.min(Math.max(Math.sqrt(aoArea) / 1000 * 1.5, 5), 100);
    
    // Construct our proxy URL instead of direct ACMA API URL
    const proxyUrl = `/api/proxy/acma?lat=${centroidCoords[1]}&lng=${centroidCoords[0]}&radius=${Math.ceil(searchRadius)}`;
    
    console.log('fetchMobileTowers: API URL constructed', {
      timestamp: new Date().toISOString(),
      url: proxyUrl,
      searchRadius: `${Math.ceil(searchRadius)} km`,
      message: 'Requesting data from ACMA API via proxy'
    });
    
    // Fetch data via our proxy API
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ACMA API proxy error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const xmlData = await response.text();
    
    // Process the XML/KML response to extract tower data
    const towerData = processKmlResponse(xmlData);
    
    console.log('fetchMobileTowers: processed API response', {
      timestamp: new Date().toISOString(),
      towerCount: towerData.length,
      message: 'Successfully parsed tower data from ACMA'
    });
    
    // Filter towers to ensure they're within or close to the AO
    const filteredTowers = filterTowersByAO(towerData, aoGeometry);
    
    console.log('fetchMobileTowers: filtered by AO', {
      timestamp: new Date().toISOString(),
      originalCount: towerData.length,
      filteredCount: filteredTowers.length,
      message: 'Filtered towers by AO proximity'
    });
    
    // Convert to GeoJSON for map display
    const towerGeoJSON = convertToGeoJSON(filteredTowers);
    
    // Add/update source
    const sourceId = 'mobile-towers-source';
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(towerGeoJSON);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: towerGeoJSON
      });
    }
    
    // Add the main tower layer with styling
    const layerId = 'mobile-towers-layer';
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        // Style based on technology
        'circle-radius': [
          'case',
          ['==', ['get', 'technology'], '5g'], 10,
          ['==', ['get', 'technology'], '4g'], 8,
          ['==', ['get', 'technology'], '3g'], 6,
          6 // Default for unknown
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'technology'], '5g'], '#9932CC', // Purple for 5G
          ['==', ['get', 'technology'], '4g'], '#4682B4', // Blue for 4G
          ['==', ['get', 'technology'], '3g'], '#FFA500', // Orange for 3G
          '#888888' // Gray for unknown
        ],
        'circle-opacity': 0.8,
        'circle-stroke-width': 2,
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'carrier'], 'telstra'], '#0066CC', // Telstra blue
          ['==', ['get', 'carrier'], 'optus'], '#00CC00', // Optus green
          ['==', ['get', 'carrier'], 'vodafone'], '#FF0000', // Vodafone red
          '#FFFFFF' // White for others
        ]
      },
      layout: {
        visibility: 'visible'
      }
    });
    
    // Add a layer for tower labels to show when zoomed in
    const labelLayerId = 'mobile-towers-labels';
    if (map.getLayer(labelLayerId)) {
      map.removeLayer(labelLayerId);
    }
    
    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': [
          'concat',
          ['get', 'name'],
          '\n',
          ['get', 'technology'],
          ' - ',
          ['get', 'carrier']
        ],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'visibility': 'none' // Hidden by default, toggle with zoom
      },
      paint: {
        'text-color': '#333',
        'text-halo-color': '#fff',
        'text-halo-width': 1
      }
    });
    
    // Show labels only when zoomed in
    map.on('zoom', () => {
      const zoom = map.getZoom();
      if (zoom > 12) {
        if (map.getLayer(labelLayerId)) {
          map.setLayoutProperty(labelLayerId, 'visibility', 'visible');
        }
      } else {
        if (map.getLayer(labelLayerId)) {
          map.setLayoutProperty(labelLayerId, 'visibility', 'none');
        }
      }
    });
    
    // Set up click handler for tower popups
    map.on('click', layerId, (e) => {
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const props = feature.properties;
      
      // Create popup content
      const content = `
        <div class="text-xs p-1">
          <h3 class="font-bold">${props.name}</h3>
          <p><strong>Carrier:</strong> ${capitalizeFirstLetter(props.carrier)}</p>
          <p><strong>Technology:</strong> ${props.technology.toUpperCase()}</p>
          <p><strong>Assignments:</strong> ${props.assignments}</p>
          ${props.elevation ? `<p><strong>Elevation:</strong> ${props.elevation} m</p>` : ''}
          ${props.location ? `<p><strong>Location:</strong> ${props.location}</p>` : ''}
        </div>
      `;
      
      new mapboxgl.Popup()
        .setLngLat([props.longitude, props.latitude])
        .setHTML(content)
        .addTo(map);
    });
    
    // Change cursor to pointer when hovering over towers
    map.on('mouseenter', layerId, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    
    map.on('mouseleave', layerId, () => {
      map.getCanvas().style.cursor = '';
    });
    
    setLayerVisibility(layerId, true);
    
    console.log('fetchMobileTowers: layers added to map', {
      timestamp: new Date().toISOString(),
      layers: [layerId, labelLayerId],
      message: 'Successfully added tower layers to map'
    });
    
    return true;
  } catch (error) {
    console.error('fetchMobileTowers: error', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to fetch mobile tower data'
    });
    return false;
  }
}

/**
 * Process KML/XML response from ACMA API
 */
function processKmlResponse(xmlData: string): TowerData[] {
  try {
    const parsedData = parseXML(xmlData);
    
    // Verify we have valid data
    if (!parsedData || !parsedData.Document || !parsedData.Document.Placemark) {
      console.warn('processKmlResponse: Invalid KML data structure');
      return [];
    }
    
    const placemarks = extractPlacemarks(parsedData);
    
    if (!placemarks || placemarks.length === 0) {
      console.warn('processKmlResponse: No placemarks found');
      return [];
    }
    
    // Process placemarks with added error handling
    return placemarks.map(placemark => {
      try {
        // Extract relevant data with null checks
        const id = getNestedValue(placemark, 'ExtendedData.Data[name="site_id"].value') || `site-${Math.random().toString(36).substring(2, 10)}`;
        const name = getNestedValue(placemark, 'name') || 'Unknown Site';
        
        // Use parseFloat with fallbacks for coordinates
        const latStr = getNestedValue(placemark, 'ExtendedData.Data[name="float_latitude"].value');
        const lngStr = getNestedValue(placemark, 'ExtendedData.Data[name="float_longitude"].value');
        const latitude = parseFloat(latStr || '0');
        const longitude = parseFloat(lngStr || '0');
        
        // Get carrier information
        const carrierRaw = getNestedValue(placemark, 'ExtendedData.Data[name="client_id"].value') || 
                           getNestedValue(placemark, 'ExtendedData.Data[name="carrier"].value') || '';
        
        // Get other fields with fallbacks
        const assignmentsStr = getNestedValue(placemark, 'ExtendedData.Data[name="assignments"].value') || '0';
        const elevationStr = getNestedValue(placemark, 'ExtendedData.Data[name="elevation"].value');
        const state = getNestedValue(placemark, 'ExtendedData.Data[name="state"].value') || '';
        const location = getNestedValue(placemark, 'ExtendedData.Data[name="location"].value') || '';
        
        // Determine carrier based on name pattern or client id
        const carrier = determineCarrier(name, carrierRaw);
        
        // Determine technology based on available data
        const technology = determineTechnology(name);
        
        return {
          id,
          name,
          latitude,
          longitude,
          carrier,
          carrierRaw,
          technology,
          assignments: parseInt(assignmentsStr || '0', 10),
          elevation: elevationStr ? parseInt(elevationStr, 10) : undefined,
          state,
          location
        };
      } catch (error) {
        console.warn('Error processing placemark:', error);
        // Return a minimal tower object if processing fails
        return {
          id: `error-${Math.random().toString(36).substring(2, 10)}`,
          name: 'Error Processing Tower',
          latitude: 0,
          longitude: 0,
          carrier: 'other',
          carrierRaw: '',
          technology: 'unknown',
          assignments: 0
        };
      }
    }).filter(tower => tower.latitude !== 0 && tower.longitude !== 0); // Filter out invalid towers
  } catch (error) {
    console.error('Error processing KML response:', error);
    return [];
  }
}

  /**
   * Filter towers to include only those within or close to the AO
   * 
   * @param towers Array of tower data
   * @param aoGeometry Area of Operations GeoJSON
   * @returns Filtered array of towers
   */
  function filterTowersByAO(towers: TowerData[], aoGeometry: GeoJSON.FeatureCollection): TowerData[] {
    // Handle empty towers array
    if (!towers || towers.length === 0) {
      console.warn('filterTowersByAO: No towers to filter');
      return [];
    }
    
    try {
      // Create a buffered version of the AO for proximity checking
      const bufferedAO = turf.buffer(aoGeometry, 2, { units: 'kilometers' });
      
      // Filter only if we have a valid buffered AO
      if (bufferedAO) {
        return towers.filter(tower => {
          // Skip invalid coordinates
          if (!tower.latitude || !tower.longitude) return false;
          
          try {
            const point = turf.point([tower.longitude, tower.latitude]);
            return turf.booleanPointInPolygon(point, bufferedAO);
          } catch (error) {
            console.warn(`Error checking tower at [${tower.longitude},${tower.latitude}]:`, error);
            // Include the tower if we can't determine if it's in the AO
            return true;
          }
        });
      } else {
        console.warn('filterTowersByAO: Failed to create buffered AO');
        return towers; // Return all towers if buffer fails
      }
    } catch (error) {
      console.error('Error filtering towers by AO:', error);
      return towers; // Return all towers on error
    }
  }

/**
 * Convert tower data to GeoJSON for map rendering
 * 
 * @param towers Array of tower data
 * @returns GeoJSON FeatureCollection
 */
function convertToGeoJSON(towers: TowerData[]): GeoJSON.FeatureCollection {
  const features = towers.map(tower => ({
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [tower.longitude, tower.latitude]
    },
    properties: {
      id: tower.id,
      name: tower.name,
      carrier: tower.carrier,
      carrierRaw: tower.carrierRaw,
      technology: tower.technology,
      assignments: tower.assignments,
      elevation: tower.elevation,
      state: tower.state,
      location: tower.location,
      // Include original coordinates for easier access
      latitude: tower.latitude,
      longitude: tower.longitude
    }
  }));
  
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Apply filters to the mobile towers layer
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
    message: 'Applying filters to mobile tower layer'
  });

  if (!map.getLayer('mobile-towers-layer')) {
    console.warn('filterMobileTowers: layer not found', {
      timestamp: new Date().toISOString(),
      message: 'Cannot filter: mobile-towers-layer does not exist'
    });
    return false;
  }
  
  try {
    // Build filter expression
    let filterParts: any[] = ['all'];
    
    // Add carrier filter if specified
    if (filters.carriers && filters.carriers.length > 0) {
      // Use 'match' expression for better performance with multiple values
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
      // Use 'match' expression for better performance with multiple values
      filterParts.push([
        'match',
        ['get', 'technology'],
        filters.technologies,
        true,
        false
      ]);
    }
    
    // Add frequency range filter if specified
    if (filters.frequencyMin !== undefined && filters.frequencyMax !== undefined) {
      filterParts.push([
        'all',
        ['>=', ['get', 'frequency'], filters.frequencyMin],
        ['<=', ['get', 'frequency'], filters.frequencyMax]
      ]);
    }
    
    console.log('filterMobileTowers: filter expression', {
      timestamp: new Date().toISOString(),
      expression: JSON.stringify(filterParts),
      message: 'Created filter expression'
    });
    
    // Apply filter to main layer
    map.setFilter('mobile-towers-layer', filterParts);
    
    // Also apply to labels layer if it exists
    if (map.getLayer('mobile-towers-labels')) {
      map.setFilter('mobile-towers-labels', filterParts);
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
 * Improved carrier detection from tower data
 */
function determineCarrier(siteName: string, clientId: string): 'telstra' | 'optus' | 'vodafone' | 'other' {
  const nameLower = siteName.toLowerCase();
  
  // First try site name - most reliable
  if (nameLower.includes('telstra')) return 'telstra';
  if (nameLower.includes('optus')) return 'optus';
  if (nameLower.includes('vodafone')) return 'vodafone';
  if (nameLower.includes('tpg')) return 'vodafone'; // TPG merged with Vodafone
  if (nameLower.includes('hutchison')) return 'vodafone';
  
  // Check by client ID if available
  if (clientId) {
    if (clientId.includes('20053843')) return 'telstra';
    if (clientId.includes('1149289')) return 'optus';
    if (clientId.includes('1196220')) return 'vodafone';
    
    // Additional checks for variations of carrier names
    if (clientId.toLowerCase().includes('telstra')) return 'telstra';
    if (clientId.toLowerCase().includes('optus')) return 'optus';
    if (clientId.toLowerCase().includes('vodafone')) return 'vodafone';
  }
  
  // Detect common naming patterns
  if (nameLower.includes('tcl')) return 'telstra'; // Telstra often uses TCL
  if (nameLower.includes('amplitel')) return 'telstra'; // Telstra's tower company
  if (nameLower.includes('singtel')) return 'optus'; // Singtel owns Optus
  
  return 'other';
}

/**
 * Helper function to determine technology based on site name
 */
function determineTechnology(siteName: string, carrierRaw: string): '3g' | '4g' | '5g' | 'unknown' {
  const nameLower = siteName.toLowerCase();
  
  // Enhanced technology detection logic
  if (nameLower.includes('5g') || 
      nameLower.includes('amplitel') ||
      nameLower.includes('mmwave')) {
    return '5g';
  }
  
  if (nameLower.includes('4g') || 
      nameLower.includes('lte') ||
      nameLower.includes('b28')) {
    return '4g';
  }
  
  if (nameLower.includes('3g') || 
      nameLower.includes('umts') ||
      nameLower.includes('hspa')) {
    return '3g';
  }
  
  // Default based on carrier
  if (carrierRaw && carrierRaw.includes('20053843')) {
    // Most Telstra sites support 4G at minimum
    return '4g';
  }
  
  // Most modern towers support 4G at minimum
  return '4g';
}

/**
 * Utility functions for XML/KML processing
 */
function extractPlacemarks(parsedXml: any): any[] {
  // Implementation would depend on the XML parsing library used
  // This is a placeholder function
  return parsedXml?.Document?.Placemark || [];
}

function getNestedValue(obj: any, path: string): string {
  // Implementation would depend on the XML parsing library used
  // This is a placeholder function
  return ''; 
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Note: The parseXML function would need to be implemented in a separate utility file
// It would handle the conversion of XML/KML to a structured object