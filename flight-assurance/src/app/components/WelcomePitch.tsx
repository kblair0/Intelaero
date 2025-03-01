// components/WelcomePitch.tsx
import React from "react";
import Image from "next/image";

interface WelcomePitchProps {
  onGetStarted: () => void;
}

const WelcomePitch: React.FC<WelcomePitchProps> = ({ onGetStarted }) => {
  return (
    <>
<div className=" p-4 rounded-lg shadow-lg border border-gray-300">
  <h1
    className="text-xl font-bold mb-2 text-yellow-500"
    style={{
      textShadow:
        "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff",
    }}
  >
    Mission Assurance for Drones
  </h1>
  <p className="text-sm mb-2 text-yellow-500">
    Deliver More, Worry Less.
  </p>
  <ul className="list-none space-y-1 mb-2 text-sm">
          <li className="flex items-center gap-1">
            <span>📍</span>
            Advanced 3D Flight Path Obstacle Assessment
          </li>
          <li className="flex items-center gap-1">
            <span>✅</span>
            Comprehensive Flight Plan Integrity Evaluation
          </li>
          <li className="flex items-center gap-1">
            <span>✈️</span>
            Advanced Visual and Electronic Line-of-Sight Tools
          </li>
        </ul>
      </div>
      <div className="mt-4 flex flex-col items-center gap-1">
        <Image
          src="/Logonobackgrnd.png"
          alt="Intel Aero Logo"
          width={0}
          height={0}
          sizes="100vw"
          style={{ width: "30%", height: "auto" }}
          className="max-w-full h-auto"
        />
        <Image
          src="/Namenobackgrnd.png"
          alt="Intel Aero Title"
          width={0}
          height={0}
          sizes="100vw"
          style={{ width: "50%", height: "auto" }}
          className="max-w-full h-auto"
        />
      </div>
    </>
  );
};

export default WelcomePitch;
