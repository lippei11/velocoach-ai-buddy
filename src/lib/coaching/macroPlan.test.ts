import { describe, it, expect } from 'vitest';
import { addDays, addWeeks, format, parseISO } from 'date-fns';
import {
  generatePlanStructure,
  getPhaseForDate,
  getWeekContext,
  shouldActivateAdaptiveDeload,
} from './macroPlan';
import type { PlanStructure, PlanPhase, DeloadTrigger } from './macroPlan';

const TODAY = '2026-03-17';

function eventIn(weeks: number): string {
  return format(addWeeks(parseISO(TODAY), weeks), 'yyyy-MM-dd');
}

function makePlan(overrides: Partial<Parameters<typeof generatePlanStructure>[0]> = {}): PlanStructure {
  return generatePlanStructure({
    eventDate: eventIn(20),
    todayDate: TODAY,
    currentCtl: 50,
    eventDemandProfile: 'mixed_hobby_fitness',
    hoursPerWeek: 8,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. 20-week plan produces 4 phases
// ---------------------------------------------------------------------------
describe('generatePlanStructure — 20-week plan', () => {
  it('produces exactly 4 phases', () => {
    const plan = makePlan();
    expect(plan.phases).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 2. Phase order is always base -> build -> peak -> taper
// ---------------------------------------------------------------------------
describe('phase order', () => {
  it('is always base → build → peak → taper', () => {
    const plan = makePlan();
    expect(plan.phases.map((p) => p.phase)).toEqual(['base', 'build', 'peak', 'taper']);
  });
});

// ---------------------------------------------------------------------------
// 3. Total weeks across all phases equals totalWeeks
// ---------------------------------------------------------------------------
describe('total weeks', () => {
  it('sum of phase weeks equals totalWeeks', () => {
    for (const w of [8, 10, 12, 14, 16, 20, 24]) {
      const plan = makePlan({ eventDate: eventIn(w) });
      const sum = plan.phases.reduce((s, p) => s + p.weeks, 0);
      expect(sum).toBe(plan.totalWeeks);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. specificity_heavy: BUILD > BASE
// ---------------------------------------------------------------------------
describe('specificity_heavy strategy', () => {
  it('has BUILD weeks > BASE weeks', () => {
    const plan = makePlan({ eventDemandProfile: 'time_trial', hoursPerWeek: 8 });
    const base = plan.phases.find((p) => p.phase === 'base')!;
    const build = plan.phases.find((p) => p.phase === 'build')!;
    expect(build.weeks).toBeGreaterThan(base.weeks);
  });
});

// ---------------------------------------------------------------------------
// 5. base_heavy: BASE > BUILD
// ---------------------------------------------------------------------------
describe('base_heavy strategy', () => {
  it('has BASE weeks > BUILD weeks', () => {
    const plan = makePlan({ eventDemandProfile: 'steady_climbing', hoursPerWeek: 10 });
    const base = plan.phases.find((p) => p.phase === 'base')!;
    const build = plan.phases.find((p) => p.phase === 'build')!;
    expect(base.weeks).toBeGreaterThan(build.weeks);
  });
});

// ---------------------------------------------------------------------------
// 6. balanced with hoursPerWeek = 8: BUILD >= BASE
// ---------------------------------------------------------------------------
describe('balanced strategy (hours=8)', () => {
  it('has BUILD weeks >= BASE weeks', () => {
    const plan = makePlan({
      eventDemandProfile: 'mixed_hobby_fitness',
      hoursPerWeek: 8,
      currentCtl: 50,
    });
    const base = plan.phases.find((p) => p.phase === 'base')!;
    const build = plan.phases.find((p) => p.phase === 'build')!;
    expect(build.weeks).toBeGreaterThanOrEqual(base.weeks);
  });
});

// ---------------------------------------------------------------------------
// 7. TAPER is 2 weeks for plans >= 9 weeks
// ---------------------------------------------------------------------------
describe('taper duration', () => {
  it('is 2 weeks for plans >= 9 weeks', () => {
    for (const w of [9, 10, 12, 16, 20, 24]) {
      const plan = makePlan({ eventDate: eventIn(w) });
      const taper = plan.phases.find((p) => p.phase === 'taper')!;
      expect(taper.weeks).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. BUILD deload weeks every 3 weeks
// ---------------------------------------------------------------------------
describe('build deload pattern', () => {
  it('schedules deloads every 3 weeks within BUILD phase', () => {
    const plan = makePlan({ eventDate: eventIn(20) });
    const build = plan.phases.find((p) => p.phase === 'build')!;
    expect(build.deloadStrategy.defaultPattern).toBe('every_3_weeks');

    // Verify every 3rd week within phase appears in deloadWeeks
    const phaseStart = build.weekNumbers[0];
    for (let i = 3; i <= build.weeks; i += 3) {
      expect(build.deloadWeeks).toContain(phaseStart + i - 1);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. PEAK has no deload weeks
// ---------------------------------------------------------------------------
describe('peak deload', () => {
  it('has no planned deload weeks', () => {
    const plan = makePlan();
    const peak = plan.phases.find((p) => p.phase === 'peak')!;
    expect(peak.deloadWeeks).toHaveLength(0);
    expect(peak.deloadStrategy.defaultPattern).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// 10. getPhaseForDate returns correct phase for a date in mid-BUILD
// ---------------------------------------------------------------------------
describe('getPhaseForDate', () => {
  it('returns build phase for a date in mid-build', () => {
    const plan = makePlan({ eventDate: eventIn(20) });
    const build = plan.phases.find((p) => p.phase === 'build')!;
    const midBuild = format(
      addDays(parseISO(build.startDate), Math.floor(build.weeks * 7 / 2)),
      'yyyy-MM-dd'
    );
    const result = getPhaseForDate(plan, midBuild);
    expect(result?.phase).toBe('build');
  });

  // 11. Returns null for date after plan end
  it('returns null for a date after plan end', () => {
    const plan = makePlan();
    const afterEnd = format(addDays(parseISO(plan.phases.at(-1)!.endDate), 5), 'yyyy-MM-dd');
    expect(getPhaseForDate(plan, afterEnd)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 12 + 13. getWeekContext deload flags
// ---------------------------------------------------------------------------
describe('getWeekContext — deload flag', () => {
  function mondayOf(date: string): string {
    const d = parseISO(date);
    const day = d.getUTCDay();
    const monday = addDays(d, -((day + 6) % 7));
    return format(monday, 'yyyy-MM-dd');
  }

  it('isDeloadWeek === true for a week in deloadWeeks', () => {
    const plan = makePlan({ eventDate: eventIn(20) });
    const build = plan.phases.find((p) => p.phase === 'build')!;
    if (build.deloadWeeks.length === 0) return; // nothing to test

    const deloadWeekNum = build.deloadWeeks[0];
    // weekStart of that plan-relative week
    const deloadStart = format(
      addDays(parseISO(plan.planStartDate), (deloadWeekNum - 1) * 7),
      'yyyy-MM-dd'
    );
    const weekStart = mondayOf(deloadStart);
    const ctx = getWeekContext(plan, weekStart);
    expect(ctx?.isDeloadWeek).toBe(true);
  });

  it('isDeloadWeek === false for a normal (non-deload) week', () => {
    const plan = makePlan({ eventDate: eventIn(20) });
    // Week 1 is never a deload week
    const week1Start = mondayOf(plan.planStartDate);
    const ctx = getWeekContext(plan, week1Start);
    expect(ctx?.isDeloadWeek).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14. getWeekContext.weeksUntilEvent decreases correctly
// ---------------------------------------------------------------------------
describe('getWeekContext — weeksUntilEvent', () => {
  it('decreases by 1 each week when eventDate exists', () => {
    const plan = makePlan({ eventDate: eventIn(20) });
    const w1 = format(parseISO(plan.planStartDate), 'yyyy-MM-dd');
    const w2 = format(addWeeks(parseISO(plan.planStartDate), 1), 'yyyy-MM-dd');
    const ctx1 = getWeekContext(plan, w1);
    const ctx2 = getWeekContext(plan, w2);
    expect(ctx1?.weeksUntilEvent).not.toBeNull();
    expect(ctx2?.weeksUntilEvent).not.toBeNull();
    expect(ctx1!.weeksUntilEvent! - ctx2!.weeksUntilEvent!).toBe(1);
  });

  // 15. weeksUntilEvent === null when eventDate is null
  it('is null when eventDate is null', () => {
    const plan = makePlan({ eventDate: null });
    const ctx = getWeekContext(plan, plan.planStartDate);
    expect(ctx?.weeksUntilEvent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 16 + 17. shouldActivateAdaptiveDeload
// ---------------------------------------------------------------------------
describe('shouldActivateAdaptiveDeload', () => {
  it('returns true when trigger matches a flexible phase', () => {
    const plan = makePlan();
    const build = plan.phases.find((p) => p.phase === 'build')!;
    expect(
      shouldActivateAdaptiveDeload(build, ['illness' as DeloadTrigger])
    ).toBe(true);
  });

  it('returns false when flexible insertion is not allowed (peak/taper)', () => {
    const plan = makePlan();
    const peak = plan.phases.find((p) => p.phase === 'peak')!;
    expect(
      shouldActivateAdaptiveDeload(peak, ['illness' as DeloadTrigger])
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 18. BUILD for steady_climbing includes climb_simulation and back_to_back
// ---------------------------------------------------------------------------
describe('steady_climbing build sessions', () => {
  it('includes climb_simulation and back_to_back in BUILD key session types', () => {
    const plan = makePlan({ eventDemandProfile: 'steady_climbing' });
    const build = plan.phases.find((p) => p.phase === 'build')!;
    expect(build.keySessionTypes).toContain('climb_simulation');
    expect(build.keySessionTypes).toContain('back_to_back');
  });
});

// ---------------------------------------------------------------------------
// 19. eventDate = null produces a 12-week plan
// ---------------------------------------------------------------------------
describe('no-event plan', () => {
  it('produces a 12-week plan when eventDate is null', () => {
    const plan = makePlan({ eventDate: null });
    expect(plan.totalWeeks).toBe(12);
    expect(plan.eventDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 20. event < 6 weeks → only PEAK + TAPER
// ---------------------------------------------------------------------------
describe('compressed plan', () => {
  it('produces only PEAK and TAPER phases when event is < 6 weeks away', () => {
    const plan = makePlan({ eventDate: eventIn(4) });
    expect(plan.macroStrategy).toBe('compressed');
    expect(plan.phases.map((p) => p.phase)).toEqual(['peak', 'taper']);
    expect(plan.phases).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 21. event > 24 weeks → extended_prep + 24-week structured horizon
// ---------------------------------------------------------------------------
describe('extended_prep plan', () => {
  it('uses macroStrategy = extended_prep and returns a 24-week structured plan', () => {
    const plan = makePlan({ eventDate: eventIn(30) });
    expect(plan.macroStrategy).toBe('extended_prep');
    expect(plan.totalWeeks).toBe(24);
    const sum = plan.phases.reduce((s, p) => s + p.weeks, 0);
    expect(sum).toBe(24);
    expect(plan.phases).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 22. strengthSessionsPerWeek.base = 2 when hoursPerWeek >= 8, no tighter cap
// ---------------------------------------------------------------------------
describe('strength policy — base phase', () => {
  it('is 2 when hoursPerWeek >= 8 with no user cap', () => {
    const plan = makePlan({ hoursPerWeek: 8, strengthSessionsPerWeek: undefined });
    expect(plan.strengthSessionsPerWeek.base).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 23. taper is always 0
// ---------------------------------------------------------------------------
describe('strength policy — taper phase', () => {
  it('is always 0', () => {
    for (const userCap of [undefined, 0, 1, 3]) {
      const plan = makePlan({ strengthSessionsPerWeek: userCap });
      expect(plan.strengthSessionsPerWeek.taper).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 24. user strength cap is respected
// ---------------------------------------------------------------------------
describe('strength policy — user cap', () => {
  it('caps base phase to userCap when userCap < phase policy', () => {
    const plan = makePlan({ hoursPerWeek: 10, strengthSessionsPerWeek: 1 });
    // Phase policy for base with hours=10 is 2; user cap is 1
    expect(plan.strengthSessionsPerWeek.base).toBe(1);
  });

  it('uses phase policy when userCap > phase policy', () => {
    const plan = makePlan({ hoursPerWeek: 8, strengthSessionsPerWeek: 3 });
    // Phase policy for build is 1; user cap is 3 → use 1
    expect(plan.strengthSessionsPerWeek.build).toBe(1);
  });

  it('allows 0 when user cap is 0', () => {
    const plan = makePlan({ strengthSessionsPerWeek: 0 });
    expect(plan.strengthSessionsPerWeek.base).toBe(0);
    expect(plan.strengthSessionsPerWeek.build).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 25. macroStrategy selected correctly for representative scenarios
// ---------------------------------------------------------------------------
describe('macroStrategy selection', () => {
  it('steady_climbing → base_heavy', () => {
    const plan = makePlan({ eventDemandProfile: 'steady_climbing', eventDate: eventIn(20) });
    expect(plan.macroStrategy).toBe('base_heavy');
  });

  it('time_trial → specificity_heavy', () => {
    const plan = makePlan({ eventDemandProfile: 'time_trial', eventDate: eventIn(20) });
    expect(plan.macroStrategy).toBe('specificity_heavy');
  });

  it('mixed_hobby_fitness → balanced', () => {
    const plan = makePlan({ eventDemandProfile: 'mixed_hobby_fitness', eventDate: eventIn(20) });
    expect(plan.macroStrategy).toBe('balanced');
  });

  it('event < 6 weeks → compressed', () => {
    const plan = makePlan({ eventDate: eventIn(3) });
    expect(plan.macroStrategy).toBe('compressed');
  });

  it('event > 24 weeks → extended_prep', () => {
    const plan = makePlan({ eventDate: eventIn(26) });
    expect(plan.macroStrategy).toBe('extended_prep');
  });

  it('ftp_build profile → specificity_heavy', () => {
    const plan = makePlan({ eventDemandProfile: 'ftp_build', eventDate: eventIn(20) });
    expect(plan.macroStrategy).toBe('specificity_heavy');
  });

  it('high hours (10) with no specific profile → base_heavy', () => {
    const plan = makePlan({ eventDemandProfile: null, hoursPerWeek: 10, eventDate: eventIn(20) });
    expect(plan.macroStrategy).toBe('base_heavy');
  });
});
