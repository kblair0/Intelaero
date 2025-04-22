import * as turf from "@turf/turf";

export interface SamplePoint {
  /** [lon, lat, alt] */
  position: [number, number, number];
  /** metres */
  distanceFromStart: number;
  /** metres AMSL */
  flightElevation: number;
  /** metres AMSL – caller must fill */
  terrainElevation: number;
  /** flightElevation – terrainElevation */
  clearance: number;
}

export interface SamplingOptions {
  /** Spacing between samples in *metres* */
  resolution: number;
  /**
   * Callback invoked with *percentage* (0–100). If it returns true the
   * sampling aborts early (used for Cancel buttons).
   */
  progressCallback?: (progressPercent: number) => boolean;
  /**
   * If the flight plan is already in terrain-following mode we can skip
   * querying terrain in the caller.
   */
  isTerrainMode?: boolean;
}

/**
 * Interpolates a 3‑D LineString at a fixed step size.
 *
 * NOTE: The heavy work – querying terrain – is *not* performed here;
 *       we only calculate the geometrical skeleton. That keeps this
 *       function pure and unit-testable.
 */
export async function sampleFlightPath(
  line: GeoJSON.LineString,
  {
    resolution = 10,
    progressCallback,
    isTerrainMode = false,
  }: SamplingOptions
): Promise<SamplePoint[]> {
  const coords3d = line.coordinates as [number, number, number][];
  if (coords3d.length < 2) throw new Error("LineString must contain ≥2 points");

  /* ───────────────────── 1. Build flat segment table ───────────────────── */
  interface SegmentMeta {
    start: number; // cumulative distance from origin (metres)
    len: number; // segment length (metres)
    a0: number; // start altitude (m)
    a1: number; // end altitude (m)
  }
  const segments: SegmentMeta[] = [];
  let cumulative = 0;

  for (let i = 0; i < coords3d.length - 1; i++) {
    const [sx, sy] = coords3d[i];
    const [ex, ey] = coords3d[i + 1];
    const len = turf.distance([sx, sy], [ex, ey], { units: "meters" });
    segments.push({ start: cumulative, len, a0: coords3d[i][2], a1: coords3d[i + 1][2] });
    cumulative += len;
  }

  const totalLen = cumulative; // metres
  const totalSteps = Math.floor(totalLen / resolution);

  /* ───────────────────── 2. Sampling loop (O(n)) ──────────────────────── */
  const samples: SamplePoint[] = [];
  let segIdx = 0;

  for (let step = 0; step <= totalSteps; step++) {
    const dist = step * resolution; // metres from start

    // Advance segment pointer lazily (monotonically)
    while (
      segIdx < segments.length - 1 &&
      dist > segments[segIdx].start + segments[segIdx].len + Number.EPSILON
    ) {
      segIdx++;
    }

    const seg = segments[segIdx];

    // Fraction along current segment, clamped [0,1]
    const t = Math.min(Math.max((dist - seg.start) / seg.len, 0), 1);
    const flightElev = seg.a0 + t * (seg.a1 - seg.a0);

    // Interpolate lon/lat linearly – cheap and good enough at ≤10 m steps
    const [sx, sy] = coords3d[segIdx];
    const [ex, ey] = coords3d[segIdx + 1];
    const lon = sx + t * (ex - sx);
    const lat = sy + t * (ey - sy);

    samples.push({
      position: [lon, lat, flightElev],
      distanceFromStart: dist,
      flightElevation: flightElev,
      terrainElevation: 0, // will be filled with DEM in the analysis step
      clearance: 0,
    });

    /* ── progress callback every ~5 % (cheap) ── */
    if (progressCallback && step % Math.max(1, Math.floor(totalSteps / 20)) === 0) {
      if (progressCallback((step / totalSteps) * 100)) {
        // user requested cancellation
        return [];
      }
    }
  }

  // force 100 % when done
  progressCallback?.(100);

  return samples;
}

/**
 * Hook to access the sampleFlightPath function
 * @returns Object containing the sampleFlightPath function
 */
export const useFlightPathSampling = () => {
  return { sampleFlightPath };
};