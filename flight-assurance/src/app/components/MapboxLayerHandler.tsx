"use client";

import { useEffect, useRef } from "react";
// We still import type definitions but not the actual library
import type mapboxgl from "mapbox-gl";

interface MapboxLayerHandlerProps {
  map: mapboxgl.Map | null;
}

// Type that extends mapboxgl.Map for popups
type ExtendedMapboxMap = mapboxgl.Map & {
  __currentPopup?: mapboxgl.Popup | null;
  __airfieldsPopup?: mapboxgl.Popup | null;
};

const getHeightForVoltage = (voltageValue: string): string => {
  const voltage = voltageValue.trim();
  switch (voltage) {
    case "415": return "7 m";
    case "11": return "9 m";
    case "33": return "20 m";
    case "66": return "20 m";
    case "110": return "45 m";
    case "132": return "45 m";
    case "220": return "45 m";
    case "275": return "55 m";
    case "330": return "65 m";
    case "500": return "76 m";
    default: return "N/A";
  }
};

const MapboxLayerHandler: React.FC<MapboxLayerHandlerProps> = ({ map }) => {
  // Use refs to track event handlers for cleanup
  const eventHandlersRef = useRef<{
    onPowerlineMouseEnter?: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => void;
    onPowerlineMouseLeave?: () => void;
    onMapMouseMove?: (e: mapboxgl.MapMouseEvent) => void;
  }>({});
  
  // Track the current feature being hovered
  const currentFeatureRef = useRef<mapboxgl.MapboxGeoJSONFeature | null>(null);
  
  useEffect(() => {
    if (!map) return;
    
    // We're in a useEffect, so we're guaranteed to be on the client
    // Safe to dynamically import mapbox-gl
    import('mapbox-gl').then((mapboxModule) => {
      const mapboxgl = mapboxModule.default;
      const extMap = map as ExtendedMapboxMap;
      
      // ----------- Powerlines Layer Setup -----------
      const powerSourceLayerName = "Electricity_Transmission_Line-08vle5";

      if (!map.getSource("electricity-lines")) {
        map.addSource("electricity-lines", {
          type: "vector",
          url: "mapbox://intelaero.a8qtcidy"
        });
      }

      if (!map.getLayer("Electricity Transmission Lines")) {
        map.addLayer({
          id: "Electricity Transmission Lines",
          type: "line",
          source: "electricity-lines",
          "source-layer": powerSourceLayerName,
          layout: { visibility: "visible" },
          paint: { "line-width": 2, "line-color": "#f00" }
        });
      }

      if (!map.getLayer("Electricity Transmission Lines Hitbox")) {
        map.addLayer({
          id: "Electricity Transmission Lines Hitbox",
          type: "line",
          source: "electricity-lines",
          "source-layer": powerSourceLayerName,
          layout: { visibility: "visible" },
          paint: { "line-width": 20, "line-color": "rgba(0,0,0,0)" }
        });
      }

      // Handle mouse enter on powerline
      const handlePowerlineMouseEnter = (
        e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
      ) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features && e.features[0];
        if (!feature) return;
        
        // Store current feature for reference
        currentFeatureRef.current = feature;

        const voltage = feature.properties?.CAPACITY_KV || "unknown";
        const height = voltage !== "unknown" ? getHeightForVoltage(String(voltage)) : "N/A";

        const popupContent = `
          <strong>Powerline</strong><br/>
          <strong>Voltage (kV):</strong> ${voltage}<br/>
          <strong>Height:</strong> ${height}
        `;

        // Remove any existing popup first
        if (extMap.__currentPopup) {
          extMap.__currentPopup.remove();
        }

        const popup = new mapboxgl.Popup({ 
          closeButton: false, 
          closeOnClick: false,
          maxWidth: "300px"
        })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map);

        extMap.__currentPopup = popup;
      };

      // Handle mouse leave on powerline
      const handlePowerlineMouseLeave = () => {
        map.getCanvas().style.cursor = "";
        currentFeatureRef.current = null;
        
        if (extMap.__currentPopup) {
          extMap.__currentPopup.remove();
          extMap.__currentPopup = null;
        }
      };

      // Additional safety: track mouse movement across entire map
      // This ensures popup cleanup even if mouseleave events are missed
      const handleMapMouseMove = (e: mapboxgl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { 
          layers: ["Electricity Transmission Lines Hitbox"] 
        });
        
        // If we're not over a powerline but we have a currentFeature
        // the mouse has left the powerline without triggering the mouseleave event
        if (features.length === 0 && currentFeatureRef.current !== null) {
          handlePowerlineMouseLeave();
        }
      };

      // Bind handlers
      map.on("mouseenter", "Electricity Transmission Lines Hitbox", handlePowerlineMouseEnter);
      map.on("mouseleave", "Electricity Transmission Lines Hitbox", handlePowerlineMouseLeave);
      map.on("mousemove", handleMapMouseMove);

      // Store in ref for cleanup (single source of truth)
      eventHandlersRef.current = {
        onPowerlineMouseEnter: handlePowerlineMouseEnter,
        onPowerlineMouseLeave: handlePowerlineMouseLeave,
        onMapMouseMove: handleMapMouseMove
      };

      // ----------- Airfields Layer Setup -----------
      if (!map.getSource("airfields")) {
        map.addSource("airfields", {
          type: "vector",
          url: "mapbox://intelaero.6qpae87g"
        });
        console.log("Airfields source added");
      }

      if (!map.getLayer("Airfields")) {
        map.addLayer({
          id: "Airfields",
          type: "circle",
          source: "airfields",
          "source-layer": "hotosm_aus_airports_points_ge-21mapu",
          paint: {
            "circle-radius": 4,
            "circle-color": "#ff0",
            "circle-opacity": 1
          },
          filter: [
            "in",
            ["get", "aeroway"],
            ["literal", ["aerodrome", "terminal", "helipad"]]
          ]
        });
        console.log("Airfields layer added");
      }

      const onAirfieldMouseEnter = (
        e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
      ) => {
        const feature = e.features && e.features[0];
        if (!feature) return;

        map.getCanvas().style.cursor = "pointer"; // Change cursor to pointer

        const name = feature.properties?.name || "Unnamed"; // Fallback if no name
        const aeroway = feature.properties?.aeroway || "Unknown"; // Fallback if missing
        const aerowayFormatted = aeroway.charAt(0).toUpperCase() + aeroway.slice(1); // Capitalize
        const coordinates = e.lngLat;

        const popupContent = `
          <div style="padding: 2px; font-family: Arial, sans-serif;">
            <h3 style="margin: 0 0 2px 0; font-size: 14px;">${name}</h3>
            <p style="margin: 0; font-size: 14px;"><strong>Type:</strong> ${aerowayFormatted}</p>
          </div>
        `;

        // Remove any existing popup first
        if (extMap.__airfieldsPopup) {
          extMap.__airfieldsPopup.remove();
        }

        const popup = new mapboxgl.Popup({
          closeButton: false, // No close button for hover
          closeOnClick: false // Don't close on map click
        })
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(map);

        extMap.__airfieldsPopup = popup;
      };

      const onAirfieldMouseLeave = () => {
        map.getCanvas().style.cursor = ""; // Reset cursor
        if (extMap.__airfieldsPopup) {
          extMap.__airfieldsPopup.remove();
          extMap.__airfieldsPopup = null;
        }
      };

      map.on("mouseenter", "Airfields", onAirfieldMouseEnter);
      map.on("mouseleave", "Airfields", onAirfieldMouseLeave);

      // Debug source loading and features
      const onSourceData = (e: { sourceId: string }) => {
        if (e.sourceId === "airfields") {
          console.log("Source data event for airfields, isLoaded:", map.isSourceLoaded("airfields"));
          if (map.isSourceLoaded("airfields")) {
            const features = map.querySourceFeatures("airfields", {
              sourceLayer: "hotosm_aus_airports_points_ge-21mapu"
            });
            console.log("Total features loaded:", features.length);
            if (features.length > 0) {
              // Log detailed information for the first 5 features
              features.slice(0, 5).forEach((feature, index) => {
                console.log(`Feature ${index + 1} properties:`, feature.properties);
                console.log(`   Name: ${feature.properties?.name || "No name"}`);
                console.log(`   Aeroway: ${feature.properties?.aeroway || "Not specified"}`);
              });
              
              // Extract and log unique values for 'aeroway' and 'name'
              const aerowayValues = features
                .map(f => f.properties?.aeroway)
                .filter(Boolean);
              console.log("Unique aeroway values:", [...new Set(aerowayValues)]);
              
              const names = features
                .map(f => f.properties?.name)
                .filter(Boolean);
              console.log("Unique aerodrome names:", [...new Set(names)]);
            } else {
              console.log("No features found in hotosm_aus_airports_points_ge-21mapu");
              console.log("Current bounds:", map.getBounds().toArray());
            }  
          }
        }
      };

      map.on("sourcedata", onSourceData);

      // Log initial map state
      console.log("Initial map center:", map.getCenter(), "Zoom:", map.getZoom());
    }).catch(error => {
      console.error("Error loading mapbox-gl:", error);
    });

    // Cleanup function
    return () => {
      if (!map) return;
      
      // Clean up event listeners using the ref
      if (eventHandlersRef.current.onPowerlineMouseEnter) {
        map.off(
          "mouseenter", 
          "Electricity Transmission Lines Hitbox", 
          eventHandlersRef.current.onPowerlineMouseEnter
        );
      }
      
      if (eventHandlersRef.current.onPowerlineMouseLeave) {
        map.off(
          "mouseleave", 
          "Electricity Transmission Lines Hitbox", 
          eventHandlersRef.current.onPowerlineMouseLeave
        );
      }
      
      if (eventHandlersRef.current.onMapMouseMove) {
        map.off("mousemove", eventHandlersRef.current.onMapMouseMove);
      }
      
      map.off("mouseenter", "Airfields");
      map.off("mouseleave", "Airfields");
      map.off("sourcedata");
      map.off("click", "Airfields");
      
      // Handle popups
      const extMap = map as ExtendedMapboxMap;
      if (extMap.__airfieldsPopup) {
        extMap.__airfieldsPopup.remove();
        extMap.__airfieldsPopup = null;
      }
      
      if (extMap.__currentPopup) {
        extMap.__currentPopup.remove();
        extMap.__currentPopup = null;
      }
    };
  }, [map]);

  return null;
};

export default MapboxLayerHandler;