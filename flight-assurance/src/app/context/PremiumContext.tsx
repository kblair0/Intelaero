/**
 * src/app/context/PremiumContext.tsx
 * 
 * Purpose:
 * Provides centralized premium feature access management throughout the application.
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
// Import shared types
import { TierLevel, FeatureId } from '../types/PremiumTypes';
// Import from premiumConfig.ts
import { FEATURE_TIER_REQUIREMENTS, TIER_CONFIG } from '../utils/premiumConfig';

// Access code validation response
interface CodeValidationResponse {
  valid: boolean;
  tierLevel?: TierLevel;
  expiresAt?: string; // ISO date string
  message?: string;
}

// Premium context state
interface PremiumContextState {
  tierLevel: TierLevel;
  tierExpiration: Date | null;
  isModalOpen: boolean;
  attemptedFeature: FeatureId | null;
  validationLoading: boolean;
  validationError: string | null;
}

// Premium context value exposed to components
interface PremiumContextValue extends PremiumContextState {
  canUseFeature: (featureId: FeatureId, params?: any) => boolean;
  canAddMarker: (markerType: 'gcs' | 'observer' | 'repeater', currentCount: number) => boolean;
  requestUpgrade: (featureId: FeatureId) => void;
  closeModal: () => void;
  validateAccessCode: (code: string) => Promise<boolean>;
  getTierName: (level?: TierLevel) => string;
  getFeatureRequiredTier: (featureId: FeatureId) => TierLevel;
  getRemainingDays: () => number | null;
}

// Context creation
const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

// Re-export TierLevel and FeatureId for backward compatibility
export { TierLevel, FeatureId };

// Storage keys
const STORAGE_KEYS = {
  TIER_LEVEL: 'intel_aero_tier_level',
  TIER_EXPIRATION: 'intel_aero_tier_expiration'
};

// Provider component
export const PremiumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State initialization
  const [state, setState] = useState<PremiumContextState>({
    tierLevel: TierLevel.FREE,
    tierExpiration: null,
    isModalOpen: false,
    attemptedFeature: null,
    validationLoading: false,
    validationError: null
  });

  // Load tier status from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Get tier level
        const storedTierLevel = localStorage.getItem(STORAGE_KEYS.TIER_LEVEL);
        const parsedTierLevel = storedTierLevel ? parseInt(storedTierLevel, 10) : TierLevel.FREE;
        
        // Get expiration date
        const storedExpiration = localStorage.getItem(STORAGE_KEYS.TIER_EXPIRATION);
        let expirationDate: Date | null = null;
        
        if (storedExpiration) {
          expirationDate = new Date(storedExpiration);
          
          // Check if expired
          if (expirationDate && expirationDate < new Date()) {
            // Reset to free tier if expired
            localStorage.removeItem(STORAGE_KEYS.TIER_LEVEL);
            localStorage.removeItem(STORAGE_KEYS.TIER_EXPIRATION);
            expirationDate = null;
            
            setState(prev => ({
              ...prev,
              tierLevel: TierLevel.FREE,
              tierExpiration: null
            }));
          } else {
            // Set valid tier
            setState(prev => ({
              ...prev,
              tierLevel: parsedTierLevel as TierLevel,
              tierExpiration: expirationDate
            }));
          }
        } else if (parsedTierLevel !== TierLevel.FREE) {
          // Set tier without expiration
          setState(prev => ({
            ...prev,
            tierLevel: parsedTierLevel as TierLevel
          }));
        }
      } catch (error) {
        console.error('Error loading premium status:', error);
      }
    }
  }, []);

  // Check if user can use a specific feature - Using FEATURE_TIER_REQUIREMENTS from premiumConfig
  const canUseFeature = useCallback((featureId: FeatureId, params?: any): boolean => {
    // Get the required tier level for this feature
    const requiredTierLevel = FEATURE_TIER_REQUIREMENTS[featureId] || TierLevel.COMMERCIAL;
    
    // Check if current tier is greater than or equal to required tier
    if (state.tierLevel < requiredTierLevel) {
      return false;
    }
    
    // Special case for marker limits
    if (featureId === 'add_gcs' || featureId === 'add_observer' || featureId === 'add_repeater') {
      const markerType = featureId.replace('add_', '') as 'gcs' | 'observer' | 'repeater';
      const currentCount = params?.currentCount || 0;
      return currentCount < TIER_CONFIG[state.tierLevel].maxMarkers[markerType];
    }
    
    // If tier level is sufficient, allow access to the feature
    return true;
  }, [state.tierLevel]);

  // Check if user can add another marker of specified type
  const canAddMarker = useCallback((markerType: 'gcs' | 'observer' | 'repeater', currentCount: number): boolean => {
    return currentCount < TIER_CONFIG[state.tierLevel].maxMarkers[markerType];
  }, [state.tierLevel]);

  // Open upgrade modal when attempting to use premium feature
  const requestUpgrade = useCallback((featureId: FeatureId) => {
    setState(prev => ({
      ...prev,
      isModalOpen: true,
      attemptedFeature: featureId
    }));
  }, []);

  // Close upgrade modal
  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      attemptedFeature: null,
      validationError: null
    }));
  }, []);

  // Validate access code
  const validateAccessCode = useCallback(async (code: string): Promise<boolean> => {
    setState(prev => ({
      ...prev,
      validationLoading: true,
      validationError: null
    }));

    try {
      // API call to validate code
      const response = await fetch('/api/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        throw new Error('Failed to validate code');
      }

      const data: CodeValidationResponse = await response.json();

      if (!data.valid) {
        setState(prev => ({
          ...prev,
          validationLoading: false,
          validationError: data.message || 'Invalid access code'
        }));
        return false;
      }

      // Valid code - update tier level
      const newTierLevel = data.tierLevel || TierLevel.COMMUNITY;
      const expirationDate = data.expiresAt ? new Date(data.expiresAt) : null;

      // Update localStorage
      localStorage.setItem(STORAGE_KEYS.TIER_LEVEL, newTierLevel.toString());
      if (expirationDate) {
        localStorage.setItem(STORAGE_KEYS.TIER_EXPIRATION, expirationDate.toISOString());
      }

      // Update state
      setState(prev => ({
        ...prev,
        tierLevel: newTierLevel,
        tierExpiration: expirationDate,
        validationLoading: false,
        isModalOpen: false
      }));

      return true;
    } catch (error) {
      console.error('Error validating access code:', error);
      setState(prev => ({
        ...prev,
        validationLoading: false,
        validationError: 'Error validating code. Please try again.'
      }));
      return false;
    }
  }, []);

  // Get tier name
  const getTierName = useCallback((level?: TierLevel): string => {
    const tierLevel = level !== undefined ? level : state.tierLevel;
    return TIER_CONFIG[tierLevel].name;
  }, [state.tierLevel]);

  // Get required tier for a feature - using the imported FEATURE_TIER_REQUIREMENTS
  const getFeatureRequiredTier = useCallback((featureId: FeatureId): TierLevel => {
    return FEATURE_TIER_REQUIREMENTS[featureId] || TierLevel.FREE;
  }, []);

  // Get remaining days for subscription
  const getRemainingDays = useCallback((): number | null => {
    if (!state.tierExpiration) return null;
    
    const now = new Date();
    const diff = state.tierExpiration.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }, [state.tierExpiration]);

  // Context value
  const contextValue: PremiumContextValue = {
    ...state,
    canUseFeature,
    canAddMarker,
    requestUpgrade,
    closeModal,
    validateAccessCode,
    getTierName,
    getFeatureRequiredTier,
    getRemainingDays
  };

  return (
    <PremiumContext.Provider value={contextValue}>
      {children}
    </PremiumContext.Provider>
  );
};

// Custom hook for using premium context
export const usePremium = (): PremiumContextValue => {
  const context = useContext(PremiumContext);
  if (context === undefined) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return context;
};