import React from 'react';
import { useFlightConfiguration } from "../context/FlightConfigurationContext";
import { Battery } from 'lucide-react';

const Calculator: React.FC = () => {
    const { config, metrics, updateConfig } = useFlightConfiguration();

    const handleInputChange = (key: keyof typeof config) => (e: React.ChangeEvent<HTMLInputElement>) => {
        updateConfig({ [key]: e.target.value });
    };

    return (
        <div className="space-y-3 p-2">
            {/* Header */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                    <Battery className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-gray-800">Energy Configuration</h3>
                </div>
                <p className="text-xs text-gray-500">Configure battery and speed parameters</p>
            </div>

            {/* Input Parameters */}
            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                    {/* Battery Capacity */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Battery Capacity</label>
                        <div className="flex items-center">
                            <input
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-l"
                                type="number"
                                value={config.batteryCapacity}
                                onChange={handleInputChange('batteryCapacity')}
                                placeholder="28000"
                            />
                            <span className="px-2 py-1 text-xs bg-gray-100 border border-l-0 border-gray-300 rounded-r text-gray-600">
                                mAh
                            </span>
                        </div>
                    </div>

                    {/* Battery Reserve */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Battery Reserve</label>
                        <div className="flex items-center">
                            <input
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-l"
                                type="number"
                                value={config.batteryReserveReq}
                                onChange={handleInputChange('batteryReserveReq')}
                                placeholder="20"
                                min="0"
                                max="100"
                            />
                            <span className="px-2 py-1 text-xs bg-gray-100 border border-l-0 border-gray-300 rounded-r text-gray-600">
                                %
                            </span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {/* Discharge Rate */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Discharge Rate</label>
                        <div className="flex items-center">
                            <input
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-l"
                                type="number"
                                value={config.dischargeRate}
                                onChange={handleInputChange('dischargeRate')}
                                placeholder="700"
                            />
                            <span className="px-2 py-1 text-xs bg-gray-100 border border-l-0 border-gray-300 rounded-r text-gray-600">
                                mA
                            </span>
                        </div>
                    </div>

                    {/* Assumed Speed */}
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Cruise Speed</label>
                        <div className="flex items-center">
                            <input
                                type="number"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-l"
                                value={config.assumedSpeed}
                                onChange={handleInputChange('assumedSpeed')}
                            />
                            <span className="px-2 py-1 text-xs bg-gray-100 border border-l-0 border-gray-300 rounded-r text-gray-600">
                                km/h
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Indicator */}
            <div className={`mt-4 px-3 py-2 rounded ${
                metrics.isFeasible 
                    ? 'bg-green-100 border border-green-200' 
                    : 'bg-red-100 border border-red-200'
            }`}>
                <div className="flex items-center">
                    <span className="text-sm mr-2">{metrics.isFeasible ? '✓' : '⚠️'}</span>
                    <p className={`text-xs font-medium ${
                        metrics.isFeasible ? 'text-green-800' : 'text-red-800'
                    }`}>
                        {metrics.isFeasible 
                            ? 'Flight plan within battery capacity'
                            : 'Flight plan exceeds battery capacity'}
                    </p>
                </div>
            </div>

            {/* Results Grid */}
            <div className="space-y-3 mt-4">
                {/* Time Metrics */}
                <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Time Analysis</h5>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-blue-50 rounded border border-blue-100">
                            <p className="text-xs text-blue-600">Available Time</p>
                            <p className="text-sm font-medium text-blue-700">{metrics.flightTime}</p>
                        </div>
                        <div className="p-2 bg-indigo-50 rounded border border-indigo-100">
                            <p className="text-xs text-indigo-600">Est. Flight Time</p>
                            <p className="text-sm font-medium text-indigo-700">{metrics.flightPlanEstimatedTime}</p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded border border-teal-100">
                        <p className="text-xs text-teal-600">Remaining Time</p>
                        <p className="text-sm font-medium text-teal-700">{metrics.remainingTime}</p>
                        </div>
                        <div className="p-2 bg-blue-50 rounded border border-blue-100">
                            <p className="text-xs text-blue-600">Total Endurance</p>
                            <p className="text-sm font-medium text-blue-700">
                            {metrics.totalEndurance}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Battery Metrics */}
                <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Battery Analysis</h5>
                    <div className="grid grid-cols-2 gap-2">
                     <div className="p-2 bg-green-50 rounded border border-green-100">
                            <p className="text-xs text-green-600">Available Capacity</p>
                            <p className="text-sm font-medium text-green-700">
                            {metrics.availableBatteryCapacity} mAh
                            </p>
                        </div>
                        <div className={`p-2 rounded border ${
                            metrics.isFeasible 
                                ? 'bg-green-50 border-green-100' 
                                : 'bg-red-50 border-red-100'
                        }`}>
                            <p className={`text-xs ${
                                metrics.isFeasible ? 'text-green-600' : 'text-red-600'
                            }`}>Expected Usage</p>
                            <p className={`text-sm font-medium ${
                                metrics.isFeasible ? 'text-green-700' : 'text-red-700'
                            }`}>{metrics.expectedBatteryConsumption} mAh</p>
                        </div>
                            <div className="p-2 bg-yellow-50 rounded border border-yellow-100">
                            <p className="text-xs text-yellow-600">Remaining Capacity</p>
                            <p className="text-sm font-medium text-yellow-700">
                                {metrics.remainingCapacity} mAh
                            </p>
                            </div>
                            <div className="p-2 bg-orange-50 rounded border border-orange-100">
                            <p className="text-xs text-orange-600">Reserve Amount</p>
                            <p className="text-sm font-medium text-orange-700">
                                {(parseFloat(config.batteryCapacity) * (parseFloat(config.batteryReserveReq) / 100)).toFixed(0)} mAh
                            </p>
                        </div>

                    </div>
                </div>

                {/* Flight Metrics */}
                <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Flight Details</h5>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-cyan-50 rounded border border-cyan-100">
                            <p className="text-xs text-cyan-600">Max Range</p>
                            <p className="text-sm font-medium text-cyan-700">{metrics.maxDistance.toFixed(2)} km</p>
                        </div>
                        <div className="p-2 bg-purple-50 rounded border border-purple-100">
                            <p className="text-xs text-purple-600">Waypoints</p>
                            <p className="text-sm font-medium text-purple-700">{metrics.numberOfWaypoints}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Calculator;