/**
 * /src/app/learn-more/page.tsx
 * 
 * Purpose:
 * Landing page for Intel Aero, featuring "About Intel Aero" and "Introducing DroneView" with side-by-side
 * boxes, and "Analyses Available" with Visual, EVLOS, and BVLOS presets for interactive filtering.
 * Styled with gold and white colors, inspired by Talkspace's structure and AnalysisWizard.tsx, incorporating
 * Shopify best practices. Removes top toolbar, adds centralized logo, and keeps "Get Started" button.
 */

"use client";
import React, { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { Tooltip as ReactTooltip } from "react-tooltip";
import {
  PlayCircle, Navigation, Map, User, Search, Mountain, Clock, Award, TrendingUp, Shield, Eye, FileUp, Radio, LinkIcon, Zap, Trees, Signal, Eye as EyeIcon, PlaneTakeoff} from "lucide-react";

// Fallback icons
const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const Plane = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.8 3.5L12 7.5 6.2 3.5 3 6.7l6.5 6.5L3 20.5l3.2 0 6.5-6.5 6.5 6.5 3.2-3.2-6.5-6.5 6.5-6.5z" />
  </svg>
);
const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);

interface ProcessStepProps {
  step?: number;
  title: string;
  description: string;
  icon?: React.ReactNode;
  isBenefit?: boolean;
  tooltip?: string;
  isHighlighted?: boolean;
}

const ProcessStep: React.FC<ProcessStepProps> = ({ step, title, description, icon, isBenefit, tooltip, isHighlighted }) => {
  // Extract color from icon to create matching background
  const getIconBackground = (iconElement: React.ReactNode) => {
    if (!iconElement || !React.isValidElement(iconElement)) return "bg-gray-100";
    
    const iconProps = iconElement.props;
    if (iconProps?.className?.includes('text-green-600')) return "bg-green-100";
    if (iconProps?.className?.includes('text-blue-600')) return "bg-blue-100";
    if (iconProps?.className?.includes('text-yellow-600')) return "bg-yellow-100";
    if (iconProps?.className?.includes('text-purple-600')) return "bg-purple-100";
    if (iconProps?.className?.includes('text-red-600')) return "bg-red-100";
    if (iconProps?.className?.includes('text-teal-600')) return "bg-teal-100";
    if (iconProps?.className?.includes('text-gray-600')) return "bg-gray-100";
    
    return "bg-gray-100";
  };

  return (
    <div
      className={`rounded-lg p-3 transition-all hover:shadow-md ${
        isHighlighted 
          ? "!bg-blue-50 !border-2 !border-blue-600" 
          : "bg-white border border-gray-200 hover:border-blue-300"
      }`}
      data-tooltip-id={tooltip ? "analysis-tooltip" : undefined}
      data-tooltip-content={tooltip}
    >
      <div className="flex items-start gap-2 mb-2">
        {icon && (
          <div className={`p-1.5 ${getIconBackground(icon)} rounded-full`}>
            {icon}
          </div>
        )}
        {step && !isBenefit && (
          <div className="w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mr-2">
            <span className="text-sm font-bold">{step}</span>
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-medium text-sm text-gray-900">{title}</h3>
          <p className="text-xs text-gray-600 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
};

const PresetCard: React.FC<{ presetKey: string; preset: any; onSelect: (key: string) => void; isSelected: boolean }> = ({
  presetKey,
  preset,
  onSelect,
  isSelected,
}) => {
  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 cursor-pointer transition-all ${
        isSelected ? "border-blue-600 bg-blue-50 shadow-sm" : ""
      } hover:border-blue-200 hover:bg-gray-50`}
      onClick={() => onSelect(presetKey)}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 ${preset.iconBg} rounded-full`}>
          {preset.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-base text-gray-900">{preset.label}</h3>
          <p className="text-sm text-gray-500">{preset.analyses.length} analyses</p>
        </div>
        {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
      </div>
    </div>
  );
};

const LandingPage: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState({
    testimonials: false,
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Scroll to DroneView section
  const scrollToDroneView = () => {
    const element = document.getElementById('droneview-section');
    if (element) {
      const yOffset = -80; // Account for fixed header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const analysisPresets = {
    visual: {
      label: "Visual (VLOS)",
      icon: <EyeIcon className="w-4 h-4 text-blue-600" />,
      iconBg: "bg-blue-100",
      description: "Local visual operations where the observer can see the drone.",
      analyses: ["terrainProfile", "observerVsTerrain", "observerToDrone", "powerline", "airspace"],
    },
    evlos: {
      label: "EVLOS",
      icon: <Radio className="w-4 h-4 text-purple-600" />,
      iconBg: "bg-purple-100",
      description: "Extended operations using observers or technology for visibility.",
      analyses: ["terrainProfile", "observerVsTerrain", "observerToDrone", "gcsRepeaterVsTerrain", "antennaToDrone", "antennaToAntenna", "powerline", "airspace"],
    },
    bvlos: {
      label: "BVLOS",
      icon: <Signal className="w-4 h-4 text-green-600" />,
      iconBg: "bg-green-100",
      description: "Remote operations with full communication and coverage analysis.",
      analyses: ["terrainProfile", "gcsRepeaterVsTerrain", "antennaToDrone", "antennaToAntenna", "mobileTowerCoverage", "powerline", "airspace", "treeHeights"],
    },
  };

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey === selectedPreset ? null : presetKey);
  };

  const highlightedAnalyses = selectedPreset ? analysisPresets[selectedPreset as keyof typeof analysisPresets].analyses : [];
  return (
    <>
      <Head>
        <title>Intel Aero - How It Works</title>
        <meta
          name="description"
          content="Discover how Intel Aero revolutionizes drone operations with automated planning and mission success for mining, agriculture, and surveying."
        />
        <meta
          name="keywords"
          content="drone automation, Intel Aero, EVLOS, BVLOS, mining, agriculture, surveying, Australia"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-white">
        {/* Logo and Get Started Button - Fixed Toolbar */}
        <div className="fixed top-0 left-0 w-full bg-white border-b border-gray-200 py-4 sm:px-6 lg:px-8 z-10 shadow-md">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Image
              src="/Logototonobakgrnd.png"
              alt="Intel Aero Logo"
              width={100}
              height={20}
              style={{ objectFit: "contain", width: "auto", height: "auto" }}
            />
            <a
              href="/"
              className="bg-yellow-500 text-white py-2 px-4 rounded-md text-md font-medium hover:bg-yellow-600 transition-colors inline-block"
            >
              Use the Software
            </a>
          </div>
        </div>

        {/* Simplified About Intel Aero Section */}
        <section className="bg-gradient-to-br from-white to-blue-50 mt-16 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          {/* Subtle Background Elements */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 right-20 w-40 h-40 border border-yellow-300 rotate-12"></div>
            <div className="absolute bottom-20 left-16 w-28 h-28 border border-blue-300 rounded-full"></div>
            <div className="absolute top-1/3 right-1/4 w-6 h-6 bg-yellow-400 rounded-full"></div>
            <div className="absolute bottom-1/3 left-1/3 w-4 h-4 bg-blue-400 rounded-full"></div>
          </div>

          <div className="max-w-6xl mx-auto relative">
            {/* Main Story Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] mt-8 gap-12 items-start mb-8">
              
              {/* Left: Company Story - Simplified */}
              <div className="space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium mb-6">
                    <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                   About Us
                  </div>
                  <span className="text-blue-600 block font-bold mb-8 text-4xl">Automation-First RPAS Operations Tools</span>
                  
                  <div className="prose prose-lg text-gray-600 space-y-6">
                    <p className="text-xl leading-relaxed">
                      Intel Aero was founded on a simple observation: operators were spending 
                      <strong className="text-gray-800"> days planning</strong> what should be 
                      <strong className="text-gray-800"> hours of work</strong> or
                      <strong className="text-gray-800"> minutes of automation</strong>.
                    </p>
                    
                    <div className="bg-gray-50 rounded-xl p-6">
                      <p className="text-lg mb-0">
                        With over <strong className="text-blue-600">90 years of combined aerospace expertise</strong> across commercial, 
                        military, and RPAS operations, our team knew the industry needed a fundamental shift 
                        toward automation-first solutions.
                      </p>
                    </div>
                    <p className="text-lg">
                      Solving this with our "automation-first" intelligent software, unlocks unprecedented productivity gains. 
                      <strong className="text-green-600"> Operators can execute more missions, faster and more reliably</strong>, while 
                      <strong className="text-blue-600"> enterprises can scale drone programs that were previously impossible </strong> 
                      due to planning bottlenecks.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Simplified Results Cards */}
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium mb-3">
                      <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      Our Impact
                    </div>
                    <h4 className="font-bold text-gray-900 text-xl">Our Focus & Mission</h4>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="text-center p-5 bg-green-50 rounded-xl">
                      <div className="text-3xl font-bold text-green-600">90%</div>
                      <div className="text-sm text-green-700 font-medium">Reduction in User Planning Overheads</div>
                      <div className="text-xs text-gray-600 mt-1">Intelligence systems turn days → hours</div>
                    </div>
                    
                    <div className="text-center p-5 bg-blue-50 rounded-xl">
                      <div className="text-3xl font-bold text-blue-600">1000%</div>
                      <div className="text-sm text-blue-700 font-medium">More RPAS Per User</div>
                      <div className="text-xs text-gray-600 mt-1">Intelligence combined with automation drives capacity</div>
                    </div>
                    
                    <div className="text-center p-5 bg-yellow-50 rounded-xl">
                      <div className="text-3xl font-bold text-yellow-600">98%</div>
                      <div className="text-sm text-yellow-700 font-medium">Accident Reduction</div>
                      <div className="text-xs text-gray-600 mt-1">Smart iterative simulation reduces incidents</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Simplified CTA Section */}
            <div className="bg-gradient-to-r from-blue-50 to-yellow-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium mb-2">
                    <Navigation className="w-3 h-3" />
                    The Main Event
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Meet DroneView</h3>
                  <p className="text-sm text-gray-600">The automation-first RPAS platform transforming drone operations.</p>
                </div>
                <div className="text-center md:text-right">
                  <button
                    onClick={scrollToDroneView}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
                  >
                    See it in Action
                  </button>
                  <p className="text-xs text-gray-500 mt-1">↓ Scroll to explore</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Separator */}
        <div className="h-16 bg-gradient-to-b from-white via-yellow-50 to-yellow-100"></div>

        {/*Enhanced DroneView Product Section */}
        <section id="droneview-section" className="bg-gradient-to-br from-yellow-50 via-white to-blue-50 py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-20 left-10 w-32 h-32 border-2 border-yellow-400 rounded-full"></div>
            <div className="absolute bottom-20 right-10 w-24 h-24 border-2 border-blue-400 rounded-full"></div>
            <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-yellow-300 rounded-lg rotate-45"></div>
          </div>

          <div className="max-w-6xl mx-auto relative">
            {/* Hero Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Navigation className="w-4 h-4" />
                Now Available: DroneView 1.0
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Turn Days of Planning Into
                <span className="text-yellow-600 block">Minutes of Automation</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                The world's first automation-first RPAS platform. Plan EVLOS/BVLOS missions with confidence, 
                maintain perfect line-of-sight, and scale your operations 10x faster.
              </p>
            </div>

            {/* Social Proof Bar */}
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 mb-12 shadow-lg">
              <div className="flex flex-wrap justify-center items-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700"><strong>90%</strong> planning time saved</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700"><strong>1000%</strong> increase in operational capacity</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700"><strong>Zero</strong> LOS incidents</span>
                </div>
              </div>
            </div>

            {/* Main Value Proposition */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
              {/* Left: Story & Benefits */}
              <div className="space-y-8">
                {/* Customer Story */}
                <div className="bg-white border border-yellow-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-gray-700 mb-3 italic">
                        "Your software has literally turned my planning from days into hours! 
                        I can now quote and execute 4x more jobs with complete confidence."
                      </p>
                      <div className="text-sm text-gray-500">
                        <strong>Jeff</strong> • Mining Survey Operations Manager
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Benefits */}
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-gray-900">Why DroneView Changes Everything</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Zap className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Instant Mission Planning</h4>
                        <p className="text-gray-600 text-sm">AI-powered automation handles complex EVLOS/BVLOS calculations in real-time</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Eye className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Never Lose Line-of-Sight</h4>
                        <p className="text-gray-600 text-sm">Predictive visibility analysis ensures 100% visual contact across any terrain</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Signal className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Bulletproof Communication</h4>
                        <p className="text-gray-600 text-sm">Multi-layer connectivity analysis with LTE, GCS, and repeater optimization</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                  href="https://intel.aero"
                    className="bg-yellow-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-yellow-600 transition-all transform hover:scale-105 shadow-lg text-center"
                  >
                    Start Free Analysis
                  </a>
                </div>
              </div>

              {/* Right: Visual */}
              <div className="relative">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                  {/* Mock Interface */}
                  <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <span className="ml-4 text-sm text-gray-600">DroneView Mission Planner</span>
                    </div>
                  </div>
                  
                  {/* Mock Content */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">Mission Status</span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">✓ Ready to Fly</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">LOS Coverage</span>
                        <span className="font-medium text-green-600">100%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full w-full"></div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Signal Strength</span>
                        <span className="font-medium text-blue-600">98%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full w-[98%]"></div>
                      </div>
                    </div>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-yellow-800 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>All safety checks passed • Planning time: 2.3 minutes</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Floating stats */}
                <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">3.4min</div>
                    <div className="text-xs text-gray-500">vs 2 days manual</div>
                  </div>
                </div>
                
                <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">100%</div>
                    <div className="text-xs text-gray-500">LOS guaranteed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How DroneView Works Section - Enhanced */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 via-white to-blue-50 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-20 right-10 w-24 h-24 border-2 border-blue-400 rounded-full"></div>
            <div className="absolute bottom-20 left-10 w-16 h-16 border border-yellow-300 rounded-lg rotate-45"></div>
            <div className="absolute top-1/2 right-1/4 w-8 h-8 bg-green-400 rounded-full"></div>
          </div>

          <div className="max-w-6xl mx-auto relative">
            {/* Section Header - Enhanced */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4 shadow-sm">
                <Navigation className="w-4 h-4" />
                Behind the Scenes
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                How DroneView <span className="text-blue-600">Works</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
                See exactly how our automation-first platform transforms complex mission planning 
                into <strong className="text-gray-800">simple, reliable operations</strong>.
              </p>
            </div>

            {/* Enhanced DroneView Process with Gradient Background */}
            <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 border-2 border-blue-200 rounded-2xl p-8 mb-16 shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">The DroneView Process</h3>
              <p className="text-sm text-gray-600 text-center mb-8">From upload to flight-ready in minutes</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="text-center relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg transform hover:scale-110 transition-transform">
                    <FileUp className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">1</div>
                  <h4 className="font-bold text-gray-900 text-base mb-2">Upload Your Plan</h4>
                  <p className="text-sm text-gray-600">Upload flight plan or define area boundaries</p>
                </div>
                
                <div className="text-center relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg transform hover:scale-110 transition-transform">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">2</div>
                  <h4 className="font-bold text-gray-900 text-base mb-2">Automated Analysis</h4>
                  <p className="text-sm text-gray-600">AI processes terrain, obstacles, and communications</p>
                </div>
                
                <div className="text-center relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg transform hover:scale-110 transition-transform">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">3</div>
                  <h4 className="font-bold text-gray-900 text-base mb-2">Safety Validation</h4>
                  <p className="text-sm text-gray-600">Real-time safety checks and risk assessment</p>
                </div>
                
                <div className="text-center relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg transform hover:scale-110 transition-transform">
                    <Navigation className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-xs font-bold text-gray-800">4</div>
                  <h4 className="font-bold text-gray-900 text-base mb-2">Ready to Fly</h4>
                  <p className="text-sm text-gray-600">Certified mission plan in minutes, not days</p>
                </div>
              </div>
            </div>

            {/* Mission Type Selection - Enhanced */}
            <div className="mb-16">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">Choose Your Mission Type</h3>
              <p className="text-center text-gray-600 mb-10">Select a mission type to see which analyses are included below</p>      
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {Object.entries(analysisPresets).map(([key, preset]) => (
                  <div
                    key={key}
                    className={`border-3 rounded-2xl p-8 cursor-pointer transition-all transform hover:scale-105 ${
                      selectedPreset === key 
                        ? "border-blue-600 bg-gradient-to-br from-blue-50 to-blue-100 shadow-2xl scale-105" 
                        : "border-gray-200 hover:border-blue-300 hover:shadow-xl bg-white"
                    }`}
                    onClick={() => handlePresetSelect(key)}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`p-4 ${preset.iconBg} rounded-2xl shadow-md`}>
                        {React.cloneElement(preset.icon, { className: "w-6 h-6" })}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">{preset.label}</h4>
                        <p className="text-sm text-gray-500 font-medium">{preset.analyses.length} automated checks</p>
                      </div>
                      {selectedPreset === key && (
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 leading-relaxed">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Analysis Suite - Enhanced */}
            <div className="mb-16">
              <div className="text-center mb-12">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Complete Analysis Suite
                </h3>
                {selectedPreset && (
                  <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                    {analysisPresets[selectedPreset as keyof typeof analysisPresets].label} highlighted
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Individual Analysis Types - Enhanced styling */}
                <ProcessStep
                  title="Terrain Profile"
                  description="Analyse elevation and obstacles."
                  icon={<Mountain className="w-4 h-4 text-green-600" />}
                  tooltip="Detailed elevation data to identify terrain challenges."
                  isHighlighted={highlightedAnalyses.includes("terrainProfile")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Observer vs Terrain"
                  description="Check visibility from observer points."
                  icon={<Eye className="w-4 h-4 text-gray-600" />}
                  tooltip="Ensure line-of-sight between observer and drone."
                  isHighlighted={highlightedAnalyses.includes("observerVsTerrain")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="GCS/Repeater vs Terrain"
                  description="Evaluate ground control station coverage."
                  icon={<Radio className="w-4 h-4 text-yellow-600" />}
                  tooltip="Assess communication reliability with repeaters."
                  isHighlighted={highlightedAnalyses.includes("gcsRepeaterVsTerrain")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Observer to Drone"
                  description="Verify visual line-of-sight."
                  icon={<Eye className="w-4 h-4 text-blue-600" />}
                  tooltip="Confirm direct visibility for VLOS operations."
                  isHighlighted={highlightedAnalyses.includes("observerToDrone")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Antenna to Drone"
                  description="Analyse antenna communication."
                  icon={<Radio className="w-4 h-4 text-purple-600" />}
                  tooltip="Optimise signal strength for extended ranges."
                  isHighlighted={highlightedAnalyses.includes("antennaToDrone")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Antenna to Antenna"
                  description="Check inter-antenna links."
                  icon={<LinkIcon className="w-4 h-4 text-teal-600" />}
                  tooltip="Ensure robust communication between antennas."
                  isHighlighted={highlightedAnalyses.includes("antennaToAntenna")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Powerlines"
                  description="Detect powerline hazards."
                  icon={<Zap className="w-4 h-4 text-red-600" />}
                  tooltip="Identify and avoid powerline interference."
                  isHighlighted={highlightedAnalyses.includes("powerline")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Airspace"
                  description="Review airspace restrictions."
                  icon={<Plane className="w-4 h-4 text-red-600" />}
                  tooltip="Check for airspace regulations and restrictions."
                  isHighlighted={highlightedAnalyses.includes("airspace")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Tree Heights"
                  description="Measure tree elevations."
                  icon={<Trees className="w-4 h-4 text-green-600" />}
                  tooltip="Assess tree cover impact on operations."
                  isHighlighted={highlightedAnalyses.includes("treeHeights")}
                  isBenefit={true}
                />
                <ProcessStep
                  title="Mobile Towers"
                  description="Evaluate mobile tower coverage."
                  icon={<Signal className="w-4 h-4 text-purple-600" />}
                  tooltip="Integrate mobile network support for BVLOS."
                  isHighlighted={highlightedAnalyses.includes("mobileTowerCoverage")}
                  isBenefit={true}
                />
              </div>
            </div>

            {/* Enhanced Quick Start Options */}
            <div className="mb-12">
              <div className="text-center mb-12">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Get Started Now</h3>
                <p className="text-gray-600">Choose your preferred way to experience DroneView</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white border-3 border-gray-200 rounded-2xl p-8 hover:border-green-400 hover:shadow-2xl transition-all transform hover:scale-105 group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-shadow">
                      <PlayCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Try Demo</h4>
                      <p className="text-sm text-green-600 font-medium">No data required</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">Experience DroneView with our interactive demo. See analysis in action with instant results.</p>
                  <a
                    href="https://intel.aero"
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 shadow-lg block text-center"
                  >
                    Launch Demo →
                  </a>
                </div>

                <div className="bg-white border-3 border-blue-200 rounded-2xl p-8 hover:border-blue-400 hover:shadow-2xl transition-all transform hover:scale-105 group relative">
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs px-3 py-2 rounded-full font-bold shadow-lg">
                    Most Popular
                  </div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-shadow">
                      <div className="flex -space-x-1">
                        <Navigation className="w-5 h-5 text-white" />
                        <Map className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Analyse Flight Mission</h4>
                      <p className="text-sm text-blue-600 font-medium">Upload & get results</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">Upload your flight plan for comprehensive analysis. See exactly where you'll save time and avoid issues.</p>
                  <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 shadow-lg">
                    Upload Flight Plan →
                  </button>
                </div>

                <div className="bg-white border-3 border-gray-200 rounded-2xl p-8 hover:border-purple-400 hover:shadow-2xl transition-all transform hover:scale-105 group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-shadow">
                      <div className="flex -space-x-1">
                        <Map className="w-5 h-5 text-white" />
                        <Search className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">Survey Geographic Area</h4>
                      <p className="text-sm text-purple-600 font-medium">Define & analyze</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-6 leading-relaxed">Analyse terrain and coverage in your target region. Perfect for site assessment and planning.</p>
                  <button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all transform hover:scale-105 shadow-lg">
                    Define Area →
                  </button>
                </div>
              </div>
            </div>

            <ReactTooltip id="analysis-tooltip" place="top" type="dark" effect="solid" />
          </div>
        </section>


        {/* Australian Heritage - Under approach */}
        <div className="bg-gradient-to-r from-green-50 to-yellow-50 border border-yellow-300 rounded-lg p-3">
          <div className="flex items-center justify-center gap-3">
            <div className="text-base">🇦🇺</div>
            <span className="text-sm text-gray-700"><strong>Proudly Australian</strong> - Built for our unique landscapes</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center text-xs text-gray-600">
            <p>© 2025 Intel Aero. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
