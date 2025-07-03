/**
 * PropertyPopup.tsx
 * 
 * Purpose:
 * Interactive popup component for displaying detailed property and survey mark information
 * when users click on features in the cadastre overlay. Shows comprehensive metadata
 * including property details, survey mark information, and contextual data.
 * 
 * Key Features:
 * - Property boundary information (lot/plan, area, status)
 * - Survey mark details (coordinates, elevation, type)
 * - Formatted display with icons and sections
 * - External links for additional information
 * - Responsive design for mobile compatibility
 * 
 * Related Files:
 * - types.ts - Type definitions for PropertyFeature and SurveyMarkFeature
 * - CadastreContext.tsx - Manages popup state and selection
 * - CadastreDashboard.tsx - Parent component that triggers popup display
 */

'use client';
import React, { useMemo } from 'react';
import {
  X,
  MapPin,
  Building,
  Navigation,
  Calendar,
  ExternalLink,
  Info,
  Ruler,
  FileText,
  Target,
  Mountain,
  Layers,
  Hash
} from 'lucide-react';
import {
  PropertyPopupProps,
  PropertyFeature,
  SurveyMarkFeature,
  PropertyType,
  PROPERTY_TYPE_COLORS
} from './cadastre-types';

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
 * External link component
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
 * Property information display component
 */
interface PropertyInfoProps {
  property: PropertyFeature;
}

