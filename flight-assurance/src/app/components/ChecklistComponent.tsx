/**
 * ChecklistComponent.tsx
 * 
 * Purpose:
 * Provides an interactive checklist to help users complete workflow tasks.
 * Displays items in a list view with grouping functionality.
 * 
 * Related Files:
 * - ChecklistContext: Provides checklist data and toggle functions
 * - ToolsDashboard: Parent container where this component is rendered
 * - Card: UI component used for consistent styling
 */

"use client";

import React, { useState } from 'react';
import { useChecklistContext } from '../context/ChecklistContext';
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import Card from '../components/UI/Card';

// Define interfaces for type safety and clarity
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
    target: { component: string; action: string } 
  };
  index?: number;
  onToggle: (id: string) => void;
  onGuideMe: (target: { component: string; action: string }) => void;
}

/**
 * ChecklistItem: Reusable component for rendering a single checklist item.
 * Encapsulates item rendering logic, ensuring DRY and testability.
 * Uses div for accessibility and to avoid button nesting issues.
 */
const ChecklistItem: React.FC<ChecklistItemProps> = ({ 
  check, 
  index, 
  onToggle, 
  onGuideMe
}) => {
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

  return (
    <div
      className="flex items-center gap-2 p-2 border rounded-md bg-white border-gray-200 hover:bg-gray-50"
      onClick={handleChecklistClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={check.status === 'completed'}
      aria-label={`Toggle ${check.label}`}
      tabIndex={0}
    >
      {check.status === 'completed' ? (
        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-gray-400 flex-shrink-0" />
      )}
      <div className="flex-1">
        <p className={`text-xs ${check.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
          {`${index! + 1}. ${check.label}`}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGuideMe(check.target);
        }}
        className="flex-shrink-0 px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
        aria-label={`Guide me to ${check.label}`}
      >
        Guide Me
      </button>
    </div>
  );
};

/**
 * ChecklistComponent: Manages the display and interaction of a checklist.
 * Adheres to SRP by focusing on checklist rendering and user interaction.
 * Uses loose coupling via context and props for testability.
 */
const ChecklistComponent: React.FC<ChecklistComponentProps> = ({ 
  className, 
  togglePanel 
}) => {
  const { checks, completeCheck: toggleCheck, actionToPanelMap } = useChecklistContext();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Early return for empty checklist to prevent unnecessary rendering
  if (checks.length === 0) return null;

  // Calculate completion metrics
  const totalChecks = checks.length;
  const completedChecks = checks.filter((check) => check.status === 'completed').length;

  // Group checks by category for list mode
  const groupedChecks = checks.reduce((acc, check) => {
    const group = check.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(check);
    return acc;
  }, {} as Record<string, typeof checks>);

  // Toggle group expansion state
  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) newExpanded.delete(group);
    else newExpanded.add(group);
    setExpandedGroups(newExpanded);
  };

/**
 * Handles the "Guide Me" action by mapping the target action to the appropriate panel and section.
 * @param target - The target component and action from the checklist item.
 */
const handleGuideMe = (target: { component: string; action: string }) => {
  const panel = actionToPanelMap[target.action];
  let section: 'flight' | 'station' | 'merged' | 'stationLOS' | null = null;
  if (panel === 'los') {
    if (['analyseObserverVsTerrain', 'analyseGCSRepeaterVsTerrain'].includes(target.action)) {
      section = 'station';
    } else if (['observerToDrone', 'antennaToDrone', 'droneToGround'].includes(target.action)) {
      section = 'flight'; // Direct to FlightPathAnalysisCard
    } else if (target.action === 'antennaToAntenna') {
      section = 'stationLOS';
    }
  }
  if (panel) {
    togglePanel(panel, section);
  }
};

  return (
    <Card className={`w-full rounded-lg bg-white shadow ${className}`}>
      <div className="space-y-4 p-1 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            Your Analysis Checklist
          </h3>
        </div>
        
        <p className="text-xs text-gray-600">
          Follow these steps to complete your analyses. Use Guide Me to locate each action in the app.
        </p>
        
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {Object.entries(groupedChecks).map(([group, groupChecks]) => {
              const groupCompleted = groupChecks.filter((check) => check.status === 'completed').length;
              const isExpanded = expandedGroups.has(group);
              
              return (
                <div key={group} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                  <button
                    className="w-full px-2 py-2 flex items-center justify-between hover:bg-gray-50"
                    onClick={() => toggleGroup(group)}
                  >
                    <div className="flex items-center gap-2">
                      {groupCompleted === groupChecks.length ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                      <h4 className="font- text-sm text-gray-900 capitalize">
                        {group.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      <span className="text-sm text-gray-500">
                        ({groupCompleted}/{groupChecks.length})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="px-2 py-2 bg-gray-50 border-t space-y-1">
                      {groupChecks.map((check, index) => (
                        <ChecklistItem
                          key={check.id}
                          check={check}
                          index={index}
                          onToggle={toggleCheck}
                          onGuideMe={handleGuideMe}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ChecklistComponent;