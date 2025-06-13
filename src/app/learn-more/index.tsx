/**
 * /src/app/learn-more/index.tsx
 * 
 * Purpose:
 * Secondary landing page for Intel Aero, providing detailed information about the company's vision,
 * strategy, and value propositions for drone automation. Styled to match AnalysisWizard.tsx for
 * consistent UI/UX.
 * 
 * Related Components:
 * - AnalysisWizard.tsx: Provides styling inspiration (layout, Tailwind classes)
 * - VisibilityAnalysisDashboard.tsx: Provides collapsible section pattern
 * 
 * Dependencies:
 * - Lucide-react: For icons
 * - Next.js: For routing and meta tags
 * 
 * Principles:
 * - SRP: Each section component handles one aspect of the content
 * - DRY: Reusable section component for collapsible content
 * - Maintainability: Clear commenting and modular structure
 * - Accessibility: ARIA attributes and semantic HTML
 */

"use client";
import React, { useState } from "react";
import { 
  ChevronDown, 
  Plane, 
  Zap, 
  Map, 
  Signal, 
  CheckCircle,
  ArrowRight,
  Factory,
  Sprout
} from "lucide-react";
import Head from "next/head";

/**
 * Props for a collapsible content section
 */
interface ContentSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Collapsible section component for content
 * Inspired by AnalysisSection from VisibilityAnalysisDashboard.tsx
 */
