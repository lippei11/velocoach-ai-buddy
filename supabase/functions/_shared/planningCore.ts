// @ts-nocheck — Deno edge function; types resolved at Deno runtime
/**
 * planningCore.ts — Deploy-safe source of truth for all macro-planning logic.
 *
 * This file is fully self-contained within supabase/functions/ so the Supabase
 * bundler never needs to resolve paths outside the function tree.
 *
 * Node/Vite app code re-exports from here via src/lib/coaching/planningCore.ts.
 *
 * Imports:
 *   - "date-fns"         resolved via supabase/functions/import_map.json → npm:date-fns
 *   - "./constitution.json"  co-located in _shared/
 */

import { addDays, differenceInDays, format, parseISO } from "date-fns";
import constitutionData from "./constitution.json";

// =============================================================================
// INLINE TYPES (kept in sync with src/lib/coaching/velocoach-interfaces.ts)
// Defined here so this file has zero imports from src/
// =============================================================================

export type Phase = "base" | "build" | "peak" | "taper";

export type EventDemandProfile =
  | "steady_climbing"
  | "time_trial"
  | "punchy_stochastic"
  | "long_gravel"
  | "ultra_endurance"
  | "ftp_build"
  | "mixed_hobby_fitness";

export type SessionPurpose =
  | "recovery"
  | "endurance"
  | "long_ride"
  | "sweet_spot"
  | "threshold"
  | "back_to_back"
  | "climb_simulation"
  | "vo2max"
  | "sprint"
  | "strength";

type ConstitutionData = typeof constitutionData;

// =============================================================================
// TYPES
// =============================================================================

export type DeloadPattern =
  | "every_3_weeks"
  | "every_4_weeks"
  | "phase_end"
  | "none";

export type DeloadTrigger =
  | "travel_week"
  | "illness"
  | "low_readiness_pattern"
  | "missed_workout_cluster"
  | "user_requested_light_week";

export interface DeloadStrategy {
  defaultPattern: DeloadPattern;
  flexibleInsertionAllowed: boolean;
  triggers: DeloadTrigger[];
  tssMultiplier: number;
  reduceQualitySessionsTo: number;
}

export type MacroStrategy =
  | "base_heavy"
  | "balanced"
  | "specificity_heavy"
  | "compressed"
  | "extended_prep";

export interface PlanPhase {
  phase: Phase;
  startDate: string;
  endDate: string;
  weeks: number;
  weekNumbers: number[];
  deloadWeeks: number[];
  weeklyLoadFactorRange: [number, number];
  maxQualitySessions: number;
  longRideTssRatioPct: [number, number];
  deloadStrategy: DeloadStrategy;
  keySessionTypes: SessionPurpose[];
  notes: string;
}

export interface StrengthPolicy {
  base: number;
  build: number;
  peak: number;
  taper: number;
}

export interface PlanStructure {
  planStartDate: string;
  eventDate: string | null;
  totalWeeks: number;
  phases: PlanPhase[];
  eventDemandProfile: EventDemandProfile | null;
  constitutionVersion: string;
  strengthSessionsPerWeek: StrengthPolicy;
  macroStrategy: MacroStrategy;
}

export interface WeekContext {
  phase: PlanPhase;
  weekNumberInPlan: number;
  weekNumberInPhase: number;
  isDeloadWeek: boolean;
  isLastWeekOfPhase: boolean;
  isFirstWeekOfPhase: boolean;
  weeksUntilEvent: number | null;
}

export interface WeekSkeletonValidationError {
  field: string;
  code: string;
  message: string;
}

// =============================================================================
// CONSTANTS (S6.4 + S7a)
// =============================================================================

const CONSTITUTION_VERSION: string = constitutionData.version;

export const PHASE_LOAD: Record<
  Phase,
  {
    weeklyLoadFactorRange: [number, number];
    maxQualitySessions: number;
    longRideTssRatioPct: [number, number];
  }
