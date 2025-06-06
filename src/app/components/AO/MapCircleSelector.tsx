// src/components/AO/MapCircleSelector.tsx
/**
 * MapCircleSelector
 * 
 * This component allows users to click on a map and define a circular Area of Operations.
 * It integrates with Mapbox GL JS and your existing AreaOfOpsContext to:
 * 1. Handle map click events to set the center point
 * 2. Provide UI for adjusting the radius 
 * 3. Generate proper GeoJSON for the circle
 * 4. Integrate with existing layer management system
 * 
 * Dependencies:
 * - Mapbox GL JS
 * - @turf/turf for spatial operations
 * - AreaOfOpsContext for saving the generated AO
 * - LayerManager service for visualizing the AO
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import * as turf from "@turf/turf";
import { useMapContext } from "../../context/mapcontext";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import { layerManager } from "../../services/LayerManager";
import { trackEventWithForm as trackEvent } from "../../components/tracking/tracking";
import { MapPin, Circle, CheckCircle, RotateCw, X } from "lucide-react";

interface MapCircleSelectorProps {
  onComplete?: (featureCollection: GeoJSON.FeatureCollection) => void;
  onCancel?: () => void;
}

const MapCircleSelector: React.FC<MapCircleSelectorProps> = ({ 
  onComplete,
  onCancel 
}) => {
  // Access map context and AO context
  const { map, terrainLoaded } = useMapContext();
  const { setAoGeometry, bufferDistance, setBufferDistance } = useAreaOfOpsContext();
  
  // State for the center point and interaction states
  const [center, setCenter] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState<number>(bufferDistance);
  const [isSelecting, setIsSelecting] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // References to manage event listeners
  const clickListenerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  const circleLayerId = "temp-circle-layer";
  const centerLayerId = "temp-center-layer";
  
  // Add click listener to map
  const setupMapClickListener = useCallback(() => {
    if (!map || !isSelecting) return;
    
    // Remove any existing listener
    if (clickListenerRef.current) {
      map.off("click", clickListenerRef.current);
      clickListenerRef.current = null;
    }
    
    // Create new click listener
    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setCenter(coordinates);
      trackEvent("ao_map_point_selected", { coordinates });
    };
    
    // Save reference and attach to map
    clickListenerRef.current = handleMapClick;
    map.on("click", handleMapClick);
    
    // Update cursor
    map.getCanvas().style.cursor = "crosshair";
    
    return () => {
      if (map && clickListenerRef.current) {
        map.off("click", clickListenerRef.current);
        map.getCanvas().style.cursor = "";
      }
    };
  }, [map, isSelecting]);
  
  // Clean up map listeners when component unmounts
  useEffect(() => {
    setupMapClickListener();
    
    return () => {
      if (map && clickListenerRef.current) {
        map.off("click", clickListenerRef.current);
        map.getCanvas().style.cursor = "";
        
        // Clean up temporary layers
        if (map.getLayer(circleLayerId)) {
          map.removeLayer(circleLayerId);
        }
        if (map.getSource(circleLayerId)) {
          map.removeSource(circleLayerId);
        }
        if (map.getLayer(centerLayerId)) {
          map.removeLayer(centerLayerId);
        }
        if (map.getSource(centerLayerId)) {
          map.removeSource(centerLayerId);
        }
      }
    };
  }, [map, setupMapClickListener]);
  
  // Update radius state when context buffer distance changes
  useEffect(() => {
    setRadius(bufferDistance);
  }, [bufferDistance]);
  
  // Update the circle visualization when center or radius changes
  useEffect(() => {
    if (!map || !center) return;
    
    // Create circle feature using turf.js
    const circleFeature = turf.circle(center, radius / 1000, {
      units: "kilometers",
      steps: 64, // Higher step count for smoother circles
    });
    
    // Create center point feature
    const centerFeature = turf.point(center);
    
    // Add or update source and layer for center point
    if (map.getSource(centerLayerId)) {
      (map.getSource(centerLayerId) as mapboxgl.GeoJSONSource).setData(centerFeature);
    } else {
      // Create new source and layer for center
      map.addSource(centerLayerId, {
        type: "geojson",
        data: centerFeature,
      });
      
      map.addLayer({
        id: centerLayerId,
        type: "circle",
        source: centerLayerId,
        paint: {
          "circle-radius": 6,
          "circle-color": "#3b82f6", // Blue color
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
    
    // Add or update source and layer for circle
    if (map.getSource(circleLayerId)) {
      (map.getSource(circleLayerId) as mapboxgl.GeoJSONSource).setData(circleFeature);
    } else {
      // Create new source and layer for circle
      map.addSource(circleLayerId, {
        type: "geojson",
        data: circleFeature,
      });
      
      map.addLayer({
        id: circleLayerId,
        type: "fill",
        source: circleLayerId,
        paint: {
          "fill-color": "#3b82f6", // Blue color
          "fill-opacity": 0.2,
        },
      });
      
      // Add outline layer
      map.addLayer({
        id: `${circleLayerId}-outline`,
        type: "line",
        source: circleLayerId,
        paint: {
          "line-color": "#3b82f6",
          "line-width": 2,
        },
      });
    }
    
  }, [map, center, radius]);
  
  // Handle search for locations (using Mapbox Geocoding API)
  const handleSearch = async () => {
    if (!searchText || searchText.trim() === "") return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      // Using Mapbox Geocoding API
      // Note: In a production app, you should proxy this through your backend
      // to avoid exposing your Mapbox token
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchText)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=5`
      );
      
      if (!response.ok) {
        throw new Error("Search request failed");
      }
      
      const data = await response.json();
      setSearchResults(data.features || []);
      trackEvent("ao_location_searched", { query: searchText });
    } catch (error) {
      console.error("Error searching for location:", error);
      trackEvent("ao_location_search_error", { error: String(error) });
    } finally {
      setIsSearching(false);
    }
  };
  
  // Handle selection of a search result
  const handleSelectSearchResult = (result: any) => {
    if (!map || !result.center) return;
    
    const coordinates: [number, number] = [result.center[0], result.center[1]];
    setCenter(coordinates);
    setSearchResults([]);
    
    // Fly to the selected location
    map.flyTo({
      center: coordinates,
      zoom: 14,
      essential: true,
    });
    
    trackEvent("ao_search_result_selected", { 
      place_name: result.place_name,
      coordinates 
    });
  };
  
  // Generate AO from the circle
  const generateAOFromCircle = useCallback(() => {
    if (!center || !map || !terrainLoaded) return;
    
    setIsProcessing(true);
    
    try {
      // Create circle feature with turf.js
      const circleFeature = turf.circle(center, radius / 1000, {
        units: "kilometers",
        steps: 64, // Higher step count for smoother circles
      });
      
      // Create feature collection for the AO
      const featureCollection = turf.featureCollection([circleFeature]);
      
      // Clean up temporary visualization layers
      if (map.getLayer(`${circleLayerId}-outline`)) {
        map.removeLayer(`${circleLayerId}-outline`);
      }
      if (map.getLayer(circleLayerId)) {
        map.removeLayer(circleLayerId);
      }
      if (map.getSource(circleLayerId)) {
        map.removeSource(circleLayerId);
      }
      if (map.getLayer(centerLayerId)) {
        map.removeLayer(centerLayerId);
      }
      if (map.getSource(centerLayerId)) {
        map.removeSource(centerLayerId);
      }
      
      // Update context with the new AO
      setAoGeometry(featureCollection);
      
      // Add and display the AO using layer manager
      layerManager.addAreaOfOperations(featureCollection);
      layerManager.fitToAreaOfOperations(featureCollection);
      
      // Save buffer distance for future use
      setBufferDistance(radius);
      
      // Call completion callback if provided
      if (onComplete) {
        onComplete(featureCollection);
      }
      
      trackEvent("ao_circle_created", { 
        center, 
        radius,
        area_sq_km: Math.PI * Math.pow(radius / 1000, 2)
      });
      
    } catch (error) {
      console.error("Error generating circle AO:", error);
      trackEvent("ao_circle_creation_error", { error: String(error) });
    } finally {
      setIsProcessing(false);
      setIsSelecting(false);
    }
  }, [center, map, terrainLoaded, radius, setAoGeometry, setBufferDistance, onComplete]);
  
  // Handle cancellation
  const handleCancel = () => {
    // Clean up temporary layers
    if (map) {
      if (map.getLayer(`${circleLayerId}-outline`)) {
        map.removeLayer(`${circleLayerId}-outline`);
      }
      if (map.getLayer(circleLayerId)) {
        map.removeLayer(circleLayerId);
      }
      if (map.getSource(circleLayerId)) {
        map.removeSource(circleLayerId);
      }
      if (map.getLayer(centerLayerId)) {
        map.removeLayer(centerLayerId);
      }
      if (map.getSource(centerLayerId)) {
        map.removeSource(centerLayerId);
      }
      
      // Reset cursor
      map.getCanvas().style.cursor = "";
    }
    
    // Reset state
    setCenter(null);
    setSearchResults([]);
    setSearchText("");
    
    // Call cancel callback if provided
    if (onCancel) {
      onCancel();
    }
    
    trackEvent("ao_circle_creation_cancelled", {});
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-md">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Define Circular Area</h3>
        <p className="text-sm text-gray-600">
          Select a center point by clicking on the map or searching for a location, then adjust the radius.
        </p>
      </div>
      
      {/* Search box */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search for a location..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <RotateCw className="w-4 h-4 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            disabled={isSearching}
          >
            Search
          </button>
        </div>
        
        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-md shadow-md max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={`${result.id || index}`}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                onClick={() => handleSelectSearchResult(result)}
              >
                <div className="flex items-start">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{result.text}</p>
                    <p className="text-xs text-gray-500">{result.place_name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Instructions or current status */}
      {!center ? (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md mb-4">
          <div className="flex items-start">
            <MapPin className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              Click anywhere on the map to set the center point of your operational area
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-green-50 border border-green-100 rounded-md mb-4">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="text-sm text-green-800">
                Center point selected at {center[0].toFixed(6)}, {center[1].toFixed(6)}
              </p>
              <p className="text-xs text-green-700 mt-1">
                Adjust the radius below or click a different location on the map
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Radius adjustment */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="radius-slider" className="text-sm font-medium text-gray-700">
            Radius: {radius} meters
          </label>
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">
              Area: {(Math.PI * Math.pow(radius / 1000, 2)).toFixed(2)} km²
            </span>
          </div>
        </div>
        <input
          id="radius-slider"
          type="range"
          min="100"
          max="5000"
          step="100"
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>100m</span>
          <span>1km</span>
          <span>2.5km</span>
          <span>5km</span>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-between">
        <button
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={generateAOFromCircle}
          disabled={!center || isProcessing}
          className={`px-4 py-2 rounded-md text-white flex items-center gap-2 ${
            !center || isProcessing
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          } transition-colors`}
        >
          {isProcessing ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Create Area
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MapCircleSelector;