import { PhaseType, WorkoutType, Phase, PlannedWorkout, DayData, WeekData } from "@/types/trainingPlan";
import { format, addDays, addWeeks, startOfWeek, endOfWeek, differenceInWeeks, parseISO, isWithinInterval } from "date-fns";

export const PHASE_COLORS: Record<PhaseType, string> = {
  BASE: "hsl(217, 91%, 60%)",
  BUILD: "hsl(25, 95%, 53%)",
  PEAK: "hsl(0, 84%, 60%)",
  TAPER: "hsl(142, 71%, 45%)",
  RECOVERY: "hsl(215, 20%, 55%)",
};

export const PHASE_BG_CLASSES: Record<PhaseType, string> = {
  BASE: "bg-primary",
  BUILD: "bg-warning",
  PEAK: "bg-destructive",
  TAPER: "bg-success",
  RECOVERY: "bg-muted-foreground",
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

  const taperWeeks = 2;
  const peakWeeks = Math.min(3, Math.floor(totalWeeks * 0.15));
  const buildWeeks = Math.min(8, Math.floor(totalWeeks * 0.4));
  const baseWeeks = Math.max(2, totalWeeks - taperWeeks - peakWeeks - buildWeeks);

  const phases: Phase[] = [];
  let cursor = now;

  const addPhase = (type: PhaseType, weeks: number, ctlRange: [number, number], tss: number, focus: string) => {
    const start = new Date(cursor);
    const end = addWeeks(cursor, weeks);
    phases.push({
      id: type + "-" + start.getTime(),
      type,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      weeks,
      targetCTLRange: ctlRange,
      weeklyTSSTarget: tss,
      workoutFocus: focus,
    });
    cursor = end;
  };

  addPhase("BASE", baseWeeks, [50, 65], 350, "Z1-Z2 Endurance");
  addPhase("BUILD", buildWeeks, [65, 80], 420, "Threshold + Sweet Spot");
  addPhase("PEAK", peakWeeks, [80, 90], 480, "VO2max + Race-Specific");
  addPhase("TAPER", taperWeeks, [75, 85], 280, "Volume ↓, Intensity maintained");

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
      tssTarget: phase?.weeklyTSSTarget || 0,
      tssActual: Math.round(tssActual),
      days,
    });
  }

  return weeks;
}
