// src/workers/obstacleAnalysisWorker.ts

import * as turf from '@turf/turf';

// Define the interfaces
interface SamplePoint {
  position: [number, number, number];
  distanceFromStart: number;
  flightElevation: number;
  terrainElevation: number;
  clearance: number;
}

interface WorkerMessage {
  type: string;
  payload: any;
}

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'sampleFlightPath') {
    try {
      const { lineString, resolution, terrainData } = payload;
      const samples = await sampleFlightPath(lineString, resolution, terrainData);
      self.postMessage({ type: 'sampleResult', payload: samples });
    } catch (error) {
      self.postMessage({ type: 'error', payload: error.message });
    }
  }
});

// Sampling function (simplified version - you'll need to adapt)
async function sampleFlightPath(
  lineString: any, 
  resolution: number,
  terrainData: any[]
): Promise<SamplePoint[]> {
  const coords3d = lineString.coordinates;
  const line2d = turf.lineString(coords3d.map(c => [c[0], c[1]]));
  const totalLength = turf.length(line2d, { units: 'meters' });
  
  const samples: SamplePoint[] = [];
  const totalSteps = Math.max(Math.ceil(totalLength / resolution), 1);
  
  for (let step = 0; step <= totalSteps; step++) {
    // Progress updates
    const progress = (step / totalSteps) * 100;
    self.postMessage({ type: 'progress', payload: progress });
    
    const distance = step * resolution;
    if (distance > totalLength) break;
    
    // Position along the line
    const pt = turf.along(line2d, distance / 1000, { units: 'kilometers' });
    const [lng, lat] = pt.geometry.coordinates;
    
    // Interpolate flight elevation
    // ... (your existing flight elevation interpolation logic)
    let flightElevation = 0;
    // Your existing flight elevation calculation code
    
    // Get terrain elevation from pre-fetched data
    let terrainElevation = getTerrainElevation([lng, lat], terrainData);
    
    samples.push({
      position: [lng, lat, flightElevation],
      distanceFromStart: distance,
      flightElevation,
      terrainElevation,
      clearance: flightElevation - terrainElevation,
    });
  }
  
  return samples;
}

// Helper function to get terrain elevation from pre-fetched data
function getTerrainElevation(coords: [number, number], terrainData: any[]): number {
  // This would need to be implemented based on how you structure your terrain data
  // For simplicity, you might pass a grid of terrain data points
  // and then interpolate between them
  
  // Simple example (would need to be replaced with actual implementation):
  return 0; // Placeholder
}