> = {
  base:  { weeklyLoadFactorRange: [5.5, 7.0], maxQualitySessions: 1, longRideTssRatioPct: [38, 50] },
  build: { weeklyLoadFactorRange: [6.5, 8.0], maxQualitySessions: 2, longRideTssRatioPct: [35, 45] },
  peak:  { weeklyLoadFactorRange: [5.0, 6.0], maxQualitySessions: 2, longRideTssRatioPct: [32, 40] },
  taper: { weeklyLoadFactorRange: [2.5, 4.0], maxQualitySessions: 1, longRideTssRatioPct: [25, 35] },
};

const BUILD_SESSIONS: Record<EventDemandProfile, SessionPurpose[]> = {
  steady_climbing:     ["climb_simulation", "back_to_back", "long_ride", "threshold"],
  time_trial:          ["threshold", "sweet_spot"],
  punchy_stochastic:   ["vo2max", "sprint", "threshold"],
  long_gravel:         ["long_ride", "back_to_back", "endurance"],
  ultra_endurance:     ["long_ride", "back_to_back", "endurance"],
  ftp_build:           ["sweet_spot", "threshold"],
  mixed_hobby_fitness: ["endurance", "sweet_spot", "long_ride"],
};

// =============================================================================
// HELPERS
// =============================================================================

function isoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function getBuildSessions(profile: EventDemandProfile | null): SessionPurpose[] {
  if (!profile) return ["sweet_spot", "threshold", "long_ride"];
  return BUILD_SESSIONS[profile];
}

function getKeySessionTypes(
  phase: Phase,
  profile: EventDemandProfile | null
): SessionPurpose[] {
  switch (phase) {
    case "base":
      return ["endurance", "long_ride", "sweet_spot"];
    case "build":
      return getBuildSessions(profile);
    case "peak": {
      const build = getBuildSessions(profile);
      if (profile === "steady_climbing" && !build.includes("climb_simulation")) {
        return [...build, "climb_simulation"];
      }
      return build;
    }
    case "taper":
      return ["endurance", "threshold"];
  }
}

function getDeloadStrategy(phase: Phase, phaseWeeks: number): DeloadStrategy {
  const allTriggers: DeloadTrigger[] = [
    "travel_week",
    "illness",
    "low_readiness_pattern",
    "missed_workout_cluster",
    "user_requested_light_week",
  ];
  if (phase === "base") {
    const pattern: DeloadPattern = phaseWeeks >= 6 ? "every_3_weeks" : "every_4_weeks";
    return {
      defaultPattern: pattern,
      flexibleInsertionAllowed: true,
      triggers: allTriggers,
      tssMultiplier: 0.6,
      reduceQualitySessionsTo: 0,
    };
  }
  if (phase === "build") {
    return {
      defaultPattern: "every_3_weeks",
      flexibleInsertionAllowed: true,
      triggers: allTriggers,
      tssMultiplier: 0.6,
      reduceQualitySessionsTo: 1,
    };
  }
  // peak / taper
  return {
    defaultPattern: "none",
    flexibleInsertionAllowed: false,
    triggers: [],
    tssMultiplier: 1.0,
    reduceQualitySessionsTo: 1,
  };
}

function computeDeloadWeeks(
  phaseWeeks: number,
  pattern: DeloadPattern,
  phaseStartWeek: number
): number[] {
  if (pattern === "none") return [];
  const interval = pattern === "every_3_weeks" ? 3 : 4;
  const deloads: number[] = [];
  for (let wk = interval; wk <= phaseWeeks; wk += interval) {
    deloads.push(phaseStartWeek + wk - 1);
  }
  return deloads;
}

// Inner strategy (for phase allocation — excludes compressed/extended_prep)
type InnerStrategy = "base_heavy" | "balanced" | "specificity_heavy";

