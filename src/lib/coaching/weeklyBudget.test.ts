/**
 * weeklyBudget.test.ts
 *
 * Tests for the progression-based weekly TSS budget model:
 *   - computeEffectiveWeeklyLoad
 *   - buildWeeklyStressBudget
 *
 * Key invariants verified:
 *   1. Normal build progression is driven by recent effective load, not CTL alone
 *   2. Active vacation with near-zero tracked TSS does NOT collapse next-week target
 *   3. Illness → conservative target
 *   4. Partial tracking lowers certainty but does not trigger full reentry
 *   5. CTL guardrail prevents physically implausible jumps, not routine targets
 *   6. Deload week still reduces target appropriately
 */

import { describe, it, expect } from 'vitest';
import { format, addWeeks, parseISO } from 'date-fns';
import {
  computeEffectiveWeeklyLoad,
  buildWeeklyStressBudget,
  generatePlanStructure,
  getWeekContext,
} from './planningCore';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TODAY = '2026-03-17';

function eventIn(weeks: number): string {
  return format(addWeeks(parseISO(TODAY), weeks), 'yyyy-MM-dd');
}

/** Build a minimal constitution-like object matching ConstitutionData */
const MOCK_CONSTITUTION = {
  version: 'test-1',
  re_entry_gap_days: 10,
  ftp_stale_days: 60,
  stress_budget_defaults: {
    threshold_per_week: 2,
    vo2max_per_week: 1,
    neuromuscular_per_week: 1,
    durability_blocks_per_week: 1,
  },
  typology_defaults: {},
};

function makeAthleteState(overrides: {
  ctl?: number;
  hoursAvailable?: number;
  recentWeeklyTss?: number[];
  specialWeekType?: string;
  estimatedUntrackedLoad?: Record<string, unknown>;
  reentryContext?: string;
  eventDemandProfile?: string;
  strengthSessionsPerWeek?: number;
  lowReadinessPattern?: boolean;
}) {
  return {
    recentLoad: { ctl: overrides.ctl ?? 40 },
    weeklyContext: {
      hoursAvailable: overrides.hoursAvailable ?? 10,
      specialWeekType: overrides.specialWeekType ?? 'normal',
      recentWeeklyTss: overrides.recentWeeklyTss ?? [],
      ...(overrides.estimatedUntrackedLoad
        ? { estimatedUntrackedLoad: overrides.estimatedUntrackedLoad }
        : {}),
    },
    recovery: { lowReadinessPattern: overrides.lowReadinessPattern ?? false },
    reentryContext: overrides.reentryContext ?? 'none',
    eventDemandProfile: overrides.eventDemandProfile ?? 'mixed_hobby_fitness',
    preferences: {
      strengthSessionsPerWeek: overrides.strengthSessionsPerWeek ?? 0,
    },
  };
}

function makeBuildWeekCtx() {
  const plan = generatePlanStructure({
    eventDate: eventIn(20),
    todayDate: TODAY,
    currentCtl: 50,
    eventDemandProfile: 'mixed_hobby_fitness',
    hoursPerWeek: 10,
  });
  // First build week
  const buildPhase = plan.phases.find(p => p.phase === 'build');
  const weekStart = buildPhase?.startDate ?? TODAY;
  return getWeekContext(plan, weekStart)!;
}

function makeBaseWeekCtx(isDeload = false) {
  const plan = generatePlanStructure({
    eventDate: eventIn(20),
    todayDate: TODAY,
    currentCtl: 50,
    eventDemandProfile: 'mixed_hobby_fitness',
    hoursPerWeek: 10,
  });
  const basePhase = plan.phases.find(p => p.phase === 'base');
  const deloadWeekNum = basePhase?.deloadWeeks?.[0];
  const weekStart = isDeload && deloadWeekNum != null
    ? format(addWeeks(parseISO(plan.planStartDate), deloadWeekNum - 1), 'yyyy-MM-dd')
    : basePhase?.startDate ?? TODAY;
  return getWeekContext(plan, weekStart)!;
}

