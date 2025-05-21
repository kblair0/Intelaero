/**
 * MobileTowerAnalysisCard.tsx
 * 
 * Purpose:
 * Provides a UI card for analyzing mobile tower coverage in the Area of Operations.
 * Users can filter by carrier (Telstra, Optus, Vodafone), technology (3G, 4G, 5G),
 * and frequency bands.
 * 
 * This component:
 * - Shows/hides mobile towers on the map
 * - Allows filtering by carrier, technology, and frequency bands
 * - Displays loading and error states
 * - Provides information about data sources
 */

import React, { useState, useEffect } from 'react';
import { useMapContext } from '../../../../context/mapcontext';
import { useAreaOfOpsContext } from '../../../../context/AreaOfOpsContext';
import { useLayers } from '../../../../hooks/useLayers';
import { trackEventWithForm as trackEvent } from '../../../tracking/tracking';
import { FREQUENCY_BANDS } from '../../../../services/MobileTowerService';
import { FrequencyBand } from '../../../../types/mobileTowers';
import PremiumButton from '../../../UI/PremiumButton';
import { Signal, Loader, Network, AlertTriangle, CheckCircle, Radio, Smartphone, Wifi } from 'lucide-react';

interface MobileTowerAnalysisCardProps {
  // Props if needed
}

