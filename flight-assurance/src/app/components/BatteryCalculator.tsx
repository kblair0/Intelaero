"use client";
import React, { useState } from "react";
import Map from "./Map";
import FlightLogUploader from "./FlightLogUploader";

const BatteryCalculator: React.FC = () => {
  const [batteryCapacity, setBatteryCapacity] = useState<string>("28000"); // Use string to allow empty input
  const [dischargeRate, setDischargeRate] = useState<string>("700"); // Use string to allow empty input
  const [assumedSpeed, setAssumedSpeed] = useState<string>("20"); // Default assumed speed
  const [showSpeedInput, setShowSpeedInput] = useState<boolean>(false);

  // New state for phase analysis
  const [averageDraw, setAverageDraw] = useState<number | null>(null);
  const [phaseData, setPhaseData] = useState<any[]>([]);

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
  const parsedDistance = parseFloat(distance) || 0;

  // Handle the processed flight log data
  const handleFileProcessing = (data: any) => {
    console.log("Backend Response:", data); // Log to check the exact response
  
    if (Array.isArray(data)) {
      // Backend returned the array directly
      setPhaseData(data);
    } else {
      console.error("Unexpected response structure:", data);
      setPhaseData([]); // Default to an empty array if response is unexpected
    }
  };   

  return (
    <div className="flex h-screen text-white">
      {/* Map container */}
      <div className="flex-1">
        <div className="relative w-full h-full">
          <Map estimatedFlightDistance={parsedDistance} />
        </div>
      </div>

      <div className="w-1/3 p-6 overflow-y-auto">
        <div>
          <label className="block text-lg font-medium mb-2">
            Battery capacity (mAh):
          </label>
          <input
            type="number"
            value={batteryCapacity}
            onChange={(e) => setBatteryCapacity(e.target.value)}
            placeholder="Enter capacity"
          />
        </div>

        <div>
          <label className="block text-lg font-medium mb-2">
            Discharge rate (mAh/min):
          </label>
          <input
            type="number"
            value={dischargeRate}
            onChange={(e) => setDischargeRate(e.target.value)}
            placeholder="Enter discharge rate"
          />
        </div>

        <div
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => setShowSpeedInput(!showSpeedInput)}
        >
          <span
            className={`transform transition-transform ${
              showSpeedInput ? "rotate-90" : "rotate-0"
            }`}
          >
            ➤
          </span>
          <span className="text-sm font-medium">
            Assumed speed: {assumedSpeed}km/h
          </span>
        </div>

        {showSpeedInput && (
          <div>
            <input
              type="number"
              value={assumedSpeed}
              onChange={(e) => setAssumedSpeed(e.target.value)}
              placeholder="Enter speed"
            />
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-2">Results:</h2>
          <p className="text-lg">
            Estimated flight time:{" "}
            <span className="font-bold">{flightTime} minutes</span>
          </p>
          <p className="text-lg">
            Estimated travel distance:{" "}
            <span className="font-bold">{distance} km</span>
          </p>
        </div>

        {/* Flight Log Uploader */}
        <FlightLogUploader onProcessComplete={handleFileProcessing} />

        {/* Display enhanced results */}
        {averageDraw && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-2">Enhanced Battery Draw</h2>
            <p className="text-lg">
              Average Draw: <span className="font-bold">{averageDraw.toFixed(2)} mAh/s</span>
            </p>
          </div>
        )}

{phaseData && phaseData.length > 0 && (
  <>
    {/* Top Summary Table */}
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Total Flight Summary</h2>
      <table className="w-full border-collapse border border-gray-300 text-black">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 p-2">Avg Logged Discharge Rate</th>
            <th className="border border-gray-300 p-2">mAh/Min</th>
          </tr>
        </thead>
        <tbody>
          {phaseData
            .filter((phase) => phase.Phase === "Total Flight Summary")
            .map((summary, index) => (
              <tr key={`summary-${index}`}>
                <td className="border border-gray-300 p-2">Total Draw per Minute</td>
                <td className="border border-gray-300 p-2">
                  {summary["Total Draw per Minute(mAh)"]?.toFixed(2) ?? "N/A"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>

    {/* Detailed Phase Analysis Table */}
    <h2 className="text-xl font-semibold mb-2">Phase Analysis</h2>
    <table className="w-full border-collapse border border-gray-300 text-black">
      <thead>
        <tr className="bg-gray-200">
          <th className="border border-gray-300 p-2">Phase</th>
          <th className="border border-gray-300 p-2">Total Time (s)</th>
          <th className="border border-gray-300 p-2">Total Draw (mAh)</th>
          <th className="border border-gray-300 p-2">Avg Draw (mAh/s)</th>
          <th className="border border-gray-300 p-2">Diff From Avg (%)</th>
          <th className="border border-gray-300 p-2">% Time of Flight</th>
        </tr>
      </thead>
      <tbody>
        {phaseData
          .filter((phase) => phase.Phase !== "Total Flight Summary")
          .map((phase, index) => (
            <tr key={index}>
              <td className="border border-gray-300 p-2">{phase.Phase}</td>
              <td className="border border-gray-300 p-2">
                {phase["TotalTime(s)"].toFixed(2)}
              </td>
              <td className="border border-gray-300 p-2">
                {phase["Total Draw(mAh)"].toFixed(2)}
              </td>
              <td className="border border-gray-300 p-2">
                {phase["AvgDr(mAh/s)"]?.toFixed(2) ?? "N/A"}
              </td>
              <td className="border border-gray-300 p-2">
                {phase["DiffofAvg(%)"]?.toFixed(2) ?? "N/A"}%
              </td>
              <td className="border border-gray-300 p-2">
                {phase["PctTime of Flight(%)"]?.toFixed(2)}%
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </>
)}
      </div>
    </div>
  );
};

export default BatteryCalculator;
