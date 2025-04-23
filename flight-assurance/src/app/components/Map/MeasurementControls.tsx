// MeasurementControls.tsx
// This component provides UI controls for the measurement tool functionality
// and displays measurement results

import React from 'react';
import { useMeasurement } from '../Map/Hooks/useMeasurement';
import { Ruler, X, Trash2 } from 'lucide-react';
import { trackEventWithForm as trackEvent } from '../../components/tracking/tracking';

const MeasurementControls: React.FC = () => {
  const { startMeasurement, stopMeasurement, clearMeasurement, isMeasuring, measurement } = useMeasurement();

  const handleToggleMeasurement = () => {
    if (isMeasuring) {
      trackEvent('measurement_stopped', { panel: 'measurement-controls' });
      stopMeasurement();
    } else {
      trackEvent('measurement_started', { panel: 'measurement-controls' });
      startMeasurement();
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col space-y-2">
      <div className="flex space-x-2">
        <button
          onClick={handleToggleMeasurement}
          className={`map-button flex items-center ${isMeasuring ? 'bg-blue-100' : ''}`}
        >
          <Ruler className="w-5 h-5 mr-2" />
          {isMeasuring ? 'Stop Measuring' : 'Measure Distance'}
        </button>
        
        {/* Clear Measurement button - only shown when measuring is active */}
        {isMeasuring && (
          <button
            onClick={() => {
              trackEvent('measurement_cleared', { panel: 'measurement-controls' });
              clearMeasurement();
            }}
            className="map-button flex items-center"
            title="Clear current measurements"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Clear
          </button>
        )}
      </div>
      
      {measurement && measurement.points.length > 1 && (
        <div className="bg-white p-3 rounded-md shadow-md text-sm">
          <div className="flex justify-between items-center mb-1">
            <h4 className="font-semibold">Measurement</h4>
            <X 
              className="w-4 h-4 cursor-pointer text-gray-500 hover:text-gray-700"
              onClick={() => {
                trackEvent('measurement_cleared', { panel: 'measurement-controls' });
                clearMeasurement();
              }}
            />
          </div>
          <div className="text-gray-700">
            <div>Points: {measurement.points.length}</div>
            <div>Total distance: {(measurement.distance / 1000).toFixed(2)} km</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementControls;