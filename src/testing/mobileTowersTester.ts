// src/testing/mobileTowersTester.ts
import * as turf from '@turf/turf';

/**
 * Utility to test the mobile towers feature
 */
export function createTestAO(centerLat: number, centerLng: number, radiusKm: number): GeoJSON.FeatureCollection {
  // Create a circular Area of Operations for testing
  const center = turf.point([centerLng, centerLat]);
  const circle = turf.circle(center, radiusKm, {
    steps: 64,
    units: 'kilometers'
  });
  
  return {
    type: 'FeatureCollection',
    features: [circle]
  };
}

/**
 * Test the mobile towers service with a predefined location
 * Example usage:
 * - Import in your component: import { testMobileTowers } from '../testing/mobileTowersTester';
 * - Add a button: <button onClick={testMobileTowers}>Test Towers</button>
 */
export function testMobileTowers() {
  // Set a known location with towers (e.g. Sydney CBD)
  const testAO = createTestAO(-33.8688, 151.2093, 5); // Sydney, 5km radius
  
  // You can access these in your MobileTowerAnalysisCard for testing
  console.log('Test AO created for Sydney:', testAO);
  return testAO;
}