/**
 * SandboxCard.tsx - Experimental Features with Meshblock Demo
 *
 * Purpose: Expandable experimental features card with single meshblock access button
 * Opens the meshblock analysis panel and automatically loads meshblock data
 */

'use client';
import React, { useState } from "react";
import { 
  Beaker, 
  Map, 
  ArrowRight,
  Loader2
} from "lucide-react";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";
import { useMeshblockContext } from "../../../sandbox/meshblox/MeshblockContext";

/**
 * Simplified Sandbox Card with Single Meshblock Access
 */
const SandboxCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan,
  onTogglePanel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  
  // Access meshblock context for auto-loading
  const { 
    toggleMeshblocks, 
    loading: meshblockLoading, 
    layersVisible,
    error
  } = useMeshblockContext();

  /**
   * Opens meshblock analysis panel AND automatically loads data
   */
  const handleOpenMeshblockPanel = async () => {
    trackEvent("open_meshblock_analysis", { 
      source: "sandbox_card",
      autoLoad: true
    });
    
    setIsLoading(true);
    
    try {
      // First open the panel
      if (onTogglePanel) {
        onTogglePanel("meshblock");
      }
      
      // Then automatically load meshblock data if not already loaded
      if (!layersVisible) {
        console.log("Auto-loading meshblock data from sandbox card");
        await toggleMeshblocks();
      }
    } catch (error) {
      console.error("Failed to auto-load meshblock data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine button state
  const isButtonLoading = isLoading || meshblockLoading;
  const isDataLoaded = layersVisible;
  const canLoad = true;

  return (
    <div className="border-2 border-gray-200 m-1 rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-purple-300 transition-all duration-200">
      {/* Header - Clickable to Expand */}
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggleExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-sm">
            <Beaker className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Experimental Features</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Advanced analysis tools and demonstrations
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4">
          {/* Meshblock Analysis Section */}
          <div className="space-y-3">
            
            {/* Status indicator */}
            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {/* Open Meshblock Analysis Button */}
            <button
              onClick={handleOpenMeshblockPanel}
              disabled={isButtonLoading || !canLoad}
              className={`w-full p-4 rounded-lg transition-all duration-200 transform shadow-sm ${
                isDataLoaded 
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" 
                  : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              } text-white ${
                isButtonLoading || !canLoad 
                  ? "opacity-50 cursor-not-allowed" 
                  : "hover:scale-[1.02]"
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                {isButtonLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isDataLoaded ? (
                  <Map className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                
                <div className="text-center">
                  <div className="font-medium text-sm">
                    {isButtonLoading 
                      ? "Loading Meshblock Data..." 
                      : isDataLoaded 
                        ? "View Meshblock Analysis" 
                        : "Start Meshblock Analysis"
                    }
                  </div>
                  <div className="text-xs text-blue-100 mt-1">
                    {isDataLoaded 
                      ? "Data loaded - click to open analysis panel"
                      : "Automatically loads population and land use data"
                    }
                  </div>
                </div>
              </div>
            </button>

            {/* Quick status */}
            {isDataLoaded && (
              <div className="text-xs text-center text-green-600 bg-green-50 p-2 rounded">
                ✅ Meshblock data loaded and ready for analysis
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SandboxCard;