import { describe, it, expect } from "vitest";
import {
  deriveBlocksFromPlan,
  type DerivedBlock,
  type PlanStructure,
} from "./planningCore";

/**
 * Builds a minimal PlanStructure for testing without hitting generatePlanStructure,
 * so block/phase configurations can be specified deterministically.
 */
function buildTestPlan(
  planStartDate: string,
  phases: PlanStructure["phases"]
): PlanStructure {
  return {
    planStartDate,
    eventDate: null,
    totalWeeks: phases.reduce((s, p) => s + p.weeks, 0),
    phases,
    eventDemandProfile: null,
    constitutionVersion: "7",
    strengthSessionsPerWeek: { base: 2, build: 1, peak: 1, taper: 0 },
    macroStrategy: "balanced",
  };
}

/**
 * Constructs a minimal PlanPhase entry with the fields needed by deriveBlocksFromPlan.
 * weekOffset is the number of plan weeks before this phase starts (0-indexed).
 */
function makePhase(
  phase: PlanStructure["phases"][number]["phase"],
  weeks: number,
  weekOffset: number,
  pattern: "every_3_weeks" | "every_4_weeks" | "none"
): PlanStructure["phases"][number] {
  const weekNumbers: number[] = [];
  for (let i = 1; i <= weeks; i++) weekNumbers.push(weekOffset + i);

  const deloadWeeks: number[] = [];
  if (pattern !== "none") {
    const interval = pattern === "every_3_weeks" ? 3 : 4;
    for (let wk = interval; wk <= weeks; wk += interval) {
      deloadWeeks.push(weekOffset + wk);
    }
  }

  return {
    phase,
    startDate: "",
    endDate: "",
    weeks,
    weekNumbers,
    deloadWeeks,
    weeklyLoadFactorRange: [5.5, 7.0],
    maxQualitySessions: 1,
    longRideTssRatioPct: [38, 50],
    deloadStrategy: {
      defaultPattern: pattern,
      flexibleInsertionAllowed: pattern !== "none",
      triggers: [],
      tssMultiplier: pattern === "none" ? 1.0 : 0.6,
      reduceQualitySessionsTo: 0,
    },
    keySessionTypes: ["endurance"],
    notes: "",
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("deriveBlocksFromPlan", () => {
  const PLAN_START = "2026-03-23"; // Monday

  describe("12-week plan: base(6w) + build(3w) + peak(1w) + taper(2w)", () => {
    const plan = buildTestPlan(PLAN_START, [
      makePhase("base", 6, 0, "every_3_weeks"),
      makePhase("build", 3, 6, "every_3_weeks"),
      makePhase("peak", 1, 9, "none"),
      makePhase("taper", 2, 10, "none"),
    ]);

    const blocks: DerivedBlock[] = deriveBlocksFromPlan(plan);

    it("produces 5 blocks total", () => {
      expect(blocks).toHaveLength(5);
    });

    it("block 1 (base): plan weeks 1-3, deload at week 3", () => {
      const b = blocks[0];
      expect(b.phase).toBe("base");
      expect(b.blockNumber).toBe(1);
      expect(b.blockNumberInPhase).toBe(1);
      expect(b.weeks).toBe(3);
      expect(b.loadWeeks).toBe(2);
      expect(b.deloadWeekNumbers).toEqual([3]);
      expect(b.startDate).toBe("2026-03-23");
      expect(b.endDate).toBe("2026-04-12");
    });

    it("block 2 (base): plan weeks 4-6, deload at week 6", () => {
      const b = blocks[1];
      expect(b.phase).toBe("base");
      expect(b.blockNumber).toBe(2);
      expect(b.blockNumberInPhase).toBe(2);
      expect(b.weeks).toBe(3);
      expect(b.loadWeeks).toBe(2);
      expect(b.deloadWeekNumbers).toEqual([6]);
      expect(b.startDate).toBe("2026-04-13");
      expect(b.endDate).toBe("2026-05-03");
    });

    it("block 3 (build): plan weeks 7-9, deload at week 9", () => {
      const b = blocks[2];
      expect(b.phase).toBe("build");
      expect(b.blockNumber).toBe(3);
      expect(b.blockNumberInPhase).toBe(1);
      expect(b.weeks).toBe(3);
      expect(b.loadWeeks).toBe(2);
      expect(b.deloadWeekNumbers).toEqual([9]);
    });

    it("block 4 (peak): 1 week, no deload", () => {
      const b = blocks[3];
      expect(b.phase).toBe("peak");
      expect(b.blockNumber).toBe(4);
      expect(b.blockNumberInPhase).toBe(1);
      expect(b.weeks).toBe(1);
      expect(b.loadWeeks).toBe(1);
      expect(b.deloadWeekNumbers).toEqual([]);
    });

    it("block 5 (taper): 2 weeks, no deload", () => {
      const b = blocks[4];
      expect(b.phase).toBe("taper");
      expect(b.blockNumber).toBe(5);
      expect(b.blockNumberInPhase).toBe(1);
      expect(b.weeks).toBe(2);
      expect(b.loadWeeks).toBe(2);
      expect(b.deloadWeekNumbers).toEqual([]);
    });

    it("block dates are contiguous (no gaps)", () => {
      for (let i = 0; i < blocks.length - 1; i++) {
        const endDate = new Date(blocks[i].endDate);
        const nextStart = new Date(blocks[i + 1].startDate);
        const diff = (nextStart.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);
        expect(diff).toBe(1);
      }
    });
  });

  describe("edge case: phase weeks not evenly divisible by interval", () => {
    // 7-week base with every_3_weeks → 3 + 3 + 1 blocks
    const plan = buildTestPlan(PLAN_START, [
      makePhase("base", 7, 0, "every_3_weeks"),
    ]);

    const blocks = deriveBlocksFromPlan(plan);

    it("produces 3 blocks for 7-week base", () => {
      expect(blocks).toHaveLength(3);
    });

    it("first two blocks are full 3-week blocks with deloads", () => {
      expect(blocks[0].weeks).toBe(3);
      expect(blocks[0].deloadWeekNumbers).toEqual([3]);
      expect(blocks[1].weeks).toBe(3);
      expect(blocks[1].deloadWeekNumbers).toEqual([6]);
    });

    it("last block is 1 week with no deload week", () => {
      const last = blocks[2];
      expect(last.weeks).toBe(1);
      expect(last.deloadWeekNumbers).toEqual([]);
      expect(last.loadWeeks).toBe(1);
    });

    it("blockNumberInPhase increments correctly within phase", () => {
      expect(blocks[0].blockNumberInPhase).toBe(1);
      expect(blocks[1].blockNumberInPhase).toBe(2);
      expect(blocks[2].blockNumberInPhase).toBe(3);
    });
  });

  describe("edge case: every_4_weeks pattern", () => {
    // 8-week base with every_4_weeks → 2 blocks of 4
    const plan = buildTestPlan(PLAN_START, [
      makePhase("base", 8, 0, "every_4_weeks"),
    ]);

    const blocks = deriveBlocksFromPlan(plan);

    it("produces 2 blocks for 8-week base with every_4_weeks", () => {
      expect(blocks).toHaveLength(2);
    });

    it("each block is 4 weeks with deload at week 4 / 8", () => {
      expect(blocks[0].weeks).toBe(4);
      expect(blocks[0].deloadWeekNumbers).toEqual([4]);
      expect(blocks[0].loadWeeks).toBe(3);
      expect(blocks[1].weeks).toBe(4);
      expect(blocks[1].deloadWeekNumbers).toEqual([8]);
      expect(blocks[1].loadWeeks).toBe(3);
    });
  });
});
