import React from 'react';
import { ChevronRight } from 'lucide-react';

interface MapSidePanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  isExpanded: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}

const MapSidePanel: React.FC<MapSidePanelProps> = ({
  title,
  children,
  className = '',
  isExpanded,
  onToggle,
  icon
}) => {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 transition-transform duration-300 ease-in-out
        ${isExpanded ? 'translate-x-0' : 'translate-x-full'}
        ${className}`}
    >
      {/* Main Panel */}
      <div className="h-full">
        {/* Content Container */}
        <div className="relative bg-white/95 backdrop-blur-sm shadow-xl
          w-full h-full flex flex-col rounded-l-lg border border-gray-200 
          overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50/90 border-b border-gray-200
            flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              {icon && <span className="text-gray-600">{icon}</span>}
              <h3 className="font-medium text-gray-900">{title}</h3>
            </div>
            {/* Close button */}
            {isExpanded && (
              <button
                onClick={onToggle}
                className="p-1.5 hover:bg-gray-200 rounded-full transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close panel"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto overscroll-contain
            scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent
            hover:scrollbar-thumb-gray-400">
            <div className="max-w-full">
              {children}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-[2px] lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default MapSidePanel;