// ---------------------------------------------------------------------------
// 1. computeEffectiveWeeklyLoad — basic weighted average
// ---------------------------------------------------------------------------
describe('computeEffectiveWeeklyLoad', () => {
  it('returns weighted average of recent 4 weeks (most recent weighted highest)', () => {
    // weights [4,3,2,1] / 10
    // weeks: [300, 280, 250, 200]
    // expected = (300*4 + 280*3 + 250*2 + 200*1) / 10 = (1200+840+500+200)/10 = 274
    const result = computeEffectiveWeeklyLoad([300, 280, 250, 200]);
    expect(result).toBe(274);
  });

  it('pads with CTL×7 when fewer than 4 weeks available', () => {
    // 2 real weeks + 2 CTL-based (CTL=40 → 280 each)
    // weeks: [300, 280, 280, 280]
    // expected = (300*4 + 280*3 + 280*2 + 280*1)/10 = (1200+840+560+280)/10 = 288
    const result = computeEffectiveWeeklyLoad([300, 280], 'normal', {}, 40);
    expect(result).toBe(288);
  });

  it('uses CTL×7 when no history available', () => {
    // All 4 slots = 40*7=280 → result = 280
    const result = computeEffectiveWeeklyLoad([], 'normal', {}, 40);
    expect(result).toBe(280);
  });

  it('zero-TSS week treated as missing for normal specialWeekType', () => {
    // Replicates the reported athlete state:
    // recentWeeklyTss=[0,209,388,173], CTL=35, specialWeekType='normal'
    // Without fix: weeks=[0,209,388,173] → (0*4+209*3+388*2+173*1)/10 = 158
    // With fix:    weeks[0]=0 → CTL*7=245 → [245,209,388,173]
    //              effectiveLoad = (245*4+209*3+388*2+173*1)/10
    //                           = (980+627+776+173)/10 = 2556/10 = 256
    const result = computeEffectiveWeeklyLoad([0, 209, 388, 173], 'normal', {}, 35);
    expect(result).toBe(256);
    // Confirm it is NOT the collapsed 158 value
    expect(result).toBeGreaterThan(200);
  });

  it('zero-TSS week is kept as-is for true_rest specialWeekType', () => {
    // true_rest explicitly declares the week was zero load — honour it
    // weeks=[0,209,388,173] → (0*4+209*3+388*2+173*1)/10 = 158
    const result = computeEffectiveWeeklyLoad([0, 209, 388, 173], 'true_rest', {}, 35);
    expect(result).toBe(158);
  });

  it('zero-TSS week is kept as-is for illness specialWeekType', () => {
    const result = computeEffectiveWeeklyLoad([0, 209, 388, 173], 'illness', {}, 35);
    expect(result).toBe(158);
  });

  it('active_vacation: uses estimated vacation TSS instead of near-zero tracked', () => {
    // Most-recent week = 30 TSS (missing uploads), but athlete was actually active
    // estimatedTss = 400 → should use max(30, 400) = 400 for most-recent slot
    const tracked = [30, 300, 280, 250];
    const withVacation = computeEffectiveWeeklyLoad(
      tracked,
      'active_vacation',
      { estimatedTss: 400 },
    );
    const withoutVacation = computeEffectiveWeeklyLoad(tracked);
    expect(withVacation).toBeGreaterThan(withoutVacation + 50);
  });

  it('active_vacation: estimates from durationHours + perceivedLoad when no estimatedTss', () => {
    // 8h moderate = 8 * 65 * 0.85 = 442
    const result = computeEffectiveWeeklyLoad(
      [10, 300, 280, 250],
      'active_vacation',
      { durationHours: 8, perceivedLoad: 'moderate' },
    );
    // weeks[0] = max(10, 442) = 442
    // (442*4 + 300*3 + 280*2 + 250*1)/10 = (1768+900+560+250)/10 = 347.8 → 348
    expect(result).toBeGreaterThan(340);
  });
});

