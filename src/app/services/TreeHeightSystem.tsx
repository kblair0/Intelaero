/**
 * TreeHeightSystem.ts
 * 
 * Purpose:
 * Core service for tree height visualization. Handles tile fetching, caching,
 * image processing, color mapping, and rendering coordination.
 * Updated for rasterarray tileset with actual height data.
 */

import type mapboxgl from 'mapbox-gl';

// Configuration constants - UPDATED for new rasterarray tileset
const TREE_HEIGHT_CONFIG = {
  MIN_ZOOM: 10, // Updated to match new tileset
  MAX_ZOOM: 13, // Updated to match new tileset
  TILE_SIZE: 256,
  MAX_CACHED_TILES: 100,
  // NEW RASTERARRAY TILESET ID
  TILE_URL: 'https://api.mapbox.com/v4/intelaero.forest-height-aus-data/{z}/{x}/{y}.png',
  ACCESS_TOKEN: 'sk.eyJ1IjoiaW50ZWxhZXJvIiwiYSI6ImNtYjdpcG51YTBhYmwyam4wd204ZXlmcHUifQ.hhR2MhgqopLEtNSg05zigg'
} as const;

// Color mapping for tree heights
const TREE_HEIGHT_COLORS = {
  0: 'rgba(0,0,0,0)',           // Transparent for no trees
  2: 'rgba(50,200,50,0.8)',     // Light green
  5: 'rgba(0,255,0,0.8)',       // Bright green  
  10: 'rgba(255,255,0,0.8)',    // Yellow
  20: 'rgba(255,165,0,0.9)',    // Orange
  30: 'rgba(255,50,50,0.9)',    // Red
  40: 'rgba(200,0,200,1.0)'     // Purple for very tall trees
} as const;

interface RenderOptions {
  isPointInAO: (lng: number, lat: number) => boolean;
  onProgress?: (progress: number) => void;
}

interface TileBounds {
  west: number;
  north: number;
  east: number;
  south: number;
}

interface ColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

class TreeHeightSystem {
  private map: mapboxgl.Map | null = null;
  private tileCache = new Map<string, ImageData>();
  private isInitialized = false;

  initialize(map: mapboxgl.Map): void {
    this.map = map;
    this.isInitialized = true;
    console.log("🌲 TreeHeightSystem initialized for rasterarray tileset");
  }

  private getTreeHeightColor(heightValue: number): string {
    const heights = Object.keys(TREE_HEIGHT_COLORS).map(Number).sort((a, b) => a - b);
    
    for (let i = 0; i < heights.length; i++) {
      if (heightValue <= heights[i]) {
        return TREE_HEIGHT_COLORS[heights[i] as keyof typeof TREE_HEIGHT_COLORS];
      }
    }
    
    return TREE_HEIGHT_COLORS[40];
  }

  private parseColor(color: string): ColorRGBA {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return { r: 0, g: 0, b: 0, a: 0 };
    
    const values = match[1].split(',').map(v => parseFloat(v.trim()));
    return {
      r: values[0] || 0,
      g: values[1] || 0,
      b: values[2] || 0,
      a: Math.floor((values[3] || 1) * 255)
    };
  }

  // FIXED: Added missing return statement
  private async fetchTreeHeightTile(zoom: number, x: number, y: number): Promise<ImageData | null> {
    const tileKey = `${zoom}/${x}/${y}`;
    
    if (this.tileCache.has(tileKey)) {
      console.log(`📋 Using cached tile: ${tileKey}`);
      return this.tileCache.get(tileKey)!;
    }

    try {
      const url = TREE_HEIGHT_CONFIG.TILE_URL
        .replace('{z}', zoom.toString())
        .replace('{x}', x.toString())
        .replace('{y}', y.toString()) + `?access_token=${TREE_HEIGHT_CONFIG.ACCESS_TOKEN}`;
      
      console.log(`🔍 Fetching tile ${tileKey} from: ${url}`);
      
      const response = await fetch(url, { cache: 'force-cache' });
      
      console.log(`📡 Tile ${tileKey} response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ Tile ${tileKey} error: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log(`📦 Tile ${tileKey} blob size: ${blob.size} bytes`);
      
      const imageData = await this.processImageBlob(blob);
      
      if (imageData) {
        if (this.tileCache.size >= TREE_HEIGHT_CONFIG.MAX_CACHED_TILES) {
          const firstKey = this.tileCache.keys().next().value;
          this.tileCache.delete(firstKey);
        }
        
        this.tileCache.set(tileKey, imageData);
        
        // Enhanced logging for rasterarray data
        console.log(`✅ Tile ${tileKey} loaded successfully`);
        console.log(`🔍 First 8 pixels (RGBA):`, imageData.data.slice(0, 32));
        console.log(`🎯 Red channel values:`, [
          imageData.data[0], imageData.data[4], imageData.data[8], imageData.data[12],
          imageData.data[16], imageData.data[20], imageData.data[24], imageData.data[28]
        ]);
        console.log(`🎯 Non-zero red values count:`, 
          Array.from(imageData.data).filter((val, i) => i % 4 === 0 && val > 0).length);
        
        // ADDED: Return the imageData
        return imageData;
      }
    } catch (error) {
      console.error(`❌ Failed to fetch tile ${tileKey}:`, error);
      return null;
    }
    
    return null;
  }

  private async processImageBlob(blob: Blob): Promise<ImageData | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = TREE_HEIGHT_CONFIG.TILE_SIZE;
          canvas.height = TREE_HEIGHT_CONFIG.TILE_SIZE;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve(null);
            return;
          }
          
          ctx.drawImage(img, 0, 0, TREE_HEIGHT_CONFIG.TILE_SIZE, TREE_HEIGHT_CONFIG.TILE_SIZE);
          const imageData = ctx.getImageData(0, 0, TREE_HEIGHT_CONFIG.TILE_SIZE, TREE_HEIGHT_CONFIG.TILE_SIZE);
          resolve(imageData);
        } catch (error) {
          console.error('❌ Error processing image blob:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        console.error('❌ Failed to load image blob');
        resolve(null);
      };
      img.src = URL.createObjectURL(blob);
    });
  }

  private getTileBounds(zoom: number, x: number, y: number): TileBounds {
    const scale = Math.pow(2, zoom);
    return {
      west: (x / scale) * 360 - 180,
      north: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180) / Math.PI,
      east: ((x + 1) / scale) * 360 - 180,
      south: (Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / scale))) * 180) / Math.PI
    };
  }

  private tileIntersectsAO(zoom: number, x: number, y: number, isPointInAO: (lng: number, lat: number) => boolean): boolean {
    const bounds = this.getTileBounds(zoom, x, y);
    
    const checkPoints = [
      [bounds.west, bounds.north],
      [bounds.east, bounds.north],
      [bounds.west, bounds.south],
      [bounds.east, bounds.south],
      [(bounds.west + bounds.east) / 2, (bounds.north + bounds.south) / 2]
    ];
    
    return checkPoints.some(([lng, lat]) => isPointInAO(lng, lat));
  }

  private getVisibleTiles(zoom: number): Array<{x: number, y: number}> {
    if (!this.map) return [];
    
    const bounds = this.map.getBounds();
    const scale = Math.pow(2, zoom);
    
    const minTileX = Math.floor(((bounds.getWest() + 180) / 360) * scale);
    const maxTileX = Math.floor(((bounds.getEast() + 180) / 360) * scale);
    const minTileY = Math.floor(((1 - Math.log(Math.tan((bounds.getNorth() * Math.PI) / 180) + 1 / Math.cos((bounds.getNorth() * Math.PI) / 180)) / Math.PI) / 2) * scale);
    const maxTileY = Math.floor(((1 - Math.log(Math.tan((bounds.getSouth() * Math.PI) / 180) + 1 / Math.cos((bounds.getSouth() * Math.PI) / 180)) / Math.PI) / 2) * scale);
    
    const tiles: Array<{x: number, y: number}> = [];
    
    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        tiles.push({ x, y });
      }
    }
    
    return tiles;
  }

  async renderTreeHeights(options: RenderOptions): Promise<void> {
    if (!this.isInitialized || !this.map) {
      throw new Error("TreeHeightSystem not initialized");
    }
    
    const { isPointInAO, onProgress } = options;
    
    console.log("🎨 Starting tree height rendering with rasterarray data");
    
    const currentZoom = Math.floor(this.map.getZoom());
    const clampedZoom = Math.min(TREE_HEIGHT_CONFIG.MAX_ZOOM, Math.max(TREE_HEIGHT_CONFIG.MIN_ZOOM, currentZoom));
    
    console.log(`🎯 Rendering at zoom ${clampedZoom} (actual: ${currentZoom})`);
    
    const visibleTiles = this.getVisibleTiles(clampedZoom);
    const totalTiles = visibleTiles.length;
    
    console.log(`📊 Processing ${totalTiles} tiles`);
    
    let processedTiles = 0;
    let successfulTiles = 0;
    let skippedTiles = 0;
    
    for (const tile of visibleTiles) {
      const { x, y } = tile;
      
      if (!this.tileIntersectsAO(clampedZoom, x, y, isPointInAO)) {
        skippedTiles++;
        continue;
      }
      
      try {
        const tileData = await this.fetchTreeHeightTile(clampedZoom, x, y);
        processedTiles++;
        
        if (onProgress) {
          onProgress(processedTiles / totalTiles);
        }
        
        if (!tileData) continue;
        
        successfulTiles++;
        
        await this.renderTile(clampedZoom, x, y, tileData, isPointInAO);
        
      } catch (error) {
        console.warn(`❌ Error processing tile ${clampedZoom}/${x}/${y}:`, error);
      }
    }
    
    console.log(`✅ Rendering complete: ${successfulTiles}/${processedTiles} tiles successful, ${skippedTiles} skipped (outside AO)`);
  }

  private async renderTile(
    zoom: number, 
    x: number, 
    y: number, 
    tileData: ImageData, 
    isPointInAO: (lng: number, lat: number) => boolean
  ): Promise<void> {
    if (!this.map) return;
    
    const canvas = document.querySelector('canvas[data-tree-height-canvas]') as HTMLCanvasElement;
    if (!canvas) {
      console.warn("🎨 No canvas found with data-tree-height-canvas attribute");
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const tileBounds = this.getTileBounds(zoom, x, y);
    const topLeft = this.map.project([tileBounds.west, tileBounds.north]);
    const bottomRight = this.map.project([tileBounds.east, tileBounds.south]);
    
    const tileWidth = bottomRight.x - topLeft.x;
    const tileHeight = bottomRight.y - topLeft.y;
    
    const coloredCanvas = document.createElement('canvas');
    coloredCanvas.width = TREE_HEIGHT_CONFIG.TILE_SIZE;
    coloredCanvas.height = TREE_HEIGHT_CONFIG.TILE_SIZE;
    const colorCtx = coloredCanvas.getContext('2d');
    if (!colorCtx) return;
    
    const coloredImageData = colorCtx.createImageData(TREE_HEIGHT_CONFIG.TILE_SIZE, TREE_HEIGHT_CONFIG.TILE_SIZE);
    
    let pixelsWithData = 0;
    for (let i = 0; i < tileData.data.length; i += 4) {
      const pixelX = (i / 4) % TREE_HEIGHT_CONFIG.TILE_SIZE;
      const pixelY = Math.floor((i / 4) / TREE_HEIGHT_CONFIG.TILE_SIZE);
      
      const pixelLng = tileBounds.west + (pixelX / TREE_HEIGHT_CONFIG.TILE_SIZE) * (tileBounds.east - tileBounds.west);
      const pixelLat = tileBounds.north + (pixelY / TREE_HEIGHT_CONFIG.TILE_SIZE) * (tileBounds.south - tileBounds.north);
      
      if (!isPointInAO(pixelLng, pixelLat)) {
        coloredImageData.data[i] = 0;
        coloredImageData.data[i + 1] = 0;
        coloredImageData.data[i + 2] = 0;
        coloredImageData.data[i + 3] = 0;
        continue;
      }
      
      // For rasterarray, height should be in red channel
      const heightValue = tileData.data[i];
      
      if (heightValue > 0) {
        pixelsWithData++;
        const color = this.getTreeHeightColor(heightValue);
        const rgba = this.parseColor(color);
        
        coloredImageData.data[i] = rgba.r;
        coloredImageData.data[i + 1] = rgba.g;
        coloredImageData.data[i + 2] = rgba.b;
        coloredImageData.data[i + 3] = rgba.a;
      } else {
        coloredImageData.data[i] = 0;
        coloredImageData.data[i + 1] = 0;
        coloredImageData.data[i + 2] = 0;
        coloredImageData.data[i + 3] = 0;
      }
    }
    
    if (pixelsWithData > 0) {
      colorCtx.putImageData(coloredImageData, 0, 0);
      ctx.drawImage(coloredCanvas, topLeft.x, topLeft.y, tileWidth, tileHeight);
      console.log(`🎨 Rendered tile ${zoom}/${x}/${y} with ${pixelsWithData} pixels containing height data`);
    } else {
      console.log(`⚠️ Tile ${zoom}/${x}/${y} had no pixels with height data > 0`);
    }
  }

  clearCache(): void {
    this.tileCache.clear();
    console.log("🧹 Tree height tile cache cleared");
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.tileCache.size,
      maxSize: TREE_HEIGHT_CONFIG.MAX_CACHED_TILES
    };
  }

  cleanup(): void {
    this.clearCache();
    this.map = null;
    this.isInitialized = false;
    console.log("🧹 TreeHeightSystem cleanup complete");
  }
}

export const treeHeightSystem = new TreeHeightSystem();