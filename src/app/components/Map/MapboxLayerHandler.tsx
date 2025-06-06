"use client";

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import { useMapContext } from "../../context/mapcontext";
import { layerManager } from "../../services/LayerManager";
import { useTreeHeights } from "../../hooks/useTreeHeights";

interface MapboxLayerHandlerProps {
  map: mapboxgl.Map | null;
}

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
  const { } = useMapContext();
  const { toggleTreeHeights, handleTreeHeightClick, cleanup: cleanupTreeHeights, isInitialized } = useTreeHeights(map);

  const eventHandlersRef = useRef<{
    onPowerlineMouseEnter?: (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => void;
    onPowerlineMouseLeave?: () => void;
    onMapMouseMove?: (e: mapboxgl.MapMouseEvent) => void;
  }>({});
  
  const currentFeatureRef = useRef<mapboxgl.MapboxGeoJSONFeature | null>(null);

  useEffect(() => {
    if (!map) return;

    import("mapbox-gl").then((mapboxModule) => {
      const mapboxgl = mapboxModule.default;
      const extMap = map as ExtendedMapboxMap;

      // **POWERLINES LAYER SETUP**
      const powerSourceLayerName = "Electricity_Transmission_Line-08vle5";

      if (!map.getSource("electricity-lines")) {
        map.addSource("electricity-lines", {
          type: "vector",
          url: "mapbox://intelaero.a8qtcidy",
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
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 2],
          },
          minzoom: 10,
        });
        layerManager.registerLayer("Electricity Transmission Lines");
      }

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
        layerManager.registerLayer("Electricity Transmission Lines Hitbox");
      }

      // **POWERLINES INTERACTIVITY**
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
      };

      const handlePowerlineMouseLeave = () => {
        map.getCanvas().style.cursor = "";
        currentFeatureRef.current = null;
        if (extMap.__currentPopup) {
          extMap.__currentPopup.remove();
          extMap.__currentPopup = null;
        }
      };

      const handleMapMouseMove = (e: mapboxgl.MapMouseEvent) => {
        if (map.getLayer("Electricity Transmission Lines Hitbox") &&
            map.getLayoutProperty("Electricity Transmission Lines Hitbox", "visibility") === "visible") {
          const features = map.queryRenderedFeatures(e.point, {
            layers: ["Electricity Transmission Lines Hitbox"],
          });
          if (features.length === 0 && currentFeatureRef.current !== null) {
            handlePowerlineMouseLeave();
          }
        } else if (currentFeatureRef.current !== null) {
          handlePowerlineMouseLeave();
        }
      };

      map.on("mouseenter", "Electricity Transmission Lines Hitbox", handlePowerlineMouseEnter);
      map.on("mouseleave", "Electricity Transmission Lines Hitbox", handlePowerlineMouseLeave);
      map.on("mousemove", handleMapMouseMove);

      // **AIRFIELDS LAYER SETUP**
      if (!map.getSource("airfields")) {
        map.addSource("airfields", {
          type: "vector",
          url: "mapbox://intelaero.5d451fq2",
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
            "fill-outline-color": "#FFF",
          },
          minzoom: 10,
        });
        layerManager.registerLayer("Airfields");
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
        layerManager.registerLayer("Airfields Labels");
      }

      eventHandlersRef.current = {
        onPowerlineMouseEnter: handlePowerlineMouseEnter,
        onPowerlineMouseLeave: handlePowerlineMouseLeave,
        onMapMouseMove: handleMapMouseMove,
      };

      console.log("✅ MapboxLayerHandler initialization complete");
    });

    // Cleanup function
    return () => {
      if (!map) return;
      
      console.log("🧹 Cleaning up MapboxLayerHandler");
      
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

      const extMap = map as ExtendedMapboxMap;
      if (extMap.__currentPopup) {
        extMap.__currentPopup.remove();
        extMap.__currentPopup = null;
      }
      if (extMap.__airfieldsPopup) {
        extMap.__airfieldsPopup.remove();
        extMap.__airfieldsPopup = null;
      }

      if (cleanupTreeHeights) {
        cleanupTreeHeights();
      }
      
      console.log("✅ MapboxLayerHandler cleanup complete");
    };
  }, [map, cleanupTreeHeights]);

  // Separate useEffect for tree heights integration
  useEffect(() => {
    if (!map || !isInitialized) return;

    // Attach tree heights functionality only when initialized
    (map as any).toggleTreeHeights = toggleTreeHeights;
    if (handleTreeHeightClick) {
      map.on("click", handleTreeHeightClick);
    }

    // ADD HOVER HANDLERS HERE:
    const handleTreeHover = (e: mapboxgl.MapMouseEvent) => {
      if (!isInitialized || !map) return;
      
      const treeHeightVisible = layerManager.isLayerVisible("tree-height-raster");
      if (!treeHeightVisible) return;
      
      // Simple hover effect - change cursor over map when tree layer is active
      map.getCanvas().style.cursor = 'crosshair';
    };

    const handleTreeHoverLeave = () => {
      if (!map) return;
      map.getCanvas().style.cursor = '';
    };

    // Add hover listeners only when tree heights are visible
    if (layerManager.isLayerVisible("tree-height-raster")) {
      map.on('mousemove', handleTreeHover);
      map.on('mouseleave', handleTreeHoverLeave);
    }

    return () => {
      delete (map as any).toggleTreeHeights;
      if (handleTreeHeightClick) {
        map.off("click", handleTreeHeightClick);
      }
      // Clean up hover listeners
      map.off('mousemove', handleTreeHover);
      map.off('mouseleave', handleTreeHoverLeave);
    };
  }, [map, isInitialized, toggleTreeHeights, handleTreeHeightClick]);

  return null;
};

export default MapboxLayerHandler;