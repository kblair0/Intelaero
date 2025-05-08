/**
 * ChecklistComponent.tsx
 * 
 * Purpose:
 * Provides a guided, interactive checklist to help users complete workflow tasks.
 * Supports both guided and list viewing modes for flexible user experience.
 * 
 * Related Files:
 * - ChecklistContext: Provides checklist data and toggle functions
 * - ToolsDashboard: Parent container where this component is rendered
 * - Card: UI component used for consistent styling
 */

"use client";

import React, { useState } from 'react';
import { useChecklistContext } from '../context/ChecklistContext';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronRight, Loader } from 'lucide-react';
import Card from '../components/UI/Card';

// Define interfaces for type safety and clarity
interface ChecklistComponentProps {
  className?: string;
  togglePanel: (panel: 'energy' | 'los' | 'terrain' | null) => void;
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
  isGuidedMode?: boolean;
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
  onGuideMe, 
  isGuidedMode = false 
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(check.id);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 border rounded-md ${
        isGuidedMode 
          ? 'bg-blue-50 border-blue-200' 
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
      onClick={() => onToggle(check.id)}
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
          {isGuidedMode ? check.label : `${index! + 1}. ${check.label}`}
        </p>
        {isGuidedMode && <p className="text-xs text-gray-600 mt-1">{check.action}</p>}
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
 * ChecklistComponent: Manages the display and interaction of a checklist in guided or list mode.
 * Adheres to SRP by focusing on checklist rendering and user interaction.
 * Uses loose coupling via context and props for testability.
 */
const ChecklistComponent: React.FC<ChecklistComponentProps> = ({ 
  className, 
  togglePanel 
}) => {
  const { checks, toggleCheck, actionToPanelMap } = useChecklistContext();
  const [mode, setMode] = useState<'guided' | 'list'>('guided');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Early return for empty checklist to prevent unnecessary rendering
  if (checks.length === 0) return null;

  // Calculate progress metrics
  const totalChecks = checks.length;
  const completedChecks = checks.filter((check) => check.status === 'completed').length;
  const progressPercentage = (completedChecks / totalChecks) * 100;

  // Group checks by category for list mode
  const groupedChecks = checks.reduce((acc, check) => {
    const group = check.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(check);
    return acc;
  }, {} as Record<string, typeof checks>);

  // Find the next incomplete check for guided mode
  const nextIncompleteCheck = checks.find((check) => check.status === 'pending');

  // Toggle group expansion state
  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) newExpanded.delete(group);
    else newExpanded.add(group);
    setExpandedGroups(newExpanded);
  };

  // Handle guide me action by mapping to appropriate panel
  const handleGuideMe = (target: { component: string; action: string }) => {
    const panel = actionToPanelMap[target.action];
    if (panel) {
      togglePanel(panel);
    }
  };

  // Render guided mode with a single incomplete check
  const renderGuidedMode = () => {
    if (!nextIncompleteCheck) {
      return (
        <div className="text-center p-1 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-700">All steps completed! Great job!</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <ChecklistItem
          check={nextIncompleteCheck}
          onToggle={toggleCheck}
          onGuideMe={handleGuideMe}
          isGuidedMode
        />
        <button
          onClick={() => setMode('list')}
          className="text-blue-500 text-sm hover:underline flex items-center gap-1"
        >
          <ChevronDown className="w-4 h-4" />
          View Full Checklist
        </button>
      </div>
    );
  };

  // Render list mode with grouped checks
  const renderListMode = () => (
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
      
      <button
        onClick={() => setMode('guided')}
        className="text-blue-500 text-xs hover:underline flex items-center gap-1"
      >
        <ChevronUp className="w-4 h-4" />
        Switch to Guided Mode
      </button>
    </div>
  );

  return (
    <Card className={`w-full rounded-lg bg-white shadow ${className}`}>
      <div className="space-y-4 p-1 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center mr-1 gap-2">
            Your Analysis Checklist
            <span className="text-sm font-normal text-gray-600">
              ({completedChecks}/{totalChecks})
            </span>
          </h3>
          <button
            onClick={() => setMode(mode === 'guided' ? 'list' : 'guided')}
            className="flex items-center gap-1 px-1 ml-1 py-1 bg-gray-100 text-gray-800 text-xs rounded-md hover:bg-gray-200 transition-colors"
          >
            {mode === 'guided' ? (
              <>
                <ChevronDown className="w-3 h-3" />
                List Mode
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3" />
                Guided Mode
              </>
            )}
          </button>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <p className="text-xs text-gray-600">
          Follow these steps to complete your analyses. Use 'Guide Me' to locate each action in the app.
        </p>
        
        {progressPercentage < 100 && completedChecks > 0 && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded border border-blue-100">
            <Loader className="w-4 h-4 animate-spin" />
            <span className="text-xs">Analysis in progress...</span>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {mode === 'guided' ? renderGuidedMode() : renderListMode()}
        </div>
      </div>
    </Card>
  );
};

export default ChecklistComponent;