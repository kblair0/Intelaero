import type mapboxgl from 'mapbox-gl';

/**
 * TreeHeightCanvas.tsx
 * 
 * Purpose:
 * Manages the canvas DOM element for tree height visualization overlay.
 * Handles canvas creation, positioning, sizing, and interaction methods.
 * Provides a clean interface for canvas operations without React dependencies.
 * 
 * This component:
 * - Creates and positions canvas overlay on map
 * - Handles canvas resizing and synchronization with map
 * - Provides methods for canvas visibility control
 * - Enables pixel-level height value extraction
 * - Manages canvas lifecycle and cleanup
 * 
 * Related Files:
 * - TreeHeightSystem.ts: Core rendering engine
 * - useTreeHeights.ts: React integration hook
 * - MapboxLayerHandler.tsx: Layer coordination
 */

export class TreeHeightCanvas {
  private map: mapboxgl.Map;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isVisible: boolean = false;
  private resizeHandler: (() => void) | null = null;

  constructor(map: mapboxgl.Map) {
    this.map = map;
    this.initialize();
  }

  /**
   * Initialize the canvas overlay
   */
  private initialize(): void {
    console.log("🎨 Initializing TreeHeightCanvas");
    
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-tree-height-canvas', 'true'); // Identifier for TreeHeightSystem
    
    // Style the canvas overlay
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0px';
    this.canvas.style.left = '0px';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '10';
    this.canvas.style.display = 'none';
    this.canvas.style.mixBlendMode = 'multiply'; // Blend with map for better visuals
    
    // Get canvas context
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error("Failed to get canvas 2D context");
      return;
    }
    
    // Add canvas to map container
    const mapContainer = this.map.getContainer();
    mapContainer.appendChild(this.canvas);
    
    // Set up resize handling
    this.resizeHandler = this.handleResize.bind(this);
    this.map.on('resize', this.resizeHandler);
    
    // Initial size
    this.updateCanvasSize();
    
    console.log("✅ TreeHeightCanvas initialized");
  }

  /**
   * Handle map resize events
   */
  private handleResize(): void {
    this.updateCanvasSize();
  }

  /**
   * Update canvas size to match map
   */
  private updateCanvasSize(): void {
    if (!this.canvas) return;
    
    const mapCanvas = this.map.getCanvas();
    
    // Set canvas size to match map canvas exactly
    this.canvas.width = mapCanvas.width;
    this.canvas.height = mapCanvas.height;
    this.canvas.style.width = `${mapCanvas.clientWidth}px`;
    this.canvas.style.height = `${mapCanvas.clientHeight}px`;
    
    console.log(`📏 Canvas resized to: ${mapCanvas.width}x${mapCanvas.height} (${mapCanvas.clientWidth}x${mapCanvas.clientHeight})`);
  }

  /**
   * Set canvas visibility
   */
  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    
    this.isVisible = visible;
    this.canvas.style.display = visible ? 'block' : 'none';
    
    console.log(`👁️ Canvas visibility: ${visible ? 'visible' : 'hidden'}`);
  }

  /**
   * Check if canvas is visible
   */
  getVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    if (!this.canvas || !this.ctx) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    console.log("🧹 Canvas cleared");
  }

  /**
   * Get tree height value at specific canvas coordinates
   */
  getHeightAtPoint(canvasX: number, canvasY: number): number | null {
    if (!this.canvas || !this.ctx || !this.isVisible) {
      return null;
    }
    
    try {
      // Ensure coordinates are within canvas bounds
      const x = Math.floor(canvasX);
      const y = Math.floor(canvasY);
      
      if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) {
        console.warn(`Click coordinates ${x}, ${y} outside canvas bounds`);
        return null;
      }
      
      // Get pixel data
      const imageData = this.ctx.getImageData(x, y, 1, 1);
      const pixel = imageData.data;
      
      // Tree height is stored in the red channel
      const heightValue = pixel[0];
      const hasData = pixel[3] > 0; // Alpha channel indicates if there's data
      
      console.log(`📊 Pixel data at (${x}, ${y}): R=${pixel[0]} G=${pixel[1]} B=${pixel[2]} A=${pixel[3]}`);
      
      return hasData && heightValue > 0 ? heightValue : null;
      
    } catch (error) {
      console.error("Error reading canvas pixel data:", error);
      return null;
    }
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } | null {
    if (!this.canvas) return null;
    
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Get canvas element (for direct access if needed)
   */
  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Get canvas context (for direct rendering if needed)
   */
  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  /**
   * Check if canvas is ready for use
   */
  isReady(): boolean {
    return !!(this.canvas && this.ctx);
  }

  /**
   * Set canvas blend mode
   */
  setBlendMode(blendMode: string): void {
    if (!this.canvas) return;
    
    this.canvas.style.mixBlendMode = blendMode;
    console.log(`🎨 Canvas blend mode set to: ${blendMode}`);
  }

  /**
   * Set canvas opacity
   */
  setOpacity(opacity: number): void {
    if (!this.canvas) return;
    
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    this.canvas.style.opacity = clampedOpacity.toString();
    console.log(`🌫️ Canvas opacity set to: ${clampedOpacity}`);
  }

  /**
   * Get canvas statistics for debugging
   */
  getStats(): {
    isReady: boolean;
    isVisible: boolean;
    dimensions: { width: number; height: number } | null;
    hasContext: boolean;
  } {
    return {
      isReady: this.isReady(),
      isVisible: this.isVisible,
      dimensions: this.getDimensions(),
      hasContext: !!this.ctx
    };
  }

  /**
   * Destroy the canvas and clean up resources
   */
  destroy(): void {
    console.log("🧹 Destroying TreeHeightCanvas");
    
    // Remove resize handler
    if (this.resizeHandler) {
      this.map.off('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    
    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    // Clear references
    this.canvas = null;
    this.ctx = null;
    this.isVisible = false;
    
    console.log("✅ TreeHeightCanvas destroyed");
  }
}