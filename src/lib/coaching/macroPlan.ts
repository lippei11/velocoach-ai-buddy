/**
 * macroPlan.ts — re-exports from planningCore.ts
 *
 * planningCore.ts is now a shim that re-exports from the deploy-safe source
 * of truth: supabase/functions/_shared/planningCore.ts.
 * This file is kept for backwards compatibility with existing imports.
 */
export type {
  DeloadPattern,
  DeloadTrigger,
  DeloadStrategy,
  MacroStrategy,
  PlanPhase,
  StrengthPolicy,
  PlanStructure,
  WeekContext,
  WeekSkeletonValidationError,
} from './planningCore';

export {
  generatePlanStructure,
  getPhaseForDate,
  getWeekContext,
  shouldActivateAdaptiveDeload,
  buildWeeklyStressBudget,
  validateWeekSkeleton,
  PHASE_LOAD,
} from './planningCore';
