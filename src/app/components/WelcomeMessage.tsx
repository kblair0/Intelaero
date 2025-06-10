"use client";
import React from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { trackEventWithForm as trackEvent } from "./tracking/tracking";

/**
 * WelcomeMessage.tsx - MOBILE-RESPONSIVE VERSION (SCROLLABLE + LOGO HIDING)
 * 
 * Purpose:
 * Welcome component displaying Intel.Aero branding and guiding users to start.
 * Made scrollable for all screen sizes and hides logos on small screens.
 * 
 * Relations:
 * - Used in page.tsx as an overlay modal
 * - Integrates with MobileOrientationGuard for optimal mobile experience
 * - Works with existing tracking system
 * 
 * Mobile Optimizations:
 * - Scrollable container with max-height constraints
 * - Logos hidden on small screens (sm breakpoint)
 * - Responsive container sizing
 * - Original text sizes preserved for desktop
 * - Touch-friendly interaction
 */

/**
 * Props for WelcomeMessage component
 */
interface WelcomeMessageProps {
  onGetStarted: () => void;
  onClose: () => void;
}

/**
 * WelcomeMessage component displaying the Intel.Aero branding and guiding users to start
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
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl mx-auto 
                    max-h-[90vh] sm:max-h-[95vh] overflow-y-auto
                    w-full sm:w-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <Image
          src="/Logototonobakgrnd.png"
          alt="Intel.Aero Name Logo"
          width={180}
          height={36}
          className="mb-3"
          style={{ objectFit: "contain", width: "auto", height: "auto" }}
        />
        <h1 className="text-2xl font-bold">Welcome to DroneView</h1>
        <p className="text-lg font-bold text-gray-700 mt-1 mb-1">
          Unmatched Visibility and Communications Coverage Analysis
        </p>
      </div>

      {/* Body */}
      <div className="mt-2 text-center">
        <p className="text-md mb-1 text-gray-600 max-w-xl mx-auto">
          Intel.Aero empowers drone pilots, from hobbyists to commercial operators, with clear insights into visibility and connectivity over any terrain.
        </p>
        <p className="text-md mb-1 text-gray-600 max-w-xl mx-auto">
          Fly worry-free, knowing you'll maintain visual contact and reliable connectivity (e.g. GCS/LTE) with your drone.
        </p>
        <p className="mt-2 max-w-xl mx-auto mt-4 text-md">
          <em>&apos;Your software has literally turned my planning from days into hours!&apos;</em> - Industry Partner
        </p>
      </div>

      {/* Social Proof Section - Hidden on mobile/tablet, visible on desktop */}
      <div className="mt-4 hidden md:block">
        <p className="text-center text-bold mb-2 text-md">
          Powered and Compatible with
        </p>
        <div className="flex justify-center gap-4 flex-wrap">
          <div className="flex flex-col items-center relative group">
            <Image
              src="/logos/ugcs-logo.png"
              alt="UgCS Logo"
              width={100}
              height={50}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
              aria-label="UgCS provides versatile ground control. Intel.Aero's integration with UgCS ensures reliable visibility and connectivity across terrains."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              UgCS provides versatile ground control. Intel.Aero's integration ensures reliable visibility and connectivity across terrains.
            </div>
          </div>
          <div className="flex flex-col items-center relative group">
            <Image
              src="/logos/ardupilot-logo.webp"
              alt="ArduPilot Logo"
              width={100}
              height={50}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
              aria-label="ArduPilot's open-source autopilot software powers many professional drones. Intel.Aero's compatibility with ArduPilot ensures seamless integration."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              ArduPilot's open-source autopilot powers professional drones. Intel.Aero's compatibility ensures seamless integration.
            </div>

          </div>
          <div className="flex flex-col items-center relative group">
            <Image
              src="/logos/skydio-logo.jpeg"
              alt="Skydio Logo"
              width={100}
              height={50}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
              aria-label="Skydio, a leader in autonomous drones, is AI-driven. Intel.Aero's support for Skydio enhances autonomous missions with connectivity analysis."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              Skydio, a leader in autonomous drones, is AI-driven. Intel.Aero's support enhances autonomous missions with connectivity analysis.
            </div>
          </div>

          <div className="flex flex-col items-center relative group">
            <Image
              src="/logos/dronedeploy-logo.png"
              alt="DroneDeploy Logo"
              width={100}
              height={50}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
              aria-label="DroneDeploy is a leading platform for drone mapping. Intel.Aero's compatibility with DroneDeploy enhances mapping with visibility insights."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              DroneDeploy is a leading platform for drone mapping. Intel.Aero's compatibility enhances mapping with visibility insights.
            </div>
          </div>
          <div className="flex flex-col items-center relative group">
            <Image
              src="/logos/mavlink-logo.png.webp"
              alt="MAVLink Logo"
              width={100}
              height={50}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
              aria-label="MAVLink, the industry-standard protocol, enables Intel.Aero to integrate with open-source autopilots for reliable waypoint navigation."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              MAVLink, the industry-standard protocol, enables Intel.Aero to integrate with autopilots for waypoint navigation.
            </div>
          </div>

          <div className="flex flex-col items-center relative group p-4 max-w-[120px]">
            <Image
              src="/logos/dji-logo.png"
              alt="DJI Logo"
              width={80}
              height={38}
              style={{ objectFit: "contain", height: "auto" }}
              aria-label="DJI, the global leader in drone manufacturing, sets the standard for drones. Intel.Aero's support for the DJI SDK enables use with DJI's popular hardware."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              DJI, the global leader in drones, sets the standard. Intel.Aero's DJI SDK support enables use with popular hardware.
            </div>
          </div>

          <div className="flex flex-col items-center relative group">
            <Image
              src="/logos/pix4d-logo.png"
              alt="Pix4D Logo"
              width={65}
              height={30}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
              aria-label="Pix4D is renowned for photogrammetry. Intel.Aero's compatibility with Pix4D combines visibility analysis with high-precision mapping."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              Pix4D is renowned for photogrammetry. Intel.Aero's compatibility combines visibility analysis with high-precision mapping.
            </div>
          </div>
          <div className="flex flex-col items-center mt-4 relative group">
            <Image
              src="/logos/PX4-Logo-Black.png"
              alt="PX4 Logo"
              width={90}
              height={45}
              style={{ objectFit: "contain", height: "auto" }}
              aria-label="PX4, a leading open-source autopilot, powers advanced drones. Intel.Aero's PX4 compatibility ensures confident mission planning."
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded-lg p-1 w-56 text-center z-10">
              PX4, a leading open-source autopilot, powers advanced drones. Intel.Aero's compatibility ensures confident planning.
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={handleGetStarted}
          className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-d
                     min-h-[44px] min-w-[120px] touch-manipulation"
          aria-label="Get Started with Intel.Aero"
          style={{ touchAction: 'manipulation' }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default WelcomeMessage;