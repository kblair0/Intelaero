/**
 * ReloadButton.tsx
 * 
 * Purpose:
 * Provides a simple, robust button to reload the entire application.
 * Handles both programmatic state reset and full page reload as fallback.
 * 
 * Related Files:
 * - Used in page.tsx main layout
 * - Integrates with MapContext for state management
 * - May be used in error boundaries or toolbars
 * - Works with tracking system for analytics
 * 
 * Implementation Details:
 * - Uses window.location.reload() for complete app reset
 * - Includes loading state for better UX
 * - Follows design system with consistent styling
 * - Tracks reload events for monitoring
 */

import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface ReloadButtonProps {
  /** Optional custom text for the button */
  text?: string;
  /** Optional custom icon */
  icon?: React.ReactNode;
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Button style variant - added danger for reset operations */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  /** Optional className for additional styling */
  className?: string;
  /** Optional callback before reload */
  onBeforeReload?: () => void;
}

/**
 * ReloadButton Component
 * 
 * A robust button component that reloads the entire application.
 * Styled to match the wizard's design system with consistent spacing and colors.
 */
const ReloadButton: React.FC<ReloadButtonProps> = ({
  text = "Reset App",
  icon,
  size = 'md',
  variant = 'outline',
  className = '',
  onBeforeReload
}) => {
  const [isReloading, setIsReloading] = useState(false);

  /**
   * Handles the reload action with proper state management
   */
  const handleReload = async () => {
    try {
      setIsReloading(true);
      
      // Call optional callback before reload
      if (onBeforeReload) {
        onBeforeReload();
      }

      // Track the reload event if tracking is available
      if (typeof window !== 'undefined' && (window as any).trackEvent) {
        (window as any).trackEvent('app_reload_triggered', {
          source: 'reload_button',
          timestamp: new Date().toISOString()
        });
      }

      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force a complete reload of the application
      window.location.reload();
    } catch (error) {
      console.error('Error during app reload:', error);
      // Reset loading state if reload fails
      setIsReloading(false);
    }
  };

  // Size classes matching wizard button sizing
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm', 
    lg: 'px-6 py-2 text-sm'
  };

  // Variant classes matching wizard styling
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white border border-gray-600',
    outline: 'bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300',
    danger: 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 hover:border-red-300'
  };

  return (
    <button
      onClick={handleReload}
      disabled={isReloading}
      className={`
        inline-flex items-center justify-center gap-2 
        font-medium rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      title="Reset the entire application and start fresh"
      aria-label={isReloading ? 'Resetting application...' : 'Reset application'}
    >
      {/* Icon with rotation animation when loading - matches wizard icon styling */}
      <span className={`flex-shrink-0 ${isReloading ? 'animate-spin' : ''}`}>
        {icon || <RotateCcw className="w-4 h-4" />}
      </span>
      
      {/* Button text - matches wizard text styling */}
      <span className="font-medium">
        {isReloading ? 'Resetting...' : text}
      </span>
    </button>
  );
};

export default ReloadButton;