/**
 * TreeHeightQueryResults.tsx
 * 
 * Purpose:
 * Modal/popup component to display tree height analysis results.
 * Shows statistical summary, height distribution, and provides export options.
 * 
 * Features:
 * - Statistical summary with key metrics
 * - Height distribution visualization
 * - Interactive histogram
 * - Export functionality (CSV, JSON)
 * - Responsive design for mobile and desktop
 * 
 * Related Files:
 * - TreeHeightTypes.ts: Type definitions for props and data
 * - treeHeightConfig.ts: Configuration for height classes and colors
 */

import React, { useState, useMemo } from 'react';
import { 
  X,
  BarChart3, 
  TreePine, 
  MapPin, 
  Clock,
  Calculator,
  TrendingUp,
  Info
} from 'lucide-react';

// Import types separately from values
import type { 
  TreeHeightQueryResultsData, 
  TreeHeightQueryResultsProps,
  TreeHeightDistribution
} from '../../../services/TreeHeightService';

// Import the runtime value separately
import { TREE_HEIGHT_ANALYSIS } from '../../../services/TreeHeightService';

/**
 * Stat card component for displaying key metrics
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'orange' | 'purple';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtitle, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200'
  };

  return (
    <div className={`p-3 rounded-lg border-2 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-xs text-gray-600 mt-1">{subtitle}</div>}
    </div>
  );
};

/**
 * Height distribution bar chart component
 */
interface DistributionChartProps {
  distribution: TreeHeightDistribution[];
  totalSamples: number;
}

