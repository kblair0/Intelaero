/**
 * MeshblockPopup.tsx
 * 
 * Purpose:
 * Interactive popup component for displaying detailed meshblock information
 * on hover or click events. Shows comprehensive meshblock metadata including
 * land use, population estimates, area calculations, and contextual information.
 */

'use client';
import React, { useMemo } from 'react';
import {
  X,
  MapPin,
  Users,
  Home,
  Calendar,
  ExternalLink,
  Info,
  TrendingUp,
  Map,
  Building,
  AlertTriangle,
  Layers
} from 'lucide-react';
import {
  MeshblockPopupProps,
  MeshblockViewMode,
  LandUseCategory,
  getGroundRiskClassName,
  getGroundRiskClassColor
} from './types';
import { getMeshblockColor } from './utils/meshblockColors';

/**
 * Formatted data row component for consistent display
 */
interface DataRowProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  emphasis?: boolean;
  color?: string;
}

const DataRow: React.FC<DataRowProps> = ({ 
  icon, 
  label, 
  value, 
  unit, 
  emphasis = false,
  color 
}) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-2 text-gray-600">
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span className="text-sm">{label}:</span>
    </div>
    <div className="flex items-center gap-1">
      {color && (
        <div 
          className="w-3 h-3 rounded border border-gray-300"
          style={{ backgroundColor: color }}
        />
      )}
      <span className={`text-sm ${emphasis ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-gray-500 ml-1">{unit}</span>}
      </span>
    </div>
  </div>
);

/**
 * Section header component
 */
interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
    <div className="p-1 bg-blue-100 rounded text-blue-600">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
    </div>
  </div>
);

/**
 * External link component - FIXED: Renamed to avoid conflict
 */
interface ExternalLinkComponentProps {
  href: string;
  children: React.ReactNode;
}

const ExternalLinkComponent: React.FC<ExternalLinkComponentProps> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs underline"
  >
    {children}
    <ExternalLink className="w-3 h-3" />
  </a>
);

/**
 * Main meshblock popup component
 */
const MeshblockPopup: React.FC<MeshblockPopupProps> = ({
  meshblock,
  viewMode,
  onClose,
  includeAnalysisData = false
}) => {
  const { properties } = meshblock;
  
  // FIXED: Stabilize useMemo with proper dependencies and correct field names
  const derivedData = useMemo(() => {
    const landUse = properties.landUseCategory || LandUseCategory.OTHER;
    const color = getMeshblockColor(landUse, properties.populationDensity || 0, viewMode);
    
    // ✅ FIXED: Use actual lowercase field names from API
    const areaKm2 = properties.area_albers_sqkm || 0;
    const areaHectares = areaKm2 * 100; // Convert km² to hectares
    
    const populationPerDwelling = properties.estimatedDwellings && properties.estimatedDwellings > 0
      ? (properties.estimatedPopulation || 0) / properties.estimatedDwellings
      : 0;
    
    // ✅ FIXED: Use actual lowercase field name
    const meshblockCode = properties.mb_code_2021 || 'Unknown';
    
    // ✅ Safe formatting - check if code exists and has right format
    const formattedCode = meshblockCode && meshblockCode.length === 11
      ? meshblockCode.replace(/(\d{1})(\d{4})(\d{6})/, '$1 $2 $3')
      : meshblockCode;
    
    // ABS data URL - general meshblock information page
    const absUrl = `https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/main-structure-and-greater-capital-city-statistical-areas/mesh-blocks`;
        
    return {
      landUse,
      color,
      areaKm2,
      areaHectares,
      populationPerDwelling,
      meshblockCode,
      formattedCode,
      absUrl
    };
  }, [
    properties.landUseCategory,
    properties.populationDensity,
    properties.area_albers_sqkm,
    properties.estimatedDwellings,
    properties.estimatedPopulation,
    properties.mb_code_2021,
    viewMode
  ]);
  
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-sm w-full max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <SectionHeader
              icon={<Map className="w-4 h-4" />}
              title={`Meshblock ${derivedData.formattedCode}`}
              subtitle={`${properties.sa2_name_2021}, ${properties.state_name_2021}`}
            />
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Close popup"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Land Use Information */}
        <div>
          <SectionHeader
            icon={<Building className="w-4 h-4" />}
            title="Land Use"
          />
          <div className="space-y-1">
            <DataRow
              icon={<Layers className="w-4 h-4" />}
              label="Category"
              value={derivedData.landUse}
              emphasis={true}
              color={getMeshblockColor(derivedData.landUse, 0, MeshblockViewMode.LAND_USE)}
            />
            <DataRow
              icon={<Map className="w-4 h-4" />}
              label="Area"
              value={properties.area_albers_sqkm.toFixed(3)}
              unit="km²"
            />
            <DataRow
              label="Area"
              value={derivedData.areaHectares.toFixed(1)}
              unit="hectares"
            />
          </div>
        </div>
        
        {/* Population Information */}
        {viewMode === MeshblockViewMode.POPULATION_DENSITY && (
          <div>
            <SectionHeader
              icon={<Users className="w-4 h-4" />}
              title="Population & Risk Assessment"
            />
            <div className="space-y-1">
              <DataRow
                icon={<Home className="w-4 h-4" />}
                label="Est. Dwellings"
                value={properties.estimatedDwellings || 0}
                emphasis={true}
              />
              <DataRow
                icon={<Users className="w-4 h-4" />}
                label="Est. Population"
                value={properties.estimatedPopulation || 0}
                emphasis={true}
              />
              <DataRow
                icon={<TrendingUp className="w-4 h-4" />}
                label="Density"
                value={properties.populationDensity?.toFixed(1) || '0.0'}
                unit="people/km²"
                emphasis={true}
              />
              {/* ADD this new row for ground risk class */}
              <DataRow
                icon={<AlertTriangle className="w-4 h-4" />}
                label="Ground Risk Class"
                value={getGroundRiskClassName(properties.populationDensity || 0)}
                emphasis={true}
                color={getGroundRiskClassColor(properties.populationDensity || 0)}
              />
              {derivedData.populationPerDwelling > 0 && (
                <DataRow
                  label="People per dwelling"
                  value={derivedData.populationPerDwelling.toFixed(1)}
                />
              )}
            </div>
          </div>
        )}
        
        {/* Flight Path Analysis Data - FIXED: Check for existence of properties */}
        {includeAnalysisData && properties.intersectsFlightPath && (
          <div>
            <SectionHeader
              icon={<MapPin className="w-4 h-4" />}
              title="Flight Path Analysis"
            />
            <div className="space-y-1">
              <DataRow
                label="Intersects flight path"
                value="Yes"
                emphasis={true}
                color="#ff6b35"
              />
              {/* FIXED: Check if properties exist before displaying */}
              {(properties as any).intersectionArea && (
                <DataRow
                  label="Intersection area"
                  value={(properties as any).intersectionArea.toFixed(3)}
                  unit="km²"
                />
              )}
              {(properties as any).intersectionRatio && (
                <DataRow
                  label="Coverage"
                  value={((properties as any).intersectionRatio * 100).toFixed(1)}
                  unit="%"
                />
              )}
            </div>
          </div>
        )}
        
        {/* Metadata */}
        <div>
          <SectionHeader
            icon={<Info className="w-4 h-4" />}
            title="Technical Details"
          />
          <div className="space-y-1">
            <DataRow
              icon={<Calendar className="w-4 h-4" />}
              label="Census Year"
              value="2021"
            />
            <DataRow
              label="Meshblock Code"
              value={properties.mb_code_2021}
            />
            {properties.processedAt && (
              <DataRow
                label="Data processed"
                value={new Date(properties.processedAt).toLocaleDateString()}
              />
            )}
          </div>
        </div>
        
        {/* Footer with links */}
        <div className="pt-3 border-t border-gray-200">
          <div className="space-y-2">
            <ExternalLinkComponent href={derivedData.absUrl}>
              View detailed ABS data
            </ExternalLinkComponent>
            <div className="text-xs text-gray-500">
              <p>
                Population estimates calculated from ABS dwelling data. 
                Actual population may vary.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* View Mode Indicator */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">
            Viewing: <span className="font-medium">
              {viewMode === MeshblockViewMode.LAND_USE ? 'Land Use Categories' : 'Population Density'}
            </span>
          </span>
          {viewMode === MeshblockViewMode.LAND_USE && (
            <div 
              className="w-3 h-3 rounded border border-gray-300"
              style={{ backgroundColor: derivedData.color }}
              title={`${derivedData.landUse} color indicator`}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MeshblockPopup;