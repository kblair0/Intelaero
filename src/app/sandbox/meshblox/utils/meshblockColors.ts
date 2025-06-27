/**
 * meshblockColors.ts
 * 
 * Purpose:
 * Provides color schemes and styling configurations for meshblock visualization.
 * Handles both land use categorical colors and population density gradient colors.
 * Ensures accessibility compliance and provides dynamic opacity calculations.
 * 
 * Features:
 * - Land use category color mappings (descriptive, not risk-based)
 * - Population density gradient definitions
 * - Mapbox style expressions for dynamic coloring
 * - Accessibility-compliant color schemes
 * - Opacity and styling utility functions
 * 
 * Dependencies:
 * - ../types: For MeshblockViewMode interface
 * 
 * Related Files:
 * - types.ts: Imports LandUseCategory and other exports from here
 * - MeshblockService.ts: Uses color functions for layer styling
 * - UI Components: Use color schemes for legends and controls
 */

import { MeshblockViewMode } from '../types';

/**
 * Land use categories from ABS Meshblock Classification
 * Based on field values
 */
export enum LandUseCategory {
  RESIDENTIAL = 'Residential',
  COMMERCIAL = 'Commercial',
  INDUSTRIAL = 'Industrial',
  PARKLAND = 'Parkland',
  EDUCATION = 'Education',
  HOSPITAL_MEDICAL = 'Hospital/Medical',
  TRANSPORT = 'Transport',
  PRIMARY_PRODUCTION = 'Primary Production',
  WATER = 'Water',
  OTHER = 'Other'
}

/**
 * Color mappings for land use categories - moved here to avoid circular imports
 */
export const LAND_USE_COLORS: Record<LandUseCategory, string> = {
  [LandUseCategory.RESIDENTIAL]: '#87CEEB',     // Sky blue
  [LandUseCategory.COMMERCIAL]: '#DA70D6',      // Orchid purple  
  [LandUseCategory.INDUSTRIAL]: '#696969',      // Dim gray
  [LandUseCategory.PARKLAND]: '#32CD32',        // Lime green
  [LandUseCategory.EDUCATION]: '#FFD700',       // Gold
  [LandUseCategory.HOSPITAL_MEDICAL]: '#FF6347', // Tomato red
  [LandUseCategory.TRANSPORT]: '#2F4F4F',       // Dark slate gray
  [LandUseCategory.PRIMARY_PRODUCTION]: '#D2691E', // Chocolate brown
  [LandUseCategory.WATER]: '#4169E1',           // Royal blue
  [LandUseCategory.OTHER]: '#D3D3D3'            // Light gray
};

/**
 * Ground risk class color breakpoints aligned with aviation standards
 * Colors represent risk levels: green (low) -> yellow (medium) -> red (high)
 */
export const POPULATION_DENSITY_BREAKPOINTS = {
  0: '#e8f5e8',        // Very light green - Isolated environment (0 to <0.5)
  0.5: '#c8e6c8',      // Light green - Isolated environment  
  5: '#a8d4a8',        // Medium green - Scarcely populated environment
  50: '#fff3cd',       // Light yellow - Lightly populated environment
  500: '#ffeb3b',      // Yellow - Sparsely populated environment  
  5000: '#ff9800',     // Orange - Suburban/low density metropolitan
  50000: '#f44336',    // Red - High density metropolitan
  100000: '#d32f2f'    // Dark red - Assemblies of people
} as const;

/**
 * iGRC risk level colors (1-10 scale)
 */
export const IGRC_COLORS = {
  1: '#22c55e',   // Green - Very Low
  2: '#22c55e',   // Green - Very Low  
  3: '#22c55e',   // Green - Low
  4: '#eab308',   // Yellow - Medium
  5: '#eab308',   // Yellow - Medium
  6: '#eab308',   // Yellow - Medium
  7: '#f97316',   // Orange - High
  8: '#f97316',   // Orange - High
  9: '#ef4444',   // Red - Very High
  10: '#ef4444'   // Red - Very High
} as const;

/**
 * iGRC risk level categories
 */
export function getiGRCRiskLevel(igrc: number): 'low' | 'medium' | 'high' | 'very-high' {
  if (igrc <= 3) return 'low';
  if (igrc <= 6) return 'medium';
  if (igrc <= 8) return 'high';
  return 'very-high';
}

