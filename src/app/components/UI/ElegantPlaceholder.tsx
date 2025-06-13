/**
 * ElegantPlaceholder.tsx
 * 
 * Purpose:
 * Professional, minimal sidebar placeholder that appears when no flight plan or AO is loaded.
 * Provides subtle brand presence without competing with the wizard flow.
 * Replaces the working toolbar during onboarding phase.
 * 
 * Design Philosophy:
 * - Minimal cognitive load: Single value statement, one CTA
 * - Professional credibility: Clean typography, quality spacing
 * - Non-competing presence: Subtle, supportive, not promotional
 * - Elegant simplicity: Generous white space, minimal elements
 * 
 * Related Files:
 * - page.tsx: Conditionally renders this component
 * - ToolsDashboard: The working toolbar that replaces this
 * - WelcomeMessage: Brand styling reference
 * - AnalysisWizard: Clean UI patterns reference
 */

"use client";
import React from "react";
import Image from "next/image";
import { ExternalLink, HelpCircle } from "lucide-react";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";

/**
 * Props for ElegantPlaceholder component
 */
interface ElegantPlaceholderProps {
  className?: string;
}

/**
 * ElegantPlaceholder component - Professional sidebar presence during onboarding
 * 
 * Follows "Elegant Placeholder" strategy:
 * - Ultra-minimal content to avoid wizard distraction
 * - Single, clear call-to-action
 * - Professional appearance for credibility
 * - Subtle support without competing for attention
 */
const ElegantPlaceholder: React.FC<ElegantPlaceholderProps> = ({ 
  className = "" 
}) => {
  /**
   * Handles the Learn More button click
   */
  const handleLearnMore = () => {
    trackEvent("elegant_placeholder_learn_more_clicked", {
      source: "sidebar_placeholder"
    });
    
    // TODO: Replace with actual info page URL
    window.open("/learn-more", "_blank");
  };

  /**
   * Handles the Help link click
   */
  const handleHelp = () => {
    trackEvent("elegant_placeholder_help_clicked", {
      source: "sidebar_placeholder"
    });
    
    // TODO: Replace with actual help/support URL
    window.open("/help", "_blank");
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-l-xl ${className}`}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-8">
        {/* Brand Section */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <Image
              src="/Logototonobakgrnd.png"
              alt="Intel.Aero"
              width={140}
              height={28}
              className="mx-auto"
              style={{ objectFit: "contain" }}
            />
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Professional Drone Mission Planning
          </h3>
          
          <p className="text-sm text-gray-600 max-w-xs mx-auto leading-relaxed">
            Trusted by operators worldwide for rapid, accurate mission planning
          </p>
        </div>

        {/* Single Call-to-Action */}
        <div className="w-full max-w-xs">
          <button
            onClick={handleLearnMore}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 
                       bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 
                       transition-colors duration-200 font-medium"
            aria-label="Learn more about Intel.Aero"
            style={{ color: 'white' }}
          >
            <span style={{ color: 'white' }}>Learn More About Intel.Aero</span>
            <ExternalLink className="w-4 h-4" style={{ color: 'white' }} />
          </button>
        </div>
      </div>

      {/* Subtle Support Footer */}
      <div className="border-t border-gray-100 px-6 py-4">
        <button
          onClick={handleHelp}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 
                     transition-colors duration-200"
          aria-label="Get help and support"
        >
          <HelpCircle className="w-3 h-3" />
          <span>Need Help?</span>
        </button>
      </div>
    </div>
  );
};

export default ElegantPlaceholder;