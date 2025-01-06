"use client";
import React, { useState, useEffect, useRef } from "react";
import Map, { MapRef } from "./Map";
import ObstacleAssessment from "./ObstacleAssessment";

const BatteryCalculator: React.FC = () => {
  const [batteryCapacity, setBatteryCapacity] = useState<string>("28000");
  const [dischargeRate, setDischargeRate] = useState<string>("700");
  const [assumedSpeed, setAssumedSpeed] = useState<string>("20");
  const [showSpeedInput, setShowSpeedInput] = useState<boolean>(false);
  const [averageDraw, setAverageDraw] = useState<number | null>(null);
  const [phaseData, setPhaseData] = useState<any[]>([]);
  const [parsedDistance, setParsedDistance] = useState<number>(0);
  const [showTick, setShowTick] = useState(false);
  const [flightPlanDistance, setFlightPlanDistance] = useState<number | null>(null);
  const [showObstacleModal, setShowObstacleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAssessments, setShowAssessments] = useState(false);
  const [showElos, setShowElos] = useState(false);

  const [gcsLocation, setGcsLocation] = useState<{ lng: number; lat: number; elevation: number | null } | null>(null);
  const [observerLocation, setObserverLocation] = useState<{ lng: number; lat: number; elevation: number | null } | null>(null);
  const [repeaterLocation, setRepeaterLocation] = useState<{ lng: number; lat: number; elevation: number | null } | null>(null);
  const [rawFlightPlan, setRawFlightPlan] = useState<GeoJSON.FeatureCollection | null>(null); // Uploaded but unprocessed
  const [processedFlightPlan, setProcessedFlightPlan] = useState<GeoJSON.FeatureCollection | null>(null); // To be used for assessments
  const mapRef = useRef<MapRef | null>(null);
  
  //UI for Collapsable Sections
  const [showObstacleAssessment, setShowObstacleAssessment] = useState(false);

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

  const handleFlightPlanUpdate = (geojson: GeoJSON.FeatureCollection) => {
    console.log("handleFlightPlanUpdate triggered");
    setRawFlightPlan(geojson);
    setShowAssessments(true);
  };

  const handleDataProcessed = (data: { averageDraw: number; phaseData: any[] }) => {
    setAverageDraw(data.averageDraw);
    setPhaseData(data.phaseData);
    console.log("Data Processed:", data);
  };

  const handleShowTickChange = (value: boolean) => {
    setShowTick(value);
    console.log("Updated showTick from Map:", value); // Debugging to verify updates
  };

  const handleTotalDistanceChange = (distance: number) => {
    console.log("Received flight plan distance:", distance);
    setFlightPlanDistance(distance); // Update the state with the flight plan distance
  };

  const formatFlightTime = (timeInMinutes: number): string => {
    const minutes = Math.floor(timeInMinutes); // Whole minutes
    const seconds = Math.round((timeInMinutes - minutes) * 60); // Remaining seconds
    return `${minutes}:${seconds.toString().padStart(2, "0")}`; // Format as min:sec
  };

  const handleEnlargeGraph = () => {
    setLoading(true);
    setShowObstacleModal(true);
  };
  
    const calculateBatteryReserve = (): string => {
    if (flightPlanDistance === null || flightPlanDistance === 0) {
      return "N/A"; // Avoid division by zero
    }
    const reservePercentage =
      ((parsedDistance - flightPlanDistance) / flightPlanDistance) * 100;
    return reservePercentage.toFixed(2) + "%"; // Format to 2 decimal places
  };

  const handleObstacleAssessment = () => {
    if (rawFlightPlan) {
      setProcessedFlightPlan(rawFlightPlan); // Move the raw flight plan to processed state
      setLoading(true); // Show loading indication
    } else {
      console.warn("No flight plan available for obstacle assessment!");
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen text-white bg-gray-200">
      {/* Map Section */}
      <div className="w-full md:flex-1 md:h-full order-1 md:order-none">
        <div className="relative w-full h-64 md:h-full">
          <Map
            ref={mapRef}
            onPlanUploaded={handleFlightPlanUpdate}
            estimatedFlightDistance={parsedDistance}
            onDataProcessed={handleDataProcessed}
            onShowTickChange={handleShowTickChange}
            onTotalDistanceChange={handleTotalDistanceChange}
            onGcsLocationChange={setGcsLocation}
            onObserverLocationChange={setObserverLocation}
            onRepeaterLocationChange={setRepeaterLocation}
          />
        </div>
      </div>
  
      {/* Right Panel (Inputs/Results) */}
      <div className="w-full md:w-1/3 p-4 overflow-y-auto bg-gray-300 mt-8 rounded-md">
      <h2 className="text-xl font-semibold mb-4 ">Step 2B: Set/Adjust Your Own Flight Plan Parameters</h2>
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
              {formatFlightTime(parseFloat(batteryCapacity) / parseFloat(dischargeRate) || 0)} min
            </span>
          </p>
          <p className="text-sm mb-2">
            Estimated travel distance:{" "}
            <span className="font-bold">{parsedDistance.toFixed(2)} km</span>
          </p>
          {flightPlanDistance !== null && (
            <p className="text-sm mb-2">
              Uploaded Flight Plan Distance:{" "}
              <span className="font-bold">{flightPlanDistance.toFixed(2)} km</span>
            </p>
          )}
          <p className="text-sm mb-2">
            Battery Reserve:{" "}
            <span
              className={`font-bold ${
                parseFloat(calculateBatteryReserve()) < 0 ? "text-red-500" : "text-green-500"
              }`}
            >
              {calculateBatteryReserve()}
            </span>
          </p>
          <div>
            {showTick ? (
              <p>✅ Available flight time exceeds required distance/time</p>
            ) : (
              <p>❌ Distance/time required exceeds available flight time</p>
            )}
          </div>
        </div>
  
        {/* 🔋 Flight Analysis Section */}
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
                <table className="w-full border-collapse border border-gray-500 text-sm text-black">
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
                        <tr
                          key={`phase-${index}`}
                          className={index % 2 === 0 ? "bg-gray-100" : "bg-white"}
                        >
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
              </div>
            )}
          </div>
        )}

        {/* Assessments Section */}
        {showAssessments && (
          <div className="bg-white p-4 rounded-md shadow-md mt-4">
            <h2 className="text-xl font-semibold mb-4">Assessments</h2>
            <div className="flex flex-col justify-center sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
              {/* Vertical layout on small screens, horizontal with spacing on larger screens */}
              <button
                onClick={() => {
                  if (rawFlightPlan) {
                    handleObstacleAssessment(); // Use rawFlightPlan for assessment trigger
                  } else {
                    console.warn("No flight plan is available for obstacle assessment!");
                  }
                }}
                className="bg-yellow-500 text-black text-sm px-4 py-2 rounded shadow hover:bg-yellow-600"
              >
                🚨 Obstacle Assessment
              </button>

              <button
                onClick={() => {
                  console.log("ELOS Button Clicked");
                  setShowElos(!showElos);
                }}
                className="bg-blue-500 text-white text-sm px-4 py-2 rounded shadow hover:bg-blue-600"
              >
                ⚡️ ELOS Assessment
              </button>
            </div>
          </div>
        )}   
  
        {/* Obstacle Assessment Results */}
        {processedFlightPlan && (
          <div className="bg-white p-4 rounded-md shadow-md mt-4">
            {/* Heading and Enlarge Graph button remain outside the 'relative' container */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Obstacle Assessment</h2>
              <button
                onClick={handleEnlargeGraph}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Enlarge Graph
              </button>
            </div>

            {/* Only this container will get "covered" by the spinner overlay */}
            <div className="relative">
              <ObstacleAssessment
                flightPlan={processedFlightPlan}
                onDataProcessed={(data) => {
                  console.log("Obstacle assessment data processed:", data);
                  setLoading(false);
                }}
              />

              {/* Overlay the spinner here so it doesn't cover the heading */}
              {loading && (
                <div className="absolute inset-0 flex justify-center items-center bg-white z-50">
                  <div className="spinner-border animate-spin text-blue-500" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal for Enlarged Obstacle Assessment */}
        {showObstacleModal && processedFlightPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 p-7 flex items-center justify-center z-50">
            <div
              className="bg-white rounded shadow-lg relative flex flex-col"
              style={{
                width: "90vw",   // Modal width
                height: "90vh",  // Modal height
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowObstacleModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✖
              </button>

              <h2 className="text-2xl font-semibold mb-4 mt-4 text-center">
                Obstacle Assessment
              </h2>

              {/* This container expands to fill the modal */}
              <div className="flex-1 relative p-5">
                {/* Always render the ObstacleAssessment component */}
                <ObstacleAssessment
                  flightPlan={processedFlightPlan}
                  style={{ width: "100%", height: "100%" }}
                  onDataProcessed={(data) => {
                    console.log("Obstacle assessment data processed:", data);
                    setTimeout(() => {
                      setLoading(false);
                    }, 5000);
                  }}
                />

                {/* Spinner overlay if loading */}
                {loading && (
                  <div className="absolute inset-0 flex justify-center items-center bg-white z-50">
                    <div className="spinner-border animate-spin text-blue-500" role="status">
                      <span className="sr-only">Loading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

{showElos && (
  <div className="mt-4 bg-white p-4 rounded-md shadow-md">
    <h2 className="text-xl font-semibold mb-4 text-gray-700">⚡️ ELOS Details</h2>
    
    {/* GCS Details */}
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Ground Control Station (GCS) Latitude:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={gcsLocation ? gcsLocation.lat.toFixed(4) : "Not set"}
      />
      <label className="block text-sm font-medium mt-4 mb-1">Longitude:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={gcsLocation ? gcsLocation.lng.toFixed(4) : "Not set"}
      />
      <label className="block text-sm font-medium mt-4 mb-1">Elevation:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={gcsLocation ? gcsLocation.elevation?.toFixed(4) ?? "N/A" : "Not set"}
      />
    </div>

    {/* Observer Details */}
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Observer Latitude:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={observerLocation ? observerLocation.lat.toFixed(4) : "Not set"}
      />
      <label className="block text-sm font-medium mt-4 mb-1">Longitude:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={observerLocation ? observerLocation.lng.toFixed(4) : "Not set"}
      />
      <label className="block text-sm font-medium mt-4 mb-1">Elevation:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={observerLocation ? observerLocation.elevation?.toFixed(4) ?? "N/A" : "Not set"}
      />
    </div>

    {/* Repeater Details */}
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">Repeater Latitude:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={repeaterLocation ? repeaterLocation.lat.toFixed(4) : "Not set"}
      />
      <label className="block text-sm font-medium mt-4 mb-1">Longitude:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={repeaterLocation ? repeaterLocation.lng.toFixed(4) : "Not set"}
      />
      <label className="block text-sm font-medium mt-4 mb-1">Elevation:</label>
      <input
        className="w-full px-3 py-2 rounded bg-gray-200 text-black placeholder-gray-300"
        type="text"
        readOnly
        value={repeaterLocation ? repeaterLocation.elevation?.toFixed(4) ?? "N/A" : "Not set"}
      />
    </div>
  </div>
)}



      </div>
    </div>
  );
};

export default BatteryCalculator;