/**
 * Get color for iGRC value
 */
export function getiGRCColor(igrc: number): string {
  return IGRC_COLORS[igrc as keyof typeof IGRC_COLORS] || IGRC_COLORS[1];
}


/**
 * Ground risk class definitions for aviation safety assessment
 */
export enum GroundRiskClass {
  CONTROLLED_GROUND = 'Controlled ground area',
  ISOLATED = 'Isolated environment', 
  SCARCELY_POPULATED = 'Scarcely populated environment',
  LIGHTLY_POPULATED = 'Lightly populated environment',
  SPARSELY_POPULATED = 'Sparsely populated environment',
  SUBURBAN_LOW_DENSITY = 'Suburban/low density metropolitan',
  HIGH_DENSITY_METROPOLITAN = 'High density metropolitan',
  ASSEMBLIES_OF_PEOPLE = 'Assemblies of people'
}

/**
 * Helper function to convert population density to ground risk class
 * @param density - Population density in people per km²
 * @returns Ground risk class enum value
 */
export function getGroundRiskClass(density: number): GroundRiskClass {
  if (density >= 50000) return GroundRiskClass.ASSEMBLIES_OF_PEOPLE;
  if (density >= 5000) return GroundRiskClass.HIGH_DENSITY_METROPOLITAN;
  if (density >= 500) return GroundRiskClass.SUBURBAN_LOW_DENSITY;
  if (density >= 50) return GroundRiskClass.SPARSELY_POPULATED;
  if (density >= 5) return GroundRiskClass.LIGHTLY_POPULATED;
  if (density >= 0.5) return GroundRiskClass.SCARCELY_POPULATED;
  return GroundRiskClass.ISOLATED;
}

/**
 * Helper function to get risk class display name
 * @param density - Population density in people per km²
 * @returns Human-readable risk class name
 */
export function getGroundRiskClassName(density: number): string {
  return getGroundRiskClass(density);
}

/**
 * Helper function to get risk class color
 * @param density - Population density in people per km²
 * @returns Hex color string for the risk class
 */
export function getGroundRiskClassColor(density: number): string {
  if (density >= 50000) return POPULATION_DENSITY_BREAKPOINTS[100000];
  if (density >= 5000) return POPULATION_DENSITY_BREAKPOINTS[50000];
  if (density >= 500) return POPULATION_DENSITY_BREAKPOINTS[5000];
  if (density >= 50) return POPULATION_DENSITY_BREAKPOINTS[500];
  if (density >= 5) return POPULATION_DENSITY_BREAKPOINTS[50];
  if (density >= 0.5) return POPULATION_DENSITY_BREAKPOINTS[5];
  return POPULATION_DENSITY_BREAKPOINTS[0]; // ✅ FIXED: Use 0 for very low density
}

/**
 * Land use category colors with enhanced contrast for accessibility
 * Extends the base LAND_USE_COLORS with additional styling options
 */
export const ENHANCED_LAND_USE_COLORS = {
  ...LAND_USE_COLORS,
  // Add stroke/outline colors for better definition
  stroke: {
    [LandUseCategory.RESIDENTIAL]: '#5F9EA0',     // Darker sky blue
    [LandUseCategory.COMMERCIAL]: '#BA55D3',      // Darker orchid
    [LandUseCategory.INDUSTRIAL]: '#555555',      // Darker gray
    [LandUseCategory.PARKLAND]: '#228B22',        // Darker green
    [LandUseCategory.EDUCATION]: '#DAA520',       // Darker gold
    [LandUseCategory.HOSPITAL_MEDICAL]: '#DC143C', // Darker red
    [LandUseCategory.TRANSPORT]: '#2F4F4F',       // Same dark gray
    [LandUseCategory.PRIMARY_PRODUCTION]: '#A0522D', // Darker brown
    [LandUseCategory.WATER]: '#1E90FF',           // Darker blue
    [LandUseCategory.OTHER]: '#A9A9A9'            // Darker gray
  }
};

/**
 * Creates Mapbox style expression for land use coloring
 * @param opacity - Base opacity for the colors (0-1)
 * @returns Mapbox style expression for fill-color
 */
