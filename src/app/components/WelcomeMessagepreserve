"use client";
import React from "react";
import Image from "next/image"; // Import Image component
import { X } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

/**
 * Props for WelcomeMessage component
 */
interface WelcomeMessageProps {
  onGetStarted: () => void;
  onClose: () => void;
}

/**
 * WelcomeMessage component displaying the Intel.Aero DroneView branding and guiding users to start
 */
const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ onGetStarted, onClose }) => {
  /**
   * Handles the Get Started button click
   */
  const handleGetStarted = () => {
    trackEvent("welcome_get_started_clicked", {});
    onGetStarted();
  };


  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/Logototonobakgrnd.png"
          alt="Intel.Aero DroneView Name Logo"
          width={200}
          height={40}
          className="mb-4"
          style={{ objectFit: "contain" }}
        />

      <h1 className="text-3xl font-bold">
          Welcome to DroneView
        </h1>
        <p className="text-xl mb-1 font-bold text-gray-700 mt-2">
          Unmatched Visibility and Communications Coverage Analysis
        </p>
      </div>

      {/* Body */}
      <div className="mt-3 text-center">
  <p className="text-md mb-2 text-gray-600 max-w-2xl mx-auto">
    DroneView empowers drone pilots, from hobbyists to commercial operators, with clear insights into visibility and/or connectivity over any terrain.
  </p>
  <p className="text-md mb-2 text-gray-600 max-w-2xl mx-auto">
    Fly worry-free, knowing you’ll maintain visual contact and reliable connectivity e.g GCS/LTE with your drone.
  </p>
  <p className="text-lg font-bold text-gray-800 max-w-2xl mx-auto">
    Plan smarter, fly farther—never let complexity ground your drones.
  </p>
  <p className="mt-3 max-w-2xl mx-auto">
  <em>'Your software has literally turned my planning from days into hours!'</em> - Surveying Customer
</p>
</div>

      {/* Call to Action */}
      <div className="mt-8 flex justify-center gap-4">
        <button
          onClick={handleGetStarted}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          aria-label="Get Started with DroneView"
        >
          Get Started
        </button>
       
      </div>
    </div>
  );
};

export default WelcomeMessage;