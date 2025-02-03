import React from 'react';
import { useFlightConfiguration } from "../context/FlightConfigurationContext";

const Calculator: React.FC = () => {
    const { config, metrics, updateConfig } = useFlightConfiguration();

    // Handle input changes
    const handleInputChange = (key: keyof typeof config) => (e: React.ChangeEvent<HTMLInputElement>) => {
        updateConfig({ [key]: e.target.value });
    };

    return (
        <div>
            {/* Header */}
            <div>
                <h3 className="text-xl font-semibold text-gray-800">Flight Calculator</h3>
                <p className="text-sm text-gray-500 mt-1">Adjust parameters and view flight metrics</p>
            </div>

            {/* Inputs Section */}
            <div className="space-y-4">
                <div className="space-y-3">
                    <h4 className="text-sm font-medium mt-2 text-gray-700 flex items-center">
                        <span className="mr-2">🚁</span> Flight Parameters
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Battery (mAh)</label>
                            <input
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                type="number"
                                value={config.batteryCapacity}
                                onChange={handleInputChange('batteryCapacity')}
                                placeholder="28000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Discharge Rate</label>
                            <input
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                type="number"
                                value={config.dischargeRate}
                                onChange={handleInputChange('dischargeRate')}
                                placeholder="700"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                        <span className="text-sm text-gray-600">Assumed Speed</span>
                        <div className="flex items-center">
                            <input
                                type="number"
                                className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm"
                                value={config.assumedSpeed}
                                onChange={handleInputChange('assumedSpeed')}
                            />
                            <span className="text-sm font-medium text-gray-800 ml-2">km/h</span>
                        </div>
                    </div>
                </div>
            </div>

            
            {/* Results Section */}
            <div className="space-y-4">
                <h2 className="text-md font-medium text-gray-700 mt-2 flex items-center">
                    <span className="mr-2">📊</span> Flight Analysis
                </h2>
                {/* Status Indicator */}
                <div className={`mt-2 p-3 rounded-lg ${metrics.isFeasible ? 'bg-green-100' : 'bg-red-100'}`}>
                    <div className="flex items-center">
                        <span className="mr-2 text-lg">{metrics.isFeasible ? '✓' : '✗'}</span>
                        <p className={`text-sm ${metrics.isFeasible ? 'text-green-700' : 'text-red-700'}`}>
                            {metrics.isFeasible 
                                ? 'Flight time exceeds requirements'
                                : 'Flight requirements exceed available time'}
                        </p>
                    </div>
                </div>

                {/* Battery & Timing Metrics */}
                <h5 className="text-sm font-medium text-gray-700 mt-4">🔋 Battery &amp; Timing Metrics</h5>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Est Flight Time Avail</p>
                        <p className="font-semibold text-blue-600">{metrics.flightTime}</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Flight Plan Est. Time</p>
                        <p className="font-semibold text-indigo-600">{metrics.flightPlanEstimatedTime}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Battery Reserve Time Avail</p>
                        <p className="font-semibold text-green-600">{metrics.reserveTime}</p>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Expected Battery Consumption</p>
                        <p className="font-semibold text-indigo-600">{metrics.expectedBatteryConsumption} mAh</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg col-span-2">
                        <p className="text-xs text-gray-600 mb-1">Battery Reserve %</p>
                        <p className={`font-semibold ${parseFloat(metrics.batteryReserve) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {metrics.batteryReserve}
                        </p>
                    </div>
                </div>

                {/* Flight Plan Metrics */}
                <h5 className="text-sm font-medium text-gray-700 mt-4">🗺️ Flight Plan Metrics</h5>
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Est Max Distance Avail</p>
                        <p className="font-semibold text-blue-600">{metrics.maxDistance.toFixed(2)} km</p>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Number of Waypoints</p>
                        <p className="font-semibold text-teal-600">{metrics.numberOfWaypoints}</p>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-lg col-span-2">
                        <p className="text-xs text-gray-600 mb-1">Main Segment Altitude Mode</p>
                        <p className="font-semibold text-teal-600">{metrics.mainAltitudeMode}</p>
                    </div>
                </div>
            </div>  
        </div>
    );
};

export default Calculator;
