// components/CalculatorCard.tsx
import React from "react";
import Card from "./Card";

const CalculatorCard: React.FC = () => {
    // Temporary mock values for visualization
    const mockFormatFlightTime = (time: number) => {
        const minutes = Math.floor(time);
        const seconds = Math.round((time - minutes) * 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    return (
        <Card>
            <div className="space-y-6">
                {/* Header */}
                <div className="pb-2 border-b border-gray-200">
                    <h3 className="text-xl font-semibold text-gray-800">Flight Calculator</h3>
                    <p className="text-sm text-gray-500 mt-1">Adjust parameters and view flight metrics</p>
                </div>

                {/* Inputs Section */}
                <div className="space-y-4">
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center">
                            <span className="mr-2">🚁</span> Flight Parameters
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Battery (mAh)</label>
                                <input
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    type="number"
                                    placeholder="28000"
                                    disabled
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-1">Discharge Rate</label>
                                <input
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    type="number"
                                    placeholder="700"
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                                <span className="text-sm text-gray-600">Assumed Speed</span>
                                <div className="flex items-center">
                                    <span className="text-sm font-medium text-gray-800 mr-2">
                                        20 km/h
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                        <span className="mr-2">📊</span> Flight Analysis
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Flight Time</p>
                            <p className="font-semibold text-blue-600">
                                {mockFormatFlightTime(40)}
                            </p>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Max Distance</p>
                            <p className="font-semibold text-blue-600">
                                13.33 km
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Reserve Time</p>
                            <p className="font-semibold text-green-600">
                                12:30
                            </p>
                        </div>

                        <div className="p-3 bg-red-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Battery Reserve</p>
                            <p className="font-semibold text-green-600">
                                +19.23%
                            </p>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="p-3 rounded-lg bg-green-100">
                        <div className="flex items-center">
                            <span className="mr-2 text-lg text-green-600">✓</span>
                            <p className="text-sm text-green-700">
                                Flight time exceeds requirements
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default CalculatorCard;