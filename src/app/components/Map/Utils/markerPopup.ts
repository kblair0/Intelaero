// src/app/utils/markerPopup.ts
import mapboxgl from 'mapbox-gl';

export function createMarkerPopup(
  markerType: 'gcs' | 'observer' | 'repeater',
  initialElevation: number,
  elevationOffset: number,
  onDelete: () => void,
  markerId: string = '', // Default to empty string for backward compatibility
  markerIndex: number = 0, // Default to 0 for backward compatibility
  hasMultiple: boolean = false // Default to false for backward compatibility
): mapboxgl.Popup {
  const popupDiv = document.createElement("div");
  
  // Define your inline styles here or consider moving to CSS modules
  const styles = {
    container: "padding: 8px; min-width: 200px;",
    header:
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;",
    deleteBtn:
      "background: #e53e3e; color: white; border: none; padding: 2px 4px; border-radius: 4px; cursor: pointer; font-size: 10px;",
    label: "color: #4a5568; font-size: 12px; display: block; margin-bottom: 4px;",
    value: "color: #1a202c; font-size: 12px; font-weight: 500;",
    id: "color: #4a5568; font-size: 10px; display: block; margin-left: 4px;",
  };
  
  const markerInfo = {
    gcs: { icon: "📡", title: "GCS" },
    observer: { icon: "🔭", title: "Observer" },
    repeater: { icon: "⚡️", title: "Repeater" },
  };
  
  const { icon, title } = markerInfo[markerType];
  const stationElevation = initialElevation + elevationOffset;
  
  // Add marker index to title if there are multiple markers of this type
  const markerTitle = hasMultiple ? `${title} #${markerIndex + 1}` : title;
  
  popupDiv.innerHTML = `
    <div class="popup-container" style="${styles.container}">
      <div style="${styles.header}">
        <div style="display: flex; align-items: center;">
          <h5 style="font-weight: 600; font-size: 0.875rem; color: #4a5568;">
            ${markerTitle} ${icon}
          </h5>
          <span style="${styles.id}" title="Marker ID">${markerId.substring(0, 6)}</span>
        </div>
        <button id="delete-marker-btn" style="${styles.deleteBtn}">
          Delete
        </button>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="${styles.label}">Ground Elevation:</label>
        <span style="${styles.value}">${initialElevation.toFixed(1)} m ASL</span>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="${styles.label}">Elevation Offset:</label>
        <span style="${styles.value}">${elevationOffset.toFixed(1)} m</span>
      </div>
      <div style="margin-bottom: 8px;">
        <label style="${styles.label}">Station Elevation:</label>
        <span style="${styles.value}">${stationElevation.toFixed(1)} m ASL</span>
      </div>
    </div>
  `;
  
  // Use a generic button ID since we're passing the callback directly
  popupDiv.querySelector(`#delete-marker-btn`)
    ?.addEventListener("click", onDelete);
    
  return new mapboxgl.Popup({ closeButton: false }).setDOMContent(popupDiv);
}