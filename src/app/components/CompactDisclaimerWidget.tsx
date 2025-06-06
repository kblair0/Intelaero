/**
 * CompactDisclaimerWidget.tsx
 * 
 * Purpose:
 * Provides a compact, unobtrusive safety disclaimer widget that expands to show
 * critical safety information and user responsibilities. Ensures users are aware
 * of the tool's limitations and legal requirements.
 * 
 * This component:
 * - Shows a minimal safety notice by default
 * - Expands to display key safety information and user responsibilities
 * - Provides liability protection through clear acknowledgment of limitations
 * - Links to full safety guidelines for comprehensive information
 * 
 * Related Files:
 * - ToolsDashboard.tsx: Parent component where this widget is displayed
 * - AnalysisWizard.tsx: Could also include this widget for wizard users
 * - Legal/compliance: Provides liability protection for the application
 */

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface CompactDisclaimerWidgetProps {
  className?: string;
}

const CompactDisclaimerWidget: React.FC<CompactDisclaimerWidgetProps> = ({ className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFullGuidelinesClick = () => {
    // You can implement this to open a modal, new page, or external link
    // For now, this is a placeholder
    console.log('Open full safety guidelines');
    // Example: window.open('/safety-guidelines', '_blank');
  };

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left hover:bg-amber-100 rounded p-1 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="disclaimer-content"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-800">
            Planning Tool - Safety Notice
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
        )}
      </button>
      
      {isExpanded && (
        <div id="disclaimer-content" className="mt-3 space-y-3 text-xs text-amber-700">
          <div className="p-2 bg-amber-100 rounded border border-amber-300">
            <p className="font-semibold">⚠️ This is a planning tool only</p>
            <p className="mt-1">Results are approximations. Always verify conditions independently before flight operations.</p>
          </div>
          
          <div className="space-y-2">
            <p className="font-semibold">Critical Limitations:</p>
            <ul className="list-disc list-inside space-y-1 text-xs ml-2">
              <li>Data may be outdated, incomplete, or inaccurate</li>
              <li>No real-time conditions or weather considered</li>
              <li>Does not replace official regulatory approvals</li>
              <li>Cannot account for specific equipment limitations</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <p className="font-semibold">Your Responsibilities:</p>
            <ul className="list-disc list-inside space-y-1 text-xs ml-2">
              <li>Conduct independent verification of flight parameters</li>
              <li>Perform visual inspection before flight operations</li>
              <li>Obtain all required regulatory approvals</li>
              <li>Maintain situational awareness during operations</li>
              <li>Comply with all applicable aviation regulations</li>
            </ul>
          </div>
          
          <div className="border-t border-amber-300 pt-2">
            <p className="text-xs font-medium mb-1">Liability Disclaimer:</p>
            <p className="text-xs">
              <strong>By using this application, you agree that:</strong> You assume full responsibility for flight safety and regulatory compliance. 
              Results are estimates only and may contain errors. Developers bear no liability for operational decisions based on this data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompactDisclaimerWidget;