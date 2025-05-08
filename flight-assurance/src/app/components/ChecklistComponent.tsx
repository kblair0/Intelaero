import React, { useState } from 'react';
import { useChecklistContext } from '../context/ChecklistContext';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../components/UI/Card';

interface ChecklistComponentProps {
  className?: string;
}

const ChecklistComponent: React.FC<ChecklistComponentProps> = ({ className }) => {
  const { checks, toggleCheck, setGuidedTarget } = useChecklistContext();
  const [mode, setMode] = useState<'guided' | 'list'>('guided');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (checks.length === 0) return null;

  const totalChecks = checks.length;
  const completedChecks = checks.filter(check => check.status === 'completed').length;
  const progressPercentage = (completedChecks / totalChecks) * 100;

  const groupedChecks = checks.reduce((acc, check) => {
    const group = check.group || 'Ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(check);
    return acc;
  }, {} as Record<string, typeof checks>);

  const nextIncompleteCheck = checks.find(check => check.status === 'pending');

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) newExpanded.delete(group);
    else newExpanded.add(group);
    setExpandedGroups(newExpanded);
  };

  const handleItemClick = (id: string) => toggleCheck(id);

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCheck(id);
    }
  };

  const handleGuideMe = (target: { component: string; action: string }, action: string) => {
    setGuidedTarget(target);
    setTimeout(() => setGuidedTarget(null), 5000);
    // Future enhancement: Trigger an overlay with action text
  };

  const renderGuidedMode = () => {
    if (!nextIncompleteCheck) {
      return (
        <div className="text-center p-1">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-700">All steps completed! Great job!</p>
        </div>
      );
    }

    const group = nextIncompleteCheck.group || 'Ungrouped';
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-1 rounded-lg border border-blue-200">
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => handleItemClick(nextIncompleteCheck.id)}
            onKeyDown={(e) => handleKeyDown(e, nextIncompleteCheck.id)}
            role="checkbox"
            aria-checked={nextIncompleteCheck.status === 'completed'}
            aria-label={`Toggle ${nextIncompleteCheck.label}`}
          >
            <Circle className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">1. {nextIncompleteCheck.label}</p>
              <p className="text-xs text-gray-600">{nextIncompleteCheck.action}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGuideMe(nextIncompleteCheck.target, nextIncompleteCheck.action);
              }}
              className="text-blue-500 text-xs hover:text-blue-600"
              aria-label={`Guide me to ${nextIncompleteCheck.label}`}
            >
              Guide Me
            </button>
          </button>
        </div>
        <button
          onClick={() => setMode('list')}
          className="text-blue-500 text-sm hover:underline"
        >
          View Full Checklist
        </button>
      </div>
    );
  };

  const renderListMode = () => (
    <div className="space-y-4">
      {Object.entries(groupedChecks).map(([group, groupChecks]) => {
        const groupCompleted = groupChecks.filter(check => check.status === 'completed').length;
        const isExpanded = expandedGroups.has(group);
        return (
          <div key={group} className="space-y-2">
            <button
              className="flex items-center justify-between w-full text-left p-1 hover:bg-gray-100 rounded"
              onClick={() => toggleGroup(group)}
            >
              <h4 className="font-medium text-gray-800 capitalize">
                {group.replace(/([A-Z])/g, ' $1').trim()} ({groupCompleted}/{groupChecks.length})
              </h4>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isExpanded && (
              <ul className="space-y-2 pl-4">
                {groupChecks.map((check, index) => (
                  <li key={check.id} className="flex items-center gap-2 bg-white p-1 rounded-lg shadow-sm">
                    <button
                      className="flex items-center gap-2 flex-1 text-left"
                      onClick={() => handleItemClick(check.id)}
                      onKeyDown={(e) => handleKeyDown(e, check.id)}
                      role="checkbox"
                      aria-checked={check.status === 'completed'}
                      aria-label={`Toggle ${check.label}`}
                    >
                      {check.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                      <span className={`text-sm ${check.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {index + 1}. {check.label}
                      </span>
                    </button>
                    <button
                      onClick={() => handleGuideMe(check.target, check.action)}
                      className="text-blue-500 text-xs hover:text-blue-600"
                      aria-label={`Guide me to ${check.label}`}
                    >
                      Guide Me
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      <button
        onClick={() => setMode('guided')}
        className="text-blue-500 text-sm hover:underline"
      >
        Switch to Guided Mode
      </button>
    </div>
  );

  return (
    <Card className={`w-full rounded-l-xl ${className}`}>
      <div className="space-y-4 p-1 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Your Analysis Checklist
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({completedChecks}/{totalChecks})
            </span>
          </h3>
          <button
            onClick={() => setMode(mode === 'guided' ? 'list' : 'guided')}
            className="text-blue-500 text-sm hover:underline"
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
        <p className="text-sm text-gray-600">
          Follow these steps to complete your analyses. Use 'Guide Me' to locate each action in the app.
        </p>
        <div className="flex-1 overflow-y-auto">
          {mode === 'guided' ? renderGuidedMode() : renderListMode()}
        </div>
      </div>
    </Card>
  );
};

export default ChecklistComponent;