function selectInnerStrategy(
  profile: EventDemandProfile | null,
  hoursPerWeek: number,
  currentCtl: number | null
): InnerStrategy {
  if (
    profile === "steady_climbing" ||
    profile === "long_gravel" ||
    profile === "ultra_endurance"
  )
    return "base_heavy";

  if (profile === "time_trial" || profile === "ftp_build")
    return "specificity_heavy";

  if (profile === "mixed_hobby_fitness" || profile === "punchy_stochastic")
    return "balanced";

  // Remaining profiles (gran_fondo, or null) → hours + CTL driven
  if (hoursPerWeek >= 9) return "base_heavy";
  if (currentCtl === null || currentCtl < 30) return "base_heavy";
  if (hoursPerWeek <= 7) return "specificity_heavy";
  return "balanced";
}

function computePhaseDurations(
  strategy: InnerStrategy,
  totalWeeks: number
): { base: number; build: number; peak: number; taper: number } {
  let taper: number;
  let peak: number;

  if (totalWeeks <= 8) {
    taper = totalWeeks >= 8 ? 2 : 1;
    peak = 1;
  } else if (totalWeeks <= 16) {
    taper = 2;
    peak = 2;
  } else {
    taper = 2;
    peak = 3;
  }

  const remainder = totalWeeks - taper - peak;

  let base: number;
  let build: number;

  if (strategy === "base_heavy") {
    base = Math.ceil(remainder * 0.60);
    build = remainder - base;
  } else if (strategy === "balanced") {
    // BUILD >= BASE (hobby-athlete default: slightly build-biased)
    build = Math.ceil(remainder * 0.55);
    base = remainder - build;
  } else {
    // specificity_heavy: BUILD dominates
    build = Math.ceil(remainder * 0.70);
    base = remainder - build;
  }

  // Guarantee minimum 1 for both active phases
  if (base < 1 && remainder >= 2) { base = 1; build = remainder - 1; }
  if (build < 1 && remainder >= 2) { build = 1; base = remainder - 1; }

  return { base, build, peak, taper };
}

function computeCompressedDurations(
  totalWeeks: number
): { base: number; build: number; peak: number; taper: number } {
  const taper = totalWeeks > 3 ? 2 : 1;
  const peak = totalWeeks - taper;
  return { base: 0, build: 0, peak, taper };
}

function computeStrengthPolicy(
  hoursPerWeek: number,
  eventDate: string | null,
  planEndDate: string,
  userCap?: number
): StrengthPolicy {
  const capFn = (v: number) =>
    userCap !== undefined ? Math.min(v, userCap) : v;

  const basePolicy = hoursPerWeek >= 8 ? 2 : 1;

  // PEAK: 0 if event within 10 days of plan end; otherwise 1
  let peakPolicy = 1;
  if (eventDate) {
    const daysEventToPlanEnd = differenceInDays(
      parseISO(planEndDate),
      parseISO(eventDate)
    );
    // eventDate is at plan end or past it → event is within 10 days
    if (Math.abs(daysEventToPlanEnd) <= 10) peakPolicy = 0;
  }

  return {
    base: capFn(basePolicy),
    build: capFn(1),
    peak: capFn(peakPolicy),
    taper: 0, // always 0, cap doesn't apply upward
  };
}

function buildPhase(
  phase: Phase,
  weeks: number,
  planStartDate: string,
  weekOffset: number, // cumulative weeks before this phase
  profile: EventDemandProfile | null
): PlanPhase {
  const startDate = isoDate(addDays(parseISO(planStartDate), weekOffset * 7));
  const endDate = isoDate(addDays(parseISO(planStartDate), (weekOffset + weeks) * 7 - 1));

  const weekNumbers: number[] = [];
  for (let i = 1; i <= weeks; i++) {
    weekNumbers.push(weekOffset + i);
  }

  const deloadStrat = getDeloadStrategy(phase, weeks);
  const deloadWeeks = computeDeloadWeeks(
    weeks,
    deloadStrat.defaultPattern,
    weekOffset + 1
  );

  const load = PHASE_LOAD[phase];

  const phaseNotes: Record<Phase, string> = {
    base: "Aerobic foundation, fat metabolism, long-ride durability.",
    build: "Event-specific intensity, TSS progression, quality sessions.",
    peak: "Sharpen fitness, reduce volume, maintain intensity.",
    taper: "Freshness for event. Minimal TSS, maintain race-pace touches.",
  };

  return {
    phase,
    startDate,
    endDate,
    weeks,
    weekNumbers,
    deloadWeeks,
    weeklyLoadFactorRange: load.weeklyLoadFactorRange,
    maxQualitySessions: load.maxQualitySessions,
    longRideTssRatioPct: load.longRideTssRatioPct,
    deloadStrategy: deloadStrat,
    keySessionTypes: getKeySessionTypes(phase, profile),
    notes: phaseNotes[phase],
  };
}

