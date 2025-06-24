/**
 * TierComparison.tsx
 * 
 * Purpose:
 * Standalone tier comparison component that showcases the three DroneView tiers
 * (Free, Community, Commercial) with user-friendly feature descriptions.
 * Matches the learn-more page styling and can be imported anywhere.
 * 
 * Features:
 * - Clean tier comparison layout
 * - User-friendly feature names
 * - Responsive design
 * - Professional styling matching brand guidelines
 * - Self-contained with no external dependencies
 */

import React from 'react';
import { 
  Eye, 
  Radio, 
  Mountain, 
  Navigation, 
  Zap, 
  Shield, 
  Signal, 
  Trees, 
  MapPin, 
  Radar,
  CheckCircle,
  X
} from 'lucide-react';

// User-friendly feature definitions focused on Line of Sight capabilities
const FEATURES = {
  // Core Line of Sight Features
  basicTerrainAnalysis: {
    name: "Basic Terrain Analysis",
    description: "Single DEM source terrain assessment for line of sight",
    icon: <Mountain className="w-4 h-4" />
  },
  manualObserverPlacement: {
    name: "Manual Observer Placement",
    description: "Place observers manually and verify basic line of sight",
    icon: <Eye className="w-4 h-4" />
  },
  flightPlanLOSCheck: {
    name: "Flight Plan Line of Sight Check",
    description: "Verify visual contact along your entire flight path",
    icon: <Navigation className="w-4 h-4" />
  },
  
  // Enhanced Planning Features
  multiDEMAnalysis: {
    name: "Multi-DEM Terrain Analysis",
    description: "Cross-reference multiple elevation sources for accuracy",
    icon: <Mountain className="w-4 h-4" />
  },
  automatedObserverPlacement: {
    name: "Automated Observer Placement",
    description: "AI suggests optimal observer positions for compliance",
    icon: <MapPin className="w-4 h-4" />
  },
  observerToObserverLOS: {
    name: "Observer-to-Observer Line of Sight",
    description: "Verify line of sight between all observer positions",
    icon: <Eye className="w-4 h-4" />
  },
  hazardIdentification: {
    name: "Highest Risk Hazard Detection",
    description: "Identify powerlines, towers, and critical obstacles",
    icon: <Shield className="w-4 h-4" />
  },
  instantQuoting: {
    name: "Instant Mission Quoting",
    description: "Generate accurate quotes in minutes, not days",
    icon: <Zap className="w-4 h-4" />
  },
  
  // Advanced Future Features
  bvlosIntegration: {
    name: "BVLOS Integration",
    description: "Beyond visual line of sight planning and compliance",
    icon: <Radar className="w-4 h-4" />
  },
  mlOptimization: {
    name: "ML-Powered Optimization",
    description: "Machine learning models for instantaneous results",
    icon: <Signal className="w-4 h-4" />
  },
  automatedPlanning: {
    name: "Automated Mission Planning",
    description: "Set parameters and let AI plan the entire mission",
    icon: <Navigation className="w-4 h-4" />
  },
  advancedLandingSites: {
    name: "Smart Landing Site Selection",
    description: "Optimal landing sites and RTH point selection",
    icon: <MapPin className="w-4 h-4" />
  },
  realTimeOptimization: {
    name: "Real-Time Mission Optimization",
    description: "Dynamic replanning based on changing conditions",
    icon: <Zap className="w-4 h-4" />
  }
};

