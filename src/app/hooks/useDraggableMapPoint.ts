// src/hooks/useDraggableMapPoint.ts
import { useCallback, useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { trackEventWithForm as trackEvent } from '../components/tracking/tracking';

interface UseDraggableMapPointProps {
  map: mapboxgl.Map | null;
  centerPoint: [number, number] | null;
  radius: number;
  onCenterChange: (newCenter: [number, number]) => void;
  onPreviewUpdate: (center: [number, number], radius: number) => void;
  enabled?: boolean;
  centerId: string; // Layer ID for the center point
}

interface DraggableMapPointReturn {
  isDragging: boolean;
  isHovering: boolean;
  enableDrag: () => void;
  disableDrag: () => void;
}

/**
 * Custom hook for making a map point draggable
 * Follows the same patterns as useMeasurement.ts and useMarkers.ts
 */
export const useDraggableMapPoint = ({
  map,
  centerPoint,
  radius,
  onCenterChange,
  onPreviewUpdate,
  enabled = true,
  centerId
}: UseDraggableMapPointProps): DraggableMapPointReturn => {
  // State for drag interactions
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  // Refs for event handlers (following useMeasurement pattern)
  const mouseDownRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  const mouseMoveRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  const mouseUpRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  const mouseEnterRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  const mouseLeaveRef = useRef<((e: mapboxgl.MapLayerMouseEvent) => void) | null>(null);
  
  // Drag state
  const dragStartPoint = useRef<[number, number] | null>(null);
  const lastUpdateTime = useRef<number>(0);
  
  /**
   * Updates the center point visual style based on hover/drag state
   */
  const updateCenterPointStyle = useCallback(() => {
    if (!map || !map.getLayer(centerId)) return;
    
    try {
      if (isDragging) {
        // Dragging state - larger, different color
        map.setPaintProperty(centerId, 'circle-radius', 8);
        map.setPaintProperty(centerId, 'circle-color', '#ef4444'); // Red while dragging
        map.setPaintProperty(centerId, 'circle-stroke-width', 3);
      } else if (isHovering) {
        // Hovering state - slightly larger, glowing
        map.setPaintProperty(centerId, 'circle-radius', 7);
        map.setPaintProperty(centerId, 'circle-color', '#3b82f6'); // Blue
        map.setPaintProperty(centerId, 'circle-stroke-width', 3);
        map.setPaintProperty(centerId, 'circle-stroke-color', '#93c5fd'); // Light blue glow
      } else {
        // Default state
        map.setPaintProperty(centerId, 'circle-radius', 6);
        map.setPaintProperty(centerId, 'circle-color', '#3b82f6');
        map.setPaintProperty(centerId, 'circle-stroke-width', 2);
        map.setPaintProperty(centerId, 'circle-stroke-color', '#ffffff');
      }
    } catch (error) {
      console.warn('Error updating center point style:', error);
    }
  }, [map, centerId, isDragging, isHovering]);
  
  /**
   * Handles mouse down on center point
   */
  const handleMouseDown = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!enabled || !centerPoint) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStartPoint.current = centerPoint;
    
    // Change cursor for entire map
    if (map?.getCanvas()) {
      map.getCanvas().style.cursor = 'grabbing';
    }
    
    trackEvent('map_point_drag_start', { 
      center: centerPoint,
      radius 
    });
  }, [enabled, centerPoint, map, radius]);
  
  /**
   * Handles mouse move during drag
   */
  const handleMouseMove = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!isDragging || !enabled) return;
    
    // Throttle updates for performance (60fps max)
    const now = Date.now();
    if (now - lastUpdateTime.current < 16) return;
    lastUpdateTime.current = now;
    
    const newCenter: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    
    // Update preview immediately for smooth dragging
    onPreviewUpdate(newCenter, radius);
    
    // Update state
    onCenterChange(newCenter);
  }, [isDragging, enabled, onPreviewUpdate, onCenterChange, radius]);
  
  /**
   * Handles mouse up to end drag
   */
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    dragStartPoint.current = null;
    
    // Reset cursor
    if (map?.getCanvas()) {
      map.getCanvas().style.cursor = isHovering ? 'grab' : '';
    }
    
    trackEvent('map_point_drag_end', { 
      center: centerPoint,
      radius 
    });
  }, [isDragging, map, isHovering, centerPoint, radius]);
  
  /**
   * Handles mouse enter center point layer
   */
  const handleMouseEnter = useCallback(() => {
    if (!enabled || isDragging) return;
    
    setIsHovering(true);
    
    if (map?.getCanvas()) {
      map.getCanvas().style.cursor = 'grab';
    }
  }, [enabled, isDragging, map]);
  
  /**
   * Handles mouse leave center point layer
   */
  const handleMouseLeave = useCallback(() => {
    if (isDragging) return; // Don't change hover state while dragging
    
    setIsHovering(false);
    
    if (map?.getCanvas()) {
      map.getCanvas().style.cursor = '';
    }
  }, [isDragging, map]);
  
  /**
   * Set up event listeners
   */
  const setupEventListeners = useCallback(() => {
    if (!map || !enabled || !centerPoint) return;
    
    // Clean up existing listeners first
    if (mouseDownRef.current) map.off('mousedown', centerId, mouseDownRef.current);
    if (mouseMoveRef.current) map.off('mousemove', mouseMoveRef.current);
    if (mouseUpRef.current) map.off('mouseup', mouseUpRef.current);
    if (mouseEnterRef.current) map.off('mouseenter', centerId, mouseEnterRef.current);
    if (mouseLeaveRef.current) map.off('mouseleave', centerId, mouseLeaveRef.current);
    
    // Store refs for cleanup
    mouseDownRef.current = handleMouseDown;
    mouseMoveRef.current = handleMouseMove;
    mouseUpRef.current = handleMouseUp;
    mouseEnterRef.current = handleMouseEnter;
    mouseLeaveRef.current = handleMouseLeave;
    
    // Add listeners
    map.on('mousedown', centerId, handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.on('mouseenter', centerId, handleMouseEnter);
    map.on('mouseleave', centerId, handleMouseLeave);
    
    // Also listen for mouse up on window to handle dragging outside map
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      if (map) {
        map.off('mousedown', centerId, handleMouseDown);
        map.off('mousemove', handleMouseMove);
        map.off('mouseup', handleMouseUp);
        map.off('mouseenter', centerId, handleMouseEnter);
        map.off('mouseleave', centerId, handleMouseLeave);
      }
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [map, enabled, centerPoint, centerId, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseEnter, handleMouseLeave]);
  
  /**
   * Clean up event listeners
   */
  const cleanupEventListeners = useCallback(() => {
    if (!map) return;
    
    try {
      if (mouseDownRef.current) map.off('mousedown', centerId, mouseDownRef.current);
      if (mouseMoveRef.current) map.off('mousemove', mouseMoveRef.current);
      if (mouseUpRef.current) map.off('mouseup', mouseUpRef.current);
      if (mouseEnterRef.current) map.off('mouseenter', centerId, mouseEnterRef.current);
      if (mouseLeaveRef.current) map.off('mouseleave', centerId, mouseLeaveRef.current);
      
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Reset cursor
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
    } catch (error) {
      console.warn('Error cleaning up drag event listeners:', error);
    }
    
    // Clear refs
    mouseDownRef.current = null;
    mouseMoveRef.current = null;
    mouseUpRef.current = null;
    mouseEnterRef.current = null;
    mouseLeaveRef.current = null;
  }, [map, centerId, handleMouseUp]);
  
  /**
   * Enable drag functionality
   */
  const enableDrag = useCallback(() => {
    setupEventListeners();
  }, [setupEventListeners]);
  
  /**
   * Disable drag functionality
   */
  const disableDrag = useCallback(() => {
    cleanupEventListeners();
    setIsDragging(false);
    setIsHovering(false);
  }, [cleanupEventListeners]);
  
  // Update visual style when state changes
  useEffect(() => {
    updateCenterPointStyle();
  }, [updateCenterPointStyle]);
  
  // Set up/cleanup event listeners when dependencies change
  useEffect(() => {
    if (enabled && centerPoint) {
      setupEventListeners();
    } else {
      cleanupEventListeners();
    }
    
    return cleanupEventListeners;
  }, [enabled, centerPoint, setupEventListeners, cleanupEventListeners]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupEventListeners();
    };
  }, [cleanupEventListeners]);
  
  return {
    isDragging,
    isHovering,
    enableDrag,
    disableDrag
  };
};