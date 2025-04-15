"use client";

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import { useMapContext } from "../../context/MapContext";
// Import layerManager directly from services if needed for registration purposes:
import { layerManager } from "../../services/LayerManager";

interface MapboxLayerHandlerProps {
  map: mapboxgl.Map | null;
}

// Extend mapboxgl.Map type for popup tracking
type ExtendedMapboxMap = mapboxgl.Map & {
  __currentPopup?: mapboxgl.Popup | null;
  __airfieldsPopup?: mapboxgl.Popup | null;
};

// Utility to determine height based on voltage
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
  // Even though your context doesn’t expose the layerManager,
  // you are importing it directly from your services so you can register layers.
  const { /* no layerManager here */ } = useMapContext();
  const eventHandlersRef = useRef<{
    onPowerlineMouseEnter?: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => void;
    onPowerlineMouseLeave?: () => void;
    onMapMouseMove?: (e: mapboxgl.MapMouseEvent) => void;
  }>({});
  const currentFeatureRef = useRef<mapboxgl.MapboxGeoJSONFeature | null>(null);

  useEffect(() => {
    if (!map) return;

    // Dynamically import mapbox-gl on the client side
    import("mapbox-gl").then((mapboxModule) => {
      const mapboxgl = mapboxModule.default;
      const extMap = map as ExtendedMapboxMap;

      // **Powerlines Layer Setup**
      const powerSourceLayerName = "Electricity_Transmission_Line-08vle5";

      // Add vector source for electricity lines if it doesn’t exist, with extra logging
      if (!map.getSource("electricity-lines")) {
        map.addSource("electricity-lines", {
          type: "vector",
          url: "mapbox://intelaero.a8qtcidy",
        });
        console.log("[MapboxLayerHandler] Added source 'electricity-lines'.");
      } else {
        console.log("[MapboxLayerHandler] Source 'electricity-lines' already exists.");
      }

      // Add powerlines layer and register with layerManager
      if (!map.getLayer("Electricity Transmission Lines")) {
        map.addLayer({
          id: "Electricity Transmission Lines",
          type: "line",
          source: "electricity-lines",
          "source-layer": powerSourceLayerName,
          layout: { visibility: "none" },
          paint: {
            "line-color": "#f00",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 2],
          },
          minzoom: 10,
        });
        console.log("[MapboxLayerHandler] Added layer 'Electricity Transmission Lines'.");
        layerManager.registerLayer("Electricity Transmission Lines");
      } else {
        console.log("[MapboxLayerHandler] Layer 'Electricity Transmission Lines' already exists.");
      }

      // Add powerlines hitbox layer and register with layerManager
      if (!map.getLayer("Electricity Transmission Lines Hitbox")) {
        map.addLayer({
          id: "Electricity Transmission Lines Hitbox",
          type: "line",
          source: "electricity-lines",
          "source-layer": powerSourceLayerName,
          layout: { visibility: "none" },
          paint: { "line-width": 20, "line-color": "rgba(0,0,0,0)" },
          minzoom: 10,
        });
        console.log("[MapboxLayerHandler] Added layer 'Electricity Transmission Lines Hitbox'.");
        layerManager.registerLayer("Electricity Transmission Lines Hitbox");
      } else {
        console.log("[MapboxLayerHandler] Layer 'Electricity Transmission Lines Hitbox' already exists.");
      }

      // **Interactivity for Powerlines**
      const handlePowerlineMouseEnter = (
        e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
      ) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features && e.features[0];
        if (!feature) return;

        currentFeatureRef.current = feature;
        const voltage = feature.properties?.CAPACITY_KV || "unknown";
        const height = voltage !== "unknown" ? getHeightForVoltage(String(voltage)) : "N/A";

        const popupContent = `
          <strong>Powerline</strong><br/>
          <strong>Voltage (kV):</strong> ${voltage}<br/>
          <strong>Height:</strong> ${height}
        `;

        if (extMap.__currentPopup) extMap.__currentPopup.remove();

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "300px",
        })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map);

        extMap.__currentPopup = popup;
        console.log("[MapboxLayerHandler] Displayed popup for powerline.");
      };

      const handlePowerlineMouseLeave = () => {
        map.getCanvas().style.cursor = "";
        currentFeatureRef.current = null;
        if (extMap.__currentPopup) {
          extMap.__currentPopup.remove();
          extMap.__currentPopup = null;
          console.log("[MapboxLayerHandler] Removed powerline popup on mouse leave.");
        }
      };

      const handleMapMouseMove = (e: mapboxgl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["Electricity Transmission Lines Hitbox"],
        });
        if (features.length === 0 && currentFeatureRef.current !== null) {
          handlePowerlineMouseLeave();
        }
      };

      // Bind event handlers
      map.on("mouseenter", "Electricity Transmission Lines Hitbox", handlePowerlineMouseEnter);
      map.on("mouseleave", "Electricity Transmission Lines Hitbox", handlePowerlineMouseLeave);
      map.on("mousemove", handleMapMouseMove);
      console.log("[MapboxLayerHandler] Bound interactivity event handlers for powerlines.");

      eventHandlersRef.current = {
        onPowerlineMouseEnter: handlePowerlineMouseEnter,
        onPowerlineMouseLeave: handlePowerlineMouseLeave,
        onMapMouseMove: handleMapMouseMove,
      };

      // **Airfields Layer Setup**
      if (!map.getSource("airfields")) {
        map.addSource("airfields", {
          type: "vector",
          url: "mapbox://intelaero.5d451fq2",
        });
        console.log("[MapboxLayerHandler] Added source 'airfields'.");
      } else {
        console.log("[MapboxLayerHandler] Source 'airfields' already exists.");
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
            "fill-outline-color": "#FFF",
          },
          minzoom: 10,
        });
        console.log("[MapboxLayerHandler] Added layer 'Airfields'.");
        layerManager.registerLayer("Airfields");
      } else {
        console.log("[MapboxLayerHandler] Layer 'Airfields' already exists.");
      }

      if (!map.getLayer("Airfields Labels")) {
        map.addLayer({
          id: "Airfields Labels",
          type: "symbol",
          source: "airfields",
          "source-layer": "July2024Airservices-7op6cm",
          layout: {
            visibility: "none",
            "text-field": ["get", "title"],
            "symbol-placement": "line",
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-offset": [0, 0],
            "text-anchor": "center",
          },
          paint: { "text-color": "#FFF" },
          minzoom: 12,
        });
        console.log("[MapboxLayerHandler] Added layer 'Airfields Labels'.");
        layerManager.registerLayer("Airfields Labels");
      } else {
        console.log("[MapboxLayerHandler] Layer 'Airfields Labels' already exists.");
      }

      // Note: Add any additional interactivity for airfields here if needed.
    });

    // Cleanup event handlers on unmount
    return () => {
      if (!map) return;
      const handlers = eventHandlersRef.current;
      if (handlers.onPowerlineMouseEnter) {
        map.off("mouseenter", "Electricity Transmission Lines Hitbox", handlers.onPowerlineMouseEnter);
      }
      if (handlers.onPowerlineMouseLeave) {
        map.off("mouseleave", "Electricity Transmission Lines Hitbox", handlers.onPowerlineMouseLeave);
      }
      if (handlers.onMapMouseMove) {
        map.off("mousemove", handlers.onMapMouseMove);
      }

      // Remove airfields event listeners if any exist
      map.off("mouseenter", "Airfields");
      map.off("mouseleave", "Airfields");
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
      console.log("[MapboxLayerHandler] Cleanup complete.");
    };
  }, [map]);

  return null;
};

export default MapboxLayerHandler;
