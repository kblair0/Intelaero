/**
 * Shared premium types for use across the application
 */

// Tier levels
export enum TierLevel {
  FREE = 0,
  COMMUNITY = 1,
  COMMERCIAL = 2
}

// Feature IDs for all premium features
export type FeatureId = 
  | 'add_gcs' 
  | 'add_observer' 
  | 'add_repeater'
  | 'station_analysis'
  | 'merged_analysis' 
  | 'station_los_analysis'
  | 'flight_path_analysis'
  | 'terrain_analysis'
  | 'local_powerlines';