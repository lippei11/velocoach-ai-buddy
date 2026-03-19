// @ts-nocheck — Deno edge function; types resolved at Deno runtime

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlannedDay {
  date: string;           // "YYYY-MM-DD"
  dayOfWeek: number;      // 0=Mon … 6=Sun
  workoutType: string;    // key from constitution workout_types, or "rest"
  stressType: string;     // "recovery" | "endurance_base" | "threshold" | "vo2max" | "neuromuscular" | "durability" | "strength" | "none"
  plannedTss: number;
  durationMinutes: number;
  name: string;
  description: string;
  purpose: string;
}

export interface WeekSkeleton {
  weekStartDate: string;  // "YYYY-MM-DD" — Monday of the planned week
  phase: string;          // "base" | "build" | "peak" | "taper"
  days: PlannedDay[];     // exactly 7 entries (Mon–Sun)
  totalTss: number;
  rationale: string;      // coach-facing explanation, English
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate and coerce a raw LLM-produced object into a WeekSkeleton.
 * Throws a descriptive Error if the shape is invalid.
 */
export function validateWeekSkeleton(raw: unknown): WeekSkeleton {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("WeekSkeleton must be a plain object");
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.weekStartDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.weekStartDate)) {
    throw new Error("WeekSkeleton.weekStartDate must be a YYYY-MM-DD string");
  }
  if (typeof r.phase !== "string" || r.phase.trim().length === 0) {
    throw new Error("WeekSkeleton.phase must be a non-empty string");
  }
  if (!Array.isArray(r.days) || r.days.length === 0) {
    throw new Error("WeekSkeleton.days must be a non-empty array");
  }
  if (typeof r.rationale !== "string" || r.rationale.trim().length === 0) {
    throw new Error("WeekSkeleton.rationale must be a non-empty string");
  }

  for (let i = 0; i < r.days.length; i++) {
    const d = r.days[i];
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      throw new Error(`days[${i}] must be a plain object`);
    }
    const day = d as Record<string, unknown>;
    if (typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
      throw new Error(`days[${i}].date must be a YYYY-MM-DD string`);
    }
    if (typeof day.dayOfWeek !== "number" || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      throw new Error(`days[${i}].dayOfWeek must be a number 0–6`);
    }
    if (typeof day.workoutType !== "string") {
      throw new Error(`days[${i}].workoutType must be a string`);
    }
    if (typeof day.stressType !== "string") {
      throw new Error(`days[${i}].stressType must be a string`);
    }
    if (typeof day.plannedTss !== "number" || day.plannedTss < 0) {
      throw new Error(`days[${i}].plannedTss must be a non-negative number`);
    }
    if (typeof day.durationMinutes !== "number" || day.durationMinutes < 0) {
      throw new Error(`days[${i}].durationMinutes must be a non-negative number`);
    }
    if (typeof day.name !== "string") {
      throw new Error(`days[${i}].name must be a string`);
    }
    if (typeof day.description !== "string") {
      throw new Error(`days[${i}].description must be a string`);
    }
    if (typeof day.purpose !== "string") {
      throw new Error(`days[${i}].purpose must be a string`);
    }
  }

  // Derive totalTss if not provided or inconsistent
  const derivedTotal = (r.days as PlannedDay[]).reduce((sum, d) => sum + (d.plannedTss ?? 0), 0);
  const totalTss = typeof r.totalTss === "number" ? r.totalTss : derivedTotal;

  return {
    weekStartDate: r.weekStartDate,
    phase: (r.phase as string).trim(),
    days: r.days as PlannedDay[],
    totalTss,
    rationale: (r.rationale as string).trim(),
  };
}