const PropertyInfo: React.FC<PropertyInfoProps> = ({ property }) => {
  const { properties } = property;
  
  // Generate useful links
  const spatialServicesUrl = 'https://www.spatial.nsw.gov.au/';
  const titleSearchUrl = `https://www.nsw.gov.au/housing-and-construction/buying-and-selling-property/buying-a-home/searching-for-property-information`;
  
  return (
    <>
      {/* Property Details */}
      <div>
        <SectionHeader
          icon={<Building className="w-4 h-4" />}
          title="Property Details"
          subtitle={properties.lotPlanId}
        />
        <div className="space-y-1">
          <DataRow
            icon={<Hash className="w-4 h-4" />}
            label="Lot Number"
            value={properties.lotnumber}
            emphasis={true}
          />
          <DataRow
            icon={<FileText className="w-4 h-4" />}
            label="Plan Label"
            value={properties.planlabel}
            emphasis={true}
          />
          {properties.sectionnumber && (
            <DataRow
              icon={<Layers className="w-4 h-4" />}
              label="Section"
              value={properties.sectionnumber}
            />
          )}
          <DataRow
            icon={<Hash className="w-4 h-4" />}
            label="Cadastral ID"
            value={properties.cadid}
          />
        </div>
      </div>
      
      {/* Area Information */}
      <div>
        <SectionHeader
          icon={<Ruler className="w-4 h-4" />}
          title="Area Information"
        />
        <div className="space-y-1">
          <DataRow
            icon={<Ruler className="w-4 h-4" />}
            label="Total Area"
            value={properties.areaDisplay || `${properties.planlotarea.toLocaleString()} m²`}
            emphasis={true}
          />
          {properties.areaHectares && properties.areaHectares > 1 && (
            <DataRow
              label="Area (hectares)"
              value={properties.areaHectares.toFixed(2)}
              unit="ha"
            />
          )}
          <DataRow
            label="Area Units"
            value={properties.planlotareaunits}
          />
        </div>
      </div>
      
      {/* Property Classification */}
      {properties.propertyType && (
        <div>
          <SectionHeader
            icon={<Building className="w-4 h-4" />}
            title="Classification"
          />
          <div className="space-y-1">
            <DataRow
              icon={<Layers className="w-4 h-4" />}
              label="Property Type"
              value={properties.propertyType}
              emphasis={true}
              color={PROPERTY_TYPE_COLORS[properties.propertyType]}
            />
            <DataRow
              label="Title Status"
              value={properties.itstitlestatus}
            />
            {properties.hasstratum && (
              <DataRow
                label="Has Stratum"
                value="Yes"
                emphasis={true}
              />
            )}
            {properties.stratumlevel && (
              <DataRow
                label="Stratum Level"
                value={properties.stratumlevel}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Administrative Information */}
      <div>
        <SectionHeader
          icon={<Calendar className="w-4 h-4" />}
          title="Administrative"
        />
        <div className="space-y-1">
          <DataRow
            icon={<Calendar className="w-4 h-4" />}
            label="Created"
            value={new Date(properties.createdate).toLocaleDateString()}
          />
          <DataRow
            icon={<Calendar className="w-4 h-4" />}
            label="Modified"
            value={new Date(properties.modifieddate).toLocaleDateString()}
          />
          {properties.processedAt && (
            <DataRow
              label="Data Processed"
              value={new Date(properties.processedAt).toLocaleDateString()}
            />
          )}
        </div>
      </div>
      
      {/* External Links */}
      <div className="pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <ExternalLinkComponent href={spatialServicesUrl}>
            NSW Spatial Services
          </ExternalLinkComponent>
          <ExternalLinkComponent href={titleSearchUrl}>
            Property Title Search Guide
          </ExternalLinkComponent>
          <div className="text-xs text-gray-500">
            <p>
              For official property information, conduct a title search through NSW Land Registry Services.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Survey mark information display component
 */
interface SurveyMarkInfoProps {
  surveyMark: SurveyMarkFeature;
}

const SurveyMarkInfo: React.FC<SurveyMarkInfoProps> = ({ surveyMark }) => {
  const { properties } = surveyMark;
  
  // Generate useful links
  const spatialServicesUrl = 'https://www.spatial.nsw.gov.au/';
  const surveyMarkSearchUrl = 'https://portal.spatial.nsw.gov.au/portal/apps/webappviewer/index.html?id=e3862e7a6b2a44ee8aa5b7ae01eac78e';
  
  return (
    <>
      {/* Survey Mark Details */}
      <div>
        <SectionHeader
          icon={<Navigation className="w-4 h-4" />}
          title="Survey Mark"
          subtitle={properties.trigname}
        />
        <div className="space-y-1">
          <DataRow
            icon={<Target className="w-4 h-4" />}
            label="Mark Name"
            value={properties.trigname}
            emphasis={true}
          />
          <DataRow
            icon={<Navigation className="w-4 h-4" />}
            label="Mark Type"
            value={properties.marktype}
            emphasis={true}
          />
          {properties.marknumber && (
            <DataRow
              icon={<Hash className="w-4 h-4" />}
              label="Mark Number"
              value={properties.marknumber}
            />
          )}
          <DataRow
            label="Status"
            value={properties.markstatus}
          />
          <DataRow
            label="Monument Type"
            value={properties.monumenttype}
          />
          {properties.markalias && (
            <DataRow
              label="Alias"
              value={properties.markalias}
            />
          )}
        </div>
      </div>
      
      {/* Coordinate Information */}
      <div>
        <SectionHeader
          icon={<MapPin className="w-4 h-4" />}
          title="Coordinates"
        />
        <div className="space-y-1">
          <DataRow
            icon={<MapPin className="w-4 h-4" />}
            label="MGA Easting"
            value={properties.mgaeasting.toFixed(3)}
            unit="m"
            emphasis={true}
          />
          <DataRow
            icon={<MapPin className="w-4 h-4" />}
            label="MGA Northing"
            value={properties.mganorthing.toFixed(3)}
            unit="m"
            emphasis={true}
          />
          <DataRow
            label="MGA Zone"
            value={properties.mgazone}
          />
          {properties.coordinateDisplay && (
            <DataRow
              label="Coordinates"
              value={properties.coordinateDisplay}
            />
          )}
        </div>
      </div>
      
      {/* Elevation Information */}
      {properties.ahdheight && (
        <div>
          <SectionHeader
            icon={<Mountain className="w-4 h-4" />}
            title="Elevation"
          />
          <div className="space-y-1">
            <DataRow
              icon={<Mountain className="w-4 h-4" />}
              label="AHD Height"
              value={properties.ahdheight.toFixed(3)}
              unit="m"
              emphasis={true}
            />
            {properties.elevationDisplay && (
              <DataRow
                label="Elevation"
                value={properties.elevationDisplay}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Survey Information */}
      <div>
        <SectionHeader
          icon={<Info className="w-4 h-4" />}
          title="Survey Information"
        />
        <div className="space-y-1">
          <DataRow
            label="Trig Type"
            value={properties.trigtype}
          />
          <DataRow
            label="Monument Location"
            value={properties.monumentlocation}
          />
          <DataRow
            label="Mark Symbol"
            value={properties.marksymbol}
          />
          {properties.gdaclass && (
            <DataRow
              label="GDA Class"
              value={properties.gdaclass}
            />
          )}
          {properties.gdaorder && (
            <DataRow
              label="GDA Order"
              value={properties.gdaorder}
            />
          )}
          {properties.gdadate && (
            <DataRow
              icon={<Calendar className="w-4 h-4" />}
              label="GDA Date"
              value={new Date(properties.gdadate).toLocaleDateString()}
            />
          )}
        </div>
      </div>
      
      {/* External Links */}
      <div className="pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <ExternalLinkComponent href={spatialServicesUrl}>
            NSW Spatial Services
          </ExternalLinkComponent>
          <ExternalLinkComponent href={surveyMarkSearchUrl}>
            Survey Mark Search Portal
          </ExternalLinkComponent>
          <div className="text-xs text-gray-500">
            <p>
              Survey marks are geodetic control points used for precise positioning and mapping.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Main property popup component
 */
const PropertyPopup: React.FC<PropertyPopupProps> = ({
  property,
  surveyMark,
  onClose
}) => {
  const isProperty = !!property;
  const isSurveyMark = !!surveyMark;
  
  if (!isProperty && !isSurveyMark) {
    return null;
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-sm w-full max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isProperty && property && (
              <SectionHeader
                icon={<Building className="w-4 h-4" />}
                title={`Property ${property.properties.lotPlanId}`}
                subtitle="NSW Digital Cadastral Database"
              />
            )}
            {isSurveyMark && surveyMark && (
              <SectionHeader
                icon={<Navigation className="w-4 h-4" />}
                title={`Survey Mark ${surveyMark.properties.trigname}`}
                subtitle="NSW Survey Control Network"
              />
            )}
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
        {isProperty && property && <PropertyInfo property={property} />}
        {isSurveyMark && surveyMark && <SurveyMarkInfo surveyMark={surveyMark} />}
      </div>
       
      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">
            Data source: <span className="font-medium">
              {isProperty ? 'NSW Cadastre' : 'NSW Survey Marks'}
            </span>
          </span>
          <div className="flex items-center gap-1">
            <Info className="w-3 h-3 text-gray-500" />
            <span className="text-gray-500">Official records</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyPopup;