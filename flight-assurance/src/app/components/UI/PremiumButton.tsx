/**
 * src/app/components/UI/PremiumButton.tsx
 * 
 * Purpose:
 * A permission-aware button component that acts as a drop-in replacement for standard buttons.
 * It checks if the user has access to the specified feature before executing the onClick handler.
 * 
 * If the user doesn't have access, it triggers the upgrade flow instead of performing the action.
 * This component maintains the original button styling and behavior for seamless integration.
 * 

 */
/**
 * PremiumButton.tsx - Enhanced with subtle premium indicators
 */

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { usePremium } from '../../context/PremiumContext';
import { FeatureId, TierLevel } from '../../types/PremiumTypes';
import { Sparkles } from 'lucide-react'; // Or another icon from your library

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  featureId: FeatureId;
  children: ReactNode;
  permissionParams?: any;
  // New props
  showIndicator?: boolean; // Whether to show the premium indicator
  indicatorPosition?: 'left' | 'right'; // Where to position the indicator
}

const PremiumButton: React.FC<PremiumButtonProps> = ({
  featureId,
  onClick,
  children,
  permissionParams,
  disabled,
  className,
  showIndicator = true,
  indicatorPosition = 'left',
  ...props
}) => {
  const { canUseFeature, requestUpgrade, getRequiredTierForFeature, tierLevel } = usePremium();
  
  // Check if user has permission to use this feature
  const hasPermission = canUseFeature(featureId, permissionParams);
  
  // Get the tier required for this feature
  const requiredTier = getRequiredTierForFeature(featureId);
  
  // Only show indicator if this is a premium feature and user doesn't have access
  const shouldShowIndicator = showIndicator && (requiredTier > TierLevel.FREE) && (requiredTier > tierLevel);

  // Handle button click
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasPermission) {
      requestUpgrade(featureId);
      return;
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`relative ${className}`}
      {...props}
    >
      {shouldShowIndicator && indicatorPosition === 'left' && (
        <span className="inline-flex items-center mr-1.5 text-amber-500">
          <Sparkles size={14} />
        </span>
      )}
      
      {children}
      
      {shouldShowIndicator && indicatorPosition === 'right' && (
        <span className="inline-flex items-center ml-1.5 text-amber-500">
          <Sparkles size={14} />
        </span>
      )}
      
      {/* Optional tooltip-style indicator that appears on hover */}
      {shouldShowIndicator && (
        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-amber-50 
                       text-amber-800 text-xs rounded shadow-sm opacity-0 group-hover:opacity-100 
                       pointer-events-none transition-opacity whitespace-nowrap border border-amber-200">
          {requiredTier === TierLevel.COMMUNITY ? 'Community' : 'Commercial'} feature
        </span>
      )}
    </button>
  );
};

export default PremiumButton;