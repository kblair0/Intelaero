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
        <h2 className="text-2xl font-bold mb-4">Important Notice</h2>
        <div className="space-y-4 text-base">
          <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
            <p className="font-semibold text-amber-800">
              This application provides approximate terrain, obstacle, and powerline analysis for initial flight planning analysis only.
            </p>
          </div>
          <p className="text-gray-700">
            Our system processes data related to powerlines, obstacles, and environmental conditions to generate analysis results. However, the calculations are based on available data that may have limited accuracy.
          </p>
          <p className="text-gray-700">
            Actual conditions may vary, and these results should not be relied upon for operational decision-making or safety-critical planning.
          </p>
          <p className="text-gray-700">
            Always verify conditions on-site, follow applicable safety protocols, and use certified equipment for actual flight operations.
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
