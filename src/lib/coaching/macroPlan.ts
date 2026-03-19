import { addDays, differenceInDays, format, parseISO } from 'date-fns';
import constitutionData from './constitutionData';
import type { Phase, EventDemandProfile, SessionPurpose } from './velocoach-interfaces';

// =============================================================================
// TYPES (local to this module — not yet in velocoach-interfaces.ts)
// =============================================================================

export type DeloadPattern =
  | 'every_3_weeks'
  | 'every_4_weeks'
  | 'phase_end'
  | 'none';

export type DeloadTrigger =
  | 'travel_week'
  | 'illness'
  | 'low_readiness_pattern'
  | 'missed_workout_cluster'
  | 'user_requested_light_week';

export interface DeloadStrategy {
  defaultPattern: DeloadPattern;
  flexibleInsertionAllowed: boolean;
  triggers: DeloadTrigger[];
  tssMultiplier: number;
  reduceQualitySessionsTo: number;
}

export type MacroStrategy =
  | 'base_heavy'
  | 'balanced'
  | 'specificity_heavy'
  | 'compressed'
  | 'extended_prep';

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

// =============================================================================
// CONSTANTS (S6.4 + S7a)
// =============================================================================

const CONSTITUTION_VERSION: string = constitutionData.version;

const PHASE_LOAD: Record<
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
  steady_climbing:     ['climb_simulation', 'back_to_back', 'long_ride', 'threshold'],
  time_trial:          ['threshold', 'sweet_spot'],
  punchy_stochastic:   ['vo2max', 'sprint', 'threshold'],
  long_gravel:         ['long_ride', 'back_to_back', 'endurance'],
  ultra_endurance:     ['long_ride', 'back_to_back', 'endurance'],
  ftp_build:           ['sweet_spot', 'threshold'],
  mixed_hobby_fitness: ['endurance', 'sweet_spot', 'long_ride'],
};

// =============================================================================
// HELPERS
// =============================================================================

function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function getBuildSessions(profile: EventDemandProfile | null): SessionPurpose[] {
  if (!profile) return ['sweet_spot', 'threshold', 'long_ride'];
  return BUILD_SESSIONS[profile];
}

function getKeySessionTypes(
  phase: Phase,
  profile: EventDemandProfile | null
): SessionPurpose[] {
  switch (phase) {
    case 'base':
      return ['endurance', 'long_ride', 'sweet_spot'];
    case 'build':
      return getBuildSessions(profile);
    case 'peak': {
      const build = getBuildSessions(profile);
      if (profile === 'steady_climbing' && !build.includes('climb_simulation')) {
        return [...build, 'climb_simulation'];
      }
      return build;
    }
    case 'taper':
      return ['endurance', 'threshold'];
  }
}

function getDeloadStrategy(phase: Phase, phaseWeeks: number): DeloadStrategy {
  const allTriggers: DeloadTrigger[] = [
    'travel_week',
    'illness',
    'low_readiness_pattern',
    'missed_workout_cluster',
    'user_requested_light_week',
  ];
  if (phase === 'base') {
    const pattern: DeloadPattern = phaseWeeks >= 6 ? 'every_3_weeks' : 'every_4_weeks';
    return {
      defaultPattern: pattern,
      flexibleInsertionAllowed: true,
      triggers: allTriggers,
      tssMultiplier: 0.6,
      reduceQualitySessionsTo: 0,
    };
  }
  if (phase === 'build') {
    return {
      defaultPattern: 'every_3_weeks',
      flexibleInsertionAllowed: true,
      triggers: allTriggers,
      tssMultiplier: 0.6,
      reduceQualitySessionsTo: 1,
    };
  }
  // peak / taper
  return {
    defaultPattern: 'none',
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
  if (pattern === 'none') return [];
  const interval = pattern === 'every_3_weeks' ? 3 : 4;
  const deloads: number[] = [];
  for (let wk = interval; wk <= phaseWeeks; wk += interval) {
    deloads.push(phaseStartWeek + wk - 1);
  }
  return deloads;
}

// Inner strategy (for phase allocation — excludes compressed/extended_prep)
type InnerStrategy = 'base_heavy' | 'balanced' | 'specificity_heavy';

function selectInnerStrategy(
  profile: EventDemandProfile | null,
  hoursPerWeek: number,
  currentCtl: number | null
): InnerStrategy {
  if (
    profile === 'steady_climbing' ||
    profile === 'long_gravel' ||
    profile === 'ultra_endurance'
  )
    return 'base_heavy';

  if (profile === 'time_trial' || profile === 'ftp_build')
    return 'specificity_heavy';

  if (profile === 'mixed_hobby_fitness' || profile === 'punchy_stochastic')
    return 'balanced';

  // Remaining profiles (gran_fondo, or null) → hours + CTL driven
  if (hoursPerWeek >= 9) return 'base_heavy';
  if (currentCtl === null || currentCtl < 30) return 'base_heavy';
  if (hoursPerWeek <= 7) return 'specificity_heavy';
  return 'balanced';
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

  if (strategy === 'base_heavy') {
    base = Math.ceil(remainder * 0.60);
    build = remainder - base;
  } else if (strategy === 'balanced') {
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
    base: 'Aerobic foundation, fat metabolism, long-ride durability.',
    build: 'Event-specific intensity, TSS progression, quality sessions.',
    peak: 'Sharpen fitness, reduce volume, maintain intensity.',
    taper: 'Freshness for event. Minimal TSS, maintain race-pace touches.',
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
// PUBLIC API
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
    macroStrategy = 'compressed';
    planStartDate = todayDate;
    totalWeeks = Math.max(2, Math.ceil(daysToEvent / 7));
    innerStrategy = 'balanced'; // unused for compressed
  } else if (daysToEvent !== null && daysToEvent > 168) {
    // Extended prep — > 24 weeks: use final 24 weeks
    macroStrategy = 'extended_prep';
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
    macroStrategy === 'compressed'
      ? computeCompressedDurations(totalWeeks)
      : computePhaseDurations(innerStrategy, totalWeeks);

  // --- Build phases array ---
  const phases: PlanPhase[] = [];
  let weekOffset = 0;

  if (durations.base > 0) {
    phases.push(buildPhase('base', durations.base, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.base;
  }
  if (durations.build > 0) {
    phases.push(buildPhase('build', durations.build, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.build;
  }
  if (durations.peak > 0) {
    phases.push(buildPhase('peak', durations.peak, planStartDate, weekOffset, eventDemandProfile));
    weekOffset += durations.peak;
  }
  if (durations.taper > 0) {
    phases.push(buildPhase('taper', durations.taper, planStartDate, weekOffset, eventDemandProfile));
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
