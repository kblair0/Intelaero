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
          layout: { visibility: "none" },
          paint: { 
            "line-color": "#f00",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              11, 1,
              14, 2
            ]
          },
          minzoom: 10
        });
      }

      if (!map.getLayer("Electricity Transmission Lines Hitbox")) {
        map.addLayer({
          id: "Electricity Transmission Lines Hitbox",
          type: "line",
          source: "electricity-lines",
          "source-layer": powerSourceLayerName,
          layout: { visibility: "none" },
          paint: { "line-width": 20, "line-color": "rgba(0,0,0,0)" },
          minzoom: 10
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
      const handleMapMouseMove = (e: mapboxgl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { 
          layers: ["Electricity Transmission Lines Hitbox"] 
        });

        if (features.length === 0 && currentFeatureRef.current !== null) {
          handlePowerlineMouseLeave();
        }
      };

      // Bind powerline event handlers
      map.on("mouseenter", "Electricity Transmission Lines Hitbox", handlePowerlineMouseEnter);
      map.on("mouseleave", "Electricity Transmission Lines Hitbox", handlePowerlineMouseLeave);
      map.on("mousemove", handleMapMouseMove);

      // Store in ref for cleanup
      eventHandlersRef.current = {
        onPowerlineMouseEnter: handlePowerlineMouseEnter,
        onPowerlineMouseLeave: handlePowerlineMouseLeave,
        onMapMouseMove: handleMapMouseMove
      };

      // ----------- Airfields Layer Setup -----------
      if (!map.getSource("airfields")) {
        map.addSource("airfields", {
          type: "vector",
          url: "mapbox://intelaero.5d451fq2"
        });
      }
      
      if (!map.getLayer("Airfields")) {
        map.addLayer({
          id: "Airfields",
          type: "fill",
          layout: { visibility: "none" },
          source: "airfields",
          "source-layer": "July2024Airservices-7op6cm",
          paint: {
            "fill-color": "#ff7f50",
            "fill-opacity": 0.2,
            "fill-outline-color": "#FFF"
          },
          minzoom: 10
        });
      }
      
      if (!map.getLayer("Airfields Labels")) {
        map.addLayer({
          id: "Airfields Labels",
          type: "symbol",
          source: "airfields",
          "source-layer": "July2024Airservices-7op6cm",
          layout: {
            "visibility": "none",
            "text-field": ["get", "title"],
            "symbol-placement": "line",
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-offset": [0, 0],
            "text-anchor": "center"
          },
          paint: {
            "text-color": "#FFF"
          },
          minzoom: 12
        });
      }
      
    });

    // Cleanup function
    return () => {
      if (!map) return;

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
