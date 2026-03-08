import { PhaseType, WorkoutType, Phase, PlannedWorkout, DayData, WeekData, GeneratedPlanResult } from "@/types/trainingPlan";
import { format, addDays, addWeeks, startOfWeek, endOfWeek, differenceInWeeks, parseISO } from "date-fns";
import {
  MOCK_TRAINING_DAYS,
  WORKOUT_TEMPLATES,
  PHASE_DISTRIBUTION,
  PHASE_DEFAULTS,
  MOCK_CURRENT_CTL,
  MOCK_PROJECTED_CTL,
} from "@/mocks";

export const PHASE_COLORS: Record<PhaseType, string> = {
  BASE: "hsl(217, 91%, 60%)",
  BUILD: "hsl(25, 95%, 53%)",
  PEAK: "hsl(0, 84%, 60%)",
  TAPER: "hsl(142, 71%, 45%)",
  RECOVERY: "hsl(215, 20%, 55%)",
};

export const PHASE_HEX: Record<PhaseType, string> = {
  BASE: "#3B82F6",
  BUILD: "#F97316",
  PEAK: "#EF4444",
  TAPER: "#22C55E",
  RECOVERY: "#6B7280",
};

export const WORKOUT_COLORS: Record<WorkoutType, string> = {
  endurance: "#3B82F6",
  sweetspot: "#F97316",
  vo2max: "#EF4444",
  longride: "#8B5CF6",
  recovery: "#22C55E",
  rest: "transparent",
};

export function classifyWorkout(name: string, category?: string): WorkoutType {
  const lower = (name + " " + (category || "")).toLowerCase();
  if (lower.includes("recovery") || lower.includes("easy")) return "recovery";
  if (lower.includes("vo2") || lower.includes("interval") || lower.includes("hiit")) return "vo2max";
  if (lower.includes("sweet spot") || lower.includes("threshold") || lower.includes("tempo")) return "sweetspot";
  if (lower.includes("long") || lower.includes("endurance ride")) return "longride";
  return "endurance";
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function generateMockPhases(eventDate: Date): Phase[] {
  const now = new Date();
  const totalWeeks = Math.max(4, differenceInWeeks(eventDate, now));

  const { taperWeeks, peakRatio, peakMax, buildRatio, buildMax } = PHASE_DISTRIBUTION;
  const peakWeeks = Math.min(peakMax, Math.floor(totalWeeks * peakRatio));
  const buildWeeks = Math.min(buildMax, Math.floor(totalWeeks * buildRatio));
  const baseWeeks = Math.max(2, totalWeeks - taperWeeks - peakWeeks - buildWeeks);

  const phases: Phase[] = [];
  let cursor = now;

  const addPhase = (type: PhaseType, weeks: number) => {
    const defaults = PHASE_DEFAULTS[type];
    const start = new Date(cursor);
    const end = addWeeks(cursor, weeks);
    phases.push({
      id: type + "-" + start.getTime(),
      type,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      weeks,
      targetCTLRange: defaults.ctlRange,
      weeklyTSSTarget: defaults.weeklyTSS,
      workoutFocus: defaults.focus,
    });
    cursor = end;
  };

  addPhase("BASE", baseWeeks);
  addPhase("BUILD", buildWeeks);
  addPhase("PEAK", peakWeeks);
  addPhase("TAPER", taperWeeks);

  return phases;
}

export function buildWeekData(
  startDate: Date,
  numWeeks: number,
  phases: Phase[],
  planned: PlannedWorkout[],
  completedMap: Map<string, DayData["completed"]>
): WeekData[] {
  const weeks: WeekData[] = [];

  for (let w = 0; w < numWeeks; w++) {
    const weekStart = startOfWeek(addWeeks(startDate, w), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const phase = phases.find((p) => {
      const ps = parseISO(p.startDate);
      const pe = parseISO(p.endDate);
      return weekStart >= ps && weekStart < pe;
    });

    // Calculate week number within phase
    let phaseWeekLabel: string | undefined;
    if (phase) {
      const phaseStart = parseISO(phase.startDate);
      const weekInPhase = differenceInWeeks(weekStart, phaseStart) + 1;
      phaseWeekLabel = `${phase.type} Phase - Week ${weekInPhase} of ${phase.weeks}`;
    }

    const days: DayData[] = [];
    let tssActual = 0;

    for (let d = 0; d < 7; d++) {
      const date = format(addDays(weekStart, d), "yyyy-MM-dd");
      const pw = planned.find((p) => p.date === date);
      const cw = completedMap.get(date);
      if (cw?.tss) tssActual += cw.tss;
      days.push({ date, planned: pw, completed: cw });
    }

    weeks.push({
      weekNumber: w + 1,
      startDate: format(weekStart, "yyyy-MM-dd"),
      endDate: format(weekEnd, "yyyy-MM-dd"),
      phase,
      phaseWeekLabel,
      tssTarget: phase?.weeklyTSSTarget || 0,
      tssActual: Math.round(tssActual),
      days,
    });
  }

  return weeks;
}

/** Generate mock workouts for plan generation result */
export function generateMockPlanResult(eventDate: Date): GeneratedPlanResult {
  const phases = generateMockPhases(eventDate);
  const workouts: PlannedWorkout[] = [];
  let id = 1;

  for (const phase of phases) {
    const phaseStart = parseISO(phase.startDate);
    for (let w = 0; w < phase.weeks; w++) {
      const weekStart = addWeeks(phaseStart, w);
      MOCK_TRAINING_DAYS.forEach((dayOffset, i) => {
        const date = format(addDays(startOfWeek(weekStart, { weekStartsOn: 1 }), dayOffset), "yyyy-MM-dd");
        const templates = WORKOUT_TEMPLATES[phase.type];
        const tmpl = templates[i % templates.length];
        if (tmpl.type === "rest") return;
        workouts.push({
          id: `mock-${id++}`,
          date,
          name: tmpl.name,
          category: "WORKOUT",
          description: `- ${tmpl.name}\n- Duration: ${formatDuration(tmpl.duration)}\n- TSS: ${tmpl.tss}\n- Zone: ${phase.workoutFocus}`,
          duration: tmpl.duration,
          tssTarget: tmpl.tss,
          workoutType: tmpl.type,
          color: WORKOUT_COLORS[tmpl.type],
        });
      });
    }
  }

  return {
    phases,
    workouts,
    totalWorkouts: workouts.length,
    currentCTL: MOCK_CURRENT_CTL,
    projectedCTL: MOCK_PROJECTED_CTL,
  };
}