// Tier configurations focused on Line of Sight capabilities and value propositions
const TIER_CONFIGS = {
  free: {
    name: "Free",
    tagline: "Start Verifying",
    description: "Basic line of sight verification for simple missions",
    color: "emerald",
    gradient: "from-emerald-100 via-teal-50 to-cyan-100",
    borderColor: "border-emerald-300",
    buttonColor: "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700",
    accentColor: "text-emerald-600",
    iconBg: "bg-emerald-100",
    valueProps: {
      timesSaved: "Save hours on basic checks",
      costReduction: "Eliminate simple site visits",
      efficiency: "Quick line of sight verification"
    },
    features: [
      'basicTerrainAnalysis',
      'manualObserverPlacement', 
      'flightPlanLOSCheck'
    ],
    stations: {
      gcs: 0,
      observer: 1, 
      repeater: 0
    },
    limits: {
      range: "500m radius",
      resolution: "Basic terrain data",
      automation: "Manual placement only"
    }
  },
  community: {
    name: "Community",
    tagline: "Most Popular",
    description: "Automated planning that turns days into minutes",
    color: "blue",
    gradient: "from-blue-100 via-indigo-50 to-purple-100", 
    borderColor: "border-blue-400",
    buttonColor: "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700",
    accentColor: "text-blue-600",
    iconBg: "bg-blue-100",
    popular: true,
    valueProps: {
      timesSaved: "Days → Minutes planning",
      costReduction: "Eliminate most site visits",
      efficiency: "Quote in minutes, not days"
    },
    features: [
      'basicTerrainAnalysis',
      'multiDEMAnalysis',
      'automatedObserverPlacement',
      'flightPlanLOSCheck', 
      'observerToObserverLOS',
      'hazardIdentification',
      'instantQuoting'
    ],
    stations: {
      gcs: 1,
      observer: 2,
      repeater: 1
    },
    limits: {
      range: "2km radius", 
      resolution: "Multi-DEM accuracy",
      automation: "AI-assisted placement"
    }
  },
  commercial: {
    name: "Commercial", 
    tagline: "Future Ready",
    description: "Complete automation with cutting-edge ML optimization",
    color: "orange",
    gradient: "from-orange-100 via-yellow-50 to-amber-100",
    borderColor: "border-orange-400", 
    buttonColor: "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700",
    accentColor: "text-orange-600",
    iconBg: "bg-orange-100",
    valueProps: {
      timesSaved: "Fully automated planning",
      costReduction: "Zero site visits needed",
      efficiency: "ML-powered optimization"
    },
    features: [
      'basicTerrainAnalysis',
      'multiDEMAnalysis',
      'automatedObserverPlacement',
      'flightPlanLOSCheck',
      'observerToObserverLOS', 
      'hazardIdentification',
      'instantQuoting',
      'bvlosIntegration',
      'mlOptimization',
      'automatedPlanning',
      'advancedLandingSites',
      'realTimeOptimization'
    ],
    stations: {
      gcs: 10,
      observer: 10,
      repeater: 10
    },
    limits: {
      range: "5km+ radius",
      resolution: "Highest precision ML", 
      automation: "Fully automated planning"
    }
  }
};

interface FeatureRowProps {
  feature: keyof typeof FEATURES;
  tiers: ('free' | 'community' | 'commercial')[];
}