const MobileTowerAnalysisCard: React.FC<MobileTowerAnalysisCardProps> = () => {
  // State for API requests and UI
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>(['telstra', 'optus', 'vodafone']);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>(['3g', '4g', '5g']);
  const [selectedFrequencyBands, setSelectedFrequencyBands] = useState<FrequencyBand[]>([]);
  const [showFrequencyFilter, setShowFrequencyFilter] = useState(false);
  
  // Contexts and hooks
  const { map } = useMapContext();
  const { aoGeometry } = useAreaOfOpsContext();
  const { toggleMobileTowers, filterMobileTowersLayer } = useLayers();
  
  // Toggle handler for carriers
  const handleCarrierToggle = (carrier: string) => {
    setSelectedCarriers(prev => 
      prev.includes(carrier) 
        ? prev.filter(c => c !== carrier) 
        : [...prev, carrier]
    );
    
    // Track toggle event
    trackEvent('mobile_tower_analysis', {
      action: 'toggle_carrier',
      carrier,
      state: !selectedCarriers.includes(carrier) ? 'on' : 'off'
    });
  };
  
  // Toggle handler for technologies
  const handleTechnologyToggle = (tech: string) => {
    setSelectedTechnologies(prev => 
      prev.includes(tech) 
        ? prev.filter(t => t !== tech) 
        : [...prev, tech]
    );
    
    // Track toggle event
    trackEvent('mobile_tower_analysis', {
      action: 'toggle_technology',
      technology: tech,
      state: !selectedTechnologies.includes(tech) ? 'on' : 'off'
    });
  };
  
  // Toggle handler for frequency bands
  const handleFrequencyBandToggle = (band: FrequencyBand) => {
    setSelectedFrequencyBands(prev => 
      prev.includes(band) 
        ? prev.filter(b => b !== band) 
        : [...prev, band]
    );
    
    // Track toggle event
    trackEvent('mobile_tower_analysis', {
      action: 'toggle_frequency_band',
      band,
      state: !selectedFrequencyBands.includes(band) ? 'on' : 'off'
    });
  };
  
  // Show/hide mobile towers
  const handleFetchMobileTowers = async () => {
    setIsLoading(true);
    setLocalError(null);
    setSuccessMessage(null);

    try {
      // Track event
      trackEvent('mobile_tower_analysis', {
        action: 'show_towers',
        carriers: selectedCarriers.join(','),
        technologies: selectedTechnologies.join(','),
        frequencyBands: selectedFrequencyBands.join(',')
      });
      
      const success = await toggleMobileTowers();

      if (success) {
        // Apply filters immediately after loading
        const filters = {
          carriers: selectedCarriers,
          technologies: selectedTechnologies,
          frequencyBands: selectedFrequencyBands.length > 0 ? selectedFrequencyBands : undefined
        };

        filterMobileTowersLayer(filters);
        setSuccessMessage("Mobile towers loaded successfully");
      } else {
        setLocalError("Failed to load mobile tower data");
      }
    } catch (error) {
      console.error("Mobile tower fetch error:", error);
      setLocalError(error instanceof Error ? error.message : "Unknown error");
      
      // Track error event
      trackEvent('mobile_tower_analysis', {
        action: 'error',
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters whenever selections change (if layer exists)
  useEffect(() => {
    if (map?.getLayer('mobile-towers-unclustered-point')) {
      const filters = {
        carriers: selectedCarriers,
        technologies: selectedTechnologies,
        frequencyBands: selectedFrequencyBands.length > 0 ? selectedFrequencyBands : undefined
      };
      
      filterMobileTowersLayer(filters);
    }
  }, [selectedCarriers, selectedTechnologies, selectedFrequencyBands, filterMobileTowersLayer, map]);
  
  // Toggle frequency filter visibility
  const toggleFrequencyFilterVisibility = () => {
    setShowFrequencyFilter(!showFrequencyFilter);
    
    // Track event
    trackEvent('mobile_tower_analysis', {
      action: 'toggle_frequency_filter_visibility',
      state: !showFrequencyFilter ? 'expanded' : 'collapsed'
    });
  };
  
  return (
    <div className="bg-white rounded shadow p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold flex items-center">
          <Signal className="w-4 h-4 mr-1 text-blue-500" /> 
          Mobile Tower Analysis
        </h2>
      </div>
      
      {!aoGeometry ? (
        <div className="p-3 bg-yellow-100 border border-yellow-400 text-xs text-yellow-700 rounded">
          ⚠️ Please define an area of operations to analyze mobile tower coverage.
        </div>
      ) : (
        <>
          {localError && (
            <div className="p-2 mb-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertTriangle className="inline-block w-3 h-3 mr-1" />
              {localError}
            </div>
          )}
          
          {successMessage && (
            <div className="p-2 mb-3 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              <CheckCircle className="inline-block w-3 h-3 mr-1" />
              {successMessage}
            </div>
          )}
          
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1 flex items-center">
              <Network className="w-3 h-3 mr-1" />
              Select Mobile Carriers
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedCarriers.includes('telstra') 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => handleCarrierToggle('telstra')}
                aria-pressed={selectedCarriers.includes('telstra')}
              >
                <div className="w-2 h-2 rounded-full bg-blue-600 mr-1"></div>
                Telstra
              </button>
              <button
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedCarriers.includes('optus') 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => handleCarrierToggle('optus')}
                aria-pressed={selectedCarriers.includes('optus')}
              >
                <div className="w-2 h-2 rounded-full bg-green-600 mr-1"></div>
                Optus
              </button>
              <button
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedCarriers.includes('vodafone') 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => handleCarrierToggle('vodafone')}
                aria-pressed={selectedCarriers.includes('vodafone')}
              >
                <div className="w-2 h-2 rounded-full bg-red-600 mr-1"></div>
                Vodafone/TPG
              </button>
            </div>
          </div>
          
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1 flex items-center">
              <Smartphone className="w-3 h-3 mr-1" />
              Select Technologies
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedTechnologies.includes('3g') 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => handleTechnologyToggle('3g')}
                aria-pressed={selectedTechnologies.includes('3g')}
              >
                <Radio className="w-3 h-3 mr-1 text-orange-500" />
                3G
              </button>
              <button
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedTechnologies.includes('4g') 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => handleTechnologyToggle('4g')}
                aria-pressed={selectedTechnologies.includes('4g')}
              >
                <Radio className="w-3 h-3 mr-1 text-blue-500" />
                4G
              </button>
              <button
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedTechnologies.includes('5g') 
                    ? 'bg-blue-100 border border-blue-300' 
                    : 'bg-gray-100 border border-gray-300'
                }`}
                onClick={() => handleTechnologyToggle('5g')}
                aria-pressed={selectedTechnologies.includes('5g')}
              >
                <Radio className="w-3 h-3 mr-1 text-purple-500" />
                5G
              </button>
            </div>
          </div>
          
          {/* Frequency Band Section - Expandable */}
          <div className="mb-3">
            <button 
              className="w-full flex items-center justify-between text-xs text-gray-600 hover:bg-gray-50 p-1 rounded"
              onClick={toggleFrequencyFilterVisibility}
            >
              <span className="flex items-center">
                <Wifi className="w-3 h-3 mr-1" />
                Frequency Bands
              </span>
              <span className="text-gray-400">
                {showFrequencyFilter ? '▲' : '▼'}
              </span>
            </button>
            
            {showFrequencyFilter && (
              <div className="mt-2 pl-2 border-l-2 border-gray-200">
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(FREQUENCY_BANDS).map(([band, data]) => (
                    <button
                      key={band}
                      className={`px-2 py-1 text-xs text-left rounded flex items-center ${
                        selectedFrequencyBands.includes(band as FrequencyBand)
                          ? 'bg-blue-100 border border-blue-300' 
                          : 'bg-gray-100 border border-gray-300'
                      }`}
                      onClick={() => handleFrequencyBandToggle(band as FrequencyBand)}
                      aria-pressed={selectedFrequencyBands.includes(band as FrequencyBand)}
                    >
                      <div className="w-2 h-2 rounded-full bg-purple-600 mr-1"></div>
                      {data.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <PremiumButton
            featureId="mobile_tower_analysis"
            onClick={handleFetchMobileTowers}
            disabled={isLoading || selectedCarriers.length === 0 || selectedTechnologies.length === 0}
            className={`
              w-full py-2 px-4 rounded text-white text-xs font-medium
              ${isLoading || selectedCarriers.length === 0 || selectedTechnologies.length === 0
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'}
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </span>
            ) : "Show Mobile Towers"}
          </PremiumButton>
          
          <div className="mt-3 p-2 bg-blue-50 rounded-md border border-blue-100">
            <div className="flex items-start gap-2">
              <Signal className="w-3 h-3 text-blue-500 mt-0.5" />
              <p className="text-xs text-blue-700">
                Data from ACMA RRL.
              </p>
            </div>
          </div>
          
          {/* Tower Legend */}
          <div className="mt-3 border-t border-gray-100 pt-2">
            <div className="text-xs text-gray-600 mb-1">Legend:</div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full border-2 border-blue-600"></div>
                <span className="ml-1 text-gray-700">Telstra</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full border-2 border-green-600"></div>
                <span className="ml-1 text-gray-700">Optus</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full border-2 border-red-600"></div>
                <span className="ml-1 text-gray-700">Vodafone</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="ml-1 text-gray-700">5G</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="ml-1 text-gray-700">4G</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="ml-1 text-gray-700">3G</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileTowerAnalysisCard;