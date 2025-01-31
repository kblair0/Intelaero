// components/ELOSAnalysisCard.tsx
import React from 'react';
import { useLocation } from '../context/LocationContext';
import { useLOSAnalysis } from '../context/LOSAnalysisContext';
import { LocationData } from '../components/Map';
import { MapRef } from './Map';
import { useFlightPlanContext } from '../context/FlightPlanContext';

interface ELOSAnalysisCardProps {
  mapRef: React.RefObject<MapRef>;
}

const LocationDisplay = ({ title, location }: { title: string; location?: LocationData | null }) => (
  <div className="mb-3 p-2 bg-gray-50 rounded">
    <h4 className="text-xs font-semibold text-gray-600">{title}</h4>
    {location ? (
      // Add your flex classes here in place of `text-xs mt-1`:
      <div className="text-xs mt-1 flex flex-row gap-4 items-center">
        <p>Lat: {location.lat.toFixed(5)}</p>
        <p>Lng: {location.lng.toFixed(5)}</p>
        <p>Elev: {location.elevation?.toFixed(1)}m</p>
      </div>
    ) : (
      <p className="text-xs text-gray-400 mt-1">Not set</p>
    )}
  </div>
);



const ELOSAnalysisCard: React.FC<ELOSAnalysisCardProps> = ({ mapRef }) => {
  // Get location data from LocationContext
  const { gcsLocation, observerLocation, repeaterLocation } = useLocation();
  const { flightPlan } = useFlightPlanContext();
  const isFlightPlanLoaded = flightPlan !== null && Object.keys(flightPlan).length > 0;

  // Get analysis state and actions from LOSAnalysisContext
  const {
    // Configuration
    elosGridRange,
    markerConfigs,
    setElosGridRange,
    setMarkerConfig,

    // Analysis State
    isAnalyzing,
    results,
    error,

    // Analysis Actions
    setIsAnalyzing,
    setError,
    resetAnalysis,
  } = useLOSAnalysis();

  const handleAnalyzeMarker = async (markerType: 'gcs' | 'observer' | 'repeater') => {
    if (!mapRef.current) {
      setError('Map not initialized');
      return;
    }

    // Just store them in a dictionary:
    const locations = {
      gcs: gcsLocation,
      observer: observerLocation,
      repeater: repeaterLocation
    };

    const location = locations[markerType];
    if (!location) {
      setError(`${markerType} location not set`);

      return;
    }

    const range = markerConfigs[markerType].gridRange;

    try {
      setIsAnalyzing(true);
      await mapRef.current.runElosAnalysis({
        markerType,
        location,
        range
      });
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleAnalysis = async () => {
    if (!mapRef.current) {
      setError('Map not initialized');
      return;
    }
    console.log('ELOS Analysis Requested');

    try {
      setIsAnalyzing(true);
      setError(null);
      await mapRef.current.runElosAnalysis();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handler for marker configuration updates
  const handleMarkerConfigChange = (
    markerType: 'gcs' | 'observer' | 'repeater',
    field: 'elevationOffset' | 'gridRange',
    value: number
  ) => {
    setMarkerConfig(markerType, { [field]: value });
  };

  return (
    <div>
      {/* Main Analysis Section */}
      <div className="space-y-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-blue-500">✈️</span>
            Drone LOS Analysis
          </h2>
          <span className="text-xs text-gray-500">
            Determine which points along the flight path the drone can see within the selected grid range.
          </span>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Grid Range</span>
            <span>{elosGridRange}m</span>
          </div>
          <input
            type="range"
            min="500"
            max="5000"
            value={elosGridRange}
            onChange={(e) => setElosGridRange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        {!isFlightPlanLoaded && (
          <div className="p-2 bg-yellow-100 text-yellow-700 text-xs rounded mt-2">
            ⚠️ Please load a flight plan before running the analysis.
          </div>
        )}

        <button
          onClick={handleAnalysis}
          disabled={!isFlightPlanLoaded || isAnalyzing}
          className={`w-full py-2 rounded-lg font-medium transition-colors ${!isFlightPlanLoaded || isAnalyzing
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
        >
          {isAnalyzing ? 'Analyzing...' : 'Run Full Analysis'}
        </button>

        {/* Show a warning message if no flight plan is loaded */}

      </div>
      {/* Marker Analysis Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-700 border-b border-gray-300 pb-2">
          Marker-Based Line of Sight Analysis
        </h3>

        {/* Add Markers Advice */}
        {(!gcsLocation && !observerLocation && !repeaterLocation) && (
          <div className="p-3 mb-3 bg-yellow-100 border border-yellow-400 text-sm text-yellow-700 rounded">
            ⚠️ To unlock 📡GCS Station/🔭Observer Station/⚡️Repeater Station Line of Sight analysis, drop markers on the map.
          </div>
        )}
        {/* GCS Section */}
        {gcsLocation && (
          <div className="bg-gray-50 p-4 rounded">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-blue-600 flex items-center gap-1">
                <span>📡</span>
                GCS Station
              </h4>
            </div>

            <LocationDisplay title="GCS Location" location={gcsLocation} />

            <div className="space-y-3">
              {/* Elevation Offset */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Elevation Offset (m):</label>
                <input
                  type="number"
                  value={markerConfigs.gcs.elevationOffset}
                  onChange={(e) => handleMarkerConfigChange('gcs', 'elevationOffset', Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs border rounded"
                />
              </div>

              {/* Grid Range */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Analysis Range (m):</label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  value={markerConfigs.gcs.gridRange}
                  onChange={(e) => handleMarkerConfigChange('gcs', 'gridRange', Number(e.target.value))}
                  className="flex-grow h-2 bg-blue-100 rounded"
                />
                <span className="text-xs w-12">{markerConfigs.gcs.gridRange}m</span>
              </div>

              {/* Analyze Button */}
              <button
                onClick={() => handleAnalyzeMarker('gcs')}
                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90"
              >
                Analyze
              </button>

            </div>
          </div>
        )}

        {/* Observer Section */}
        {observerLocation && (
          <div className="bg-gray-50 p-4 rounded">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-green-600 flex items-center gap-1">
                <span>🔭</span>
                Observer Station
              </h4>
            </div>

            <LocationDisplay title="Observer Location" location={observerLocation} />

            <div className="space-y-3">
              {/* Elevation Offset */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Elevation Offset (m):</label>
                <input
                  type="number"
                  value={markerConfigs.observer.elevationOffset}
                  onChange={(e) => handleMarkerConfigChange('observer', 'elevationOffset', Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs border rounded"
                />
              </div>

              {/* Grid Range */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Analysis Range (m):</label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  value={markerConfigs.observer.gridRange}
                  onChange={(e) => handleMarkerConfigChange('observer', 'gridRange', Number(e.target.value))}
                  className="flex-grow h-2 bg-green-100 rounded"
                />
                <span className="text-xs w-12">{markerConfigs.observer.gridRange}m</span>
              </div>

              {/* Analyze Button */}
              <button
                onClick={() => handleAnalyzeMarker('observer')}
                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:opacity-90"
              >
                Analyze
              </button>

            </div>
          </div>
        )}
        {/* Repeater Section */}
        {repeaterLocation && (
          <div className="bg-gray-50 p-4 rounded">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-red-600 flex items-center gap-1">
                <span>⚡️</span>
                Repeater Station
              </h4>
            </div>

            <LocationDisplay title="Repeater Location" location={repeaterLocation} />

            <div className="space-y-3">
              {/* Elevation Offset */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Elevation Offset (m):</label>
                <input
                  type="number"
                  value={markerConfigs.repeater.elevationOffset}
                  onChange={(e) => handleMarkerConfigChange('repeater', 'elevationOffset', Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs border rounded"
                />
              </div>

              {/* Grid Range */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">Analysis Range (m):</label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  value={markerConfigs.repeater.gridRange}
                  onChange={(e) => handleMarkerConfigChange('repeater', 'gridRange', Number(e.target.value))}
                  className="flex-grow h-2 bg-red-100 rounded"
                />
                <span className="text-xs w-12">{markerConfigs.repeater.gridRange}m</span>
              </div>

              {/* Analyze Individual Button */}
              <button
                onClick={() => handleAnalyzeMarker('repeater')}
                className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:opacity-90"
              >
                Analyze Own LOS
              </button>

            </div>

            {/* Point to Point Analysis Dropdown and Analyze Button */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Select Point-Point LOS Target:</label>
                <select
                  className="w-32 px-2 py-1 text-xs border rounded"
                // Add logic for dropdown selection here if needed
                >
                  <option value="option1">Option 1</option>
                  <option value="option2">Option 2</option>
                  <option value="option3">Option 3</option>
                </select>
              </div>

              {/* Analyze Button */}
              <button className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:opacity-90">
                Analyze Own LOS
              </button>
            </div>
          </div>
        )}

        {/* Results Display */}
        {results && results.stats && (
          <div className="mt-4 p-4 bg-gray-50 rounded">
            <h3 className="text-lg font-semibold mb-3">Results</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-600">Visibility</p>
                <p className="text-lg font-medium">
                  {results.stats.visibleCells}/{results.stats.totalCells}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Average</p>
                <p className="text-lg font-medium">
                  {results.stats.averageVisibility.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Time</p>
                <p className="text-lg font-medium">
                  {(results.stats.analysisTime / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
          </div>
        )}
      </div> 
    </div> 
  );
};


export default ELOSAnalysisCard;