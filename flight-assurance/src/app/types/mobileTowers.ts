/**
 * mobileTowers.ts
 * 
 * Purpose:
 * Provides TypeScript definitions for mobile tower data structures, filtering options,
 * and related interfaces needed throughout the application.
 * 
 * This type file:
 * - Defines frequency band categories
 * - Specifies filter options for carriers, technologies, and frequencies
 * - Provides interfaces for tower properties and GeoJSON features
 * - Supports type safety across the tower display system
 */

/**
 * Frequency band identifiers
 */
export type FrequencyBand = 
  | 'LOW_BAND'     // 700-900 MHz
  | 'MID_BAND_1'   // 1800-2100 MHz
  | 'MID_BAND_2'   // 2300-2600 MHz
  | 'HIGH_BAND'    // 3300-3800 MHz
  | 'MMWAVE';      // 24+ GHz

/**
 * Mobile tower filter criteria
 */
export interface MobileTowerFilters {
  carriers?: string[];           // 'telstra', 'optus', 'vodafone'
  technologies?: string[];       // '3g', '4g', '5g'
  frequencyBands?: FrequencyBand[];
}

/**
 * Mobile tower properties
 * These properties are available in the GeoJSON feature properties
 */
export interface MobileTowerProperties {
  // Core identification
  id: string;
  name: string;
  site_id?: string;
  license_no?: string;
  
  // Network information
  carrier: string;       // Normalized carrier name: 'telstra', 'optus', 'vodafone', 'other'
  carrierRaw?: string;   // Original carrier name from source data
  technology: string;    // Normalized technology: '3g', '4g', '5g', 'unknown'
  
  // Technical parameters
  frequency: number;     // Center frequency in Hz
  bandwidth?: number;    // Channel bandwidth in Hz
  emission?: string;     // Emission designator (e.g., '10M0G7W')
  height?: number;       // Antenna height in meters
  azimuth?: number;      // Direction in degrees (0-359)
  tilt?: number;         // Antenna tilt in degrees (negative = downtilt)
  eirp?: number;         // Effective Isotropic Radiated Power
  eirp_unit?: string;    // Unit for EIRP (typically 'W')
  
  // Geographic information
  latitude: number;
  longitude: number;
  elevation?: number;    // Height above sea level in meters
  state?: string;        // State/territory code (NSW, VIC, etc.)
  postcode?: string;
  location?: string;     // Descriptive location
}