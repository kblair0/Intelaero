// src/hooks/useFlightPathSampling.ts

import { useCallback } from 'react';
import * as turf from '@turf/turf';
import { useMapContext } from '../context/MapContext';
import { SamplePoint } from '../context/ObstacleAnalysisContext';

export interface SamplingOptions {
  resolution: number;
  progressCallback?: (progress: number) => boolean;
}

export function useFlightPathSampling() {
  // Pull both map *and* terrainLoaded flag from context
  const { map, terrainLoaded } = useMapContext();
  
  const getTerrainElevation = useCallback(
    async ([lng, lat]: [number, number]): Promise<number> => {
      // guard until map + terrain is ready
      if (!map || !map.loaded() || !terrainLoaded) {
        console.warn('Map or terrain not loaded for terrain elevation query');
        return 0;
      }
  
      try {
        // sanity‐check coords
        if (!isFinite(lng) || !isFinite(lat)) {
          console.warn('Invalid coordinates for elevation query:', [lng, lat]);
          return 0;
        }

        // ensure DEM source + terrain is set up
        if (!map.getSource('mapbox-dem')) {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 15,
          });
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
        }
  
        const elevation = map.queryTerrainElevation([lng, lat]);
        if (elevation == null) {
          console.warn('Null elevation returned for', [lng, lat]);
          return 0;
        }
        return elevation;
      } catch (err) {
        console.error('Error getting terrain elevation:', err);
        return 0;
      }
    },
    [map, terrainLoaded]  // <-- depend on terrainLoaded now
  );
  
  const sampleFlightPath = useCallback(
    async (
      flightPath: GeoJSON.LineString,
      options: SamplingOptions = { resolution: 10 }
    ): Promise<SamplePoint[]> => {
      // validate geometry
      if (
        !flightPath.coordinates ||
        !Array.isArray(flightPath.coordinates) ||
        flightPath.coordinates.length < 2
      ) {
        throw new Error('Invalid flight path: Missing or invalid coordinates');
      }

      // build 3‑component coordinate array, removing duplicates
      const coords3d: [number, number, number][] = [];
      for (const raw of flightPath.coordinates) {
        const [lon, lat, alt = 0] = raw;
        if (
          !isFinite(lon) ||
          !isFinite(lat) ||
          (coords3d.length &&
           coords3d[coords3d.length - 1][0] === lon &&
           coords3d[coords3d.length - 1][1] === lat)
        ) {
          continue;
        }
        coords3d.push([lon, lat, alt]);
      }
      if (coords3d.length < 2) {
        throw new Error('Not enough valid coordinates after removing duplicates');
      }

      // create turf line
      const line2d = turf.lineString(coords3d.map(c => [c[0], c[1]] as [number, number]));
      const totalLength = turf.length(line2d, { units: 'meters' });

      const samples: SamplePoint[] = [];
      const totalSteps = Math.max(Math.ceil(totalLength / options.resolution), 1);
      for (let step = 0; step <= totalSteps; step++) {
        // progress callback
        if (options.progressCallback) {
          const p = (step / totalSteps) * 100;
          if (options.progressCallback(p)) return samples;
        }

        const distance = step * options.resolution;
        if (distance > totalLength) break;

        // position along the line
        const pt = turf.along(line2d, distance / 1000, { units: 'kilometers' });
        const [lng, lat] = pt.geometry.coordinates as [number, number];

        // interpolate flight elevation
        let flightElevation = 0;
        for (let i = 0; i < coords3d.length - 1; i++) {
          const [sLon, sLat, sAlt] = coords3d[i];
          const [eLon, eLat, eAlt] = coords3d[i + 1];
          const seg = turf.lineString([
            [sLon, sLat],
            [eLon, eLat],
          ]);
          const segLen = turf.length(seg, { units: 'meters' });
          const startDist = i === 0
            ? 0
            : turf.length(
                turf.lineSlice(
                  turf.point([coords3d[0][0], coords3d[0][1]]),
                  turf.point([sLon, sLat]),
                  line2d
                ),
                { units: 'meters' }
              );
          if (distance >= startDist && distance <= startDist + segLen) {
            const t = (distance - startDist) / segLen;
            flightElevation = sAlt + (eAlt - sAlt) * t;
            break;
          }
          // if we reach the final segment
          if (i === coords3d.length - 2 && distance > totalLength - options.resolution) {
            flightElevation = coords3d[coords3d.length - 1][2];
          }
        }

        // fetch terrain elevation (now guarded)
        let terrainElevation = 0;
        try {
          terrainElevation = await getTerrainElevation([lng, lat]);
        } catch (e) {
          console.warn(`Error querying terrain at [${lng},${lat}]:`, e);
        }

        samples.push({
          position: [lng, lat, flightElevation],
          distanceFromStart: distance,
          flightElevation,
          terrainElevation,
          clearance: flightElevation - terrainElevation,
        });
      }

      return samples;
    },
    [getTerrainElevation]
  );
  
  return { sampleFlightPath, getTerrainElevation };
}
