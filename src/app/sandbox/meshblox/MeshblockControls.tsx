/**
 * MeshblockControls.tsx - Updated with Compact Mode Support
 * 
 * Purpose:
 * Simplified control panel for filtering with support for compact mode
 * for use in the filters dropdown in explore mode.
 * 
 * Changes:
 * 1. Added compact prop for simplified display
 * 2. Removed redundant elements when in compact mode
 * 3. Focused on core filtering functionality
 * 4. Better organization for the new two-mode interface
 */

'use client';
import React, { useState, useCallback } from 'react';
import { 
  MapPin, 
  Users, 
  ChevronDown, 
  ChevronRight,
  Filter,
  CheckCircle,
  X,
  RotateCcw
} from 'lucide-react';
import {
  MeshblockControlsProps,
  MeshblockViewMode,
  LandUseCategory,
  MeshblockFilters
} from './types';
import { createLegendData } from './utils/meshblockColors';

/**
 * Extended props to support compact mode
 */
interface ExtendedMeshblockControlsProps extends MeshblockControlsProps {
  compact?: boolean; // NEW: For simplified display in dropdowns
}

/**
 * Land use category filter component
 */
interface LandUseFilterProps {
  selectedCategories: LandUseCategory[];
  onSelectionChange: (categories: LandUseCategory[]) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  compact?: boolean;
}

