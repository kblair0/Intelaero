/**
 * ChecklistComponent.tsx - Compact Enhanced Version
 * 
 * Purpose:
 * Provides an interactive checklist optimized for sidebar space (320px width).
 * Features modern UI/UX with space-efficient design and subtle animations.
 * 
 * Related Files:
 * - ChecklistContext: Provides checklist data and toggle functions
 * - ToolsDashboard: Parent container where this component is rendered
 * - Card: UI component used for consistent styling
 * 
 * Design Principles Applied:
 * - Space-efficient compact design for sidebar constraints
 * - Subtle visual feedback and micro-interactions
 * - Progressive disclosure with minimal padding
 * - Modern color system with accessibility
 * - Optimized for 320px sidebar width
 */

"use client";

import React, { useState, useEffect } from 'react';
import { useChecklistContext } from '../context/ChecklistContext';
import { 
  CheckCircle2, 
  Circle, 
  ChevronDown, 
  ChevronRight, 
  Sparkles, 
  Target,
  Award,
  Clock
} from 'lucide-react';
import Card from '../components/UI/Card';

// Compact interfaces optimized for sidebar
interface ChecklistComponentProps {
  className?: string;
  togglePanel: (panel: 'energy' | 'los' | 'terrain' | null, section?: 'flight' | 'station' | 'merged' | 'stationLOS' | null) => void;
}

interface ChecklistItemProps {
  check: { 
    id: string; 
    label: string; 
    action: string; 
    status: 'pending' | 'completed'; 
    target: { component: string; action: string };
    group: string;
  };
  index?: number;
  onToggle: (id: string) => void;
  onGuideMe: (target: { component: string; action: string }) => void;
  isRecentlyCompleted?: boolean;
}

/**
 * Compact ChecklistItem optimized for sidebar space
 */
