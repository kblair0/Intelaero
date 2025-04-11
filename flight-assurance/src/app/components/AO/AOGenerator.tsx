// src/components/AO/AOGenerator.tsx
"use client";
import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import * as turf from "@turf/turf";
import { useFlightPlanContext } from "../../context/FlightPlanContext"; 
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";

export interface AOGeneratorRef {
  generateAO: () => void;
}

const AOGenerator = forwardRef<AOGeneratorRef>((props, ref) => {
  const { flightPlan } = useFlightPlanContext();
  const { setAoGeometry } = useAreaOfOpsContext();

  const generateAO = () => {
    if (!flightPlan) {
      console.log("No flight plan available to generate AO.");
      setAoGeometry(null);
      return;
    }

    try {
      // Extract coordinates from flight plan
      const coordinates = flightPlan.features[0].geometry.coordinates;
      const line = turf.lineString(coordinates.map((coord: number[]) => [coord[0], coord[1]]));

      // Generate a 1km buffer around the flight path
      const buffer = turf.buffer(line, 1, { units: "kilometers" });
      const aoGeoJSON = turf.featureCollection([buffer]);

      console.log("Generated AO geometry:", aoGeoJSON);
      setAoGeometry(aoGeoJSON);
    } catch (error) {
      console.error("Error generating AO:", error);
      setAoGeometry(null);
    }
  };

  // Expose generateAO to parent components via ref
  useImperativeHandle(ref, () => ({
    generateAO,
  }));

  // Optional: Automatic generation on flight plan change (if desired)
  useEffect(() => {
    // Uncomment this if you want automatic AO generation when flight plan loads
    // generateAO();
  }, [flightPlan]);

  return null; // This component doesn't render anything
});

AOGenerator.displayName = "AOGenerator";
export default AOGenerator;