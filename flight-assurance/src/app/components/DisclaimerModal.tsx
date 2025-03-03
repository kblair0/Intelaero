"use client";

import React, { useState } from "react";

const DisclaimerModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl">
        <h2 className="text-2xl text-center font-bold mb-4">Important Notice - Demo Application</h2>
        <div className="space-y-4 text-base">
          <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
            <p className="font-semibold text-center text-xl text-amber-800">
              This is a demo application for approximate terrain, obstacle, and powerline analysis during drone/RPAS flight planning.
            </p>
          </div>
          <p className="text-center text-gray-700">
            Actual conditions may vary, and these results should not be relied upon for operational decision-making or safety-critical planning.
          </p>
          <p className="text-sm text-center text-gray-700">
            Our system processes data related to powerlines, obstacles, and environmental conditions to generate analysis results. However, the calculations are based on available data that may have limited accuracy.
          </p>
          <h3 className="text-xl font-bold mb-4">Privacy Notice</h3>
          <p className="text-sm text-gray-700">
            Minimal Data is collected from this site. Data is limited to improving the application for users. Examples include: button interactions and types of flightplans uploaded. We willl never sell or distribute any users data.
          </p>
        </div>
        <div className="mt-6">
          <button
            onClick={handleClose}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            I Understand and Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