const ContentSection: React.FC<ContentSectionProps> = ({
  title,
  description,
  icon,
  children,
  isExpanded,
  onToggle,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`Toggle ${title} section`}
      >
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-600">
          {icon}
        </div>
        <div className="flex-grow">
          <h3 className="font-medium text-gray-900">{title}</h3>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Main Learn More page component
 */
const LearnMorePage: React.FC = () => {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState({
    vision: true,
    challenges: false,
    strategy: false,
    valueProps: false,
    future: false,
  });

  // Toggle a section's expanded state
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <>
      <Head>
        <title>Learn More About Intel Aero - Drone Automation Solutions</title>
        <meta
          name="description"
          content="Discover Intel Aero's vision for revolutionizing drone automation in Australia. Learn about our solutions for mining, agriculture, and surveying."
        />
        <meta name="keywords" content="drone automation, Intel Aero, EVLOS, BVLOS, mining, agriculture, surveying, Australia" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 rounded-t-lg">
          <h1 className="text-xl font-bold text-gray-900">Learn More About Intel Aero</h1>
          <p className="text-sm text-gray-600 mt-1">
            Powering Australia’s drone revolution with automation and productivity
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {/* Vision Section */}
          <ContentSection
            title="Our Vision"
            description="Igniting Australia’s productivity through drone automation"
            icon={<Plane className="w-4 h-4" />}
            isExpanded={expandedSections.vision}
            onToggle={() => toggleSection("vision")}
          >
            <p className="text-sm text-gray-700 mb-3">
              Australia is brimming with potential, but declining productivity and uninspired leadership are holding us back. At Intel Aero, we see drones and automation as the spark to ignite a productivity explosion, particularly in industries like mining, agriculture, and surveying.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                <span><strong>Mining:</strong> Autonomous drones for measuring and surveying, reducing danger and boosting efficiency.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                <span><strong>Agriculture:</strong> Monitor remote stations with drones, saving time and resources.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                <span><strong>Surveying:</strong> One operator managing 10-20 drones, unlocking unprecedented productivity.</span>
              </li>
            </ul>
          </ContentSection>

          {/* Challenges Section */}
          <ContentSection
            title="Current Challenges"
            description="Overcoming the barriers to efficient drone operations"
            icon={<Zap className="w-4 h-4" />}
            isExpanded={expandedSections.challenges}
            onToggle={() => toggleSection("challenges")}
          >
            <p className="text-sm text-gray-700 mb-3">
              Planning EVLOS and BVLOS missions is time-intensive, requiring multiple tools for compliance, terrain checks, and line-of-sight assessments. Mistakes can lead to costly downtime, crashes, and lost customer trust.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-yellow-700">
                <strong>Case Study:</strong> An operator lost days of work due to terrain blocking line-of-sight, triggering unexpected return-to-home commands. Our software’s LOS tool identified viable flight paths, saving time and enabling 2x more job quotes.
              </p>
            </div>
            <p className="text-sm text-gray-700">
              Our solution automates 70% of planning tasks, cuts costs by 50%, and ensures robust contingency planning to prevent crashes and downtime.
            </p>
          </ContentSection>

          {/* Strategy Section */}
          <ContentSection
            title="Our Strategy"
            description="Empowering operators and enterprises with automation"
            icon={<Map className="w-4 h-4" />}
            isExpanded={expandedSections.strategy}
            onToggle={() => toggleSection("strategy")}
          >
            <p className="text-sm text-gray-700 mb-3">
              We provide bespoke tools for commercial operators to deliver superior services to enterprises, while paving the way for enterprises to internalize drone operations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Commercial Operators</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Reduce planning time by 70% with automated mission checks.
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Enable operators to manage 10-20 drones simultaneously.
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Provide free insights in exchange for anonymized data.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Enterprises</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Transition from outsourcing to in-house drone operations.
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Deploy “Drone-in-a-Box” systems for autonomous monitoring.
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Reduce costs and risks with enterprise-grade automation.
                  </li>
                </ul>
              </div>
            </div>
          </ContentSection>

          {/* Value Propositions Section */}
          <ContentSection
            title="Value Propositions"
            description="Delivering measurable benefits for operators and enterprises"
            icon={<Signal className="w-4 h-4" />}
            isExpanded={expandedSections.valueProps}
            onToggle={() => toggleSection("valueProps")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Commercial Operators</h4>
                <p className="text-sm text-gray-700 mb-3">
                  Our “Mission Lock” software slashes planning time from days to minutes, checking 150 parameters per kilometer—30x more than manual methods.
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                    Quote 2x more jobs with faster planning.
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                    Increase mission volume and margins.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Enterprises</h4>
                <p className="text-sm text-gray-700 mb-3">
                  “Enterprise Lock” enables in-house drone operations, reducing reliance on commercial operators and lowering costs.
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                    Significant cost savings and risk reduction.
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-1" />
                    Self-sufficiency with automated systems.
                  </li>
                </ul>
              </div>
            </div>
          </ContentSection>

          {/* Future Section */}
          <ContentSection
            title="The Future of Drone Automation"
            description="Predictions and opportunities for the next decade"
            icon={<Factory className="w-4 h-4" />}
            isExpanded={expandedSections.future}
            onToggle={() => toggleSection("future")}
          >
            <p className="text-sm text-gray-700 mb-3">
              Over the next 10 years, automation will reshape the drone industry, shifting capabilities from commercial operators to enterprises.
            </p>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Key Predictions</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Enterprises will internalize drone operations, reducing reliance on commercial providers.
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    BVLOS missions will unlock long-range applications like pipeline monitoring.
                  </li>
                  <li className="flex items-start">
                    <ArrowRight className="w-4 h-4 text-blue-500 mr-2 mt-1" />
                    Drone-in-a-Box systems will dominate autonomous monitoring and logistics.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Our Role</h4>
                <p className="text-sm text-gray-700">
                  We’re building BVLOS-ready features and data-driven tools to position Intel Aero as a leader in enterprise automation. From mission assurance to operational dashboards, we’re enabling the future of drones.
                </p>
              </div>
            </div>
          </ContentSection>

          {/* Call to Action */}
          <div className="bg-blue-600 text-white rounded-lg p-4 text-center">
            <h2 className="text-lg font-bold mb-2">Join the Drone Revolution</h2>
            <p className="text-sm mb-4">
              Ready to transform your drone operations? Contact us to learn how Intel Aero can boost your productivity.
            </p>
            <a
              href="/contact"
              className="inline-block bg-white text-blue-600 py-2 px-4 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 p-4 rounded-b-lg text-center text-xs text-gray-600">
          <p>© 2025 Intel Aero. All rights reserved.</p>
        </div>
      </div>
    </>
  );
};

export default LearnMorePage;