// =============================================================================
// PUBLIC API — MACRO PLAN
// =============================================================================

export function generatePlanStructure(input: {
  eventDate: string | null;
  todayDate: string;
  currentCtl: number | null;
  eventDemandProfile: EventDemandProfile | null;
  hoursPerWeek: number;
  strengthSessionsPerWeek?: number;
}): PlanStructure {
  const {
    eventDate,
    todayDate,
    currentCtl,
    eventDemandProfile,
    hoursPerWeek,
    strengthSessionsPerWeek,
  } = input;

  const daysToEvent = eventDate
    ? differenceInDays(parseISO(eventDate), parseISO(todayDate))
    : null;

  // --- Macro strategy selection ---
  let macroStrategy: MacroStrategy;
  let planStartDate: string;
  let totalWeeks: number;
  let innerStrategy: InnerStrategy;

  if (daysToEvent !== null && daysToEvent < 42) {
    // Compressed — < 6 weeks
    macroStrategy = "compressed";
    planStartDate = todayDate;
    totalWeeks = Math.max(2, Math.ceil(daysToEvent / 7));
    innerStrategy = "balanced"; // unused for compressed
  } else if (daysToEvent !== null && daysToEvent > 168) {
    // Extended prep — > 24 weeks: use final 24 weeks
    macroStrategy = "extended_prep";
    planStartDate = isoDate(addDays(parseISO(eventDate!), -24 * 7));
    totalWeeks = 24;
    innerStrategy = selectInnerStrategy(eventDemandProfile, hoursPerWeek, currentCtl);
  } else if (eventDate === null) {
    // No event → 12-week default
    macroStrategy = selectInnerStrategy(eventDemandProfile, hoursPerWeek, currentCtl) as MacroStrategy;
    planStartDate = todayDate;
    totalWeeks = 12;
    innerStrategy = selectInnerStrategy(eventDemandProfile, hoursPerWeek, currentCtl);
  } else {
    // Normal structured plan 6–24 weeks
    innerStrategy = selectInnerStrategy(eventDemandProfile, hoursPerWeek, currentCtl);
    macroStrategy = innerStrategy as MacroStrategy;
    planStartDate = todayDate;
    totalWeeks = Math.round(daysToEvent / 7);
    totalWeeks = Math.max(6, Math.min(24, totalWeeks));
  }

  // --- Phase duration allocation ---
  const durations =
    macroStrategy === "compressed"
      ? computeCompressedDurations(totalWeeks)
      : computePhaseDurations(innerStrategy, totalWeeks);

  // --- Build phases array ---
  const phases: PlanPhase[] = [];
  let weekOffset = 0;

  if (durations.base > 0) {
    phases.push(buildPhase("base", durations.base, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.base;
  }
  if (durations.build > 0) {
    phases.push(buildPhase("build", durations.build, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.build;
  }
  if (durations.peak > 0) {
    phases.push(buildPhase("peak", durations.peak, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.peak;
  }
  if (durations.taper > 0) {
    phases.push(buildPhase("taper", durations.taper, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.taper;
  }

  // --- Strength policy ---
  const planEndDate = isoDate(addDays(parseISO(planStartDate), totalWeeks * 7 - 1));
  const strengthPolicy = computeStrengthPolicy(
    hoursPerWeek,
    eventDate,
    planEndDate,
    strengthSessionsPerWeek
  );

  return {
    planStartDate,
    eventDate,
    totalWeeks,
    phases,
    eventDemandProfile,
    constitutionVersion: CONSTITUTION_VERSION,
    strengthSessionsPerWeek: strengthPolicy,
    macroStrategy,
  };
}

export function getPhaseForDate(
  plan: PlanStructure,
  date: string
): PlanPhase | null {
  const d = parseISO(date);
  for (const phase of plan.phases) {
    if (d >= parseISO(phase.startDate) && d <= parseISO(phase.endDate)) {
      return phase;
    }
  }
  return null;
}

export function getWeekContext(
  plan: PlanStructure,
  weekStartDate: string
): WeekContext | null {
  // Use Wednesday (weekStart + 3) as the representative day to handle
  // planStartDate offsets that don't align with Monday
  const repDay = addDays(parseISO(weekStartDate), 3);
  const daysDiff = differenceInDays(repDay, parseISO(plan.planStartDate));

  if (daysDiff < 0) return null;

  const weekNumberInPlan = Math.floor(daysDiff / 7) + 1;
  if (weekNumberInPlan < 1 || weekNumberInPlan > plan.totalWeeks) return null;

  const phase = plan.phases.find((p) => p.weekNumbers.includes(weekNumberInPlan));
  if (!phase) return null;

  const weekNumberInPhase = weekNumberInPlan - phase.weekNumbers[0] + 1;
  const isDeloadWeek = phase.deloadWeeks.includes(weekNumberInPlan);
  const isLastWeekOfPhase =
    weekNumberInPlan === phase.weekNumbers[phase.weekNumbers.length - 1];
  const isFirstWeekOfPhase = weekNumberInPlan === phase.weekNumbers[0];

  let weeksUntilEvent: number | null = null;
  if (plan.eventDate) {
    const daysToEvent = differenceInDays(
      parseISO(plan.eventDate),
      parseISO(weekStartDate)
    );
    weeksUntilEvent = Math.max(0, Math.ceil(daysToEvent / 7));
  }

  return {
    phase,
    weekNumberInPlan,
    weekNumberInPhase,
    isDeloadWeek,
    isLastWeekOfPhase,
    isFirstWeekOfPhase,
    weeksUntilEvent,
  };
}

export function shouldActivateAdaptiveDeload(
  phase: PlanPhase,
  triggers: DeloadTrigger[]
): boolean {
  if (!phase.deloadStrategy.flexibleInsertionAllowed) return false;
  return triggers.some((t) => phase.deloadStrategy.triggers.includes(t));
}

// =============================================================================
// PUBLIC API — WEEK BUDGET
// =============================================================================

/**
 * Computes the weekly stress budget for a given week.
 * This is the authoritative source of session-type caps and TSS targets.
 * The returned WeeklyStressBudget has planned* fields initialised to 0 —
 * the Planning Agent fills those in as it assigns sessions.
 */
export function buildWeeklyStressBudget(
  ctx: WeekContext,
  constitution: ConstitutionData,
  athleteState: any
): any {
  const { phase, isDeloadWeek } = ctx;
  const ctl = athleteState.recentLoad.ctl ?? 40;
  const hoursAvailable = athleteState.weeklyContext.hoursAvailable;

  // TSS target = CTL × load factor (midpoint of phase range)
  const loadRange = PHASE_LOAD[phase.phase].weeklyLoadFactorRange;
  const loadMid = (loadRange[0] + loadRange[1]) / 2;
  const deloadMultiplier = isDeloadWeek ? phase.deloadStrategy.tssMultiplier : 1.0;

  let weeklyTssTarget = Math.round(ctl * loadMid * deloadMultiplier);
  // Cap to available hours (approx 75 TSS/hour hard ceiling)
  const hoursCap = Math.round(hoursAvailable * 75);
  weeklyTssTarget = Math.min(weeklyTssTarget, hoursCap);

  const weeklyTssMin = Math.round(ctl * loadRange[0] * deloadMultiplier);
  const weeklyTssMax = Math.min(Math.round(ctl * loadRange[1] * deloadMultiplier), hoursCap);

  // Session caps from constitution defaults
  const defaults = constitution.stress_budget_defaults;
  let maxThresholdSessions = defaults.threshold_per_week;
  let maxVo2Sessions = defaults.vo2max_per_week;

  // Phase adjustments
  if (phase.phase === "taper") {
    maxThresholdSessions = 1;
    maxVo2Sessions = 0;
  } else if (phase.phase === "base") {
    maxVo2Sessions = 0; // no VO2 in base phase
  }

  // Deload week: reduce hard session caps
  if (isDeloadWeek) {
    maxThresholdSessions = Math.max(0, maxThresholdSessions - 1);
    maxVo2Sessions = 0;
  }

  // Recovery signal degradation
  if (athleteState.recovery.lowReadinessPattern) {
    maxThresholdSessions = Math.max(0, maxThresholdSessions - 1);
    maxVo2Sessions = 0;
  }

  // Re-entry context: conservative caps
  if (athleteState.reentryContext !== "none") {
    maxThresholdSessions = Math.min(1, maxThresholdSessions);
    maxVo2Sessions = 0;
  }

  // Neuromuscular only for punchy_stochastic
  const maxNeuromuscularSessions =
    athleteState.eventDemandProfile === "punchy_stochastic"
      ? defaults.neuromuscular_per_week
      : 0;

  const maxDurabilityBlocks = defaults.durability_blocks_per_week;

  // Strength budget: use athlete preference, capped to phase policy
  const userStrengthPref = athleteState.preferences.strengthSessionsPerWeek;
  const maxStrengthSessions =
    phase.phase === "taper"
      ? 0
      : userStrengthPref !== undefined
      ? Math.min(userStrengthPref, phase.phase === "base" ? 2 : 1)
      : phase.phase === "base"
      ? 2
      : 1;

  return {
    weeklyTssTarget,
    weeklyTssMin,
    weeklyTssMax,
    maxThresholdSessions,
    maxVo2Sessions,
    maxNeuromuscularSessions,
    maxDurabilityBlocks,
    maxStrengthSessions,
    // Planned counts start at zero — Planning Agent fills these in
    plannedThreshold: 0,
    plannedVo2: 0,
    plannedNeuromuscular: 0,
    plannedDurability: 0,
    plannedStrength: 0,
    plannedLongRide: false,
    exceptionApplied: false,
  };
}

// =============================================================================
// PUBLIC API — VALIDATION
// =============================================================================

const HARD_SLOT_TYPES = new Set(["threshold", "vo2max", "neuromuscular"]);

/**
 * Validates a WeekSkeleton returned by the LLM Planning Agent.
 * Returns an array of errors (empty = valid).
 *
 * Checks performed:
 * - Required top-level fields present and typed correctly
 * - phase matches the plan phase for weekStartDate
 * - confidence is 0..1
 * - weeklyStressBudget.weeklyTssTarget is present
 * - slots is a non-empty array
 * - Each slot has day (0–6), purpose, durationMinutes (>=15), targetTss (>=0)
 * - All slot days are within availableDays
 * - No back-to-back hard sessions (threshold/vo2max/neuromuscular on consecutive days)
 */
export function validateWeekSkeleton(
  skeleton: unknown,
  plan: PlanStructure,
  weekStartDate: string,
  availableDays: number[]
): WeekSkeletonValidationError[] {
  const errors: WeekSkeletonValidationError[] = [];

  if (!skeleton || typeof skeleton !== "object") {
    return [{ field: "root", code: "INVALID_TYPE", message: "Skeleton must be a non-null object" }];
  }

  const s = skeleton as Record<string, unknown>;

  // Required non-empty string fields
  for (const f of ["userId", "weekStartDate", "phase", "weekFocus", "rationaleShort", "planningAgentVersion"] as const) {
    if (typeof s[f] !== "string" || !(s[f] as string).trim()) {
      errors.push({ field: f, code: "REQUIRED", message: `${f} must be a non-empty string` });
    }
  }

  // Phase must match plan phase for this week
  if (typeof s["phase"] === "string") {
    const ctx = getWeekContext(plan, weekStartDate);
    if (ctx && s["phase"] !== ctx.phase.phase) {
      errors.push({
        field: "phase",
        code: "PHASE_MISMATCH",
        message: `phase "${s["phase"]}" does not match plan phase "${ctx.phase.phase}" for ${weekStartDate}`,
      });
    }
  }

  // confidence: 0..1
  const confidence = s["confidence"];
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    errors.push({ field: "confidence", code: "INVALID_CONFIDENCE", message: "confidence must be a number in [0, 1]" });
  }

  // weeklyStressBudget
  if (!s["weeklyStressBudget"] || typeof s["weeklyStressBudget"] !== "object") {
    errors.push({ field: "weeklyStressBudget", code: "REQUIRED", message: "weeklyStressBudget is required" });
  } else {
    const budget = s["weeklyStressBudget"] as Record<string, unknown>;
    if (typeof budget["weeklyTssTarget"] !== "number" || (budget["weeklyTssTarget"] as number) < 0) {
      errors.push({
        field: "weeklyStressBudget.weeklyTssTarget",
        code: "INVALID_TSS_TARGET",
        message: "weeklyStressBudget.weeklyTssTarget must be a non-negative number",
      });
    }
  }

  // slots
  if (!Array.isArray(s["slots"])) {
    errors.push({ field: "slots", code: "REQUIRED", message: "slots must be an array" });
    return errors;
  }

  const slots = s["slots"] as unknown[];

  if (slots.length === 0) {
    errors.push({ field: "slots", code: "EMPTY_SLOTS", message: "slots array must have at least one session" });
  }

  const hardDays: number[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot || typeof slot !== "object") {
      errors.push({ field: `slots[${i}]`, code: "INVALID_TYPE", message: "Each slot must be an object" });
      continue;
    }
    const sl = slot as Record<string, unknown>;

    // day: integer 0–6
    const day = sl["day"];
    if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) {
      errors.push({ field: `slots[${i}].day`, code: "INVALID_DAY", message: "day must be an integer 0–6 (Mon–Sun)" });
    } else if (!availableDays.includes(day)) {
      errors.push({
        field: `slots[${i}].day`,
        code: "OUTSIDE_AVAILABLE_DAYS",
        message: `Day ${day} is not in athlete's available days [${availableDays.join(", ")}]`,
      });
    }

    // purpose
    if (typeof sl["purpose"] !== "string" || !(sl["purpose"] as string).trim()) {
      errors.push({ field: `slots[${i}].purpose`, code: "REQUIRED", message: "purpose must be a non-empty string" });
    }

    // slotType
    if (typeof sl["slotType"] !== "string" || !(sl["slotType"] as string).trim()) {
      errors.push({ field: `slots[${i}].slotType`, code: "REQUIRED", message: "slotType must be a non-empty string" });
    }

    // durationMinutes
    const dur = sl["durationMinutes"];
    if (typeof dur !== "number" || (dur as number) < 15) {
      errors.push({ field: `slots[${i}].durationMinutes`, code: "INVALID_DURATION", message: "durationMinutes must be >= 15" });
    }

    // targetTss
    const tss = sl["targetTss"];
    if (typeof tss !== "number" || (tss as number) < 0) {
      errors.push({ field: `slots[${i}].targetTss`, code: "INVALID_TSS", message: "targetTss must be a non-negative number" });
    }

    // Track hard days
    if (typeof sl["slotType"] === "string" && HARD_SLOT_TYPES.has(sl["slotType"] as string)) {
      if (typeof day === "number") hardDays.push(day);
    }
  }

  // Back-to-back hard session check
  const sortedHardDays = [...new Set(hardDays)].sort((a, b) => a - b);
  for (let i = 1; i < sortedHardDays.length; i++) {
    if (sortedHardDays[i] - sortedHardDays[i - 1] === 1) {
      errors.push({
        field: "slots",
        code: "BACK_TO_BACK_HARD_DAYS",
        message: `Back-to-back hard sessions on days ${sortedHardDays[i - 1]} and ${sortedHardDays[i]} (${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][sortedHardDays[i - 1]]} / ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][sortedHardDays[i]]})`,
      });
    }
  }

  return errors;
}