const DistributionChart: React.FC<DistributionChartProps> = ({ distribution, totalSamples }) => {
  const maxCount = Math.max(...distribution.map(d => d.count));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Height Distribution
      </h4>
      
      <div className="space-y-1">
        {distribution.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            {/* Label */}
            <div className="w-20 text-xs text-gray-700 font-medium flex-shrink-0">
              {item.className}
            </div>
            
            {/* Range */}
            <div className="w-16 text-xs text-gray-500 flex-shrink-0">
              {item.range.min}-{item.range.max}m
            </div>
            
            {/* Bar */}
            <div className="flex-1 relative">
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
            
            {/* Count and percentage */}
            <div className="w-20 text-xs text-gray-700 text-right flex-shrink-0">
              <div className="font-semibold">{item.count.toLocaleString()}</div>
              <div className="text-gray-500">{item.percentage.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        Total samples: {totalSamples.toLocaleString()}
      </div>
    </div>
  );
};

/**
 * Main tree height query results component
 */
const TreeHeightQueryResults: React.FC<TreeHeightQueryResultsProps> = ({
  result,
  isOpen,
  onClose,
  onRerun,
  
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'distribution' | 'details'>('summary');

  // Calculate height distribution if not provided
  const distribution = useMemo((): TreeHeightDistribution[] => {
    if (result.distribution) {
      return result.distribution;
    }

    // Calculate distribution from raw heights
    const heightClasses = TREE_HEIGHT_ANALYSIS.HEIGHT_CLASSES;
    const totalSamples = result.heights.length;
    
    return Object.entries(heightClasses).map(([className, range]) => {
      const count = result.heights.filter(h => h >= range.min && h < range.max).length;
      return {
        className,
        range,
        count,
        percentage: (count / totalSamples) * 100,
        color: range.color
      };
    }).filter(item => item.count > 0); // Only show classes with data
  }, [result]);

  // Calculate area
  const areaKm2 = useMemo(() => {
    const [west, south, east, north] = result.bounds;
    // Rough calculation - more accurate would use proper geographic calculations
    const deltaLat = north - south;
    const deltaLng = east - west;
    const avgLat = (north + south) / 2;
    const latDegreeKm = 111; // km per degree latitude
    const lngDegreeKm = 111 * Math.cos(avgLat * Math.PI / 180); // km per degree longitude at this latitude
    return (deltaLat * latDegreeKm) * (deltaLng * lngDegreeKm);
  }, [result.bounds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <TreePine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Tree Height Analysis</h2>
              <p className="text-sm text-gray-600">Area of Operations Results</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            
            {/* Rerun button */}
            {onRerun && (
              <button 
                onClick={onRerun}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Re-run
              </button>
            )}
            
            {/* Close button */}
            <button 
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'summary', label: 'Summary', icon: Calculator },
            { id: 'distribution', label: 'Distribution', icon: BarChart3 },
            { id: 'details', label: 'Details', icon: Info }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Key statistics grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Calculator className="w-4 h-4" />}
                  label="Average Height"
                  value={`${result.statistics.average.toFixed(1)}m`}
                  subtitle={`${result.statistics.count.toLocaleString()} samples`}
                  color="blue"
                />
                
                <StatCard
                  icon={<TrendingUp className="w-4 h-4" />}
                  label="Maximum Height"
                  value={`${result.statistics.max.toFixed(1)}m`}
                  subtitle={`Min: ${result.statistics.min.toFixed(1)}m`}
                  color="green"
                />
                
                <StatCard
                  icon={<MapPin className="w-4 h-4" />}
                  label="Area Analyzed"
                  value={`${areaKm2.toFixed(2)} km²`}
                  subtitle="Total coverage"
                  color="orange"
                />
                
                <StatCard
                  icon={<TreePine className="w-4 h-4" />}
                  label="Data Quality"
                  value={`${((result.statistics.count / (result.statistics.count + result.statistics.noDataCount)) * 100).toFixed(1)}%`}
                  subtitle={`${result.statistics.noDataCount} corrupted points`}
                  color="purple"
                />
              </div>

              {/* Quick insights */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Key Insights</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <div>• {getHeightInsight(result.statistics.average)}</div>
                  <div>• {getMaxHeightInsight(result.statistics.max)}</div>
                  <div>• {getDataQualityInsight(result.statistics.count, result.statistics.noDataCount)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Distribution Tab */}
          {activeTab === 'distribution' && (
            <div className="space-y-4">
              <DistributionChart 
                distribution={distribution} 
                totalSamples={result.statistics.count} 
              />
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Geographic Bounds</h4>
                  <div className="space-y-1 text-gray-700">
                    <div>West: {result.bounds[0].toFixed(4)}°</div>
                    <div>South: {result.bounds[1].toFixed(4)}°</div>
                    <div>East: {result.bounds[2].toFixed(4)}°</div>
                    <div>North: {result.bounds[3].toFixed(4)}°</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">Analysis Details</h4>
                  <div className="space-y-1 text-gray-700">
                    <div>Zoom Level: {result.metadata?.zoomLevel || 13}</div>
                    <div>Tiles Processed: {result.metadata?.tilesProcessed || 'N/A'}</div>
                    <div>Duration: {result.metadata?.durationMs ? `${(result.metadata.durationMs / 1000).toFixed(1)}s` : 'N/A'}</div>
                    <div>Timestamp: {result.metadata?.timestamp ? new Date(result.metadata.timestamp).toLocaleString() : 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Data source information */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">Data Source</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>• Australia Forest Height 2019 Dataset</div>
                  <div>• 30m spatial resolution</div>
                  <div>• Derived from GEDI lidar and Landsat data</div>
                  <div>• University of Maryland GLAD team</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="text-xs text-gray-600">
            Results based on available forest height data
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper functions for generating insights
const getHeightInsight = (avgHeight: number): string => {
  if (avgHeight < 5) return "Low vegetation, mostly shrubs and young trees";
  if (avgHeight < 15) return "Mixed vegetation with small to medium trees";
  if (avgHeight < 25) return "Mature forest with medium-height trees";
  if (avgHeight < 35) return "Tall forest canopy present";
  return "Very tall forest with exceptional tree heights";
};

const getMaxHeightInsight = (maxHeight: number): string => {
  if (maxHeight < 20) return "No significant tall trees detected";
  if (maxHeight < 40) return "Some tall trees present - consider drone altitude";
  if (maxHeight < 60) return "Very tall trees detected - plan flight altitude carefully";
  return "Exceptional tree heights - detailed flight planning required";
};

const getDataQualityInsight = (dataPoints: number, noDataPoints: number): string => {
  const coverage = (dataPoints / (dataPoints + noDataPoints)) * 100;
  if (coverage > 95) return "Excellent data coverage across the area";
  if (coverage > 85) return "Good data coverage with some gaps";
  if (coverage > 70) return "Moderate data coverage - some areas may lack data";
  return "Limited data coverage - results may be incomplete";
};

export default TreeHeightQueryResults;