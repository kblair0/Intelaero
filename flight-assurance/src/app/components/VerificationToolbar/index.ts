/**
 * PlanVerification/index.ts
 * 
 * Purpose:
 * Main entry point for the Plan Verification system.
 * Re-exports components for easier imports throughout the application.
 * 
 * Usage:
 * import { ToolsDashboard } from '@/components/PlanVerification';
 */

// Export the dashboard component
export { default as ToolsDashboard } from './ToolsDashboard';

// Re-export utility functions
export * from './Utils';