/**
 * SandboxCard.tsx - Experimental Features with Meshblock Demo
 *
 * Purpose: Expandable experimental features card with compact meshblock and cadastre buttons
 * Opens the meshblock analysis panel and automatically loads meshblock data
 */

'use client';
import React, { useState } from "react";
import { 
  Beaker, 
  Map,
  MapPin,
  ArrowRight,
  Loader2
} from "lucide-react";
import { VerificationCardProps } from "../Utils/types";
import { trackEventWithForm as trackEvent } from "../../tracking/tracking";
import { useMeshblockContext } from "../../../sandbox/meshblox/MeshblockContext";
import { useCadastreContext } from '../../../sandbox/cadastre';

/**
 * Simplified Sandbox Card with Compact Meshblock and Cadastre Buttons
 */
const SandboxCard: React.FC<VerificationCardProps> = ({
  isExpanded,
  onToggleExpanded,
  flightPlan,
  onTogglePanel
}) => {
  const [isMeshblockLoading, setIsMeshblockLoading] = useState(false);
  const [isCadastreLoading, setIsCadastreLoading] = useState(false);
  
  // Access meshblock context for auto-loading
  const { 
    toggleMeshblocks, 
    loading: meshblockLoading, 
    layersVisible,
    error
  } = useMeshblockContext();

  // Cadastre context
  const { 
    toggleCadastre, 
    loading: cadastreLoading, 
    layersVisible: cadastreVisible, 
    error: cadastreError 
  } = useCadastreContext();

  /**
   * Opens meshblock analysis panel AND automatically loads data
   */
  const handleOpenMeshblockPanel = async () => {
    trackEvent("open_meshblock_analysis", { 
      source: "sandbox_card",
      autoLoad: true
    });
    
    setIsMeshblockLoading(true);
    
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
      setIsMeshblockLoading(false);
    }
  };

  /**
   * Opens cadastre dashboard and automatically loads data
   */
  const handleOpenCadastrePanel = async () => {
    trackEvent('open_cadastre_analysis', { source: 'sandbox_card', autoLoad: true });
    setIsCadastreLoading(true);
    try {
      if (onTogglePanel) {
        onTogglePanel('cadastre');
      }
      if (!cadastreVisible) {
        console.log('Auto-loading cadastre data from sandbox card');
        await toggleCadastre();
      }
    } catch (error) {
      console.error('Failed to auto-load cadastre data:', error);
    } finally {
      setIsCadastreLoading(false);
    }
  };

  // Button states
  const isMeshblockButtonLoading = isMeshblockLoading || meshblockLoading;
  const isMeshblockDataLoaded = layersVisible;
  const isCadastreButtonLoading = isCadastreLoading || cadastreLoading;
  const isCadastreDataLoaded = cadastreVisible;
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
          <div className="space-y-2">
            
            {/* Status indicator */}
            {(error || cadastreError) && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error || cadastreError}
              </div>
            )}

            {/* Compact Buttons Grid */}
            <div className="grid grid-cols-1 gap-2">
              
              {/* Meshblock Button - Compact */}
              <button
                onClick={handleOpenMeshblockPanel}
                disabled={isMeshblockButtonLoading || !canLoad}
                className={`p-2 rounded-lg transition-all duration-200 shadow-sm ${
                  isMeshblockDataLoaded 
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" 
                    : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                } text-white ${
                  isMeshblockButtonLoading || !canLoad 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:scale-[1.01]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isMeshblockButtonLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                  ) : isMeshblockDataLoaded ? (
                    <Map className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">
                      {isMeshblockButtonLoading 
                        ? "Loading..." 
                        : isMeshblockDataLoaded 
                          ? "Meshblock Analysis" 
                          : "Start Meshblock Analysis"
                      }
                    </div>
                  </div>
                </div>
              </button>

              {/* Cadastre Button - Compact */}
              <button
                onClick={handleOpenCadastrePanel}
                disabled={isCadastreButtonLoading || !canLoad}
                className={`p-2 rounded-lg transition-all duration-200 shadow-sm ${
                  isCadastreDataLoaded
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-blue-500 to-green-600 hover:from-blue-600 hover:to-green-700'
                } text-white ${isCadastreButtonLoading || !canLoad ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'}`}
              >
                <div className="flex items-center gap-2">
                  {isCadastreButtonLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                  ) : isCadastreDataLoaded ? (
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs truncate">
                      {isCadastreButtonLoading
                        ? 'Loading...'
                        : isCadastreDataLoaded
                          ? 'Cadastre Dashboard'
                          : 'Start Cadastre Visualization'}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Compact Status Messages */}
            {(isMeshblockDataLoaded || isCadastreDataLoaded) && (
              <div className="text-xs text-center text-green-600 bg-green-50 p-1.5 rounded">
                ✅ {isMeshblockDataLoaded && isCadastreDataLoaded 
                  ? 'Both datasets loaded' 
                  : isMeshblockDataLoaded 
                    ? 'Meshblock data ready' 
                    : 'Cadastre data ready'
                }
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SandboxCard;