// components/Map/FlightPathDisplay.tsx

/**
 * FlightPathDisplay Component
 * ---------------------------------------
 * This component is responsible for rendering the flight plan's route on the map along
 * with its associated markers: a start marker, an end marker, and an "Available Range Limit" marker.
 * 
 * Key responsibilities:
 *   - Retrieve and display the processed flight plan on the map using the addFlightPath hook.
 *   - Create and position a start marker (green) at the beginning of the flight path.
 *   - Create and position an end marker (blue) at the end of the flight path.
 *   - Calculate the available flight distance based on battery metrics (available battery capacity,
 *     discharge rate, and assumed speed) from the FlightConfiguration context.
 *   - If the available range is insufficient to cover the total flight plan distance, compute
 *     the point along the path at which the flight plan exceeds the available energy and display
 *     a red marker ("Available Range Limit") at that location.
 * 
 */
'use client';
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useMapContext } from '../../context/MapContext';
import { useLayers } from '../../hooks/useLayers';
import { useFlightConfiguration } from '../../context/FlightConfigurationContext';

const FlightPathDisplay: React.FC = () => {
  const { flightPlan } = useFlightPlanContext();
  const { map, terrainLoaded } = useMapContext();
  const { addFlightPath } = useLayers();
  const { config, metrics } = useFlightConfiguration();

  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const availableRangeMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map || !terrainLoaded || !flightPlan || !flightPlan.properties?.processed) {
      return;
    }

    addFlightPath(flightPlan);

    try {
      const coordinates = flightPlan.features[0].geometry.coordinates;
      if (coordinates.length > 0) {
        const startCoord = coordinates[0];
        if (startMarkerRef.current) {
          startMarkerRef.current.remove();
          startMarkerRef.current = null;
        }
        if (startCoord && startCoord.length >= 2) {
          startMarkerRef.current = new mapboxgl.Marker({
            color: '#00FF00',
            scale: 1.2,
            draggable: false,
          })
            .setLngLat([startCoord[0], startCoord[1]])
            .setPopup(
              new mapboxgl.Popup({ closeButton: false, offset: 25, className: 'custom-popup' })
                .setHTML('<strong style="color: black; background: white; padding: 4px;">Start</strong>')
            )
            .addTo(map);
          startMarkerRef.current.togglePopup();
        }

        const endCoord = coordinates[coordinates.length - 1];
        if (endMarkerRef.current) {
          endMarkerRef.current.remove();
          endMarkerRef.current = null;
        }
        if (endCoord && endCoord.length >= 2) {
          endMarkerRef.current = new mapboxgl.Marker({
            color: '#0000FF',
            scale: 1.2,
            draggable: false,
          })
            .setLngLat([endCoord[0], endCoord[1]])
            .setPopup(
              new mapboxgl.Popup({ closeButton: false, offset: 25, className: 'custom-popup' })
                .setHTML('<strong style="color: black; background: white; padding: 4px;">Finish</strong>')
            )
            .addTo(map);
          endMarkerRef.current.togglePopup();
        }
      }
    } catch (error) {
      console.error('Error creating start/end markers:', error);
    }
  }, [map, terrainLoaded, flightPlan, addFlightPath]);

  useEffect(() => {
    if (!map || !terrainLoaded || !flightPlan || !flightPlan.properties?.processed) {
      return;
    }

    const coordinates = flightPlan.features[0].geometry.coordinates;
    const totalDistance: number = flightPlan.properties.totalDistance;
    if (!coordinates || coordinates.length === 0) return;

    const dischargeRate = parseFloat(config.dischargeRate);
    const assumedSpeed = parseFloat(config.assumedSpeed);
    if (dischargeRate === 0 || assumedSpeed === 0) return;

    const availableFlightTime = metrics.availableBatteryCapacity / dischargeRate;
    const availableDistance = (availableFlightTime / 60) * assumedSpeed;

    if (availableDistance >= totalDistance) {
      if (availableRangeMarkerRef.current) {
        availableRangeMarkerRef.current.remove();
        availableRangeMarkerRef.current = null;
      }
      return;
    }

    const line = turf.lineString(coordinates.map((coord: number[]) => [coord[0], coord[1]]));
    const estimatedPoint = turf.along(line, availableDistance, { units: 'kilometers' });
    const [lng, lat] = estimatedPoint.geometry.coordinates as [number, number];

    if (availableRangeMarkerRef.current) {
      availableRangeMarkerRef.current.setLngLat([lng, lat]);
    } else {
      availableRangeMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ closeButton: false })
            .setHTML('<strong style="color: black; background: white; padding: 4px;">Available Range Limit</strong>')
        )
        .addTo(map);
      availableRangeMarkerRef.current.togglePopup();
    }
  }, [map, terrainLoaded, flightPlan, config, metrics]);

  useEffect(() => {
    return () => {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
      if (availableRangeMarkerRef.current) {
        availableRangeMarkerRef.current.remove();
        availableRangeMarkerRef.current = null;
      }
    };
  }, []);

  return null;
};

export default FlightPathDisplay;