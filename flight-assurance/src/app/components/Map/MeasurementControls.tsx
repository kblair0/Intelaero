import React from 'react';
import { useMeasurement } from '../../hooks/useMeasurement';
import IconButton from './UI/IconButton';
import { Ruler } from 'lucide-react';

const MeasurementControls: React.FC = () => {
  const { startMeasurement, stopMeasurement, isMeasuring, measurement } = useMeasurement();

  return (
    <div className="absolute top-48 left-4 z-10 flex flex-col space-y-2">
      <IconButton
        onClick={isMeasuring ? stopMeasurement : startMeasurement}
        className={isMeasuring ? 'bg-blue-100' : ''}
      >
        <Ruler className="w-5 h-5 mr-2" />
        {isMeasuring ? 'Stop Measuring' : 'Start Measuring'}
      </IconButton>
      {measurement && measurement.points.length > 1 && (
        <div className="bg-white p-2 rounded shadow text-sm">
          Distance: {(measurement.distance / 1000).toFixed(2)} km
        </div>
      )}
    </div>
  );
};

export default MeasurementControls;