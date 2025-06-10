import React, { useState, useEffect } from 'react';
import { RotateCcw, Smartphone, Monitor, Tablet } from 'lucide-react';
import Image from 'next/image';

/**
 * MobileOrientationGuard.tsx
 * 
 * Purpose:
 * Detects mobile devices in portrait mode and shows instructions to rotate device.
 * Optionally suggests using larger devices if landscape mobile is still too cramped.
 * 
 * Relations:
 * - Used in main layout (page.tsx) to wrap the entire application
 * - Integrates with existing responsive design system
 * - Works with Tailwind CSS classes for responsive breakpoints
 */

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
  isSmallLandscape: boolean; // landscape but still too small
}

interface MobileOrientationGuardProps {
  children: React.ReactNode;
  /**
   * Minimum width in landscape mode to consider "usable"
   * Below this, we'll suggest using a larger device
   */
  minLandscapeWidth?: number;
  /**
   * Show "use larger device" suggestion even in landscape if screen is too small
   */
  suggestLargerDevice?: boolean;
}

const MobileOrientationGuard: React.FC<MobileOrientationGuardProps> = ({
  children,
  minLandscapeWidth = 640, // 640px = Tailwind's sm breakpoint
  suggestLargerDevice = true
}) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isPortrait: false,
    isLandscape: false,
    screenWidth: 0,
    screenHeight: 0,
    isSmallLandscape: false
  });

  const [showLargerDeviceSuggestion, setShowLargerDeviceSuggestion] = useState(false);

  /**
   * Detect device type and orientation
   */
  const updateDeviceInfo = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;
    const isLandscape = width > height;
    
    // Detect mobile/tablet based on screen size and user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /iphone|ipod|android|blackberry|windows phone|webos/.test(userAgent);
    const isTabletUA = /ipad|android(?!.*mobile)|tablet/.test(userAgent);
    
    // Consider device mobile if:
    // 1. User agent indicates mobile, OR
    // 2. Screen width is less than 768px (typical mobile breakpoint)
    const isMobile = isMobileUA || (width < 768 && !isTabletUA);
    const isTablet = isTabletUA || (width >= 768 && width < 1024);
    
    // Check if landscape mode is still too cramped
    const isSmallLandscape = isLandscape && width < minLandscapeWidth;

    setDeviceInfo({
      isMobile,
      isTablet,
      isPortrait,
      isLandscape,
      screenWidth: width,
      screenHeight: height,
      isSmallLandscape
    });
  };

  useEffect(() => {
    // Initial check
    updateDeviceInfo();

    // Listen for orientation/resize changes
    const handleResize = () => {
      updateDeviceInfo();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [minLandscapeWidth]);

  /**
   * Show rotation instruction for mobile portrait mode
   */
  const shouldShowRotateMessage = deviceInfo.isMobile && deviceInfo.isPortrait;

  /**
   * Show larger device suggestion for small landscape screens
   */
  const shouldShowLargerDeviceMessage = 
    suggestLargerDevice && 
    deviceInfo.isMobile && 
    deviceInfo.isLandscape && 
    deviceInfo.isSmallLandscape &&
    !showLargerDeviceSuggestion;

  // If we should show rotate message, render the overlay
  if (shouldShowRotateMessage) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          {/* Logo */}
          <div className="mb-6">
            <Image
              src="/Logonobackgrnd.png"
              alt="Intel.Aero Logo"
              width={80}
              height={32}
              className="mx-auto"
              style={{ objectFit: "contain" }}
            />
          </div>

          {/* Rotate Icon Animation */}
          <div className="mb-6">
            <div className="relative inline-block">
              <Smartphone className="w-16 h-16 text-blue-600 mx-auto animate-pulse" />
              <RotateCcw className="w-8 h-8 text-amber-600 absolute -top-2 -right-2 animate-spin" 
                style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
            </div>
          </div>

          {/* Instructions */}
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Please Rotate Your Device
          </h2>
          
          <p className="text-gray-600 mb-4 leading-relaxed">
            Intel.Aero's drone planning tools work best in landscape mode for optimal map viewing and analysis.
          </p>

          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              🔄 Turn your device sideways to continue
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If landscape is too small and we should suggest larger device
  if (shouldShowLargerDeviceMessage) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          {/* Logo */}
          <div className="mb-6">
            <Image
              src="/Logonobackgrnd.png"
              alt="Intel.Aero Logo"
              width={80}
              height={32}
              className="mx-auto"
              style={{ objectFit: "contain" }}
            />
          </div>

          {/* Device Icons */}
          <div className="mb-6 flex justify-center gap-4">
            <Tablet className="w-12 h-12 text-blue-600" />
            <Monitor className="w-12 h-12 text-amber-600" />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Better Experience Available
          </h2>
          
          <p className="text-gray-600 mb-4 leading-relaxed">
            For the best Intel.Aero experience with full access to all drone planning features, we recommend using:
          </p>

          <div className="space-y-2 mb-6 text-left">
            <div className="flex items-center gap-3 p-2 bg-blue-50 rounded">
              <Tablet className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-blue-800">Tablet (iPad, Android tablet)</span>
            </div>
            <div className="flex items-center gap-3 p-2 bg-amber-50 rounded">
              <Monitor className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-amber-800">Desktop or laptop computer</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowLargerDeviceSuggestion(true)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Continue Anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Normal rendering - show the app
  return <>{children}</>;
};

export default MobileOrientationGuard;