export function createLandUseColorExpression(opacity: number = 0.7): any[] {
  const colorCases: any[] = ['case'];
  
  // Add cases for each land use category
  Object.entries(LAND_USE_COLORS).forEach(([category, color]) => {
    colorCases.push(['==', ['get', 'landUseCategory'], category]);
    colorCases.push(adjustColorOpacity(color, opacity));
  });
  
  // Default color for unknown categories
  colorCases.push(adjustColorOpacity(LAND_USE_COLORS[LandUseCategory.OTHER], opacity));
  
  return colorCases;
}

/**
 * Creates Mapbox style expression for population density gradient coloring
 * @param opacity - Base opacity for the colors (0-1)
 * @returns Mapbox style expression for fill-color
 */
export function createPopulationDensityColorExpression(opacity: number = 0.7): any[] {
  const densityBreakpoints = Object.keys(POPULATION_DENSITY_BREAKPOINTS)
    .map(Number)
    .sort((a, b) => a - b);
  
  const interpolation: any[] = [
    'interpolate',
    ['linear'],
    ['get', 'populationDensity']
  ];
  
  // Add breakpoints and colors
  densityBreakpoints.forEach(breakpoint => {
    interpolation.push(breakpoint);
    interpolation.push(
      adjustColorOpacity(
        POPULATION_DENSITY_BREAKPOINTS[breakpoint as keyof typeof POPULATION_DENSITY_BREAKPOINTS], 
        opacity
      )
    );
  });
  
  return interpolation;
}

/**
 * Creates Mapbox style expression for stroke/outline colors
 * @param viewMode - Current view mode to determine appropriate stroke colors
 * @param opacity - Stroke opacity (0-1)
 * @returns Mapbox style expression for line-color
 */
export function createStrokeColorExpression(
  viewMode: MeshblockViewMode, 
  opacity: number = 0.8
): any[] {
  if (viewMode === MeshblockViewMode.LAND_USE) {
    const strokeCases: any[] = ['case'];
    
    // Add cases for each land use category stroke
    Object.entries(ENHANCED_LAND_USE_COLORS.stroke).forEach(([category, color]) => {
      strokeCases.push(['==', ['get', 'landUseCategory'], category]);
      strokeCases.push(adjustColorOpacity(color, opacity));
    });
    
    // Default stroke color
    strokeCases.push(adjustColorOpacity('#666666', opacity));
    
    return strokeCases;
    } else {
      // For population density, use a consistent dark stroke
      return ['literal', adjustColorOpacity('#2c3e50', opacity)];
    }
}

/**
 * Adjusts color opacity by converting hex colors to rgba
 * @param hexColor - Hex color string (e.g., '#ff0000')
 * @param opacity - Desired opacity (0-1)
 * @returns RGBA color string
 */
