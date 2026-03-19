/**
 * macroPlan.ts — re-exports from planningCore.ts
 *
 * All macro-planning logic has moved to planningCore.ts so it can be shared
 * with the Deno edge functions via supabase/functions/_shared/planningCore.ts.
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
