/**
 * PlanVerification/Utils/types.ts
 * 
 * Purpose:
 * Defines shared types and interfaces for the Plan Verification system.
 * Creates a type-safe foundation for all verification components.
 * 
 * Related Components:
 * - ToolsDashboard: Uses these types to render the verification UI
 * - Card components: Implement and extend these interfaces
 * - Utility functions: Process flight plan data using these types
 */

import { ReactNode } from 'react';
import { ElevationService } from '@/app/services/ElevationService';
import { FlightPlanData } from '@/app/context/FlightPlanContext';

/**
 * Status of a verification check
 */
export type VerificationStatus = 'pending' | 'loading' | 'success' | 'error' | 'warning';

/**
 * Represents a waypoint coordinate with index
 */
export interface WaypointCoordinate {
  coord: number[];                 // Coordinate [lng, lat, alt]
  index: number;                   // Index in the flight plan
}

/**
 * A sub-section of a verification card
 */
export interface VerificationSubSection {
  title: string;                  // Sub-section title
  content: ReactNode;             // Rendered content
}

/**
 * Represents a section in the verification dashboard
 */
export interface VerificationSection {
  id: string;                      // Unique identifier
  title: string;                   // Display title
  description: string;             // Brief description
  status: VerificationStatus;      // Current status
  details?: string[];              // Optional detail messages
  action?: () => void;             // Optional primary action callback
  actionLabel?: string;            // Label for primary action
  actions?: ReactNode;             // Custom action buttons
  subSections?: VerificationSubSection[]; // Child sections
}

/**
 * Base props for all verification card components
 */
export interface VerificationCardProps {
  isExpanded: boolean;             // Whether section is expanded
  onToggleExpanded: () => void;    // Toggle expansion callback
  flightPlan: FlightPlanData | null; // Current flight plan
  onTogglePanel?: (panel: "energy" | "los" | "terrain" | null) => void; // Panel toggle callback
}

/**
 * Props for the ToolsDashboard
 */
export interface ToolsDashboardProps {
  onTogglePanel: (panel: "energy" | "los" | "terrain" | null) => void;
}

/**
 * Interface to a map and its services
 */
export interface MapInterface {
  map: any | null;
  toggleLayer: (layerId: string) => void;
  elevationService?: ElevationService;
}

/**
 * Error handling callback
 */
export type ErrorHandler = (message: string) => void;

/**
 * Result of a terrain analysis
 */
export interface TerrainAnalysisResult {
  minimumClearance: number;
  criticalPointDistance: number | null;
  highestObstacle: number;
  hasCollision: boolean;
}