export function adjustColorOpacity(hexColor: string, opacity: number): string {
  // Handle both #rgb and #rrggbb formats
  const hex = hexColor.replace('#', '');
  const isShort = hex.length === 3;
  
  const r = parseInt(isShort ? hex[0] + hex[0] : hex.substr(0, 2), 16);
  const g = parseInt(isShort ? hex[1] + hex[1] : hex.substr(2, 2), 16);
  const b = parseInt(isShort ? hex[2] + hex[2] : hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

/**
 * Gets appropriate color for a specific meshblock based on view mode
 * @param landUseCategory - Land use category of the meshblock
 * @param populationDensity - Population density value
 * @param viewMode - Current view mode
 * @param opacity - Desired opacity
 * @returns Color string
 */
export function getMeshblockColor(
  landUseCategory: LandUseCategory,
  populationDensity: number,
  viewMode: MeshblockViewMode,
  opacity: number = 0.7
): string {
  if (viewMode === MeshblockViewMode.LAND_USE) {
    return adjustColorOpacity(LAND_USE_COLORS[landUseCategory], opacity);
  } else {
    // Use the helper function that already handles the type correctly
    const baseColor = getGroundRiskClassColor(populationDensity);
    return adjustColorOpacity(baseColor, opacity);
  }
}

/**
 * Creates legend data for UI components
 * @param viewMode - Current view mode
 * @returns Array of legend items with labels and colors
 */
export function createLegendData(viewMode: MeshblockViewMode): Array<{label: string; color: string}> {
  if (viewMode === MeshblockViewMode.LAND_USE) {
    return Object.entries(LAND_USE_COLORS).map(([category, color]) => ({
      label: category,
      color: color
    }));
  } else {
    // Return ground risk classes instead of density ranges
    return [
      { label: GroundRiskClass.ISOLATED, color: POPULATION_DENSITY_BREAKPOINTS[0] },
      { label: GroundRiskClass.SCARCELY_POPULATED, color: POPULATION_DENSITY_BREAKPOINTS[5] },
      { label: GroundRiskClass.LIGHTLY_POPULATED, color: POPULATION_DENSITY_BREAKPOINTS[50] },
      { label: GroundRiskClass.SPARSELY_POPULATED, color: POPULATION_DENSITY_BREAKPOINTS[500] },
      { label: GroundRiskClass.SUBURBAN_LOW_DENSITY, color: POPULATION_DENSITY_BREAKPOINTS[5000] },
      { label: GroundRiskClass.HIGH_DENSITY_METROPOLITAN, color: POPULATION_DENSITY_BREAKPOINTS[50000] },
      { label: GroundRiskClass.ASSEMBLIES_OF_PEOPLE, color: POPULATION_DENSITY_BREAKPOINTS[100000] }
    ];
  }
}

/**
 * Calculates contrast ratio between two colors for accessibility compliance
 * @param color1 - First color (hex)
 * @param color2 - Second color (hex)
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = hex.replace('#', '').match(/.{2}/g);
    if (!rgb) return 0;
    
    const [r, g, b] = rgb.map(c => {
      const channel = parseInt(c, 16) / 255;
      return channel <= 0.03928 
        ? channel / 12.92 
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Validates that color scheme meets WCAG accessibility standards
 * @param backgroundColor - Background color to test against
 * @returns Object indicating which colors pass accessibility tests
 */
export function validateAccessibility(backgroundColor: string = '#ffffff'): {
  landUse: Record<LandUseCategory, boolean>;
  populationDensity: boolean[];
} {
  const landUseResults = {} as Record<LandUseCategory, boolean>;
  
  // Test land use colors against background
  Object.entries(LAND_USE_COLORS).forEach(([category, color]) => {
    const contrast = calculateContrastRatio(color, backgroundColor);
    landUseResults[category as LandUseCategory] = contrast >= 3.0; // WCAG AA for graphics
  });
  
  // Test population density colors against background
  const densityResults = Object.values(POPULATION_DENSITY_BREAKPOINTS).map(color => {
    const contrast = calculateContrastRatio(color, backgroundColor);
    return contrast >= 3.0;
  });
  
  return {
    landUse: landUseResults,
    populationDensity: densityResults
  };
}

/**
 * Dynamic color adjustment for intersection highlighting
 * @param baseColor - Base color to adjust
 * @param highlighted - Whether the meshblock is highlighted
 * @returns Adjusted color with appropriate emphasis
 */
export function getIntersectionHighlightColor(baseColor: string, highlighted: boolean): string {
  if (!highlighted) {
    return adjustColorOpacity(baseColor, 0.7);
  }
  
  // Increase saturation and add glow effect for highlighted meshblocks
  return adjustColorOpacity('#ff6b35', 0.9); // Orange highlight for flight path intersections
}

/**
 * Color utilities for different zoom levels
 * Adjusts visibility and detail based on map zoom
 */
export const ZOOM_DEPENDENT_STYLING = {
  // Zoom 13-15: Basic colors with medium opacity
  basic: {
    fillOpacity: 0.6,
    strokeOpacity: 0.8,
    strokeWidth: 0.5
  },
  // Zoom 15-17: Enhanced colors with higher opacity
  detailed: {
    fillOpacity: 0.8,
    strokeOpacity: 1.0,
    strokeWidth: 1.0
  },
  // Zoom 17+: Full opacity with detailed strokes
  maximum: {
    fillOpacity: 0.9,
    strokeOpacity: 1.0,
    strokeWidth: 1.5
  }
};

/**
 * Gets appropriate styling based on current zoom level
 * @param zoom - Current map zoom level
 * @returns Styling configuration object
 */
export function getZoomDependentStyling(zoom: number): typeof ZOOM_DEPENDENT_STYLING.basic {
  if (zoom >= 17) {
    return ZOOM_DEPENDENT_STYLING.maximum;
  } else if (zoom >= 15) {
    return ZOOM_DEPENDENT_STYLING.detailed;
  } else {
    return ZOOM_DEPENDENT_STYLING.basic;
  }
}