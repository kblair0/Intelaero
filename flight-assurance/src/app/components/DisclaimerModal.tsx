import { useState, useEffect } from 'react';

const DisclaimerModal = () => {
  const [isOpen, setIsOpen] = useState(true);

  const handleAccept = () => {
    setIsOpen(false);
    localStorage.setItem('disclaimerAccepted', 'true');
  };

  useEffect(() => {
    const hasAccepted = localStorage.getItem('disclaimerAccepted');
    if (hasAccepted) {
      setIsOpen(false);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-xl sm:max-w-2xl overflow-y-auto max-h-full shadow-xl">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Important Notice</h2>
        
        <div className="space-y-4 text-base sm:text-lg">
          <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
            <p className="font-semibold text-amber-800">
              This application provides approximate terrain and line-of-sight analysis for initial flight planning purposes only. 
              It should not be used as the sole source for operational decision-making or safety-critical planning.
            </p>
          </div>

          <p className="text-gray-700">
            This application&apos;s calculations are based on available terrain data which may have limited accuracy and resolution. 
            Terrain features, obstacles, and vegetation may exist that are not represented in our analysis. Additionally, 
            the line-of-sight and coverage predictions do not account for atmospheric conditions, signal interference, 
            or real-world RF propagation characteristics.
          </p>

          <p className="text-gray-700">
            While we strive for accuracy, this tool should be considered a planning aid only. Actual flight conditions, 
            terrain clearance, and radio communications may differ significantly from predictions. Users must conduct their 
            own site surveys, follow local regulations, maintain appropriate safety margins, and rely on certified navigation 
            equipment for actual flight operations.
          </p>

          <p className="text-gray-700">
            You acknowledge that operational decisions based on this tool&apos;s output are made at your own risk. Always verify 
            conditions on-site and maintain appropriate safety protocols regardless of this application&apos;s analysis results.
          </p>
        </div>

        <div className="mt-6">
          <button
            onClick={handleAccept}
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
