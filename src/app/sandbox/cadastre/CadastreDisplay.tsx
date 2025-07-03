/**
 * CadastreDisplay.tsx
 * 
 * Purpose:
 * Map layer rendering component for NSW Cadastre property boundaries and survey marks.
 * Handles the integration between the cadastre context state and the actual map display,
 * including popup rendering and layer visibility management. This component follows the
 * established pattern from MeshblockDisplay.tsx.
 * 
 * Key Features:
 * - Renders property popup when property is selected
 * - Renders survey mark popup when survey mark is selected
 * - Manages popup positioning and map integration
 * - Handles popup state synchronization with context
 * - Responsive positioning for mobile devices
 * 
 * Related Files:
 * - CadastreContext.tsx - Provides popup state and selection data
 * - PropertyPopup.tsx - Popup component for displaying feature details
 * - CadastreService.ts - Handles map layer creation and management
 * - types.ts - Type definitions for features and props
 */

'use client'; 
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMapContext } from '../../context/mapcontext';
import { useCadastreContext } from './CadastreContext';
import PropertyPopup from './PropertyPopup';
import { CadastreDisplayProps } from './cadastre-types';

/**
 * Popup positioning utility
 */
interface PopupPosition {
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
}

/**
 * Calculates optimal popup position to keep it within viewport
 */
function calculatePopupPosition(
  clickEvent: { x: number; y: number },
  popupElement: HTMLElement,
  mapContainer: HTMLElement
): PopupPosition {
  const mapRect = mapContainer.getBoundingClientRect();
  const popupRect = popupElement.getBoundingClientRect();
  
  // Default popup dimensions (will be adjusted based on content)
  const popupWidth = Math.min(320, mapRect.width * 0.9);
  const popupHeight = Math.min(400, mapRect.height * 0.8);
  
  // Calculate position relative to map container
  let left = clickEvent.x - mapRect.left;
  let top = clickEvent.y - mapRect.top;
  
  // Adjust horizontal position to keep popup in viewport
  if (left + popupWidth > mapRect.width) {
    left = mapRect.width - popupWidth - 10; // 10px margin
  }
  if (left < 10) {
    left = 10;
  }
  
  // Adjust vertical position to keep popup in viewport
  if (top + popupHeight > mapRect.height) {
    top = mapRect.height - popupHeight - 10; // 10px margin
  }
  if (top < 10) {
    top = 10;
  }
  
  return {
    left,
    top,
    maxWidth: popupWidth,
    maxHeight: popupHeight
  };
}

/**
 * Main cadastre display component
 */
const CadastreDisplay: React.FC<CadastreDisplayProps> = () => {
  const { map } = useMapContext();
  const {
    selectedProperty,
    selectedSurveyMark,
    showPopup,
    closePopup
  } = useCadastreContext();
  
  // Popup positioning state
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  
  // Map container reference for positioning calculations
  const [mapContainer, setMapContainer] = useState<HTMLElement | null>(null);
  
  /**
   * Initialize map container reference
   */
  useEffect(() => {
    if (map) {
      const container = map.getContainer();
      setMapContainer(container);
    }
  }, [map]);
  
  /**
   * Handle map click events to capture click position for popup positioning
   */
  useEffect(() => {
    if (!map) return;
    
    const handleMapClick = (e: any) => {
      // Store click position for popup positioning
      const mapContainer = map.getContainer();
      const mapRect = mapContainer.getBoundingClientRect();
      
      setClickPosition({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY
      });
    };
    
    // Add click listener to map
    map.on('click', handleMapClick);
    
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map]);
  
  /**
   * Update popup position when popup is shown or click position changes
   */
  useEffect(() => {
    if (showPopup && clickPosition && popupRef.current && mapContainer) {
      // Small delay to ensure popup has rendered and has dimensions
      const timer = setTimeout(() => {
        if (popupRef.current) {
          const position = calculatePopupPosition(
            clickPosition,
            popupRef.current,
            mapContainer
          );
          setPopupPosition(position);
        }
      }, 10);
      
      return () => clearTimeout(timer);
    } else {
      setPopupPosition(null);
    }
  }, [showPopup, clickPosition, mapContainer]);
  
  /**
   * Handle escape key to close popup
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPopup) {
        closePopup();
      }
    };
    
    if (showPopup) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showPopup, closePopup]);
  
  /**
   * Handle click outside popup to close it
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showPopup && 
        popupRef.current && 
        !popupRef.current.contains(e.target as Node)
      ) {
        closePopup();
      }
    };
    
    if (showPopup) {
      // Add delay to prevent immediate closure from the same click that opened it
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPopup, closePopup]);
  
  // Don't render anything if no popup should be shown
  if (!showPopup || (!selectedProperty && !selectedSurveyMark) || !mapContainer) {
    return null;
  }
  
  // Create popup content
  const popupContent = (
    <div
      ref={popupRef}
      className="absolute z-50 transition-all duration-200 ease-out"
      style={{
        left: popupPosition?.left ?? 0,
        top: popupPosition?.top ?? 0,
        maxWidth: popupPosition?.maxWidth ?? 320,
        maxHeight: popupPosition?.maxHeight ?? 400,
        opacity: popupPosition ? 1 : 0,
        transform: popupPosition ? 'scale(1)' : 'scale(0.95)',
        pointerEvents: popupPosition ? 'auto' : 'none'
      }}
    >
      <div className="relative">
        {/* Popup shadow/backdrop */}
        <div className="absolute inset-0 bg-black/20 rounded-lg blur-sm transform translate-x-1 translate-y-1" />
        
        {/* Actual popup content */}
        <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          <PropertyPopup
            property={selectedProperty}
            surveyMark={selectedSurveyMark}
            onClose={closePopup}
          />
        </div>
      </div>
    </div>
  );
  
  // Render popup using portal to map container
  return createPortal(popupContent, mapContainer);
};

export default CadastreDisplay;