const ChecklistItem: React.FC<ChecklistItemProps> = ({ 
  check, 
  index, 
  onToggle, 
  onGuideMe,
  isRecentlyCompleted = false
}) => {
  const [showCelebration, setShowCelebration] = useState(false);

  // Celebration effect for completions
  useEffect(() => {
    if (isRecentlyCompleted) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isRecentlyCompleted]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (check.target.action === 'analyseTerrainInAO') {
        onGuideMe(check.target);
      } else {
        onToggle(check.id);
      }
    }
  };

  const handleChecklistClick = () => {
    if (check.target.action === 'analyseTerrainInAO') {
      onGuideMe(check.target);
    } else {
      onToggle(check.id);
    }
  };

  // Compact styling with subtle effects
  const getItemStyling = () => {
    if (check.status === 'completed') {
      return "bg-green-50 border-green-200 hover:bg-green-100";
    }
    return "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50";
  };

  // Compact action button color
  const getActionColor = () => {
    if (check.target.action.includes('terrain')) return "bg-green-500 hover:bg-green-600";
    if (check.target.action.includes('observer')) return "bg-blue-500 hover:bg-blue-600";
    if (check.target.action.includes('antenna')) return "bg-purple-500 hover:bg-purple-600";
    return "bg-indigo-500 hover:bg-indigo-600";
  };

  return (
    <div
      className={`
        relative flex items-center gap-2 p-2 border rounded-lg transition-all duration-200 cursor-pointer
        ${getItemStyling()}
        ${showCelebration ? 'scale-105 shadow-md' : 'scale-100'}
      `}
      onClick={handleChecklistClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={check.status === 'completed'}
      aria-label={`Toggle ${check.label}`}
      tabIndex={0}
    >
      {/* Compact celebration effect */}
      {showCelebration && (
        <div className="absolute -top-1 -right-1 animate-bounce">
          <Sparkles className="w-4 h-4 text-yellow-500" />
        </div>
      )}

      {/* Compact status icon */}
      <div className="flex-shrink-0">
        {check.status === 'completed' ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <Circle className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" />
        )}
      </div>

      {/* Compact content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <span className={`
            w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center
            ${check.status === 'completed' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-600'
            }
          `}>
            {(index || 0) + 1}
          </span>
          <h4 className={`
            font-medium text-xs leading-tight truncate
            ${check.status === 'completed' 
              ? 'text-green-800 line-through' 
              : 'text-gray-900'
            }
          `}>
            {check.label}
          </h4>
        </div>
        
        {/* Compact action description - only show if not completed */}
        {check.status === 'pending' && (
          <p className="text-xs text-gray-600 ml-5 leading-tight">
            {check.action.length > 40 ? `${check.action.slice(0, 40)}...` : check.action}
          </p>
        )}
      </div>

      {/* Compact Guide Me button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGuideMe(check.target);
        }}
        className={`
          flex items-center gap-1 px-2 py-1 rounded text-white text-xs font-medium
          ${getActionColor()}
          shadow-sm hover:shadow transition-all duration-200 transform hover:scale-105
          focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500
        `}
        aria-label={`Guide me to ${check.label}`}
      >
        <Target className="w-3 h-3" />
        <span className="hidden sm:inline">Go</span>
      </button>
    </div>
  );
};

/**
 * Compact ChecklistComponent optimized for sidebar space
 */
const ChecklistComponent: React.FC<ChecklistComponentProps> = ({ 
  className, 
  togglePanel 
}) => {
  const { checks, completeCheck: toggleCheck, actionToPanelMap, setHighlightMarkers } = useChecklistContext();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());

  // Auto-expand first incomplete group
  useEffect(() => {
    if (checks.length > 0) {
      const firstIncompleteGroup = checks.find(check => check.status === 'pending')?.group;
      if (firstIncompleteGroup) {
        setExpandedGroups(prev => new Set([...prev, firstIncompleteGroup]));
      }
    }
  }, [checks]);

  // Early return for empty checklist
  if (checks.length === 0) return null;

  // Calculate compact metrics
  const totalChecks = checks.length;
  const completedChecks = checks.filter((check) => check.status === 'completed').length;
  const progressPercentage = totalChecks > 0 ? (completedChecks / totalChecks) * 100 : 0;

  // Group checks by category
  const groupedChecks = checks.reduce((acc, check) => {
    const group = check.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(check);
    return acc;
  }, {} as Record<string, typeof checks>);

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) newExpanded.delete(group);
    else newExpanded.add(group);
    setExpandedGroups(newExpanded);
  };

  // Guide me handler
  const handleGuideMe = (target: { component: string; action: string }) => {
    if (['addObserver', 'addGCSorRepeater'].includes(target.action)) {
      setHighlightMarkers(true);
      setTimeout(() => setHighlightMarkers(false), 10000);
      return;
    }
    
    const panel = actionToPanelMap[target.action];
    let section: 'flight' | 'station' | 'merged' | 'stationLOS' | null = null;
    
    if (panel === 'los') {
      if (['analyseObserverVsTerrain', 'analyseGCSRepeaterVsTerrain'].includes(target.action)) {
        section = 'station';
      } else if (['observerToDrone', 'antennaToDrone', 'droneToGround'].includes(target.action)) {
        section = 'flight';
      } else if (target.action === 'antennaToAntenna') {
        section = 'stationLOS';
      }
    }
    
    if (panel) {
      togglePanel(panel, section);
    }
  };

  // Toggle check with celebration tracking
  const handleToggleCheck = (id: string) => {
    setRecentlyCompleted(prev => new Set([...prev, id]));
    toggleCheck(id);
    
    setTimeout(() => {
      setRecentlyCompleted(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 1500);
  };

  return (
    <Card className={`w-full rounded-lg bg-white shadow border-0 ${className}`}>
      <div className="space-y-3 p-3 flex flex-col h-full">
        {/* Compact Header with Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500 rounded-lg">
                <Award className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Analysis Checklist</h3>
                <p className="text-xs text-gray-600">
                  {completedChecks}/{totalChecks} complete
                </p>
              </div>
            </div>
            
            {/* Completion celebration */}
            {progressPercentage === 100 && (
              <div className="animate-bounce">
                <Sparkles className="w-5 h-5 text-yellow-500" />
              </div>
            )}
          </div>

          {/* Compact Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium text-gray-900">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Compact Helper Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-900 font-medium">
              {progressPercentage === 100 
                ? "🎉 All complete! Mission ready."
                : progressPercentage > 50 
                  ? "Great progress! Keep going."
                  : "Use 'Go' buttons to navigate to tools."
              }
            </p>
          </div>
        </div>
        
        {/* Compact Groups List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.entries(groupedChecks).map(([group, groupChecks]) => {
            const groupCompleted = groupChecks.filter((check) => check.status === 'completed').length;
            const isExpanded = expandedGroups.has(group);
            const isGroupComplete = groupCompleted === groupChecks.length;
            
            return (
              <div 
                key={group} 
                className={`
                  border rounded-lg overflow-hidden transition-all duration-200
                  ${isGroupComplete 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-white hover:border-blue-300'
                  }
                `}
              >
                {/* Compact Group Header */}
                <button
                  className={`
                    w-full px-3 py-2 flex items-center justify-between transition-colors
                    ${isGroupComplete ? 'hover:bg-green-100' : 'hover:bg-blue-50'}
                  `}
                  onClick={() => toggleGroup(group)}
                >
                  <div className="flex items-center gap-2">
                    {/* Compact Status Icon */}
                    {isGroupComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                    
                    {/* Group Info */}
                    <div className="text-left">
                      <h4 className="font-medium text-xs text-gray-900 capitalize">
                        {group.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">
                          {groupCompleted}/{groupChecks.length}
                        </span>
                        {isGroupComplete && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Expand/Collapse Icon */}
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
                
                {/* Compact Group Content */}
                {isExpanded && (
                  <div className="px-3 pb-2 bg-gray-50 border-t border-gray-100">
                    <div className="space-y-1.5 pt-2">
                      {groupChecks.map((check, index) => (
                        <ChecklistItem
                          key={check.id}
                          check={check}
                          index={index}
                          onToggle={handleToggleCheck}
                          onGuideMe={handleGuideMe}
                          isRecentlyCompleted={recentlyCompleted.has(check.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default ChecklistComponent;