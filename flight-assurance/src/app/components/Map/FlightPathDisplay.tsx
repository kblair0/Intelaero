// components/Map/FlightPathDisplay.tsx
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useMapContext } from '../../context/MapContext';
import { useLayers } from '../../hooks/useLayers';

const FlightPathDisplay: React.FC = () => {
  const { flightPlan } = useFlightPlanContext();
  const { map, isMapReady } = useMapContext();
  const { addFlightPath } = useLayers();
  
  // Refs for start/end markers
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Add flight path to map when flight plan is processed
  useEffect(() => {
    if (!map || !isMapReady || !flightPlan || !flightPlan.properties?.processed) {
      console.log("FlightPathDisplay: Conditions not met", { 
        map: !!map, 
        isMapReady, 
        flightPlan: !!flightPlan, 
        processed: flightPlan?.properties?.processed 
      });
      return;
    }

    console.log("FlightPathDisplay: Adding flight path to map", {
      coordinates: flightPlan.features[0].geometry.coordinates.length,
      start: flightPlan.features[0].geometry.coordinates[0],
      end: flightPlan.features[0].geometry.coordinates[flightPlan.features[0].geometry.coordinates.length - 1]
    });

    // Add flight path to map through the layers hook
    addFlightPath(flightPlan);
    
    // Enhanced marker creation with more explicit logging and error handling
    try {
      // Add start marker
      const coordinates = flightPlan.features[0].geometry.coordinates;
      if (coordinates.length > 0) {
        const startCoord = coordinates[0];
        const endCoord = coordinates[coordinates.length - 1];
        
        console.log("Creating start marker at", startCoord);
        
        // Clean up existing markers first to avoid duplicates
        if (startMarkerRef.current) {
          startMarkerRef.current.remove();
          startMarkerRef.current = null;
        }
        if (endMarkerRef.current) {
          endMarkerRef.current.remove();
          endMarkerRef.current = null;
        }
        
        // Explicit type checking and handling
        if (startCoord && startCoord.length >= 2) {
          // Create start marker with more visible styling
          startMarkerRef.current = new mapboxgl.Marker({ 
            color: "#00FF00", // Bright green
            scale: 1.2,        // Slightly larger
            draggable: false
          })
            .setLngLat([startCoord[0], startCoord[1]])
            .setPopup(
              new mapboxgl.Popup({ 
                closeButton: false,
                offset: 25,
                className: "custom-popup" // Add custom class for styling if needed
              })
                .setHTML('<strong style="color: black; background-color: white; padding: 4px;">Start</strong>')
            )
            .addTo(map);
            
          // Force popup to show
          startMarkerRef.current.togglePopup();
          console.log("Start marker created:", startMarkerRef.current);
        }
        
        console.log("Creating end marker at", endCoord);
        
        // Create end marker
        if (endCoord && endCoord.length >= 2) {
          endMarkerRef.current = new mapboxgl.Marker({ 
            color: "#0000FF", // Bright blue
            scale: 1.2,        // Slightly larger
            draggable: false
          })
            .setLngLat([endCoord[0], endCoord[1]])
            .setPopup(
              new mapboxgl.Popup({ 
                closeButton: false,
                offset: 25,
                className: "custom-popup" // Add custom class for styling if needed
              })
                .setHTML('<strong style="color: black; background-color: white; padding: 4px;">Finish</strong>')
            )
            .addTo(map);
            
          // Force popup to show
          endMarkerRef.current.togglePopup();
          console.log("End marker created:", endMarkerRef.current);
        }
      }
    } catch (error) {
      console.error("Error creating markers:", error);
    }
  }, [map, isMapReady, flightPlan, addFlightPath]);

  // Clean up markers when component unmounts
  useEffect(() => {
    return () => {
      console.log("FlightPathDisplay: Cleaning up markers");
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
    };
  }, []);

  // This is a behavior-only component, so it doesn't render anything directly
  return null;
};

export default FlightPathDisplay;