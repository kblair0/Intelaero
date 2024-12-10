"use client";
import React, { useState } from "react";

const BatteryCalculator: React.FC = () => {
  const [batteryCapacity, setBatteryCapacity] = useState<string>("28000"); // Use string to allow empty input
  const [dischargeRate, setDischargeRate] = useState<string>("700"); // Use string to allow empty input
  const [assumedSpeed, setAssumedSpeed] = useState<string>("20"); // Default assumed speed
  const [showSpeedInput, setShowSpeedInput] = useState<boolean>(false);

  // Parse input values or default to 0 if empty
  const parsedBatteryCapacity = parseFloat(batteryCapacity) || 0;
  const parsedDischargeRate = parseFloat(dischargeRate) || 0;
  const parsedAssumedSpeed = parseFloat(assumedSpeed) || 20;

  // Calculate the estimated flight time
  const flightTime =
    parsedBatteryCapacity > 0 && parsedDischargeRate > 0
      ? (parsedBatteryCapacity / parsedDischargeRate).toFixed(2)
      : "0";

  // Calculate the distance the drone can travel
  const distance =
    parsedBatteryCapacity > 0 && parsedDischargeRate > 0
      ? ((Number(flightTime) / 60) * parsedAssumedSpeed).toFixed(2) // Convert flight time to hours
      : "0";

  return (
    <div className="min-h-screen text-gray-100 flex flex-col items-center justify-center px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Drone Battery Flight Distance Calculator
      </h1>

      <div className="space-y-4 w-full max-w-md">
        <div>
          <label className="block text-lg font-medium mb-2">Battery capacity (mAh):</label>
          <input
            type="number"
            className="w-full px-3 py-2 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={batteryCapacity}
            onChange={(e) => setBatteryCapacity(e.target.value)}
            placeholder="Enter capacity"
          />
        </div>

        <div>
          <label className="block text-lg font-medium mb-2">Discharge rate (mAh/min):</label>
          <input
            type="number"
            className="w-full px-3 py-2 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={dischargeRate}
            onChange={(e) => setDischargeRate(e.target.value)}
            placeholder="Enter discharge rate"
          />
        </div>

        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setShowSpeedInput(!showSpeedInput)}>
          <span className={`transform transition-transform ${showSpeedInput ? "rotate-90" : "rotate-0"}`}>
            ➤
          </span>
          <span className="text-sm font-medium">Assumed speed: {assumedSpeed}km/h</span>
        </div>

        {showSpeedInput && (
          <div>
            <input
              type="number"
              className="w-full px-3 py-2 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={assumedSpeed}
              onChange={(e) => setAssumedSpeed(e.target.value)}
              placeholder="Enter speed"
            />
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Results:</h2>
        <p className="text-lg">
          Estimated Flight Time: <span className="font-bold">{flightTime} minutes</span>
        </p>
        <p className="text-lg">
          Estimated Travel Distance: <span className="font-bold">{distance} km</span>
        </p>
      </div>
    </div>
  );
};

export default BatteryCalculator;
