// PremiumTypes.ts
export enum TierLevel {
  FREE = 0,
  COMMUNITY = 1,
  COMMERCIAL = 2
}

// Feature IDs with tier requirements
export type FeatureId = 
  | 'add_gcs' 
  | 'add_observer' 
  | 'add_repeater'
  | 'station_analysis'
  | 'merged_analysis' 
  | 'station_los_analysis'
  | 'flight_path_analysis'
  | 'terrain_analysis'
  | 'local_powerlines'
  | 'hv_powerlines'
  | 'airspace_analysis'
  | 'extended_grid_range'
  | 'high_resolution_grid'
  | 'mobile_tower_analysis';