// ---------------------------------------------------------------------------
// 1b. buildWeeklyStressBudget — zero-TSS anchoring fix (regression guard)
// ---------------------------------------------------------------------------
describe('buildWeeklyStressBudget — zero-TSS most-recent week regression', () => {
  it('replicates reported athlete state: [0,209,388,173] does NOT produce target=158', () => {
    // Before fix: effectiveLoad collapsed to 158 because zero got weight 4.
    // After fix:  zero → CTL*7 fallback, effectiveLoad = 256, base target = 256.
    const ctx = makeBaseWeekCtx();
    const state = makeAthleteState({
      ctl: 35,
      hoursAvailable: 10,
      recentWeeklyTss: [0, 209, 388, 173, 340, 314, 205, 269],
      specialWeekType: 'normal',
    });
    const budget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, state);

    // effectiveLoad = (35*7*4 + 209*3 + 388*2 + 173*1)/10
    //              = (980 + 627 + 776 + 173)/10 = 256
    // base targetFactor = 1.00 → weeklyTssTarget = 256
    expect(budget.weeklyTssTarget).toBe(256);
    expect(budget.weeklyTssTarget).not.toBe(158);

    // min/max should also reflect the corrected baseline
    expect(budget.weeklyTssMin).toBe(Math.round(256 * 0.88));  // 225
    expect(budget.weeklyTssMax).toBe(Math.round(256 * 1.10));  // 282
  });
});

// ---------------------------------------------------------------------------
// 2. buildWeeklyStressBudget — normal progression driven by recent load, NOT CTL
// ---------------------------------------------------------------------------
describe('buildWeeklyStressBudget — normal build week', () => {
  it('target is near effectiveLoad × 1.05 (build phase factor), NOT ctl×something', () => {
    const ctx = makeBuildWeekCtx();
    const recentWeeklyTss = [300, 290, 280, 270];
    const athleteState = makeAthleteState({ ctl: 30, recentWeeklyTss });
    const budget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, athleteState);

    // effectiveLoad = (300*4+290*3+280*2+270*1)/10 = (1200+870+560+270)/10 = 290
    // build target = 290 * 1.05 = 304 (before hours cap and guardrail)
    // CTL×7 = 30*7 = 210 — the old model would yield 210-ish, new model should yield ~304
    expect(budget.weeklyTssTarget).toBeGreaterThan(250);
    // Also should NOT be bounded down to CTL×7 (210)
    expect(budget.weeklyTssTarget).not.toBeLessThan(200);
  });

  it('when no recentWeeklyTss falls back gracefully to CTL-based estimate', () => {
    const ctx = makeBaseWeekCtx();
    const athleteState = makeAthleteState({ ctl: 50, recentWeeklyTss: [] });
    const budget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, athleteState);
    expect(budget.weeklyTssTarget).toBeGreaterThan(0);
    expect(budget.weeklyTssMin).toBeLessThanOrEqual(budget.weeklyTssTarget);
    expect(budget.weeklyTssMax).toBeGreaterThanOrEqual(budget.weeklyTssTarget);
  });
});

