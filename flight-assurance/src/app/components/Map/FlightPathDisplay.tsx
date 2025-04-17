'use client';
import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { useFlightPlanContext } from '../../context/FlightPlanContext';
import { useMapContext } from '../../context/MapContext';
import { useLayers } from '../../hooks/useLayers';
import { useFlightConfiguration } from '../../context/FlightConfigurationContext';

const FLIGHT_SOURCE_ID = 'flightplan-data';
const FLIGHT_LINE_LAYER_ID = 'flightplan-line';

const FlightPathDisplay: React.FC = () => {
  const { flightPlan } = useFlightPlanContext();
  const { map, terrainLoaded } = useMapContext();
  const { addFlightPath } = useLayers();
  const { config, metrics } = useFlightConfiguration();

  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const availableRangeMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // —— Draw (or redraw) the flight‐path & start/end markers
  useEffect(() => {
    if (!map || !terrainLoaded || !flightPlan || !flightPlan.properties?.processed) {
      return;
    }

    // —— CLEAN UP any previous flight‐plan before drawing the new one
    if (map.getLayer(FLIGHT_LINE_LAYER_ID)) {
      map.removeLayer(FLIGHT_LINE_LAYER_ID);
    }
    if (map.getSource(FLIGHT_SOURCE_ID)) {
      map.removeSource(FLIGHT_SOURCE_ID);
    }

    // —— Now invoke your hook to add the new source + layer
    addFlightPath(flightPlan);

    try {
      const coords = flightPlan.features[0].geometry.coordinates;
      if (coords.length > 0) {
        // —— Start marker
        const [startLon, startLat] = coords[0];
        if (startMarkerRef.current) {
          startMarkerRef.current.remove();
          startMarkerRef.current = null;
        }
        startMarkerRef.current = new mapboxgl.Marker({ color: '#00FF00', scale: 1.2 })
          .setLngLat([startLon, startLat])
          .setPopup(new mapboxgl.Popup({ offset: 25, className: 'custom-popup' })
            .setHTML('<strong style="color:black;background:white;padding:4px;">Start</strong>'))
          .addTo(map);
        startMarkerRef.current.togglePopup();

        // —— End marker
        const [endLon, endLat] = coords[coords.length - 1];
        if (endMarkerRef.current) {
          endMarkerRef.current.remove();
          endMarkerRef.current = null;
        }
        endMarkerRef.current = new mapboxgl.Marker({ color: '#0000FF', scale: 1.2 })
          .setLngLat([endLon, endLat])
          .setPopup(new mapboxgl.Popup({ offset: 25, className: 'custom-popup' })
            .setHTML('<strong style="color:black;background:white;padding:4px;">Finish</strong>'))
          .addTo(map);
        endMarkerRef.current.togglePopup();
      }
    } catch (err) {
      console.error('Error creating start/end markers:', err);
    }
  }, [map, terrainLoaded, flightPlan, addFlightPath]);

  // —— Compute & display “available range” marker if battery runs out mid‑flight
  useEffect(() => {
    if (!map || !terrainLoaded || !flightPlan || !flightPlan.properties?.processed) {
      return;
    }
    const coords = flightPlan.features[0].geometry.coordinates;
    const totalDistance = flightPlan.properties.totalDistance;
    if (!coords.length || !totalDistance) return;

    const dischargeRate = parseFloat(config.dischargeRate);
    const assumedSpeed = parseFloat(config.assumedSpeed);
    if (!dischargeRate || !assumedSpeed) return;

    const availableTimeMin = metrics.availableBatteryCapacity / dischargeRate;
    const availableDistKm = (availableTimeMin / 60) * assumedSpeed;

    // —— Remove marker entirely if we can complete the route
    if (availableDistKm >= totalDistance) {
      if (availableRangeMarkerRef.current) {
        availableRangeMarkerRef.current.remove();
        availableRangeMarkerRef.current = null;
      }
      return;
    }

    // —— Otherwise place/update a red marker at the cutoff point
    const line = turf.lineString(coords.map(c => [c[0], c[1]] as [number, number]));
    const cutoffPt = turf.along(line, availableDistKm, { units: 'kilometers' });
    const [lng, lat] = cutoffPt.geometry.coordinates as [number, number];

    if (availableRangeMarkerRef.current) {
      availableRangeMarkerRef.current.setLngLat([lng, lat]);
    } else {
      availableRangeMarkerRef.current = new mapboxgl.Marker({ color: 'red' })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ closeButton: false })
          .setHTML('<strong style="color:black;background:white;padding:4px;">Available Range Limit</strong>'))
        .addTo(map);
      availableRangeMarkerRef.current.togglePopup();
    }
  }, [map, terrainLoaded, flightPlan, config, metrics]);

  // —— Clean up markers when this component unmounts
  useEffect(() => {
    return () => {
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      availableRangeMarkerRef.current?.remove();
    };
  }, []);

  return null;
};

export default FlightPathDisplay;
