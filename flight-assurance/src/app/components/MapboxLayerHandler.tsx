import { useEffect } from "react";
import mapboxgl from "mapbox-gl";

interface MapboxLayerHandlerProps {
  map: mapboxgl.Map | null;
}

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
    case "500": return "76 m";
    default: return "N/A";
  }
};

const MapboxLayerHandler: React.FC<MapboxLayerHandlerProps> = ({ map }) => {
  useEffect(() => {
    if (!map) return;

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
        paint: { "line-width": 20, "line-color": "rgba(0,0,0,0)", "line-opacity": 0 }
      });
    }

    const onPowerlineMouseEnter = (e: mapboxgl.MapMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = e.features && e.features[0];
      if (!feature) return;

      const voltage = feature.properties.CAPACITY_KV || "unknown";
      const height = voltage !== "unknown" ? getHeightForVoltage(String(voltage)) : "N/A";

      const popupContent = `
        <strong>Voltage (kV):</strong> ${voltage}<br/>
        <strong>Height:</strong> ${height}
      `;

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(e.lngLat)
        .setHTML(popupContent)
        .addTo(map);

      (map as any).__currentPopup = popup;
    };

    const onPowerlineMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      if ((map as any).__currentPopup) {
        (map as any).__currentPopup.remove();
        (map as any).__currentPopup = null;
      }
    };

    map.on("mouseenter", "Electricity Transmission Lines Hitbox", onPowerlineMouseEnter);
    map.on("mouseleave", "Electricity Transmission Lines Hitbox", onPowerlineMouseLeave);

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
      

    // On hover, show popup
    map.on("mouseenter", "Airfields", (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;

      map.getCanvas().style.cursor = "pointer"; // Change cursor to pointer

      const name = feature.properties.name || "Unnamed"; // Fallback if no name
      const aeroway = feature.properties.aeroway || "Unknown"; // Fallback if missing
      const aerowayFormatted = aeroway.charAt(0).toUpperCase() + aeroway.slice(1); // Capitalize
      const coordinates = e.lngLat;

      const popupContent = `
        <div style="padding: 2px; font-family: Arial, sans-serif;">
          <h3 style="margin: 0 0 2px 0; font-size: 14px;">${name}</h3>
          <p style="margin: 0; font-size: 14px;"><strong>Type:</strong> ${aerowayFormatted}</p>
        </div>
      `;

      // Remove any existing popup first
      if ((map as any).__airfieldsPopup) {
        (map as any).__airfieldsPopup.remove();
      }

      const popup = new mapboxgl.Popup({
        closeButton: false, // No close button for hover
        closeOnClick: false // Don’t close on map click
      })
        .setLngLat(coordinates)
        .setHTML(popupContent)
        .addTo(map);

      // Store popup reference
      (map as any).__airfieldsPopup = popup;
    });

    // On leave, remove popup
    map.on("mouseleave", "Airfields", () => {
      map.getCanvas().style.cursor = ""; // Reset cursor
      if ((map as any).__airfieldsPopup) {
        (map as any).__airfieldsPopup.remove();
        (map as any).__airfieldsPopup = null;
      }
    });

    // Debug source loading and features
    map.on("sourcedata", (e) => {
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
              console.log(`   Name: ${feature.properties.name || "No name"}`);
              console.log(`   Aeroway: ${feature.properties.aeroway || "Not specified"}`);
              // Log additional keys if needed:
              // console.log(`   Other tags:`, feature.properties);
            });
            
            // Extract and log unique values for 'aeroway' and 'name'
            const aerowayValues = features.map(f => f.properties.aeroway).filter(Boolean);
            console.log("Unique aeroway values:", [...new Set(aerowayValues)]);
            
            const names = features.map(f => f.properties.name).filter(Boolean);
            console.log("Unique aerodrome names:", [...new Set(names)]);
          } else {
            console.log("No features found in hotosm_aus_airports_points_ge-21mapu");
            console.log("Current bounds:", map.getBounds().toArray());
          }  
        }
      }
    });

    // Log initial map state
    console.log("Initial map center:", map.getCenter(), "Zoom:", map.getZoom());

    // Consolidated cleanup
    return () => {
      map.off("mouseenter", "Electricity Transmission Lines Hitbox", onPowerlineMouseEnter);
      map.off("mouseleave", "Electricity Transmission Lines Hitbox", onPowerlineMouseLeave);
      map.off("mouseenter", "Airfields");
      map.off("mouseleave", "Airfields");
      map.off("sourcedata"); // Cleanup sourcedata listener
      map.off("click", "Airfields");
      // Ensure popup is removed on cleanup
      if ((map as any).__airfieldsPopup) {
        (map as any).__airfieldsPopup.remove();
        (map as any).__airfieldsPopup = null;
      }
    };
  }, [map]);

  return null;
};

export default MapboxLayerHandler;