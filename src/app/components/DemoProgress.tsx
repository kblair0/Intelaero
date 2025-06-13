// src/components/DemoProgress.tsx

/**
 * Purpose:
 * Displays a compact demo progress indicator at the bottom of the screen.
 * Non-intrusive design that allows users to see the app behind it.
 *
 * Features:
 * - Bottom-positioned toast style with minimal background interference
 * - Compact design suitable for non-blocking progress indication
 * - Step progress visualization with icons
 * - Smooth transitions and animations
 * - Mobile responsive design
 *
 * Related Files:
 * - page.tsx: Renders this as a page-level overlay
 * - DemoOrchestrationContext.tsx: Provides demo state data
 */

import React from 'react';
import { CheckCircle, Loader2, Plane, User, Mountain, Settings } from 'lucide-react';

interface DemoProgressProps {
  step: number; // DemoStep enum value
  message: string;
  progress: number; // 0-100 percentage
  isVisible: boolean;
}

const DemoProgress: React.FC<DemoProgressProps> = ({ 
  step, 
  message, 
  progress, 
  isVisible 
}) => {
  if (!isVisible) return null;

  // Step configuration with icons and labels
  const stepConfig = [
    { id: 0, label: 'Ready', icon: Settings },
    { id: 1, label: 'Flight Plan', icon: Plane },
    { id: 2, label: 'Observer', icon: User },
    { id: 3, label: 'Analysis', icon: Mountain },
    { id: 4, label: 'Complete', icon: CheckCircle }
  ];

  const isComplete = step === 4;
  const isError = step === -1;

  return (
    // Bottom positioned with minimal background interference
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      {/* Demo Progress Card - Bottom toast style */}
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 mx-auto max-w-md
                      sm:max-w-lg
                      landscape:max-w-sm">
        
        {/* Header Section - More compact for bottom position */}
        <div className="text-center mb-4 landscape:mb-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isError ? (
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xs">!</span>
              </div>
            ) : isComplete ? (
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-gray-900 landscape:text-sm">
              {isError ? 'Demo Error' : isComplete ? 'Demo Complete!' : 'Running Demo'}
            </h3>
          </div>
          
          {/* Progress Message */}
          <p className="text-xs text-gray-600 landscape:text-xs">
            {message}
          </p>
        </div>

        {/* Compact Progress Bar */}
        {!isError && (
          <div className="mb-4 landscape:mb-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              {progress}% Complete
            </div>
          </div>
        )}

        {/* Compact Step Indicators */}
        <div className="flex justify-between items-center mb-3">
          {stepConfig.map((stepItem, index) => {
            const StepIcon = stepItem.icon;
            const isCurrentStep = step === stepItem.id;
            const isCompletedStep = step > stepItem.id;

            return (
              <div key={stepItem.id} className="flex flex-col items-center flex-1">
                {/* Smaller Step Circle */}
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center mb-1 transition-all
                  landscape:w-5 landscape:h-5
                  ${isCurrentStep 
                    ? 'bg-blue-500 text-white ring-1 ring-blue-200' 
                    : isCompletedStep 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
                  }
                `}>
                  {isCompletedStep ? (
                    <CheckCircle className="w-3 h-3 landscape:w-2.5 landscape:h-2.5" />
                  ) : (
                    <StepIcon className={`w-3 h-3 landscape:w-2.5 landscape:h-2.5 ${
                      isCurrentStep ? 'animate-pulse' : ''
                    }`} />
                  )}
                </div>
                
                {/* Compact Step Label */}
                <span className={`
                  text-xs text-center font-medium transition-colors
                  landscape:text-[9px]
                  ${isCurrentStep 
                    ? 'text-blue-600' 
                    : isCompletedStep 
                    ? 'text-green-600' 
                    : 'text-gray-400'
                  }
                `}>
                  {stepItem.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Compact Completion Message */}
        {isComplete && (
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-xs text-green-700 font-medium">
              🎉 Your demo environment is ready!
            </p>
          </div>
        )}

        {/* Compact Error Message */}
        {isError && (
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-xs text-red-700 font-medium">
              Demo encountered an issue
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoProgress;