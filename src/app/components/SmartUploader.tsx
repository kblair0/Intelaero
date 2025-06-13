// src/components/SmartUploader.tsx
"use client";
import React, { useState } from 'react';
import FlightPlanUploader from './FlightPlanUploader';
import AreaOpsUploader from './AO/AreaOpsUploader';
import { FileUp, Navigation, Map } from 'lucide-react';
import { trackEventWithForm as trackEvent } from './tracking/tracking';

/**
 * SmartUploader Component
 * 
 * Purpose:
 * Provides a unified upload interface that intelligently routes files
 * to the appropriate uploader based on file type or user selection.
 * Optimized for wizard integration with compact mode.
 */

export type UploadType = 'flight-plan' | 'area' | 'auto';
export type UploadResult = {
  data: any;
  type: 'flight-plan' | 'area';
};

interface SmartUploaderProps {
  mode?: 'full' | 'compact';
  acceptedTypes?: UploadType[];
  onUploadComplete?: (result: UploadResult) => void;
  onClose?: () => void;
  // Specific upload type if we want to force one uploader
  uploadType?: 'flight-plan' | 'area';
}

/**
 * Smart file type detection based on file extension
 */
const detectFileType = (filename: string): 'flight-plan' | 'area' | 'unknown' => {
  const ext = filename.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'waypoints':
    case 'geojson':
      return 'flight-plan';
    case 'kml':
      // KML can be either - we'll need user clarification or smart detection
      return 'unknown';
    case 'kmz':
      return 'flight-plan';
    default:
      return 'unknown';
  }
};

const SmartUploader: React.FC<SmartUploaderProps> = ({
  mode = 'full',
  acceptedTypes = ['auto'],
  onUploadComplete,
  onClose,
  uploadType
}) => {
  const [activeUploader, setActiveUploader] = useState<'flight-plan' | 'area' | null>(
    uploadType || null
  );
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const isCompact = mode === 'compact';

  /**
   * Handle file drop/selection when in auto mode
   */
  const handleSmartUpload = (files: FileList) => {
    if (files.length === 0) return;
    
    const file = files[0];
    const detectedType = detectFileType(file.name);
    
    trackEvent('smart_uploader_file_detected', { 
      filename: file.name, 
      detectedType,
      mode 
    });

    if (detectedType === 'unknown' || (detectedType === 'area' && file.name.endsWith('.kml'))) {
      // For KML files, show type selector since they could be either
      setShowTypeSelector(true);
    } else {
      setActiveUploader(detectedType);
    }
  };

  /**
   * Handle upload completion from child uploaders
   */
  const handleFlightPlanUploaded = (data: any) => {
    onUploadComplete?.({ data, type: 'flight-plan' });
  };

  const handleAreaUploaded = (data: any) => {
    onUploadComplete?.({ data, type: 'area' });
  };

  /**
   * Type selector for ambiguous files
   */
  const TypeSelector = () => (
    <div className="text-center space-y-3">
      <p className="text-sm text-gray-700">What type of file are you uploading?</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setActiveUploader('flight-plan');
            setShowTypeSelector(false);
            trackEvent('smart_uploader_type_selected', { type: 'flight-plan', mode });
          }}
          className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <Navigation className="w-6 h-6 text-blue-600 mb-2" />
          <span className="text-sm font-medium">Flight Plan</span>
          <span className="text-xs text-gray-500">Mission path & waypoints</span>
        </button>
        <button
          onClick={() => {
            setActiveUploader('area');
            setShowTypeSelector(false);
            trackEvent('smart_uploader_type_selected', { type: 'area', mode });
          }}
          className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
        >
          <Map className="w-6 h-6 text-purple-600 mb-2" />
          <span className="text-sm font-medium">Operating Area</span>
          <span className="text-xs text-gray-500">Survey boundaries</span>
        </button>
      </div>
    </div>
  );

  /**
   * Auto upload interface - smart file detection
   */
  const AutoUploader = () => (
    <div className="text-center">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
        style={{ minHeight: isCompact ? "120px" : "160px" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleSmartUpload(e.dataTransfer.files);
        }}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.waypoints,.geojson,.kml,.kmz';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleSmartUpload(files);
          };
          input.click();
        }}
      >
        <FileUp className={`${isCompact ? 'w-8 h-8' : 'w-12 h-12'} text-gray-400 mx-auto mb-3`} />
        <p className={`${isCompact ? 'text-sm' : 'text-base'} font-medium text-gray-700`}>
          Drop your file here or click to browse
        </p>
        <p className={`${isCompact ? 'text-xs' : 'text-sm'} text-gray-500 mt-1`}>
          Supports flight plans and operating areas
        </p>
      </div>
    </div>
  );

  // Show type selector if needed
  if (showTypeSelector) {
    return <TypeSelector />;
  }

  // Show specific uploader if selected
  if (activeUploader === 'flight-plan') {
    return (
      <FlightPlanUploader
        compact={isCompact}
        onClose={onClose}
        onPlanUploaded={handleFlightPlanUploaded}
      />
    );
  }

  if (activeUploader === 'area') {
    return (
      <AreaOpsUploader
        compact={isCompact}
        onClose={onClose}
        onAOUploaded={handleAreaUploaded}
      />
    );
  }

  // Default: show auto uploader
  return <AutoUploader />;
};

export default SmartUploader;