/**
 * PlanVerification/index.ts
 * 
 * Purpose:
 * Main entry point for the Plan Verification system.
 * Re-exports components for easier imports throughout the application.
 * 
 * Usage:
 * import { PlanVerificationDashboard } from '@/components/PlanVerification';
 */

// Export the dashboard component
export { default as PlanVerificationDashboard } from './PlanVerificationDashboard';

// Re-export utility functions
export * from './Utils';