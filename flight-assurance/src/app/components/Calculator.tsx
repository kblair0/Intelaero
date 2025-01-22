/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Map, { MapRef } from "./Map";
import ObstacleAssessment from "./ObstacleAssessment";
import ELOSGridAnalysis from "./ELOSGridAnalysis";
import { layerManager, MAP_LAYERS } from './LayerManager';

// ELOS related types
interface ELOSAnalysisState {
  isAnalyzing: boolean;
  error: string | null;
  stats: {
    visibleCells: number;
    totalCells: number;
    averageVisibility: number;
    analysisTime: number;
  } | null;
}

interface Location {
  lng: number;
  lat: number;
  elevation: number | null;
}


const Calculator: React.FC = () => {
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
  //Elos Variables
  const [showElos, setShowElos] = useState(false);
  const elosGridRef = useRef<ELOSGridAnalysisRef>(null);
  const [gcsLocation, setGcsLocation] = useState<{ lng: number; lat: number; elevation: number | null } | null>(null);
  const [observerLocation, setObserverLocation] = useState<{ lng: number; lat: number; elevation: number | null } | null>(null);
  const [repeaterLocation, setRepeaterLocation] = useState<{ lng: number; lat: number; elevation: number | null } | null>(null);
  const [rawFlightPlan, setRawFlightPlan] = useState<GeoJSON.FeatureCollection | null>(null); // Uploaded but unprocessed
  const [processedFlightPlan, setProcessedFlightPlan] = useState<GeoJSON.FeatureCollection | null>(null); // To be used for assessments
  const [elosState, setElosState] = useState<ELOSAnalysisState>({
    isAnalyzing: false,
    error: null,
    stats: null
  });
  const [elosGridRange, setElosGridRange] = useState<number>(3000);
  // Markers for LOS
  const [markerGridRanges, setMarkerGridRanges] = useState({
    gcs: 3000,
    observer: 3000,
    repeater: 3000
  });
    const [markerElevationOffsets, setMarkerElevationOffsets] = useState({
    gcs: 0,
    observer: 0,
    repeater: 0
  });

  const mapRef = useRef<MapRef | null>(null);

  const handleElosAnalysis = async () => {
    console.log("handleElosAnalysis triggered");
    if (!rawFlightPlan || !mapRef.current) {
      setElosState(prev => ({
        ...prev,
        error: "Please upload a flight plan first"
      }));
      return;
    }
  
    try {
      // Set analyzing state
      setElosState(prev => ({
        ...prev,
        isAnalyzing: true,
        error: null
      }));
  
      await new Promise(resolve => setTimeout(resolve, 0));
  
      if (!mapRef.current?.runElosAnalysis) {
        throw new Error("ELOS analysis method not available");
      }
      
      await mapRef.current.runElosAnalysis();
      console.log("ELOS analysis completed successfully");
      
      // Explicitly set analyzing to false after success
      setElosState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: null
      }));
  
    } catch (error) {
      console.error("ELOS Analysis failed:", error);
      setElosState(prev => ({
        ...prev,
        isAnalyzing: false,  // Make sure to set this to false on error too
        error: error instanceof Error ? error.message : "Analysis failed"
      }));
    }
  };
  // ELOS Layer - Visibility Toggler
  const handleToggleElosLayer = () => {
    if (mapRef.current) {
      mapRef.current.toggleLayerVisibility(MAP_LAYERS.ELOS_GRID);
    }
  };



  
  //UI for Collapsable Sections
  // const [showObstacleAssessment, setShowObstacleAssessment] = useState(false);
  // const [showElos, setShowElos] = useState(false);

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

  const handleShowTickChange = useCallback((value: boolean) => {
    setShowTick(value);
    console.log("Updated showTick from Map:", value);
  }, []);

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

  // Just below your other helper functions
  const calculateReserveFlightTime = (): string => {
  // If there's no flight plan distance, we can’t compute a "reserve" time
  if (!flightPlanDistance || flightPlanDistance === 0) {
    return "N/A";
  }

  // Total flight time in minutes:
  const totalFlightTimeInMinutes =
    parseFloat(batteryCapacity) / parseFloat(dischargeRate) || 0;

  // Flight plan time in minutes:
  // (distance in km) / (speed in km/h) * 60 (to convert hours to minutes)
  const flightPlanTimeInMinutes =
    (flightPlanDistance / (parseFloat(assumedSpeed) || 20)) * 60;

  // Leftover (reserve) time
  const reserveTimeInMinutes = totalFlightTimeInMinutes - flightPlanTimeInMinutes;

  // If negative or zero, let’s just call it 0:00
  if (reserveTimeInMinutes <= 0) {
    return "0:00";
  }

  // Convert leftover minutes to min:sec
  return formatFlightTime(reserveTimeInMinutes);
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
          elosGridRange={elosGridRange}          
        />
        </div>
      </div>
  
      {/* Right Panel (Inputs/Results) */}
      <div className="w-full md:w-1/3 p-4 bg-gray-300 mt-8 rounded-md h-[118vh]">
        {/* Sticky Header */}
        <h2 className="text-xl font-semibold mb-4 bg-gray-300 top-0 z-10 p-2">
          Step 2B: Set/Adjust Your Own Parameters
        </h2>

        {/* Scrollable Content */}
        <div className="overflow-y-auto h-[105vh]">

          {/* Flight Parameters Section */}
          <div className="bg-white p-4 rounded-md shadow-md">
            <h2 className="text-xl font-semibold mb-4">🚁 Flight Parameters</h2>
            {/* Battery Capacity */}
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
            {/* Discharge Rate */}
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
            {/* Assumed Speed */}
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
                Reserve Flight Time Available:{" "}
                <span className="font-bold">
                  {calculateReserveFlightTime()} mins
                </span>
              </p>

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
            {processedFlightPlan && mapRef.current && (
            <div className="bg-white p-4 rounded-md shadow-md mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Obstacle Assessment</h2>
                <button
                  onClick={handleEnlargeGraph}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  Enlarge Graph
                </button>
              </div>

              <div className="relative">
                <ObstacleAssessment
                  flightPlan={processedFlightPlan}
                  map={mapRef.current}
                  onDataProcessed={(data) => {
                    console.log("Obstacle assessment data processed:", data);
                    setLoading(false);
                  }}
                />

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
                      // style={{ width: "100%", height: "100%" }}
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
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-700">⚡️ ELOS Analysis</h2>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        onChange={handleToggleElosLayer}
                      />
                      <span className="toggle-slider"></span>
                      <span className="ml-3 text-gray-700 text-xs font-medium">
                        ELOS Grid Visibility
                      </span>
                    </label>
                  </div>
                
                {/* ELOS Grid Controls */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold mb-2">Grid Analysis Settings</h3>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-600">Grid Range: {elosGridRange}m</span>
                    <input
                      type="range"
                      min="500"
                      max="5000"
                      step="100"
                      value={elosGridRange}
                      onChange={(e) => setElosGridRange(Number(e.target.value))}
                      className="w-2/3 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleElosAnalysis}
                    disabled={elosState.isAnalyzing || !rawFlightPlan}
                    className={`w-full px-4 py-2 rounded-md text-white font-medium transition-colors
                      ${elosState.isAnalyzing 
                        ? 'bg-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'}
                      ${!rawFlightPlan ? 'bg-gray-300 cursor-not-allowed opacity-50' : ''}
                      `}
                  >
                    {elosState.isAnalyzing ? 'Analyzing...' : 'Run ELOS Analysis'}
                    {!rawFlightPlan && <span className="ml-2 text-xs">(Upload flight plan first)</span>}
                  </button>
                </div>

                {/* Error Display */}
                {elosState.error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    {elosState.error}
                  </div>
                )}

                {/* Analysis Results */}
                {elosState.stats && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-md">
                    <h3 className="text-lg font-semibold mb-2">Analysis Results</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Visible Areas</p>
                        <p className="text-lg font-medium">
                          {elosState.stats.visibleCells} / {elosState.stats.totalCells} cells
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Average Visibility</p>
                        <p className="text-lg font-medium">
                          {elosState.stats.averageVisibility.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Analysis Time</p>
                        <p className="text-lg font-medium">
                          {(elosState.stats.analysisTime / 1000).toFixed(1)}s
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Location Information */}
                <div className="grid gap-4">
                  <LocationDisplay title="GCS Location" location={gcsLocation} />
                  <LocationDisplay title="Observer Location" location={observerLocation} />
                  <LocationDisplay title="Repeater Location" location={repeaterLocation} />
                </div>

                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                {/* GCS Controls */}
                {gcsLocation && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-blue-600">GCS Grid Controls 📡</h4>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          onChange={() => layerManager.toggleLayerVisibility('gcs-grid-layer')}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-xs text-gray-600">Show Grid</span>
                      </label>
                    </div>
                    {/* Add elevation offset control */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-gray-600">Elevation Offset (m):</span>
                      <input
                        type="number"
                        value={markerElevationOffsets.gcs}
                        onChange={(e) => setMarkerElevationOffsets(prev => ({
                          ...prev,
                          gcs: Number(e.target.value)
                        }))}
                        className="w-20 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                    {/* Rest of your existing controls */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={markerGridRanges.gcs}
                        onChange={(e) => setMarkerGridRanges(prev => ({
                          ...prev,
                          gcs: Number(e.target.value)
                        }))}
                        className="flex-grow h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-600 w-16">{markerGridRanges.gcs}m</span>
                      <button
                        onClick={() => {
                          if (mapRef.current && gcsLocation) {
                            mapRef.current.runElosAnalysis({
                              markerType: 'gcs',
                              location: {
                                ...gcsLocation,
                                elevation: (gcsLocation.elevation || 0) + markerElevationOffsets.gcs
                              },
                              range: markerGridRanges.gcs
                            });
                          }
                        }}
                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                      >
                        Analyze
                      </button>
                    </div>
                  </div>
                )}

                {/* Observer Controls */}
                {observerLocation && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-green-600">Observer Grid Controls 🔭</h4>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          onChange={() => layerManager.toggleLayerVisibility('observer-grid-layer')}
                          className="form-checkbox h-4 w-4 text-green-600"
                        />
                        <span className="text-xs text-gray-600">Show Grid</span>
                      </label>
                    </div>
                    {/* Add elevation offset control */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-gray-600">Elevation Offset (m):</span>
                      <input
                        type="number"
                        value={markerElevationOffsets.observer}
                        onChange={(e) => setMarkerElevationOffsets(prev => ({
                          ...prev,
                          observer: Number(e.target.value)
                        }))}
                        className="w-20 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                    {/* Rest of controls */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={markerGridRanges.observer}
                        onChange={(e) => setMarkerGridRanges(prev => ({
                          ...prev,
                          observer: Number(e.target.value)
                        }))}
                        className="flex-grow h-2 bg-green-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-600 w-16">{markerGridRanges.observer}m</span>
                      <button
                        onClick={() => {
                          if (mapRef.current && observerLocation) {
                            mapRef.current.runElosAnalysis({
                              markerType: 'observer',
                              location: {
                                ...observerLocation,
                                elevation: (observerLocation.elevation || 0) + markerElevationOffsets.observer
                              },
                              range: markerGridRanges.observer
                            });
                          }
                        }}
                        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                      >
                        Analyze
                      </button>
                    </div>
                  </div>
                )}

                {/* Repeater Controls */}
                {repeaterLocation && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-red-600">Repeater Grid Controls ⚡️</h4>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          onChange={() => layerManager.toggleLayerVisibility('repeater-grid-layer')}
                          className="form-checkbox h-4 w-4 text-red-600"
                        />
                        <span className="text-xs text-gray-600">Show Grid</span>
                      </label>
                    </div>
                    {/* Add elevation offset control */}
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs text-gray-600">Elevation Offset (m):</span>
                      <input
                        type="number"
                        value={markerElevationOffsets.repeater}
                        onChange={(e) => setMarkerElevationOffsets(prev => ({
                          ...prev,
                          repeater: Number(e.target.value)
                        }))}
                        className="w-20 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                    {/* Rest of controls */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={markerGridRanges.repeater}
                        onChange={(e) => setMarkerGridRanges(prev => ({
                          ...prev,
                          repeater: Number(e.target.value)
                        }))}
                        className="flex-grow h-2 bg-red-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs text-gray-600 w-16">{markerGridRanges.repeater}m</span>
                      <button
                        onClick={() => {
                          if (mapRef.current && repeaterLocation) {
                            mapRef.current.runElosAnalysis({
                              markerType: 'repeater',
                              location: {
                                ...repeaterLocation,
                                elevation: (repeaterLocation.elevation || 0) + markerElevationOffsets.repeater
                              },
                              range: markerGridRanges.repeater
                            });
                          }
                        }}
                        className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Analyze
                      </button>
                    </div>
                  </div>
                )}
                {/* No markers message */}
                {!gcsLocation && !observerLocation && !repeaterLocation && (
                  <div className="text-sm text-gray-500 text-center py-2">
                    Add markers to the map to see grid controls
                  </div>
                )}
              </div>


                {/* ELOS Grid Analysis Component */}
                {rawFlightPlan && mapRef.current && (
                  <ELOSGridAnalysis
                    ref={elosGridRef}
                    map={mapRef.current}
                    flightPath={rawFlightPlan}
                    elosGridRange={elosGridRange}
                    onError={async (error) => {
                      setElosState(prev => ({
                        ...prev,
                        isAnalyzing: false,
                        error: error.message
                      }));
                    }}
                    onSuccess={async (result) => {
                      console.log("Calculator: onSuccess called with result:", result);
                      setElosState(prev => ({
                        ...prev,
                        isAnalyzing: false,
                        error: null,
                        stats: {
                          visibleCells: result.stats.visibleCells,
                          totalCells: result.stats.totalCells,
                          averageVisibility: result.stats.averageVisibility,
                          analysisTime: result.stats.analysisTime
                        }
                      }));
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Location Display Component
  const LocationDisplay: React.FC<{
    title: string;
    location: Location | null;
    }> = ({ title, location }) => (
    <div className="p-3 bg-gray-50 rounded-md">
    <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div className="grid grid-cols-3 gap-2 text-xs">
    <div>
      <label className="block text-gray-600">Lat</label>
      <input
        className="w-full px-2 py-1 bg-gray-200 rounded text-center text-black"
        type="text"
        readOnly
        value={location ? location.lat.toFixed(4) : "Not set"}
      />
    </div>
  <div>
    <label className="block text-gray-600">Lng</label>
    <input
      className="w-full px-2 py-1 bg-gray-200 rounded text-center text-black"
      type="text"
      readOnly
      value={location ? location.lng.toFixed(4) : "Not set"}
    />
  </div>
  <div>
    <label className="block text-gray-600">Elev</label>
    <input
      className="w-full px-2 py-1 bg-gray-200 rounded text-center text-black"
      type="text"
      readOnly
      value={location ? location.elevation?.toFixed(4) ?? "N/A" : "Not set"}
    />
    </div>
  </div>
</div>
  );

export default Calculator;