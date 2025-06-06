// useMeasurement.ts
// This hook handles distance measurement functionality on the map,
// allowing users to click points and visualize the distance between them.
// It integrates with the MapContext to access the map instance and provides
// a clean API for measuring distances with visual feedback.

import { useCallback, useState, useEffect, useRef } from 'react';
import { useMapContext } from '../../../context/mapcontext';
import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import { trackEventWithForm as trackEvent } from '../../../components/tracking/tracking';

interface MeasurementResult {
  distance: number; // Meters
  points: [number, number][]; // [lng, lat] points
  segments: number[]; // Individual segment distances in meters
}

export const useMeasurement = () => {
  const { map } = useMapContext();
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  
  // Use refs to maintain consistent references for event handlers
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const movingPopupRef = useRef<mapboxgl.Popup | null>(null);
  const pointsRef = useRef<[number, number][]>([]);
  
  // Constants for layer IDs
  const FIXED_LINE_SOURCE = 'measurement-fixed-line-source';
  const TEMP_LINE_SOURCE = 'measurement-temp-line-source';
  const FIXED_LINE_LAYER = 'measurement-fixed-line-layer';
  const TEMP_LINE_LAYER = 'measurement-temp-line-layer';


  // Clean up measurement resources
  const cleanupMeasurement = useCallback(() => {
    // Add comprehensive map validation
    if (!map || !map.getStyle || !map.getCanvas) {
      console.warn("Map not available or already destroyed during measurement cleanup");
      return;
    }
    
    try {
      // Check if map is still loaded
      if (!map.loaded()) {
        console.warn("Map not loaded during measurement cleanup");
        return;
      }
    } catch (mapStateError) {
      console.warn("Error checking map state during cleanup:", mapStateError);
      return;
    }
    
    // Remove markers
    markersRef.current.forEach(marker => {
      try {
        marker.remove();
      } catch (markerError) {
        console.warn("Error removing marker:", markerError);
      }
    });
    markersRef.current = [];
    
    // Remove popup
    if (movingPopupRef.current) {
      try {
        movingPopupRef.current.remove();
        movingPopupRef.current = null;
      } catch (popupError) {
        console.warn("Error removing popup:", popupError);
      }
    }
    
    // Remove layers and sources - carefully check if they exist first
    try {
      if (map.getLayer && map.getLayer(FIXED_LINE_LAYER)) {
        map.removeLayer(FIXED_LINE_LAYER);
      }
      
      if (map.getLayer && map.getLayer(TEMP_LINE_LAYER)) {
        map.removeLayer(TEMP_LINE_LAYER);
      }
      
      if (map.getSource && map.getSource(FIXED_LINE_SOURCE)) {
        map.removeSource(FIXED_LINE_SOURCE);
      }
      
      if (map.getSource && map.getSource(TEMP_LINE_SOURCE)) {
        map.removeSource(TEMP_LINE_SOURCE);
      }
    } catch (e) {
      console.error("Error cleaning up measurement layers:", e);
    }
    
    // Reset cursor and points - with additional safety checks
    try {
      if (map.getCanvas && map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
    } catch (canvasError) {
      console.warn("Error resetting cursor:", canvasError);
    }
    
    pointsRef.current = [];
  }, [map]);

  // Clear all current measurements but keep measuring active
  const clearMeasurement = useCallback(() => {
    if (!map) return;
    
    // Remove markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // Reset the fixed line to empty
    try {
      if (map.getSource(FIXED_LINE_SOURCE)) {
        const source = map.getSource(FIXED_LINE_SOURCE) as mapboxgl.GeoJSONSource;
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      
      if (map.getSource(TEMP_LINE_SOURCE)) {
        const tempSource = map.getSource(TEMP_LINE_SOURCE) as mapboxgl.GeoJSONSource;
        tempSource.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    } catch (e) {
      console.error("Error clearing measurement lines:", e);
    }
    
    // Reset points and measurement data
    pointsRef.current = [];
    setMeasurement({ distance: 0, points: [], segments: [] });
    
    trackEvent('measurement_cleared', { panel: 'measurement-controls' });
  }, [map]);

  // Handle click to add measurement point
  const handleClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map || !isMeasuring) return;
    
    const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    pointsRef.current.push(point);
    const points = pointsRef.current;
    
    // Update GeoJSON for the line
    try {
      if (map.getSource(FIXED_LINE_SOURCE)) {
        const source = map.getSource(FIXED_LINE_SOURCE) as mapboxgl.GeoJSONSource;
        source.setData({
          type: 'FeatureCollection',
          features: points.length >= 2 ? [
            {
              type: 'Feature',
              geometry: { 
                type: 'LineString', 
                coordinates: points 
              },
              properties: {}
            }
          ] : []
        });
      }
    } catch (e) {
      console.error("Error updating fixed line source:", e);
    }
    
    // Calculate segment and total distances
    let segments: number[] = [];
    let totalDistance = 0;
    
    if (points.length >= 2) {
      for (let i = 1; i < points.length; i++) {
        const segment = turf.distance(points[i-1], points[i], { units: 'meters' });
        segments.push(segment);
        totalDistance += segment;
      }
    }
    
    // Add marker at clicked point
    try {
      const marker = new mapboxgl.Marker({ color: '#4B56D2' })
        .setLngLat(point)
        .addTo(map);
      
      // Add popup with distance information
      if (points.length > 1) {
        const lastSegmentDistance = segments[segments.length - 1];
        const popup = new mapboxgl.Popup({ 
          closeButton: false, 
          className: 'custom-popup',
          offset: 25
        })
          .setLngLat(point)
          .setHTML(`<strong style="color: black; background: white; padding: 4px;">Segment: ${(lastSegmentDistance / 1000).toFixed(2)} km<br>Total: ${(totalDistance / 1000).toFixed(2)} km</strong>`);
        
        marker.setPopup(popup);
        popup.addTo(map);
      } else {
        // First point just shows "Start"
        const popup = new mapboxgl.Popup({ 
          closeButton: false, 
          className: 'custom-popup',
          offset: 25
        })
          .setLngLat(point)
          .setHTML(`<strong style="color: black; background: white; padding: 4px;">Start</strong>`);
        
        marker.setPopup(popup);
        popup.addTo(map);
      }
      
      markersRef.current.push(marker);
    } catch (e) {
      console.error("Error adding marker:", e);
    }
    
    // Reset temporary line
    try {
      if (map.getSource(TEMP_LINE_SOURCE)) {
        const tempSource = map.getSource(TEMP_LINE_SOURCE) as mapboxgl.GeoJSONSource;
        tempSource.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    } catch (e) {
      console.error("Error updating temp line source:", e);
    }
    
    // Update measurement state
    setMeasurement({ 
      distance: totalDistance, 
      points: [...points], 
      segments 
    });
  }, [map, isMeasuring]);

  // Handle mouse move to update temporary line
  const handleMouseMove = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map || !isMeasuring || pointsRef.current.length === 0) return;
    
    const mousePoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    const lastPoint = pointsRef.current[pointsRef.current.length - 1];
    
    // Update temporary line
    try {
      if (map.getSource(TEMP_LINE_SOURCE)) {
        const tempSource = map.getSource(TEMP_LINE_SOURCE) as mapboxgl.GeoJSONSource;
        tempSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { 
                type: 'LineString', 
                coordinates: [lastPoint, mousePoint] 
              },
              properties: {}
            }
          ]
        });
      }
    } catch (e) {
      console.error("Error updating temp line source:", e);
    }
    
    // Update moving popup with distance
    const distance = turf.distance(lastPoint, mousePoint, { units: 'meters' });
    
    try {
      if (!movingPopupRef.current) {
        movingPopupRef.current = new mapboxgl.Popup({
          closeButton: false,
          className: 'custom-popup',
          offset: 25
        }).addTo(map);
      }
      
      movingPopupRef.current
        .setLngLat(e.lngLat)
        .setHTML(`<strong style="color: black; background: white; padding: 4px;">${(distance / 1000).toFixed(2)} km</strong>`);
    } catch (e) {
      console.error("Error updating moving popup:", e);
    }
  }, [map, isMeasuring]);

  // Start a new measurement
  const startMeasurement = useCallback(() => {
    if (!map) return;
    
    // First clean up any existing measurement
    cleanupMeasurement();
    
    // Set up measurement layers
    try {
      // Initialize fixed line source/layer for completed segments
      map.addSource(FIXED_LINE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      map.addLayer({
        id: FIXED_LINE_LAYER,
        type: 'line',
        source: FIXED_LINE_SOURCE,
        paint: { 
          'line-color': '#4B56D2', 
          'line-width': 3
        }
      });
      
      // Initialize temp line source/layer for active segment
      map.addSource(TEMP_LINE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      
      map.addLayer({
        id: TEMP_LINE_LAYER,
        type: 'line',
        source: TEMP_LINE_SOURCE,
        paint: { 
          'line-color': '#4B56D2', 
          'line-width': 2, 
          'line-dasharray': [2, 2] 
        }
      });
      
      // Change cursor to crosshair
      map.getCanvas().style.cursor = 'crosshair';
      
      // Initialize state
      setIsMeasuring(true);
      pointsRef.current = [];
      setMeasurement({ distance: 0, points: [], segments: [] });
      
      trackEvent('measurement_started', { panel: 'measurement-controls' });
    } catch (e) {
      console.error("Error initializing measurement:", e);
    }
  }, [map, cleanupMeasurement]);

  // Stop measuring
  const stopMeasurement = useCallback(() => {
    if (!map) return;
    
    setIsMeasuring(false);
    
    // Remove the temporary line and moving popup
    try {
      if (movingPopupRef.current) {
        movingPopupRef.current.remove();
        movingPopupRef.current = null;
      }
      
      if (map.getSource(TEMP_LINE_SOURCE)) {
        const tempSource = map.getSource(TEMP_LINE_SOURCE) as mapboxgl.GeoJSONSource;
        tempSource.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      
      // Reset cursor
      map.getCanvas().style.cursor = '';
    } catch (e) {
      console.error("Error stopping measurement:", e);
    }
  }, [map]);


  // Handle right-click to finish measurement
  const handleRightClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map || !isMeasuring) return;
    
    e.preventDefault();
    stopMeasurement();
    
    trackEvent('measurement_completed', { 
      panel: 'measurement-controls',
      points: pointsRef.current.length,
      distance: measurement?.distance || 0 
    });
  }, [map, isMeasuring, measurement, stopMeasurement]);


  // Set up and clean up event listeners
  useEffect(() => {
    if (!map) return;
    
    if (isMeasuring) {
      map.on('click', handleClick);
      map.on('mousemove', handleMouseMove);
      map.on('contextmenu', handleRightClick);
    }
    
    return () => {
      if (map) {
        map.off('click', handleClick);
        map.off('mousemove', handleMouseMove);
        map.off('contextmenu', handleRightClick);
      }
    };
  }, [map, isMeasuring, handleClick, handleMouseMove, handleRightClick]);

  // Clean up when the component unmounts
  useEffect(() => {
    return () => {
      // Use setTimeout to ensure cleanup happens after any pending operations
      setTimeout(() => {
        try {
          cleanupMeasurement();
        } catch (cleanupError) {
          console.warn("Error during measurement cleanup:", cleanupError);
        }
      }, 0);
    };
  }, [cleanupMeasurement]);

  return { 
    startMeasurement, 
    stopMeasurement, 
    clearMeasurement, 
    measurement, 
    isMeasuring 
  };
};