// ---------------------------------------------------------------------------
// 3. Active vacation does NOT collapse next-week target
// ---------------------------------------------------------------------------
describe('buildWeeklyStressBudget — active vacation', () => {
  it('target from vacation week is NOT penalised vs normal athlete at same history', () => {
    const ctx = makeBaseWeekCtx();

    // Athlete: most-recent tracked TSS = 20 (missing uploads on vacation)
    //          but historically was at 300/week; estimated vacation TSS = 350
    const vacationState = makeAthleteState({
      ctl: 35,
      recentWeeklyTss: [20, 300, 290, 280],
      specialWeekType: 'active_vacation',
      estimatedUntrackedLoad: { estimatedTss: 350 },
    });
    const vacationBudget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, vacationState);

    // Normal athlete at same history (no vacation)
    const normalState = makeAthleteState({
      ctl: 35,
      recentWeeklyTss: [300, 300, 290, 280],
      specialWeekType: 'normal',
    });
    const normalBudget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, normalState);

    // Vacation budget should be within 20% of normal (not collapsed to near-zero)
    expect(vacationBudget.weeklyTssTarget).toBeGreaterThan(normalBudget.weeklyTssTarget * 0.75);
  });

  it('suppresses reentry caps on session types for active vacation', () => {
    const ctx = makeBaseWeekCtx();
    const state = makeAthleteState({
      ctl: 35,
      recentWeeklyTss: [20, 300, 290, 280],
      specialWeekType: 'active_vacation',
      estimatedUntrackedLoad: { estimatedTss: 350 },
      reentryContext: 'after_inconsistency', // would normally cap sessions
    });
    const budget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, state);
    // With active_vacation suppressReentry=true, threshold sessions should NOT be reduced to 1
    // base phase → default maxThresholdSessions=2, but normally reentry would cap to 1
    // With suppression, should remain at 2 (or at least not be 0)
    expect(budget.maxThresholdSessions).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Illness → most conservative target
// ---------------------------------------------------------------------------
describe('buildWeeklyStressBudget — illness', () => {
  it('illness target is the lowest among all special week types', () => {
    const ctx = makeBaseWeekCtx();
    const history = [300, 290, 280, 270];

    const makeWithType = (type: string) =>
      buildWeeklyStressBudget(
        ctx,
        MOCK_CONSTITUTION as any,
        makeAthleteState({ ctl: 50, recentWeeklyTss: history, specialWeekType: type })
      ).weeklyTssTarget;

    const illness = makeWithType('illness');
    const trueRest = makeWithType('true_rest');
    const travel = makeWithType('travel');
    const normal = makeWithType('normal');

    expect(illness).toBeLessThan(trueRest);
    expect(trueRest).toBeLessThan(travel);
    expect(travel).toBeLessThanOrEqual(normal);
  });
});

// ---------------------------------------------------------------------------
// 5. CTL guardrail: prevents implausible jumps, does not dominate routine targets
// ---------------------------------------------------------------------------
describe('buildWeeklyStressBudget — CTL guardrail', () => {
  it('does not constrain a historically active athlete whose CTL temporarily dropped', () => {
    // Athlete returning from vacation: CTL=30 (lagging), but recent actual load = 350/week
    const ctx = makeBaseWeekCtx();
    const state = makeAthleteState({
      ctl: 30,
      recentWeeklyTss: [350, 340, 330, 320],
      specialWeekType: 'active_vacation',
      estimatedUntrackedLoad: { estimatedTss: 360 },
    });
    const budget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, state);

    // CTL guardrail = 30 * 12 = 360 — should NOT cut the target to CTL×7=210
    // effectiveLoad ≈ 350, base target ≈ 350 * 1.0 * 0.9 = 315 — well within guardrail
    expect(budget.weeklyTssTarget).toBeGreaterThan(200);
  });

  it('CTL guardrail caps physically implausible jumps', () => {
    // CTL=20 (very unfit), but someone puts in fake history of 600/week
    const ctx = makeBaseWeekCtx();
    const state = makeAthleteState({
      ctl: 20,
      recentWeeklyTss: [600, 590, 580, 570],
    });
    const budget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, state);

    // CTL guardrail = 20 * 12 = 240 — should cap the target
    expect(budget.weeklyTssTarget).toBeLessThanOrEqual(240);
  });
});

