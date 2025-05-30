/**
 * src/app/components/UI/MarkerLocationsModal.tsx
 * 
 * Purpose:
 * Displays all map markers in a tabbed modal interface with coordinate copying functionality.
 * Provides users with a comprehensive view of all placed markers for planning and reference purposes.
 * 
 * Features:
 * - Tabbed view filtering by marker type (All, GCS, Observer, Repeater)
 * - Click-to-copy coordinates functionality with visual feedback
 * - Consistent naming with existing marker display logic
 * - Responsive table layout with proper accessibility
 * - Auto-scales to map container size with proper constraints
 * - Click-outside and ESC key to close functionality
 * - Fixed header/content spacing with proper z-index management
 * 
 * Related Files:
 * - MarkerContext.tsx: Provides marker data and types
 * - StationAnalysisCard.tsx: Triggers this modal via "View Locations" button
 * - UpgradeModal.tsx: Design pattern reference for modal structure
 * 
 * Changes Made:
 * - Fixed modal sizing to be responsive and auto-scale to container
 * - Added click-outside-to-close functionality with proper backdrop handling
 * - Fixed close button z-index and positioning
 * - Corrected header/table spacing by removing sticky positioning conflicts
 * - Added ESC key handler for better UX
 * - Improved responsive design for smaller screens
 */

"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { X, MapPin, Copy, Check } from 'lucide-react';
import { useMarkersContext, Marker, MarkerType } from '../../context/MarkerContext';

interface MarkerLocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal component for displaying and managing marker locations
 * Now with proper sizing, click-outside handling, and improved UX
 */
const MarkerLocationsModal: React.FC<MarkerLocationsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { markers } = useMarkersContext();
  const [activeTab, setActiveTab] = useState<'all' | MarkerType>('all');
  const [copiedCoords, setCopiedCoords] = useState<string | null>(null);
  
  // Refs for click-outside detection
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // All hooks must be called before any early returns
  const getStationDisplayName = useCallback((type: MarkerType): string => {
    switch (type) {
      case 'gcs': return 'GCS';
      case 'observer': return 'Observer';
      case 'repeater': return 'Repeater';
      default: return type.toUpperCase();
    }
  }, []);

  const getMarkerDisplayName = useCallback((marker: Marker, allMarkers: Marker[]): string => {
    const sameTypeMarkers = allMarkers.filter(m => m.type === marker.type);
    const displayName = getStationDisplayName(marker.type);
    
    if (sameTypeMarkers.length > 1) {
      const index = sameTypeMarkers.findIndex(m => m.id === marker.id) + 1;
      return `${displayName} #${index}`;
    }
    return displayName;
  }, [getStationDisplayName]);

  const filteredMarkers = useMemo(() => {
    return activeTab === 'all' ? markers : markers.filter(m => m.type === activeTab);
  }, [markers, activeTab]);

  const tabs = useMemo(() => [
    { id: 'all' as const, label: 'All Markers', count: markers.length },
    { id: 'gcs' as const, label: 'GCS', count: markers.filter(m => m.type === 'gcs').length },
    { id: 'observer' as const, label: 'Observer', count: markers.filter(m => m.type === 'observer').length },
    { id: 'repeater' as const, label: 'Repeater', count: markers.filter(m => m.type === 'repeater').length },
  ], [markers]);

  const handleCopyCoordinates = useCallback(async (lat: number, lng: number): Promise<void> => {
    const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      await navigator.clipboard.writeText(coords);
      setCopiedCoords(coords);
      setTimeout(() => setCopiedCoords(null), 2000);
    } catch (err) {
      console.error('Failed to copy coordinates:', err);
      const textArea = document.createElement('textarea');
      textArea.value = coords;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCoords(coords);
      setTimeout(() => setCopiedCoords(null), 2000);
    }
  }, []);

  /**
   * Handle click outside modal to close
   */
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  }, [onClose]);

  /**
   * Handle ESC key press to close modal
   */
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Early return AFTER all hooks
  if (!isOpen) return null;

  return (
    <div 
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header - Fixed at top */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-200" />
              <h2 className="text-lg font-semibold">Marker Locations</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-100 hover:bg-blue-800 hover:bg-opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 z-10"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation - Fixed below header */}
        <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab(tab.id)}
              aria-label={`Show ${tab.label}`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Modal Content - Scrollable area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <MarkerTable 
            markers={filteredMarkers}
            onCopyCoordinates={handleCopyCoordinates}
            copiedCoords={copiedCoords}
            getMarkerDisplayName={getMarkerDisplayName}
            allMarkers={markers}
          />
        </div>

        {/* Modal Footer - Fixed at bottom */}
        <div className="px-6 py-3 bg-gray-50 border-t text-center text-xs text-gray-500 flex-shrink-0">
            Press ESC or click outside to close
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable table component for displaying marker data
 * Updated with better responsive design and spacing
 */
interface MarkerTableProps {
  markers: Marker[];
  onCopyCoordinates: (lat: number, lng: number) => void;
  copiedCoords: string | null;
  getMarkerDisplayName: (marker: Marker, allMarkers: Marker[]) => string;
  allMarkers: Marker[];
  isPrint?: boolean;
}

const MarkerTable: React.FC<MarkerTableProps> = ({
  markers,
  onCopyCoordinates,
  copiedCoords,
  getMarkerDisplayName,
  allMarkers,
  isPrint = false
}) => {
  // Handle empty state
  if (markers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p className="text-lg font-medium mb-2">No markers found</p>
        <p className="text-sm text-gray-400">
          Place markers on the map to see them listed here
        </p>
      </div>
    );
  }

  /**
   * Get marker type color for visual consistency
   */
  const getMarkerColor = (type: MarkerType): string => {
    switch (type) {
      case 'gcs': return 'bg-blue-500';
      case 'observer': return 'bg-green-500';
      case 'repeater': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-200 bg-white shadow-sm rounded-lg">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[100px]">
              Type
            </th>
            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[120px]">
              Name
            </th>
            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[180px]">
              Coordinates
            </th>
            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[100px]">
              Elevation
            </th>
            <th className="border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[140px]">
              Height Above Ground
            </th>
            <th className="border border-gray-200 px-4 py-3 text-center text-sm font-medium text-gray-700 min-w-[100px]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {markers.map((marker) => {
            const coords = `${marker.location.lat.toFixed(5)}, ${marker.location.lng.toFixed(5)}`;
            const isCoordsCopied = copiedCoords === coords;
            
            return (
              <tr key={marker.id} className="hover:bg-gray-50 transition-colors">
                <td className="border border-gray-200 px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getMarkerColor(marker.type)}`}></span>
                    <span className="font-medium">{marker.type.toUpperCase()}</span>
                  </div>
                </td>
                <td className="border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
                  {getMarkerDisplayName(marker, allMarkers)}
                </td>
                <td className="border border-gray-200 px-4 py-3 text-sm font-mono text-gray-700">
                  {coords}
                </td>
                <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                  {marker.location.elevation.toFixed(1)}m
                </td>
                <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                  {marker.elevationOffset}m
                </td>
                <td className="border border-gray-200 px-4 py-3 text-center">
                  <button
                    onClick={() => onCopyCoordinates(marker.location.lat, marker.location.lng)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      isCoordsCopied
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 border border-gray-200 hover:border-blue-200'
                    }`}
                    title="Copy coordinates to clipboard"
                    aria-label={`Copy coordinates ${coords}`}
                  >
                    {isCoordsCopied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Coords</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MarkerLocationsModal;