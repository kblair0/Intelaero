// components/ELOSAnalysisCard.tsx
import React, { useState } from 'react';
import { useLocation } from '../context/LocationContext';
import { LocationData } from '../components/Map';
import CollapsibleCard from './collapsibleCard';

const LocationDisplay = ({ title, location }: { title: string; location?: LocationData | null }) => (
  <div className="mb-3 p-2 bg-gray-50 rounded">
    <h4 className="text-xs font-semibold text-gray-600">{title}</h4>
    {location ? (
      <div className="text-xs mt-1">
        <p>Lat: {location.lat.toFixed(5)}</p>
        <p>Lng: {location.lng.toFixed(5)}</p>
        <p>Elev: {location.elevation?.toFixed(1)}m</p>
      </div>
    ) : (
      <p className="text-xs text-gray-400 mt-1">Not set</p>
    )}
  </div>
);

interface MarkerConfig {
  elevationOffset: number;
  gridRange: number;
}

const ELOSAnalysisCard = () => {
  // Main analysis state
  const [showGrid, setShowGrid] = useState(false);
  const [gridRange, setGridRange] = useState(2000);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    visibleCells: number;
    totalCells: number;
    averageVisibility: number;
    analysisTime: number;
  } | null>(null);

  // Location context
  const { gcsLocation, observerLocation, repeaterLocation } = useLocation();

  const [selectedTarget, setSelectedTarget] = useState('');
  const [losStatus, setLosStatus] = useState('');

  // Marker configurations
  const [gcsConfig, setGcsConfig] = useState<MarkerConfig>({ elevationOffset: 0, gridRange: 1500 });
  const [observerConfig, setObserverConfig] = useState<MarkerConfig>({ elevationOffset: 0, gridRange: 1500 });
  const [repeaterConfig, setRepeaterConfig] = useState<MarkerConfig>({ elevationOffset: 0, gridRange: 1500 });

  const handleMarkerConfigChange = (
    setter: React.Dispatch<React.SetStateAction<MarkerConfig>>,
    field: keyof MarkerConfig,
    value: number
  ) => {
    setter(prev => ({ ...prev, [field]: value }));
  };

  const renderMarkerSection = (
    title: string,
    icon: string,
    location: LocationData | null,
    config: MarkerConfig,
    setConfig: React.Dispatch<React.SetStateAction<MarkerConfig>>,
    colorClass: string
  ) => (
    <div className="bg-gray-50 p-4 rounded">
      <div className="flex items-center justify-between mb-3">
        <h4 className={`text-sm font-semibold ${colorClass} flex items-center gap-1`}>
          <span>{icon}</span>
          {title}
        </h4>
      </div>

      <LocationDisplay title={`${title} Location`} location={location} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">Elevation Offset:</span>
          <input
            type="number"
            value={config.elevationOffset}
            onChange={(e) => handleMarkerConfigChange(setConfig, 'elevationOffset', Number(e.target.value))}
            className="w-20 px-2 py-1 text-xs border rounded"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min="500"
            max="5000"
            value={config.gridRange}
            onChange={(e) => handleMarkerConfigChange(setConfig, 'gridRange', Number(e.target.value))}
            className={`flex-grow h-2 ${colorClass} bg-opacity-25 rounded`}
          />
          <span className="text-xs w-12">{config.gridRange}m</span>
          <button
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90"
          >
            Analyze
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 space-y-6">
      {/* Main Analysis Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-blue-500">✈️</span>
            Drone LOS Analysis
          </h2>
          <label className="flex items-center gap-2">
            <div className="relative">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={() => setShowGrid(!showGrid)}
                className="sr-only"
              />
              <div className={`w-12 h-6 rounded-full transition-colors ${showGrid ? 'bg-blue-500' : 'bg-gray-300'
                }`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${showGrid ? 'translate-x-6' : 'translate-x-1'
                  }`} />
              </div>
            </div>
            <span className="text-sm text-gray-600">Grid</span>
          </label>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Grid Range</span>
            <span>{gridRange}m</span>
          </div>
          <input
            type="range"
            min="500"
            max="5000"
            value={gridRange}
            onChange={(e) => setGridRange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <button
          onClick={() => setIsAnalyzing(true)}
          disabled={isAnalyzing}
          className={`w-full py-2 rounded-lg font-medium transition-colors ${isAnalyzing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
        >
          {isAnalyzing ? 'Analyzing...' : 'Run Full Analysis'}
        </button>
      </div>

      {/* Marker Sections */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Marker Analysis</h3>

        {renderMarkerSection(
          'GCS Station',
          '📡',
          gcsLocation,
          gcsConfig,
          setGcsConfig,
          'text-blue-600'
        )}

        {renderMarkerSection(
          'Observer Station',
          '🔭',
          observerLocation,
          observerConfig,
          setObserverConfig,
          'text-green-600'
        )}

        {renderMarkerSection(
          'Repeater Station',
          '⚡️',
          repeaterLocation,
          repeaterConfig,
          setRepeaterConfig,
          'text-red-600'
        )}
      </div>

      {/* LOS Check Section */}
      <div className="bg-gray-50 p-4 rounded">
        <h4 className="text-sm font-semibold mb-3">Point-to-Point Check</h4>

        <div className="flex gap-2 mb-2">
          <select
            className="flex-grow px-2 py-1 text-xs border rounded bg-white"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
          >
            <option value="">Select Target</option>
            {observerLocation && <option value="observer">Observer 🔭</option>}
            {repeaterLocation && <option value="repeater">Repeater ⚡️</option>}
          </select>
          <button
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:opacity-90"
          >
            Check LOS
          </button>
        </div>

        <div className="text-xs text-gray-600 min-h-[20px]">
          {losStatus || 'Select target to check line of sight'}
        </div>
      </div>

      {/* Results/Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {stats && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h3 className="text-lg font-semibold mb-3">Results</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-600">Visibility</p>
              <p className="text-lg font-medium">
                {stats.visibleCells}/{stats.totalCells}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Average</p>
              <p className="text-lg font-medium">
                {stats.averageVisibility.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Time</p>
              <p className="text-lg font-medium">
                {(stats.analysisTime / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ELOSAnalysisCard;