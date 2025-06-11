// src/app/utils/markerPopup.ts
/**
 * PURPOSE: Creates interactive popup components for map markers showing elevation data and ground visibility information
 * RELATES TO: 
 * - MapboxGL marker system
 * - Terrain elevation services
 * - Line-of-sight calculations
 * - UI components for marker management
 * 
 * DEPENDENCIES:
 * - mapbox-gl: For popup creation and DOM manipulation
 * - Elevation services that provide ground height data
 * - Parent components that handle marker deletion callbacks
 */

import mapboxgl from 'mapbox-gl';

/**
 * Creates a popup component for map markers with elevation information and ground visibility advisory
 * 
 * @param markerType - Type of marker (gcs, observer, repeater)
 * @param initialElevation - Ground elevation at marker location in meters ASL
 * @param elevationOffset - Height offset above ground in meters
 * @param onDelete - Callback function to handle marker deletion
 * @param markerId - Unique identifier for the marker (optional)
 * @param markerIndex - Index of marker when multiple of same type exist (optional)
 * @param hasMultiple - Whether multiple markers of this type exist (optional)
 * @returns Configured MapboxGL popup instance
 */
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
  
  // Centralized styling configuration for maintainability and consistency
  const styles = {
    container: "padding: 8px; min-width: 200px;",
    header: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;",
    deleteBtn: "background: #e53e3e; color: white; border: none; padding: 2px 4px; border-radius: 4px; cursor: pointer; font-size: 10px;",
    label: "color: #4a5568; font-size: 12px; display: block; margin-bottom: 4px;",
    value: "color: #1a202c; font-size: 12px; font-weight: 500;",
    id: "color: #4a5568; font-size: 10px; display: block; margin-left: 4px;",
    advisory: "background: #f7fafc; border: 1px solid #e2e8f0; padding: 6px; border-radius: 4px; margin-bottom: 8px; font-size: 11px; color: #4a5568; line-height: 1.3;",
    advisoryIcon: "margin-right: 4px; font-size: 12px;"
  };

  // Marker configuration mapping for scalability
  const markerInfo = {
    gcs: { icon: "📡", title: "GCS" },
    observer: { icon: "🔭", title: "Observer" },
    repeater: { icon: "⚡️", title: "Repeater" },
  };

  const { icon, title } = markerInfo[markerType];
  const stationElevation = initialElevation + elevationOffset;
  
  // Generate contextual title based on marker multiplicity
  const markerTitle = hasMultiple ? `${title} #${markerIndex + 1}` : title;

  // Construct popup HTML with ground visibility advisory
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
      
      <div style="${styles.advisory}">
        <span style="${styles.advisoryIcon}">ℹ️</span>
        <strong>Ground Visibility:</strong> This shows the view of ground terrain from this vantage point, not what can be seen above ground level.
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

  // Attach deletion event handler with error handling
  const deleteButton = popupDiv.querySelector(`#delete-marker-btn`);
  if (deleteButton) {
    deleteButton.addEventListener("click", onDelete);
  } else {
    console.warn('Delete button not found in marker popup');
  }

  return new mapboxgl.Popup({ closeButton: false }).setDOMContent(popupDiv);
}