// src/services/ElevationService.ts
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { normaliseElevation } from '../utils/elevation';

/**
 * Service class to manage elevation queries using Mapbox DEM.
 * Provides preloading, caching, and retry logic for robust elevation data retrieval.
 */
export class ElevationService {
  private map: mapboxgl.Map;
  private cache: Map<string, number> = new Map();

  /**
   * Initializes the service with a Mapbox map instance.
   * @param map - The Mapbox map instance to query elevations from.
   */
  constructor(map: mapboxgl.Map) {
    this.map = map;
  }

  /**
   * Generates a unique cache key for a coordinate pair.
   * @param lon - Longitude of the coordinate.
   * @param lat - Latitude of the coordinate.
   * @returns A string key for caching elevation data.
   */
  private key(lon: number, lat: number): string {
    return `${lon.toFixed(4)}|${lat.toFixed(4)}`;
  }

  /**
   * Ensures the terrain source ("mapbox-dem") is added and ready.
   * Adds the source and terrain layer if not present, and waits for initial loading.
   * @returns A promise that resolves when the terrain source is ready.
   */
  async ensureTerrainReady(): Promise<void> {
    if (!this.map.getSource("mapbox-dem")) {
      this.map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 15,
      });
      this.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });
    }

    if (!this.map.isSourceLoaded("mapbox-dem")) {
      await new Promise<void>((resolve) => {
        const checkDEM = () => {
          if (this.map!.isSourceLoaded("mapbox-dem")) {
            this.map!.off("sourcedata", checkDEM);
            resolve();
          }
        };
        this.map!.on("sourcedata", checkDEM);
      });
    }
  }

  /**
   * Preloads DEM tiles for a given set of coordinates by adjusting the map view.
   * Ensures all necessary tiles are loaded for the area of interest.
   * @param coordinates - Array of [lon, lat, alt] coordinates defining the area.
   * @returns A promise that resolves when the map is idle and tiles are loaded.
   */
  async preloadArea(coordinates: [number, number, number][]): Promise<void> {
    const line = turf.lineString(coordinates.map(c => [c[0], c[1]]));
    const bounds = turf.bbox(line);
    const [minLng, minLat, maxLng, maxLat] = bounds;

    const currentCenter = this.map.getCenter();
    const currentZoom = this.map.getZoom();

    this.map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50 });

    await new Promise<void>((resolve) => {
      this.map.once('idle', () => resolve());
    });

    this.map.setCenter(currentCenter);
    this.map.setZoom(currentZoom);
  }

  /**
   * Retrieves elevation at a specific coordinate with caching and retries.
   * @param lon - Longitude of the point.
   * @param lat - Latitude of the point.
   * @param maxRetries - Maximum number of retry attempts if elevation is null.
   * @param retryDelay - Delay between retries in milliseconds.
   * @returns The elevation in meters, or 0 if data is unavailable after retries.
   */
  async getElevation(lon: number, lat: number, maxRetries = 3, retryDelay = 200): Promise<number> {
    const cacheKey = this.key(lon, lat);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const elev = this.map.queryTerrainElevation([lon, lat]);
      if (elev !== null) {
        const normalized = normaliseElevation(elev);
        this.cache.set(cacheKey, normalized);
        return normalized;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    console.warn(`Elevation data not loaded for [${lon}, ${lat}] after ${maxRetries} attempts`);
    this.cache.set(cacheKey, 0);
    return 0;
  }
}