const FeatureRow: React.FC<FeatureRowProps> = ({ feature, tiers }) => {
  const featureData = FEATURES[feature];
  
  return (
    <div className="grid grid-cols-4 gap-4 py-3 border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl shadow-sm">
          {React.cloneElement(featureData.icon, { className: "w-4 h-4 text-blue-600" })}
        </div>
        <div>
          <div className="font-medium text-sm text-gray-900">
            {featureData.name}
          </div>
          <div className="text-xs text-gray-500">
            {featureData.description}
          </div>
        </div>
      </div>
      
      {tiers.map((tier, index) => {
        const hasFeature = TIER_CONFIGS[tier].features.includes(feature);
        const colors = ['text-emerald-600', 'text-blue-600', 'text-orange-600'];
        return (
          <div key={tier} className="flex justify-center items-center">
            {hasFeature ? (
              <div className="relative">
                <CheckCircle className={`w-6 h-6 ${colors[index]} drop-shadow-sm`} />
                <div className={`absolute inset-0 ${colors[index]} opacity-20 rounded-full animate-pulse`}></div>
              </div>
            ) : (
              <X className="w-5 h-5 text-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface TierCardProps {
  tier: 'free' | 'community' | 'commercial';
  isCompact?: boolean;
}

const TierCard: React.FC<TierCardProps> = ({ tier, isCompact = false }) => {
  const config = TIER_CONFIGS[tier];
  
  return (
    <div className={`relative bg-gradient-to-br ${config.gradient} border-3 ${config.borderColor} rounded-2xl p-6 
                    ${config.popular ? 'scale-105 shadow-2xl ring-4 ring-blue-200' : 'shadow-xl hover:shadow-2xl'} 
                    transition-all duration-300 hover:scale-105 hover:-translate-y-1 group`}>
      
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      {config.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg animate-bounce">
            ⭐ {config.tagline}
          </div>
        </div>
      )}
      
      <div className="text-center mb-6 relative z-10">
        <h3 className={`text-2xl font-bold mb-2 ${config.accentColor}`}>
          {config.name}
        </h3>
        <p className="text-gray-600 text-sm">
          {config.description}
        </p>
      </div>

      {!isCompact && (
        <>
          {/* Value Propositions */}
          <div className="mb-6 relative z-10">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <div className={`p-1 ${config.iconBg} rounded-lg`}>
                <Zap className="w-4 h-4" />
              </div>
              Key Benefits
            </h4>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                <div className={`w-3 h-3 ${config.iconBg} rounded-full mr-3 animate-pulse`}></div>
                <span className="text-gray-700 font-medium text-sm">{config.valueProps.timesSaved}</span>
              </div>
              <div className="flex items-center p-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                <div className={`w-3 h-3 ${config.iconBg} rounded-full mr-3 animate-pulse`}></div>
                <span className="text-gray-700 font-medium text-sm">{config.valueProps.costReduction}</span>
              </div>
              <div className="flex items-center p-3 bg-white/60 rounded-lg hover:bg-white/80 transition-colors">
                <div className={`w-3 h-3 ${config.iconBg} rounded-full mr-3 animate-pulse`}></div>
                <span className="text-gray-700 font-medium text-sm">{config.valueProps.efficiency}</span>
              </div>
            </div>
          </div>

          {/* Station Limits */}
          <div className="mb-6 relative z-10">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <div className={`p-1 ${config.iconBg} rounded-lg`}>
                <MapPin className="w-4 h-4" />
              </div>
              Station Limits
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                <span className="text-gray-600 text-sm">Ground Control Stations</span>
                <span className={`font-bold text-lg ${config.accentColor}`}>{config.stations.gcs}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                <span className="text-gray-600 text-sm">Observer Positions</span>
                <span className={`font-bold text-lg ${config.accentColor}`}>{config.stations.observer}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                <span className="text-gray-600 text-sm">Communication Repeaters</span>
                <span className={`font-bold text-lg ${config.accentColor}`}>{config.stations.repeater}</span>
              </div>
            </div>
          </div>

          {/* Analysis Capabilities */}
          <div className="mb-6 relative z-10">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <div className={`p-1 ${config.iconBg} rounded-lg`}>
                <Radar className="w-4 h-4" />
              </div>
              Capabilities
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                <span className="text-gray-600 text-sm">Analysis Range</span>
                <span className={`font-medium ${config.accentColor}`}>{config.limits.range}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                <span className="text-gray-600 text-sm">Terrain Accuracy</span>
                <span className={`font-medium ${config.accentColor}`}>{config.limits.resolution}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                <span className="text-gray-600 text-sm">Automation Level</span>
                <span className={`font-medium ${config.accentColor}`}>{config.limits.automation}</span>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="mb-6 relative z-10">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <div className={`p-1 ${config.iconBg} rounded-lg`}>
                <CheckCircle className="w-4 h-4" />
              </div>
              Key Features
            </h4>
            <div className="space-y-2">
              {config.features.slice(0, 4).map(featureKey => {
                const feature = FEATURES[featureKey as keyof typeof FEATURES];
                return (
                  <div key={featureKey} className="flex items-center gap-3 p-2 bg-white/40 rounded-lg text-sm hover:bg-white/60 transition-colors">
                    <CheckCircle className={`w-4 h-4 ${config.accentColor} flex-shrink-0`} />
                    <span className="text-gray-700 font-medium">{feature.name}</span>
                  </div>
                );
              })}
              {config.features.length > 4 && (
                <div className="flex items-center gap-3 p-2 bg-white/40 rounded-lg text-sm">
                  <div className={`w-4 h-4 rounded-full ${config.iconBg} flex items-center justify-center`}>
                    <span className={`text-xs font-bold ${config.accentColor}`}>+</span>
                  </div>
                  <span className={`${config.accentColor} font-medium`}>+ {config.features.length - 4} more features</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <button className={`w-full ${config.buttonColor} text-white py-4 px-6 rounded-xl font-bold text-lg
                         transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl 
                         relative z-10 group-hover:shadow-2xl`}>
        {tier === 'free' ? '🚀 Get Started Free' : '✨ Learn More'}
      </button>
    </div>
  );
};

const TierComparison: React.FC = () => {
  // Get all unique features across all tiers
  const allFeatures = Array.from(new Set([
    ...TIER_CONFIGS.free.features,
    ...TIER_CONFIGS.community.features, 
    ...TIER_CONFIGS.commercial.features
  ])) as (keyof typeof FEATURES)[];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Enhanced Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 right-10 w-32 h-32 border-2 border-purple-400 rounded-full animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-24 h-24 border border-orange-400 rounded-lg rotate-45 animate-bounce"></div>
        <div className="absolute top-1/2 right-1/4 w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 left-1/4 w-6 h-6 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full animate-bounce"></div>
        <div className="absolute bottom-1/3 right-1/3 w-4 h-4 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-full animate-pulse"></div>
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Enhanced Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 via-blue-100 to-teal-100 text-purple-800 px-6 py-3 rounded-full text-sm font-bold mb-6 shadow-lg border border-purple-200">
            <Eye className="w-5 h-5 text-purple-600" />
            Mission Planning Revolution
          </div>
          <h2 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 bg-clip-text text-transparent mb-6">
            Automation-First Intelligence
          </h2>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-8">
            The world's first <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">automation first mission planning platform</span>. 
            Eliminate site visits and planning overhead. Delivering instantaneous quoting, and ensure perfect compliance and mission assurance with integrated line of sight intelligence.
          </p>
          
          {/* Key Value Props Banner */}
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full">
              <Zap className="w-4 h-4" />
              <span className="font-semibold">90% Time Reduction</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
              <MapPin className="w-4 h-4" />
              <span className="font-semibold">Eliminate Site Visits</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full">
              <Navigation className="w-4 h-4" />
              <span className="font-semibold">Quote in Minutes</span>
            </div>
          </div>
        </div>

        {/* Tier Cards - Mobile First */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <TierCard tier="free" />
          <TierCard tier="community" />
          <TierCard tier="commercial" />
        </div>

        {/* Enhanced Detailed Feature Comparison */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-100 via-blue-100 to-teal-100 p-8 border-b border-gray-200">
            <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent text-center mb-2">
              Line of Sight Capabilities Comparison
            </h3>
            <p className="text-gray-600 text-center text-lg">
              From basic verification to fully automated planning ✨
            </p>
          </div>
          
          {/* Enhanced Table Header */}
          <div className="grid grid-cols-4 gap-4 p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <div className="font-bold text-gray-900 text-lg">Features</div>
            <div className="text-center font-bold text-emerald-600 text-lg flex items-center justify-center gap-2">
              <span>Free</span>
              <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <div className="text-center font-bold text-blue-600 text-lg flex items-center justify-center gap-2">
              <span>Community</span>
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
            </div>
            <div className="text-center font-bold text-orange-600 text-lg flex items-center justify-center gap-2">
              <span>Commercial</span>
              <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Feature Rows */}
          <div className="p-6">
            {allFeatures.map(feature => (
              <FeatureRow 
                key={feature}
                feature={feature}
                tiers={['free', 'community', 'commercial']}
              />
            ))}
          </div>
        </div>

        {/* Enhanced Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-teal-50 border-3 border-purple-200 rounded-2xl p-10 shadow-2xl relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full animate-bounce"></div>
              <div className="absolute bottom-4 left-4 w-12 h-12 bg-gradient-to-r from-blue-400 to-teal-400 rounded-full animate-pulse"></div>
            </div>
            
            <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
              Ready to Revolutionize Your Planning? 🚀
            </h3>
            <p className="text-gray-600 mb-6 max-w-3xl mx-auto text-lg">
              Join the drone operators who've eliminated site visits and turned <strong>days of planning into minutes of automation</strong>. 
              Experience the future of line of sight planning today.
            </p>
            
            {/* Enhanced value props */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-200">
                <span className="text-emerald-600 font-semibold">✓ No More Site Visits</span>
              </div>
              <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-200">
                <span className="text-blue-600 font-semibold">✓ Instant Quoting</span>
              </div>
              <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-gray-200">
                <span className="text-purple-600 font-semibold">✓ Perfect Compliance</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-5 rounded-xl text-xl font-bold transition-all transform hover:scale-110 shadow-xl hover:shadow-2xl">
                🎯 Start Line of Sight Analysis
              </button>
              <button className="bg-white text-blue-600 border-3 border-blue-400 hover:border-blue-600 px-10 py-5 rounded-xl text-xl font-bold hover:bg-blue-50 transition-all transform hover:scale-110 shadow-xl hover:shadow-2xl">
                👀 See It In Action
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mt-6">
              <strong>Future Ready:</strong> BVLOS integration and ML-powered optimization coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TierComparison;