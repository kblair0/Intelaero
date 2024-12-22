"use client";
import React, { useState, useEffect, useRef } from "react";
import Map, { MapRef } from "./Map";

const BatteryCalculator: React.FC = () => {
  const [batteryCapacity, setBatteryCapacity] = useState<string>("28000");
  const [dischargeRate, setDischargeRate] = useState<string>("700");
  const [assumedSpeed, setAssumedSpeed] = useState<string>("20");
  const [showSpeedInput, setShowSpeedInput] = useState<boolean>(false);
  const [averageDraw, setAverageDraw] = useState<number | null>(null);
  const [phaseData, setPhaseData] = useState<any[]>([]);
  const [parsedDistance, setParsedDistance] = useState<number>(0);
  const [showTick, setShowTick] = useState(false);

  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    const parsedBatteryCapacity = parseFloat(batteryCapacity) || 0;
    const parsedDischargeRate = parseFloat(dischargeRate) || 0;
    const parsedAssumedSpeed = parseFloat(assumedSpeed) || 20;
  
    const flightTime =
      parsedBatteryCapacity > 0 && parsedDischargeRate > 0
        ? (parsedBatteryCapacity / parsedDischargeRate).toFixed(2)
        : "0";
  
    const distance =
      parsedBatteryCapacity > 0 && parsedDischargeRate > 0
        ? ((Number(flightTime) / 60) * parsedAssumedSpeed).toFixed(2)
        : "0";
  
        setParsedDistance(parseFloat(distance) || 0);
  }, [batteryCapacity, dischargeRate, assumedSpeed]); 

  const handleDataProcessed = (data: { averageDraw: number; phaseData: any[] }) => {
    setAverageDraw(data.averageDraw);
    setPhaseData(data.phaseData);
    console.log("Data Processed:", data);
  };

  const handleShowTickChange = (value: boolean) => {
    setShowTick(value);
    console.log("Updated showTick from Map:", value); // Debugging to verify updates
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen text-white bg-gray-200">
      {/* Map Section */}
      <div className="w-full md:flex-1 md:h-full order-1 md:order-none">
        <div className="relative w-full h-64 md:h-full">
        <Map
          ref={mapRef}
          estimatedFlightDistance={parsedDistance}
          onDataProcessed={handleDataProcessed}
          onShowTickChange={handleShowTickChange}
        />
        </div>
      </div>

      {/* Right Panel (Inputs/Results) */}
      <div className="w-full md:w-1/3 p-4 overflow-y-auto bg-gray-300 mt-8 rounded-md">
        <h2 className="text-xl font-semibold mb-4 ">Step 2B: Set Your Own Parameters</h2>
        <div className="bg-white p-4 rounded-md shadow-md">
          <h2 className="text-xl font-semibold mb-4">🚁 Flight Parameters</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Battery capacity (mAh):</label>
            <input
              className="w-full px-3 py-2 rounded bg-gray-600 text-white placeholder-gray-300"
              type="number"
              value={batteryCapacity}
              onChange={(e) => setBatteryCapacity(e.target.value)}
              placeholder="e.g. 28000"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Discharge rate (mAh/min):</label>
            <input
              className="w-full px-3 py-2 rounded bg-gray-600 text-white placeholder-gray-300"
              type="number"
              value={dischargeRate}
              onChange={(e) => setDischargeRate(e.target.value)}
              placeholder="e.g. 700"
            />
          </div>
          <div
            className="flex items-center space-x-2 cursor-pointer mb-2"
            onClick={() => setShowSpeedInput(!showSpeedInput)}
          >
            <span
              className={`transform transition-transform ${
                showSpeedInput ? "rotate-90" : "rotate-0"
              }`}
            >
              ➤
            </span>
            <span className="text-sm font-medium">Assumed speed: {assumedSpeed} km/h</span>
          </div>
          {showSpeedInput && (
            <div className="mb-4">
              <input
                className="w-full px-3 py-2 rounded bg-gray-600 text-white placeholder-gray-300"
                type="number"
                value={assumedSpeed}
                onChange={(e) => setAssumedSpeed(e.target.value)}
                placeholder="Enter speed"
              />
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="bg-white p-4 rounded-md shadow-md mt-4">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          <p className="text-sm mb-2">
            Estimated flight time:{" "}
            <span className="font-bold">
              {parseFloat(batteryCapacity) / parseFloat(dischargeRate) || 0} minutes
            </span>
          </p>
          <p className="text-sm mb-2">
            Estimated travel distance:{" "}
            <span className="font-bold">{parsedDistance.toFixed(2)} km</span>
          </p>
          <div>
            {showTick ? (
              <p>✅ Flight distance exceeds total distance</p>
            ) : (
              <p>❌ Flight distance does not exceed total distance</p>
            )}
          </div>
        </div>

        {/* Enhanced Estimates Section */}
        {(averageDraw || (phaseData && phaseData.length > 0)) && (
          <div className="bg-white p-4 rounded-md shadow-md mt-4">
            <h2 className="text-xl font-semibold mb-4">🔋 Flight Analysis</h2>
            {averageDraw && (
              <p className="text-sm mb-2">
                Average Draw:{" "}
                <span className="font-bold">{(averageDraw * 60).toFixed(2)} mAh/min</span>
              </p>
            )}
            {phaseData && phaseData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-500 text-sm">
                  <thead>
                    <tr className="bg-gray-600 text-white">
                      <th className="border border-gray-500 p-2">Phase</th>
                      <th className="border border-gray-500 p-2">Total Time (s)</th>
                      <th className="border border-gray-500 p-2">Total Draw (mAh)</th>
                      <th className="border border-gray-500 p-2">Avg Draw (mAh/s)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseData.map((phase, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-gray-100" : "bg-white"}
                      >
                        <td className="border border-gray-500 p-2">{phase.Phase}</td>
                        <td className="border border-gray-500 p-2">
                          {phase["TotalTime(s)"].toFixed(2)}
                        </td>
                        <td className="border border-gray-500 p-2">
                          {phase["Total Draw(mAh)"].toFixed(2)}
                        </td>
                        <td className="border border-gray-500 p-2">
                          {phase["AvgDr(mAh/s)"]?.toFixed(2) ?? "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatteryCalculator;