const LandUseFilter: React.FC<LandUseFilterProps> = ({
  selectedCategories,
  onSelectionChange,
  isExpanded,
  onToggleExpanded,
  compact = false
}) => {
  const allCategories = Object.values(LandUseCategory);
  const legendData = createLegendData(MeshblockViewMode.LAND_USE);
  
  const handleCategoryToggle = (category: LandUseCategory) => {
    if (selectedCategories.includes(category)) {
      onSelectionChange(selectedCategories.filter(c => c !== category));
    } else {
      onSelectionChange([...selectedCategories, category]);
    }
  };
  
  const handleSelectAll = () => {
    onSelectionChange(allCategories);
  };
  
  const handleSelectNone = () => {
    onSelectionChange([]);
  };
  
  const isFiltered = selectedCategories.length > 0 && selectedCategories.length < allCategories.length;
  
  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${compact ? 'shadow-sm' : ''}`}>
      <button
        onClick={onToggleExpanded}
        className={`w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors ${
          compact ? 'px-2 py-1.5' : 'px-4 py-3'
        }`}
      >
        <div className="flex items-center gap-2">
          <Filter className={compact ? "w-3 h-3" : "w-4 h-4"} />
          <span>Land Use Categories</span>
          {isFiltered && (
            <span className={`bg-purple-100 text-purple-800 px-2 py-1 rounded-full ${
              compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
            }`}>
              {selectedCategories.length} of {allCategories.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronDown className={compact ? "w-3 h-3" : "w-4 h-4"} /> : <ChevronRight className={compact ? "w-3 h-3" : "w-4 h-4"} />}
      </button>
      
      {isExpanded && (
        <div className={`border-t border-gray-200 p-3 ${compact ? 'p-2' : 'p-4'}`}>
          <div className="flex justify-between mb-2">
            <button
              onClick={handleSelectAll}
              className={`text-blue-600 hover:text-blue-800 underline font-medium ${
                compact ? 'text-xs' : 'text-xs'
              }`}
            >
              Select All
            </button>
            <button
              onClick={handleSelectNone}
              className={`text-gray-600 hover:text-gray-800 underline ${
                compact ? 'text-xs' : 'text-xs'
              }`}
            >
              Clear All
            </button>
          </div>
          
          <div className={`space-y-1 max-h-48 overflow-y-auto ${compact ? 'space-y-1 max-h-32' : 'space-y-2 max-h-48'}`}>
            {legendData.map(({ label, color }) => {
              const category = label as LandUseCategory;
              const isSelected = selectedCategories.includes(category);
              
              return (
                <label
                  key={category}
                  className={`flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors ${
                    compact ? 'gap-1.5 p-1' : 'gap-3 p-2'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleCategoryToggle(category)}
                    className={`text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                      compact ? 'w-3 h-3' : 'w-4 h-4'
                    }`}
                  />
                  <div
                    className={`rounded border border-gray-300 flex-shrink-0 ${
                      compact ? 'w-3 h-3' : 'w-4 h-4'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  <span className={`text-gray-700 flex-1 ${compact ? 'text-xs' : 'text-sm'}`}>
                    {category}
                  </span>
                  {isSelected && <CheckCircle className={`text-green-500 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Population density filter component
 */
interface PopulationFilterProps {
  minDensity?: number;
  maxDensity?: number;
  onRangeChange: (min?: number, max?: number) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  compact?: boolean;
}

const PopulationFilter: React.FC<PopulationFilterProps> = ({
  minDensity,
  maxDensity,
  onRangeChange,
  isExpanded,
  onToggleExpanded,
  compact = false
}) => {
  const [localMin, setLocalMin] = useState(minDensity?.toString() || '');
  const [localMax, setLocalMax] = useState(maxDensity?.toString() || '');
  
  const applyFilters = () => {
    const min = localMin ? parseFloat(localMin) : undefined;
    const max = localMax ? parseFloat(localMax) : undefined;
    onRangeChange(min, max);
  };
  
  const clearFilters = () => {
    setLocalMin('');
    setLocalMax('');
    onRangeChange(undefined, undefined);
  };
  
  const isFiltered = minDensity !== undefined || maxDensity !== undefined;
  
  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${compact ? 'shadow-sm' : ''}`}>
      <button
        onClick={onToggleExpanded}
        className={`w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors ${
          compact ? 'px-2 py-1.5' : 'px-4 py-3'
        }`}
      >
        <div className="flex items-center gap-2">
          <Users className={compact ? "w-3 h-3" : "w-4 h-4"} />
          <span>Population Density Range</span>
          {isFiltered && (
            <span className={`bg-green-100 text-green-800 px-2 py-1 rounded-full ${
              compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
            }`}>
              Active
            </span>
          )}
        </div>
        {isExpanded ? <ChevronDown className={compact ? "w-3 h-3" : "w-4 h-4"} /> : <ChevronRight className={compact ? "w-3 h-3" : "w-4 h-4"} />}
      </button>
      
      {isExpanded && (
        <div className={`border-t border-gray-200 p-3 ${compact ? 'p-2' : 'p-4'}`}>
          <div className={compact ? 'space-y-2' : 'space-y-3'}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block font-medium text-gray-600 mb-1 ${
                  compact ? 'text-xs mb-1' : 'text-xs mb-2'
                }`}>
                  Minimum (people/km²)
                </label>
                <input
                  type="number"
                  value={localMin}
                  onChange={(e) => setLocalMin(e.target.value)}
                  placeholder="0"
                  className={`w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    compact ? 'text-xs px-1.5 py-1' : 'text-xs px-2 py-2'
                  }`}
                />
              </div>
              <div>
                <label className={`block font-medium text-gray-600 mb-1 ${
                  compact ? 'text-xs mb-1' : 'text-xs mb-2'
                }`}>
                  Maximum (people/km²)
                </label>
                <input
                  type="number"
                  value={localMax}
                  onChange={(e) => setLocalMax(e.target.value)}
                  placeholder="No limit"
                  className={`w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    compact ? 'text-xs px-1.5 py-1' : 'text-xs px-3 py-2'
                  }`}
                />
              </div>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={applyFilters}
                className={`flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium ${
                  compact ? 'text-xs px-2 py-1' : 'text-xs px-3 py-2'
                }`}
              >
                <Filter className={compact ? "w-3 h-3" : "w-3 h-3"} />
                Apply Filter
              </button>
              <button
                onClick={clearFilters}
                className={`flex items-center gap-1 px-3 py-2 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ${
                  compact ? 'text-xs px-2 py-1' : 'text-xs px-4 py-2'
                }`}
              >
                <RotateCcw className={compact ? "w-3 h-3" : "w-3 h-3"} />
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Filter status summary component
 */
interface FilterStatusProps {
  viewMode: MeshblockViewMode;
  filters: MeshblockFilters;
  meshblockCount: number;
  onClearAllFilters: () => void;
  compact?: boolean;
}

const FilterStatus: React.FC<FilterStatusProps> = ({ 
  viewMode, 
  filters, 
  meshblockCount, 
  onClearAllFilters,
  compact = false 
}) => {
  const hasActiveFilters = 
    (filters.landUseCategories && filters.landUseCategories.length < Object.values(LandUseCategory).length) ||
    filters.minPopulationDensity !== undefined ||
    filters.maxPopulationDensity !== undefined;

  if (!hasActiveFilters) {
    return (
      <div className={`text-gray-600 bg-gray-50 p-2 rounded-lg ${
        compact ? 'text-xs p-2' : 'text-sm p-3'
      }`}>
        <div className="flex items-center gap-2">
          <CheckCircle className={`text-green-500 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
          <span>Showing all {meshblockCount.toLocaleString()} meshblocks</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 p-2 rounded-lg ${
      compact ? 'p-2' : 'p-3'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Filter className={`text-blue-600 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
            <span className={`font-medium text-blue-900 ${
              compact ? 'text-xs' : 'text-sm'
            }`}>
              Active Filters ({meshblockCount.toLocaleString()} shown)
            </span>
          </div>
          <div className={`space-y-1 text-blue-800 ${compact ? 'text-xs space-y-1' : 'text-xs space-y-2'}`}>
            {filters.landUseCategories && filters.landUseCategories.length < Object.values(LandUseCategory).length && (
              <div>Land use: {filters.landUseCategories.length} categories selected</div>
            )}
            {(filters.minPopulationDensity !== undefined || filters.maxPopulationDensity !== undefined) && (
              <div>
                Density: {filters.minPopulationDensity || 0}+ 
                {filters.maxPopulationDensity ? ` to ${filters.maxPopulationDensity}` : ''} people/km²
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClearAllFilters}
          className={`flex items-center gap-1 px-2 py-1 text-blue-600 hover:bg-blue-100 rounded transition-colors ${
            compact ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
          }`}
        >
          <X className={compact ? "w-3 h-3" : "w-3 h-3"} />
          Clear All
        </button>
      </div>
    </div>
  );
};

/**
 * Main meshblock controls component - now with compact mode support
 */
const MeshblockControls: React.FC<ExtendedMeshblockControlsProps> = ({
  viewMode,
  onViewModeChange,
  filters,
  onFiltersChange,
  layersVisible,
  onLayersVisibleChange,
  canActivate,
  loading,
  meshblockCount,
  compact = false
}) => {
  // Local state for expandable sections
  const [expandedSection, setExpandedSection] = useState<string | null>(compact ? null : 'view-mode');
  
  const toggleSection = useCallback((section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  }, []);
  
  // Handle land use filter changes
  const handleLandUseFilterChange = useCallback((categories: LandUseCategory[]) => {
    onFiltersChange({
      ...filters,
      landUseCategories: categories.length === Object.values(LandUseCategory).length ? undefined : categories
    });
  }, [filters, onFiltersChange]);
  
  // Handle population density filter changes
  const handlePopulationFilterChange = useCallback((min?: number, max?: number) => {
    onFiltersChange({
      ...filters,
      minPopulationDensity: min,
      maxPopulationDensity: max
    });
  }, [filters, onFiltersChange]);
  
  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    onFiltersChange({
      landUseCategories: undefined,
      minPopulationDensity: undefined,
      maxPopulationDensity: undefined,
      minArea: undefined,
      maxArea: undefined,
      states: undefined,
      showIntersectingOnly: undefined
    });
  }, [onFiltersChange]);
  
  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {/* Header - Hide in compact mode */}
      {!compact && (
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Filter className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Display Controls</h3>
            <p className="text-sm text-gray-600">Configure how meshblocks are displayed</p>
          </div>
        </div>
      )}
      
      {/* Filter Sections */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {/* Land use category filter - only show in land use mode */}
        {viewMode === MeshblockViewMode.LAND_USE && (
          <LandUseFilter
            selectedCategories={filters.landUseCategories || Object.values(LandUseCategory)}
            onSelectionChange={handleLandUseFilterChange}
            isExpanded={expandedSection === 'landuse'}
            onToggleExpanded={() => toggleSection('landuse')}
            compact={compact}
          />
        )}
        
        {/* Population density filter - only show in population mode */}
        {viewMode === MeshblockViewMode.POPULATION_DENSITY && (
          <PopulationFilter
            minDensity={filters.minPopulationDensity}
            maxDensity={filters.maxPopulationDensity}
            onRangeChange={handlePopulationFilterChange}
            isExpanded={expandedSection === 'population'}
            onToggleExpanded={() => toggleSection('population')}
            compact={compact}
          />
        )}
      </div>
      
      {/* Filter Status */}
      <FilterStatus
        viewMode={viewMode}
        filters={filters}
        meshblockCount={meshblockCount}
        onClearAllFilters={handleClearAllFilters}
        compact={compact}
      />
      
      {/* Help Text - Simplified for compact mode */}
      {!compact && (
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong>Tip:</strong> Use filters to focus on specific areas of interest. 
            {viewMode === MeshblockViewMode.LAND_USE 
              ? ' Select relevant land use categories to highlight areas like residential zones or critical infrastructure.'
              : ' Set density ranges to identify high-population areas that may require special consideration.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default MeshblockControls;