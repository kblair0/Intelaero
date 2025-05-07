import React from 'react';
import { useChecklistContext } from '../context/ChecklistContext';
import { CheckCircle2, Circle } from 'lucide-react';
import Card from '../components/UI/Card';

/**
 * Props for ChecklistComponent
 */
interface ChecklistComponentProps {
  className?: string;
}

/**
 * Renders a static checklist of tasks for the user to complete
 * 
 * Purpose:
 * Displays a non-draggable checklist styled to match the Plan Verification section,
 * appearing above it in the right sidebar of the HomeContent component in page.tsx.
 * 
 * Styling:
 * Uses the Card component with rounded-l-xl to align with Plan Verification.
 * Applies consistent typography and layout (flex flex-col, scrollable content).
 */
const ChecklistComponent: React.FC<ChecklistComponentProps> = ({ className }) => {
  const { checks, toggleCheck } = useChecklistContext();

  // Prevent checklist from rendering if empty
  if (checks.length === 0) {
    return null;
  }

  /**
   * Handles clicking a checklist item to toggle its status
   */
  const handleItemClick = (id: string) => {
    toggleCheck(id);
  };

  /**
   * Handles keyboard events for accessibility
   */
  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCheck(id);
    }
  };

  return (
    <Card className={`w-full rounded-l-xl ${className}`}>
      <div className="space-y-4 h-full flex flex-col">
        {/* Header */}
        <h3 className="text-lg font-semibold text-gray-900">Your Analysis Checklist</h3>
        {/* Checklist Items */}
        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.id}>
                <button
                  className="flex items-start gap-2 text-sm text-gray-700 w-full text-left p-2 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={() => handleItemClick(check.id)}
                  onKeyDown={(e) => handleKeyDown(e, check.id)}
                  role="checkbox"
                  aria-checked={check.status === 'completed'}
                  aria-label={`Toggle ${check.label}`}
                >
                  {check.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 mt-0.5" />
                  )}
                  <div>
                    <p
                      className={`font-medium ${
                        check.status === 'completed' ? 'text-green-600' : 'text-gray-800'
                      }`}
                    >
                      {check.label}
                    </p>
                    <p className="text-gray-600">{check.action}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default ChecklistComponent;