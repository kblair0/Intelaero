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
 * Related files:
 * - PremiumContext.tsx: Provides permission checking logic
 * - UpgradeModal.tsx: Shown when user attempts to access a premium feature
 */

"use client";

import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { usePremium } from '../../context/PremiumContext';
import { FeatureId } from '../../types/PremiumTypes';

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  featureId: FeatureId;
  children: ReactNode;
  permissionParams?: any; // Optional parameters for permission check
}

const PremiumButton: React.FC<PremiumButtonProps> = ({
  featureId,
  onClick,
  children,
  permissionParams,
  disabled,
  className,
  ...props
}) => {
  const { canUseFeature, requestUpgrade } = usePremium();
  
  // Check if user has permission to use this feature
  const hasPermission = canUseFeature(featureId, permissionParams);

  // Handle button click
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // If user doesn't have permission, request upgrade
    if (!hasPermission) {
      requestUpgrade(featureId);
      return;
    }
    
    // Otherwise, execute original onClick handler
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
};

export default PremiumButton;