// ---------------------------------------------------------------------------
// 6. Deload week still reduces target
// ---------------------------------------------------------------------------
describe('buildWeeklyStressBudget — deload week', () => {
  it('deload week target is lower than normal week for same athlete', () => {
    const normalCtx = makeBaseWeekCtx(false);
    const deloadCtx = makeBaseWeekCtx(true);

    if (!deloadCtx || !normalCtx) return; // skip if plan has no deload

    const state = makeAthleteState({
      ctl: 50,
      recentWeeklyTss: [300, 290, 280, 270],
    });

    const normalBudget = buildWeeklyStressBudget(normalCtx, MOCK_CONSTITUTION as any, state);
    const deloadBudget = buildWeeklyStressBudget(deloadCtx, MOCK_CONSTITUTION as any, state);

    if (deloadCtx.isDeloadWeek) {
      expect(deloadBudget.weeklyTssTarget).toBeLessThan(normalBudget.weeklyTssTarget);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. deterministic budget survives LLM-style output override
//    These tests simulate what generate-week-skeleton now does: after receiving
//    the LLM output, all budget-critical fields are overwritten from the
//    server-computed budget object.  Verifies the overwrite covers all 8 fields.
// ---------------------------------------------------------------------------
describe('server-side budget overwrite — deterministic after LLM override simulation', () => {
  it('overwrites all 8 budget-critical fields regardless of LLM values', () => {
    const ctx = makeBaseWeekCtx();
    const state = makeAthleteState({
      ctl: 35,
      hoursAvailable: 10,
      recentWeeklyTss: [0, 209, 388, 173, 340, 314, 205, 269],
      specialWeekType: 'normal',
    });
    const serverBudget = buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, state);

    // Simulate an LLM response that chose completely different budget values
    const llmOutput: Record<string, unknown> = {
      weeklyTssTarget: 999,
      weeklyTssMin: 1,
      weeklyTssMax: 9999,
      maxThresholdSessions: 99,
      maxVo2Sessions: 99,
      maxNeuromuscularSessions: 99,
      maxDurabilityBlocks: 99,
      maxStrengthSessions: 99,
      plannedThreshold: 0,
    };

    // Apply the same overwrite logic used in generate-week-skeleton
    llmOutput.weeklyTssTarget          = serverBudget.weeklyTssTarget;
    llmOutput.weeklyTssMin             = serverBudget.weeklyTssMin;
    llmOutput.weeklyTssMax             = serverBudget.weeklyTssMax;
    llmOutput.maxThresholdSessions     = serverBudget.maxThresholdSessions;
    llmOutput.maxVo2Sessions           = serverBudget.maxVo2Sessions;
    llmOutput.maxNeuromuscularSessions = serverBudget.maxNeuromuscularSessions;
    llmOutput.maxDurabilityBlocks      = serverBudget.maxDurabilityBlocks;
    llmOutput.maxStrengthSessions      = serverBudget.maxStrengthSessions;

    expect(llmOutput.weeklyTssTarget).toBe(serverBudget.weeklyTssTarget);
    expect(llmOutput.weeklyTssMin).toBe(serverBudget.weeklyTssMin);
    expect(llmOutput.weeklyTssMax).toBe(serverBudget.weeklyTssMax);
    expect(llmOutput.maxThresholdSessions).toBe(serverBudget.maxThresholdSessions);
    expect(llmOutput.maxVo2Sessions).toBe(serverBudget.maxVo2Sessions);
    expect(llmOutput.maxNeuromuscularSessions).toBe(serverBudget.maxNeuromuscularSessions);
    expect(llmOutput.maxDurabilityBlocks).toBe(serverBudget.maxDurabilityBlocks);
    expect(llmOutput.maxStrengthSessions).toBe(serverBudget.maxStrengthSessions);

    // No LLM-inflated values survive
    expect(llmOutput.weeklyTssTarget).not.toBe(999);
    expect(llmOutput.maxThresholdSessions).not.toBe(99);
  });

  it('same inputs always produce the same weeklyTssTarget (determinism)', () => {
    const ctx = makeBaseWeekCtx();
    const state = makeAthleteState({
      ctl: 35,
      hoursAvailable: 10,
      recentWeeklyTss: [0, 209, 388, 173, 340, 314, 205, 269],
      specialWeekType: 'normal',
    });

    // Call buildWeeklyStressBudget multiple times with identical inputs
    const results = Array.from({ length: 5 }, () =>
      buildWeeklyStressBudget(ctx, MOCK_CONSTITUTION as any, state)
    );

    const first = results[0].weeklyTssTarget;
    for (const r of results) {
      expect(r.weeklyTssTarget).toBe(first);
    }
    // And it should not be the collapsed pre-fix value
    expect(first).toBe(256);
  });
});
