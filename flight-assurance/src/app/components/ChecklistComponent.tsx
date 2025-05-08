"use client";

import React, { useState } from 'react';
import { useChecklistContext } from '../context/ChecklistContext';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../components/UI/Card';

// Define interfaces for type safety and clarity
interface ChecklistComponentProps {
  className?: string;
  togglePanel: (panel: 'energy' | 'los' | 'terrain' | null) => void;
}

interface ChecklistItemProps {
  check: { id: string; label: string; action: string; status: 'pending' | 'completed'; target: { component: string; action: string } };
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
const ChecklistItem: React.FC<ChecklistItemProps> = ({ check, index, onToggle, onGuideMe, isGuidedMode = false }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle(check.id);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 ${isGuidedMode ? 'bg-blue-50 p-1 rounded-lg border border-blue-200' : 'bg-white p-1 rounded-lg shadow-sm'}`}
      onClick={() => onToggle(check.id)}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={check.status === 'completed'}
      aria-label={`Toggle ${check.label}`}
      tabIndex={0}
    >
      {check.status === 'completed' ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <Circle className="w-5 h-5 text-gray-400" />
      )}
      <div className="flex-1">
        <p className={`text-xs ${check.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
          {isGuidedMode ? `1. ${check.label}` : `${index! + 1}. ${check.label}`}
        </p>
        {isGuidedMode && <p className="text-[10px] text-gray-600">{check.action}</p>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onGuideMe(check.target);
        }}
        className="text-blue-500 text-xs hover:text-blue-600"
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
const ChecklistComponent: React.FC<ChecklistComponentProps> = ({ className, togglePanel }) => {
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
        <div className="text-center p-1">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-xs text-gray-700">All steps completed! Great job!</p>
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
          className="text-blue-500 text-xs hover:underline"
        >
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
          <div key={group} className="space-y-2">
            <button
              className="flex items-center justify-between w-full text-left p-1 hover:bg-gray-100 rounded"
              onClick={() => toggleGroup(group)}
            >
              <h4 className="text-sm font-medium text-gray-800 capitalize">
                {group.replace(/([A-Z])/g, ' $1').trim()} ({groupCompleted}/{groupChecks.length})
              </h4>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isExpanded && (
              <ul className="space-y-2 pl-4">
                {groupChecks.map((check, index) => (
                  <li key={check.id}>
                    <ChecklistItem
                      check={check}
                      index={index}
                      onToggle={toggleCheck}
                      onGuideMe={handleGuideMe}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <button
        onClick={() => setMode('guided')}
        className="text-blue-500 text-xs hover:underline"
      >
        Switch to Guided Mode
      </button>
    </div>
  );

  return (
    <Card className={`w-full rounded-l-xl ${className}`}>
      <div className="space-y-4 p-1 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Your Analysis Checklist
            <span className="text-xs font-normal text-gray-600 ml-2">
              ({completedChecks}/{totalChecks})
            </span>
          </h3>
          <button
            onClick={() => setMode(mode === 'guided' ? 'list' : 'guided')}
            className="text-blue-500 text-xs hover:underline"
          >
            {mode === 'guided' ? 'List Mode' : 'Guided Mode'}
          </button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-600">
          Follow these steps to complete your analyses. Use 'Guide Me' to locate each action in the app.
        </p>
        <div className="flex-1 overflow-y-auto">{mode === 'guided' ? renderGuidedMode() : renderListMode()}</div>
      </div>
    </Card>
  );
};

export default ChecklistComponent;