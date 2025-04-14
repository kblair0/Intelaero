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
      return;
    }

    // Add flight path to map through the layers hook
    addFlightPath(flightPlan);
    
    // Add start marker
    const coordinates = flightPlan.features[0].geometry.coordinates;
    if (coordinates.length > 0) {
      const startCoord = coordinates[0];
      const endCoord = coordinates[coordinates.length - 1];
      
      // Create or update start marker
      if (startMarkerRef.current) {
        startMarkerRef.current.setLngLat([startCoord[0], startCoord[1]]);
      } else {
        startMarkerRef.current = new mapboxgl.Marker({ color: "green" })
          .setLngLat([startCoord[0], startCoord[1]])
          .setPopup(
            new mapboxgl.Popup({ closeButton: false })
              .setHTML('<strong style="color: black; bg-white;">Start</strong>')
          )
          .addTo(map);
        startMarkerRef.current.togglePopup();
      }
      
      // Create or update end marker
      if (endMarkerRef.current) {
        endMarkerRef.current.setLngLat([endCoord[0], endCoord[1]]);
      } else {
        endMarkerRef.current = new mapboxgl.Marker({ color: "blue" })
          .setLngLat([endCoord[0], endCoord[1]])
          .setPopup(
            new mapboxgl.Popup({ closeButton: false })
              .setHTML('<strong style="color: black; bg-white;">Finish</strong>')
          )
          .addTo(map);
        endMarkerRef.current.togglePopup();
      }
    }
  }, [map, isMapReady, flightPlan, addFlightPath]);

  // Clean up markers when component unmounts
  useEffect(() => {
    return () => {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
      }
    };
  }, []);

  // This is a behavior-only component, so it doesn't render anything directly
  return null;
};

export default FlightPathDisplay;