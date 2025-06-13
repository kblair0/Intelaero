// src/components/AO/MapSelectionPanel.tsx
/**
 * MapSelectionPanel
 * 
 * Purpose:
 * Provides a sidebar interface for selecting a circular area of operations
 * by either clicking on the map or searching for a location.
 * 
 * This component is designed to be embedded in the right sidebar
 * of the main application and manages map interactions for area creation.
 * 
 * Features:
 * - Map click selection mode with crosshair cursor
 * - Location search with geocoding
 * - Radius adjustment for defining circular areas
 * - Creates standard GeoJSON for the AreaOfOpsContext
 * 
 * Dependencies:
 * - Mapbox GL JS
 * - @turf/turf
 * - AreaOfOpsContext
 * - MapContext
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as turf from "@turf/turf";
import { useMapContext } from "../../context/mapcontext";
import { useAreaOfOpsContext } from "../../context/AreaOfOpsContext";
import { layerManager } from "../../services/LayerManager";
import { trackEventWithForm as trackEvent } from "../tracking/tracking";
import { useChecklistContext } from "../../context/ChecklistContext";
import { 
  Circle, 
  MapPin, 
  Search, 
  CheckCircle, 
  XCircle, 
  RotateCw, 
  ChevronLeft,
  Info
} from "lucide-react";
import { useDraggableMapPoint } from "../../hooks/useDraggableMapPoint";

interface MapSelectionPanelProps {
  mode: "map" | "search";
  onComplete: () => void;
  onCancel: () => void;
}

const MapSelectionPanel: React.FC<MapSelectionPanelProps> = ({ 
  mode, 
  onComplete, 
  onCancel 
}) => {
  // Access context values
  const { map, terrainLoaded } = useMapContext();
  const { setAoGeometry, bufferDistance, setBufferDistance } = useAreaOfOpsContext();
  const { addChecks } = useChecklistContext();
  
  // State for center point and interaction
  const [centerPoint, setCenterPoint] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState<number>(bufferDistance);
  const [status, setStatus] = useState<"idle" | "selecting" | "processing" | "complete" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // State for search functionality
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  
  // References to manage map interactions
  const clickListenerRef = useRef<((e: mapboxgl.MapMouseEvent) => void) | null>(null);
  const circleLayerId = "temp-circle-preview";
  const centerId = "temp-center-point";
  
  /**
   * Shows temporary circle preview on the map (without drag styling)
   */
  const showCirclePreview = useCallback((center: [number, number], radius: number) => {
    if (!map) return;
    
    // Create circle feature
    const circleFeature = turf.circle(center, radius / 1000, {
      units: "kilometers",
      steps: 64
    });
    
    // Create center point feature
    const centerFeature = turf.point(center);
    
    // Handle center point source/layer
    if (map.getSource(centerId)) {
      (map.getSource(centerId) as mapboxgl.GeoJSONSource).setData(centerFeature);
    } else {
      // Add new source and layer
      map.addSource(centerId, {
        type: "geojson",
        data: centerFeature
      });
      
      map.addLayer({
        id: centerId,
        type: "circle",
        source: centerId,
        paint: {
          "circle-radius": 6,
          "circle-color": "#3b82f6",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
    }
    
    // Handle circle source/layer
    if (map.getSource(circleLayerId)) {
      (map.getSource(circleLayerId) as mapboxgl.GeoJSONSource).setData(circleFeature);
    } else {
      // Add new source and layer
      map.addSource(circleLayerId, {
        type: "geojson",
        data: circleFeature
      });
      
      // Add fill layer
      map.addLayer({
        id: circleLayerId,
        type: "fill",
        source: circleLayerId,
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.2
        }
      });
      
      // Add outline layer
      map.addLayer({
        id: `${circleLayerId}-outline`,
        type: "line",
        source: circleLayerId,
        paint: {
          "line-color": "#3b82f6",
          "line-width": 2
        }
      });
    }
  }, [map, centerId, circleLayerId]);

  // Draggable point hook
  const { isDragging, isHovering } = useDraggableMapPoint({
    map,
    centerPoint,
    radius,
    onCenterChange: setCenterPoint,
    onPreviewUpdate: showCirclePreview,
    enabled: centerPoint !== null && status !== "processing" && status !== "complete",
    centerId
  });

  /**
   * Updates drag-specific visual styling
   */
  const updateDragStyling = useCallback(() => {
    if (!map) return;
    
    // Update circle styling based on drag state
    if (map.getLayer(circleLayerId)) {
      map.setPaintProperty(circleLayerId, "fill-opacity", isDragging ? 0.3 : 0.2);
    }
    
    if (map.getLayer(`${circleLayerId}-outline`)) {
      map.setPaintProperty(`${circleLayerId}-outline`, "line-color", isDragging ? "#ef4444" : "#3b82f6");
      map.setPaintProperty(`${circleLayerId}-outline`, "line-width", isDragging ? 3 : 2);
    }
  }, [map, circleLayerId, isDragging]);

  // Effect to update styling when drag state changes
  useEffect(() => {
    updateDragStyling();
  }, [updateDragStyling]);
  
  /**
   * Sets up map click listener for point selection
   */
  const setupMapClickListener = useCallback(() => {
    if (!map || status !== "idle") return;
    
    setStatus("selecting");
    
    // Remove any existing listener
    if (clickListenerRef.current) {
      map.off("click", clickListenerRef.current);
      clickListenerRef.current = null;
    }
    
    // Create new click listener
    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setCenterPoint(coordinates);
      showCirclePreview(coordinates, radius);
      trackEvent("ao_map_point_selected", { coordinates });
      
      // Stop listening for clicks once a point is selected
      map.off("click", handleMapClick);
      map.getCanvas().style.cursor = "";
    };
    
    // Save reference and attach to map
    clickListenerRef.current = handleMapClick;
    map.on("click", handleMapClick);
    
    // Update cursor
    map.getCanvas().style.cursor = "crosshair";
    
    trackEvent("ao_map_selection_started", { mode });
  }, [map, radius, status, mode, showCirclePreview]);
  
  /**
   * Updates circle preview when radius changes
   */
  const updateCirclePreview = useCallback(() => {
    if (centerPoint) {
      showCirclePreview(centerPoint, radius);
    }
  }, [centerPoint, radius, showCirclePreview]);

  /**
   * Cleans up temporary map layers
   */
  const cleanupMapLayers = useCallback(() => {
    if (!map) return;
    
    // Remove layers first, then sources
    if (map.getLayer(`${circleLayerId}-outline`)) {
      map.removeLayer(`${circleLayerId}-outline`);
    }
    
    if (map.getLayer(circleLayerId)) {
      map.removeLayer(circleLayerId);
    }
    
    if (map.getSource(circleLayerId)) {
      map.removeSource(circleLayerId);
    }
    
    if (map.getLayer(centerId)) {
      map.removeLayer(centerId);
    }
    
    if (map.getSource(centerId)) {
      map.removeSource(centerId);
    }
    
    // Reset cursor
    map.getCanvas().style.cursor = '';
  }, [map]);
  
  /**
   * Generates area of operations from the selected circle
   */
  const generateCircleAO = useCallback(async () => {
    if (!centerPoint || !map || !terrainLoaded) return;
    
    setStatus("processing");
    
    try {
      // Create circle feature
      const circleFeature = turf.circle(centerPoint, radius / 1000, {
        units: "kilometers",
        steps: 64
      });
      
      // Create feature collection
      const featureCollection = turf.featureCollection([circleFeature]);
      
      // Clean up temporary layers
      cleanupMapLayers();
      
      // Update AO context
      setAoGeometry(featureCollection);
      setBufferDistance(radius);
      
      // Add to map via layer manager
      layerManager.addAreaOfOperations(featureCollection);
      layerManager.fitToAreaOfOperations(featureCollection);
      
      // Add standard checks
      addChecks(['terrainProfile', 'gcsRepeaterVsTerrain', 'observerVsTerrain']);
      
      // Update state
      setStatus("complete");
      
      // Log event
      trackEvent("ao_circle_created", {
        mode,
        center: centerPoint,
        radius,
        area_sq_km: Math.PI * Math.pow(radius / 1000, 2)
      });
      
      // Notify parent component
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error("Error creating circular AO:", error);
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to create area");
      trackEvent("ao_circle_creation_error", { error: String(error) });
    }
  }, [
    centerPoint, 
    map, 
    terrainLoaded, 
    radius, 
    cleanupMapLayers, 
    setAoGeometry, 
    setBufferDistance,
    addChecks,
    mode,
    onComplete
  ]);
  
  /**
   * Resets selection state
   */
  const resetSelection = useCallback(() => {
    cleanupMapLayers();
    setCenterPoint(null);
    setSelectedLocation(null);
    setSearchResults([]);
    setStatus("idle");
    setErrorMessage(null);
    
    // If in map mode, set up the listener again
    if (mode === "map") {
      setupMapClickListener();
    }
  }, [cleanupMapLayers, mode, setupMapClickListener]);
  
  /**
   * Handles location search
   */
  const handleLocationSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setErrorMessage(null);
    
    try {
      // Using the OpenStreetMap Nominatim API (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        {
          headers: {
            // Add user agent as requested by Nominatim usage policy
            'User-Agent': 'DroneOperationsPlanner/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error("Search request failed");
      }
      
      const data = await response.json();
      setSearchResults(data || []);
      
      trackEvent("ao_location_search", { query: searchQuery });
    } catch (error) {
      console.error("Error searching for location:", error);
      setErrorMessage("Failed to search for location. Please try again.");
      trackEvent("ao_location_search_error", { error: String(error) });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);
  
  /**
   * Handles selecting a location from search results
   */
  const handleSelectLocation = useCallback((location: any) => {
    setSelectedLocation(location);
    
    // Define center point coordinates
    const coordinates: [number, number] = [
      parseFloat(location.lon), 
      parseFloat(location.lat)
    ];
    
    setCenterPoint(coordinates);
    
    // Fly to location
    if (map) {
      map.flyTo({
        center: coordinates,
        zoom: 14,
        essential: true
      });
      
      // Show preview
      showCirclePreview(coordinates, radius);
    }
    
    trackEvent("ao_search_result_selected", { 
      place_name: location.display_name,
      coordinates 
    });
  }, [map, radius, showCirclePreview]);
  
  /**
   * Effect to set up map click listener on initial render
   */
  useEffect(() => {
    if (mode === "map" && status === "idle") {
      setupMapClickListener();
    }
  }, [mode, status, setupMapClickListener]);
  
  /**
   * Effect to update circle preview when radius changes
   */
  useEffect(() => {
    updateCirclePreview();
  }, [radius, updateCirclePreview]);
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      cleanupMapLayers();
      
      // Remove click listener if it exists
      if (map && clickListenerRef.current) {
        map.off("click", clickListenerRef.current);
        map.getCanvas().style.cursor = "";
      }
    };
  }, [map, cleanupMapLayers]);
  
  /**
   * Renders map selection content
   */
  const renderMapSelectionContent = () => (
    <div className="space-y-3">
      {status === "idle" || status === "selecting" ? (
        <div className="p-2 bg-blue-50 border border-blue-100 rounded-md">
          <div className="flex items-start">
            <MapPin className="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              {status === "selecting" 
                ? "Click anywhere on the map to set center point" 
                : "Click to start selecting a point on the map"}
            </p>
          </div>
          
          {status === "idle" && (
            <button
              onClick={setupMapClickListener}
              className="mt-2 w-full flex items-center justify-center gap-1 bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition-colors"
            >
              <MapPin className="w-3 h-3" />
              Start Selection
            </button>
          )}
          
          {status === "selecting" && (
            <div className="flex items-center mt-2">
              <RotateCw className="w-3 h-3 text-blue-500 animate-spin mr-1" />
              <span className="text-xs text-blue-600">Waiting for click...</span>
            </div>
          )}
        </div>
      ) : null}
      
      {/* Point selected, adjust radius - COMPACT */}
      {centerPoint && status !== "processing" && status !== "complete" && (
        <div className="space-y-2">
          <div className={`p-2 border rounded-md ${
            isDragging 
              ? 'bg-blue-50 border-blue-200' 
              : isHovering
                ? 'bg-blue-50 border-blue-100'
                : 'bg-green-50 border-green-100'
          }`}>
            <div className="flex items-start">
              <CheckCircle className={`w-4 h-4 mt-0.5 mr-2 flex-shrink-0 ${
                isDragging 
                  ? 'text-blue-500' 
                  : isHovering
                    ? 'text-blue-500'
                    : 'text-green-500'
              }`} />
              <div>
                <p className={`text-xs font-medium ${
                  isDragging 
                    ? 'text-blue-800' 
                    : isHovering
                      ? 'text-blue-800'
                      : 'text-green-800'
                }`}>
                  {isDragging ? 'Dragging point...' : isHovering ? 'Point selected (draggable)' : 'Point selected'}
                </p>
                <p className={`text-xs ${
                  isDragging 
                    ? 'text-blue-700' 
                    : isHovering
                      ? 'text-blue-700'
                      : 'text-green-700'
                }`}>
                  {centerPoint[0].toFixed(4)}, {centerPoint[1].toFixed(4)}
                </p>
                {isHovering && !isDragging && (
                  <p className="text-xs text-blue-600 mt-1">Click and drag to move</p>
                )}
              </div>
            </div>
          </div>

          {/* Compact Radius adjustment */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="radius-slider" className="text-xs font-medium text-gray-700">
                Radius: {radius}m
              </label>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Circle className="w-3 h-3 text-blue-500" />
                <span>{(Math.PI * Math.pow(radius / 1000, 2)).toFixed(1)}km²</span>
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
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>100m</span>
              <span>2.5km</span>
              <span>5km</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Compact Processing state */}
      {status === "processing" && (
        <div className="p-2 bg-blue-50 border border-blue-100 rounded-md flex items-center">
          <RotateCw className="w-4 h-4 text-blue-500 animate-spin mr-2" />
          <span className="text-xs text-blue-700">Creating area...</span>
        </div>
      )}
      
      {/* Compact Completion state */}
      {status === "complete" && (
        <div className="p-2 bg-green-50 border border-green-100 rounded-md flex items-center">
          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
          <span className="text-xs text-green-700">Area created!</span>
        </div>
      )}
      
      {/* Compact Error state */}
      {status === "error" && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-md">
          <div className="flex items-center">
            <XCircle className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-xs text-red-700">Error creating area</span>
          </div>
          {errorMessage && (
            <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          )}
        </div>
      )}
      
      {/* Compact Action buttons */}
      {status !== "complete" && (
        <div className="flex justify-between gap-2">
          <button
            onClick={onCancel}
            className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors text-xs flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Cancel
          </button>
          
          {centerPoint && status !== "processing" && (
            <div className="flex gap-1">
              <button
                onClick={resetSelection}
                className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors text-xs"
              >
                Reset
              </button>
              <button
                onClick={generateCircleAO}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
              >
                <Circle className="w-3 h-3" />
                Create
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  /**
   * Renders location search content
   */
  const renderSearchContent = () => (
    <div className="space-y-3">
      {/* Compact Search input */}
      <div>
        <label htmlFor="location-search" className="block text-xs font-medium text-gray-700 mb-1">
          Search Location
        </label>
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <input
              id="location-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter location..."
              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLocationSearch();
                }
              }}
            />
            {isSearching && (
              <div className="absolute right-2 top-1.5">
                <RotateCw className="w-3 h-3 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={handleLocationSearch}
            disabled={isSearching || !searchQuery.trim()}
            className={`px-2 py-1 rounded text-white flex items-center gap-1 transition-colors text-xs ${
              isSearching || !searchQuery.trim()
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <Search className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Compact Search results - LIMITED HEIGHT */}
      {searchResults.length > 0 && !centerPoint && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="bg-gray-50 px-2 py-1 border-b border-gray-200">
            <h4 className="text-xs font-medium text-gray-700">Results</h4>
          </div>
          <div className="overflow-y-auto max-h-24"> {/* LIMITED HEIGHT */}
            {searchResults.slice(0, 3).map((result, index) => ( /* LIMIT TO 3 RESULTS */
              <button
                key={result.place_id || index}
                className="w-full px-2 py-1 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                onClick={() => handleSelectLocation(result)}
              >
                <div className="flex items-start">
                  <MapPin className="w-3 h-3 text-gray-500 mt-0.5 mr-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {result.name || result.display_name.split(',')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{result.display_name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected location and compact radius adjustment */}
      {centerPoint && status !== "processing" && status !== "complete" && (
        <div className="space-y-2">
          <div className={`p-2 border rounded-md ${
            isDragging 
              ? 'bg-blue-50 border-blue-200' 
              : isHovering
                ? 'bg-blue-50 border-blue-100'
                : 'bg-green-50 border-green-100'
          }`}>
            <div className="flex items-start">
              <CheckCircle className={`w-4 h-4 mt-0.5 mr-2 flex-shrink-0 ${
                isDragging 
                  ? 'text-blue-500' 
                  : isHovering
                    ? 'text-blue-500'
                    : 'text-green-500'
              }`} />
              <div className="min-w-0">
                <p className={`text-xs font-medium ${
                  isDragging 
                    ? 'text-blue-800' 
                    : isHovering
                      ? 'text-blue-800'
                      : 'text-green-800'
                }`}>
                  {isDragging ? 'Dragging point...' : isHovering ? 'Location selected (draggable)' : 'Location selected'}
                </p>
                <p className={`text-xs ${
                  isDragging 
                    ? 'text-blue-700' 
                    : isHovering
                      ? 'text-blue-700'
                      : 'text-green-700'
                }`}>
                  {centerPoint[0].toFixed(4)}, {centerPoint[1].toFixed(4)}
                </p>
                {isHovering && !isDragging && (
                  <p className="text-xs text-blue-600 mt-1">Click and drag to move</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Compact Radius adjustment */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label htmlFor="search-radius-slider" className="text-xs font-medium text-gray-700">
                Radius: {radius}m
              </label>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Circle className="w-3 h-3 text-blue-500" />
                <span>{(Math.PI * Math.pow(radius / 1000, 2)).toFixed(1)}km²</span>
              </div>
            </div>
            <input
              id="search-radius-slider"
              type="range"
              min="100"
              max="5000"
              step="100"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>100m</span>
              <span>2.5km</span>
              <span>5km</span>
            </div>
          </div>
        </div>
      )}
      
      {/* No results message - COMPACT */}
      {searchResults.length === 0 && searchQuery.trim() !== "" && !isSearching && !centerPoint && !errorMessage && (
        <div className="p-2 bg-gray-50 border border-gray-200 rounded">
          <p className="text-xs text-gray-600">No locations found.</p>
        </div>
      )}
      
      {/* Compact Processing state */}
      {status === "processing" && (
        <div className="p-2 bg-blue-50 border border-blue-100 rounded-md flex items-center">
          <RotateCw className="w-4 h-4 text-blue-500 animate-spin mr-2" />
          <span className="text-xs text-blue-700">Creating area...</span>
        </div>
      )}
      
      {/* Compact Completion state */}
      {status === "complete" && (
        <div className="p-2 bg-green-50 border border-green-100 rounded-md flex items-center">
          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
          <span className="text-xs text-green-700">Area created!</span>
        </div>
      )}
      
      {/* Compact Error message */}
      {errorMessage && status !== "error" && (
        <div className="p-2 bg-red-50 border border-red-100 rounded">
          <p className="text-xs text-red-600">{errorMessage}</p>
        </div>
      )}
      
      {/* Compact Error state */}
      {status === "error" && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-md">
          <div className="flex items-center">
            <XCircle className="w-4 h-4 text-red-500 mr-2" />
            <span className="text-xs text-red-700">Error creating area</span>
          </div>
          {errorMessage && (
            <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
          )}
        </div>
      )}
      
      {/* Compact Action buttons */}
      {status !== "complete" && (
        <div className="flex justify-between gap-2">
          <button
            onClick={onCancel}
            className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors text-xs flex items-center gap-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Cancel
          </button>
          
          {centerPoint && status !== "processing" && (
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setCenterPoint(null);
                  setSelectedLocation(null);
                  cleanupMapLayers();
                }}
                className="px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors text-xs"
              >
                Reset
              </button>
              <button
                onClick={generateCircleAO}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
              >
                <Circle className="w-3 h-3" />
                Create
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
  
  return (
    <div className="p-1">
      {mode === "map" ? renderMapSelectionContent() : renderSearchContent()}
    </div>
  );
};

export default MapSelectionPanel;