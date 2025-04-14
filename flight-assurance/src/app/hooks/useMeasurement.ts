//useMeasurement.ts 
// This hook handles the measurement functionality on the map.

import { useCallback, useState } from 'react';
import { useMapContext } from '../context/MapContext';
import * as turf from '@turf/turf';

interface MeasurementResult {
  distance: number; // Meters
  points: [number, number][];
}

export const useMeasurement = () => {
  const { map } = useMapContext();
  const [measurement, setMeasurement] = useState<MeasurementResult | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const startMeasurement = useCallback(() => {
    if (!map) return;
    setIsMeasuring(true);
    setMeasurement({ distance: 0, points: [] });

    const layerId = 'measurement-line';
    // Remove existing measurement layer
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(layerId)) map.removeSource(layerId);

    // Add source and layer
    map.addSource(layerId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: layerId,
      paint: {
        'line-color': '#ff0000',
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    });

    // Handle clicks to add points
    map.on('click', handleClick);
  }, [map]);

  const handleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (!map || !isMeasuring) return;
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setMeasurement((prev) => {
        const points = prev ? [...prev.points, point] : [point];
        let distance = 0;
        if (points.length > 1) {
          const line = turf.lineString(points);
          distance = turf.length(line, { units: 'meters' });
        }

        // Update layer
        const layerId = 'measurement-line';
        const source = map.getSource(layerId) as mapboxgl.GeoJSONSource;
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: points },
              properties: {},
            },
          ],
        });

        return { distance, points };
      });
    },
    [map, isMeasuring]
  );

  const stopMeasurement = useCallback(() => {
    if (!map) return;
    setIsMeasuring(false);
    map.off('click', handleClick);
  }, [map]);

  return { startMeasurement, stopMeasurement, measurement, isMeasuring };
};