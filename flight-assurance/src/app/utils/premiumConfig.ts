/**
 * Premium feature configuration and tier definitions
 * 
 * This file contains all tier-specific configurations, feature requirements,
 * and parameter limits for the premium feature system.
 */

import { TierLevel, FeatureId } from '../types/PremiumTypes';

/**
 * TIER_CONFIG - The single source of truth for all tier-related configurations
 * This defines what each tier can access, and any specific limitations
 */
export const TIER_CONFIG = {
  [TierLevel.FREE]: {
    name: 'Free',
    // Marker limits
    maxMarkers: {
      gcs: 0,         
      observer: 1,
      repeater: 0      
    },
    // Parameter limits
    parameters: {
      gridRange: { min: 100, max: 500 },
      gridSize: { min: 30, max: 100 },
      stationCount: { min: 0, max: 1 }
    },
    // Feature access (true = available in this tier)
    features: {
      'station_analysis': true,
      'station_los_analysis': true,
      'terrain_analysis': true,
      'flight_path_analysis': false,
      'merged_analysis': false,
      'local_powerlines': false,
      'hv_powerlines': true,
      'extended_grid_range': false,
      'high_resolution_grid': false,
      'airspace_analysis': true,
      'mobile_tower_analysis': false,
      'tree_heights': false
    }
  },
  [TierLevel.COMMUNITY]: {
    name: 'Community',
    maxMarkers: {
      gcs: 1,
      observer: 2,
      repeater: 1
    },
    parameters: {
      gridRange: { min: 100, max: 500 },
      gridSize: { min: 30, max: 100 },
      stationCount: { min: 0, max: 4 }
    },
    features: {
      'station_analysis': true,
      'station_los_analysis': true,
      'terrain_analysis': true,
      'flight_path_analysis': true,
      'merged_analysis': false,
      'local_powerlines': false,
      'hv_powerlines': true,
      'extended_grid_range': false,
      'high_resolution_grid': false,
      'airspace_analysis': true,
      'mobile_tower_analysis': false,
      'tree_heights': false
    }
  },
  [TierLevel.COMMERCIAL]: {
    name: 'Commercial',
    maxMarkers: {
      gcs: 10,
      observer: 10,
      repeater: 10
    },
    parameters: {
      gridRange: { min: 100, max: 5000 },
      gridSize: { min: 1, max: 100 },
      stationCount: { min: 0, max: 30 }
    },
    features: {
      'station_analysis': true,
      'station_los_analysis': true,
      'terrain_analysis': true,
      'flight_path_analysis': true,
      'merged_analysis': true,
      'local_powerlines': true,
      'hv_powerlines': true,
      'extended_grid_range': true,
      'high_resolution_grid': true,
      'airspace_analysis': true,
      'mobile_tower_analysis': true,
      'tree_heights': true
    }
  }
};

/**
 * Helper function to derive FEATURE_TIER_REQUIREMENTS from TIER_CONFIG
 * This ensures consistency between requirements and actual tier capabilities
 */
function generateFeatureTierRequirements(): Record<FeatureId, TierLevel> {
  const requirements: Record<string, TierLevel> = {};
  
  // Handle regular features
  const allFeatures = Object.keys(TIER_CONFIG[TierLevel.COMMERCIAL].features);
  allFeatures.forEach(feature => {
    // Find the lowest tier that has this feature
    for (let tier = TierLevel.FREE; tier <= TierLevel.COMMERCIAL; tier++) {
      if (TIER_CONFIG[tier].features[feature]) {
        requirements[feature] = tier;
        break;
      }
    }
  });
  
  // Handle marker types
  const markerTypes = ['gcs', 'observer', 'repeater'] as const;
  markerTypes.forEach(markerType => {
    const featureId = `add_${markerType}`;
    
    // Find the lowest tier that allows this marker
    for (let tier = TierLevel.FREE; tier <= TierLevel.COMMERCIAL; tier++) {
      if (TIER_CONFIG[tier].maxMarkers[markerType] > 0) {
        requirements[featureId] = tier;
        break;
      }
    }
  });
  
  return requirements as Record<FeatureId, TierLevel>;
}

/**
 * Feature tier requirements - DERIVED FROM TIER_CONFIG
 * This ensures there are no inconsistencies between tier requirements
 * and the actual capabilities of each tier
 */
export const FEATURE_TIER_REQUIREMENTS = generateFeatureTierRequirements();

/**
 * Parameter limits - FOR BACKWARDS COMPATIBILITY
 * These values are now directly derived from TIER_CONFIG
 */
export const PARAMETER_LIMITS = {
  [TierLevel.FREE]: TIER_CONFIG[TierLevel.FREE].parameters,
  [TierLevel.COMMUNITY]: TIER_CONFIG[TierLevel.COMMUNITY].parameters,
  [TierLevel.COMMERCIAL]: TIER_CONFIG[TierLevel.COMMERCIAL].parameters
};