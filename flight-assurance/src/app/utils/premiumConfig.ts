/**
 * Premium feature configuration and tier definitions
 * 
 * This file contains all tier-specific configurations, feature requirements,
 * and pricing information for the premium feature system.
 */

import { TierLevel, FeatureId } from '../types/PremiumTypes';

/**
 * Feature tier requirements
 * Defines which tier level is required for each premium feature
 */
export const FEATURE_TIER_REQUIREMENTS: Record<FeatureId, TierLevel> = {
  // Marker limits
  'add_gcs': TierLevel.FREE,
  'add_observer': TierLevel.FREE,
  'add_repeater': TierLevel.FREE,
  
  // Analysis features
  'station_analysis': TierLevel.FREE,
  'station_los_analysis': TierLevel.FREE,
  'terrain_analysis': TierLevel.FREE,
  'flight_path_analysis': TierLevel.COMMUNITY,
  'merged_analysis': TierLevel.COMMERCIAL,
  'local_powerlines': TierLevel.COMMUNITY,
};

/**
 * Comprehensive tier configuration
 * Contains all tier-specific settings in one place
 */
export const TIER_CONFIG = {
  [TierLevel.FREE]: {
    name: 'Free',
    maxMarkers: {
      gcs: 2,
      observer: 2,
      repeater: 2
    },
    maxAnalysisResolution: 50, // meters
  },
  [TierLevel.COMMUNITY]: {
    name: 'Community',
    maxMarkers: {
      gcs: 5,
      observer: 5,
      repeater: 5
    },
    maxAnalysisResolution: 20, // meters
  },
  [TierLevel.COMMERCIAL]: {
    name: 'Commercial',
    maxMarkers: {
      gcs: Infinity,
      observer: Infinity,
      repeater: Infinity
    },
    maxAnalysisResolution: 5, // meters
  }
};