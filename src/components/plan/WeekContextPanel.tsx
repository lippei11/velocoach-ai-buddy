import { WeekData } from "@/types/trainingPlan";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WORKOUT_COLORS, WORKOUT_LABELS, PHASE_HEX, formatDuration } from "@/lib/planUtils";
import { format, parseISO } from "date-fns";
import { Target, Flame, AlertTriangle, Bike, Info } from "lucide-react";

interface Props {
  week: WeekData;
}

export function WeekContextPanel({ week }: Props) {
  const progressPct = week.tssTarget > 0 ? Math.min(100, (week.tssActual / week.tssTarget) * 100) : 0;

  // Derive key session types from planned workouts
  const sessionTypes = new Map<string, number>();
  let hardSessions = 0;
  let hasLongRide = false;
  let totalDuration = 0;

  for (const day of week.days) {
    if (day.planned) {
      const wt = day.planned.workoutType;
      sessionTypes.set(wt, (sessionTypes.get(wt) || 0) + 1);
      if (["vo2max", "threshold", "sweetspot"].includes(wt)) hardSessions++;
      if (wt === "longride") hasLongRide = true;
      if (day.planned.duration) totalDuration += day.planned.duration;
    }
  }

  const plannedCount = week.days.filter((d) => d.planned).length;
  const completedCount = week.days.filter((d) => d.completed).length;
  const restDays = 7 - plannedCount;

  // Warnings
  const warnings: string[] = [];
  if (hardSessions > 3) warnings.push("More than 3 hard sessions — consider recovery risk.");
  if (restDays < 2) warnings.push("Fewer than 2 rest days this week.");
  if (week.tssTarget > 0 && week.tssActual > week.tssTarget * 1.15)
    warnings.push("TSS is exceeding target by >15%.");

  // Rationale
  const phaseType = week.phase?.type;
  const rationale = phaseType
    ? {
        BASE: "Focus on aerobic volume. Keep intensity low, build duration progressively.",
        BUILD: "Introduce structured intensity. Sweet spot and threshold work build race fitness.",
        PEAK: "Race-specific intensity at highest volume. VO2max intervals sharpen top-end.",
        TAPER: "Reduce volume, maintain intensity. Freshness for race day.",
        RECOVERY: "Active recovery only. Let adaptations consolidate.",
      }[phaseType]
    : "No phase assigned to this week.";

  return (
    <div className="space-y-5">
      {/* Week Header */}
      <div>
        <h3 className="font-semibold text-base">
          {format(parseISO(week.startDate), "MMM d")} – {format(parseISO(week.endDate), "MMM d")}
        </h3>
        {week.phaseWeekLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{week.phaseWeekLabel}</p>
        )}
        {week.phase && (
          <Badge
            className="mt-1.5 text-[10px]"
            style={{
              backgroundColor: PHASE_HEX[week.phase.type] + "22",
              color: PHASE_HEX[week.phase.type],
            }}
          >
            {week.phase.type} Phase
          </Badge>
        )}
      </div>

      {/* Weekly Stress Budget */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" />
          Weekly Stress Budget
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{week.tssActual} TSS actual</span>
            <span>{week.tssTarget} TSS target</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-accent p-2 text-center">
            <p className="text-muted-foreground">Sessions</p>
            <p className="font-semibold">{plannedCount}</p>
          </div>
          <div className="rounded-md bg-accent p-2 text-center">
            <p className="text-muted-foreground">Completed</p>
            <p className="font-semibold">{completedCount}</p>
          </div>
          <div className="rounded-md bg-accent p-2 text-center">
            <p className="text-muted-foreground">Duration</p>
            <p className="font-semibold">{formatDuration(totalDuration)}</p>
          </div>
        </div>
      </div>

      {/* Key Session Types */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flame className="h-4 w-4 text-destructive" />
          Key Sessions
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from(sessionTypes.entries()).map(([type, count]) => (
            <Badge
              key={type}
              variant="secondary"
              className="text-[10px] gap-1"
              style={{
                backgroundColor: (WORKOUT_COLORS[type as keyof typeof WORKOUT_COLORS] || "#666") + "22",
                color: WORKOUT_COLORS[type as keyof typeof WORKOUT_COLORS] || "#666",
              }}
            >
              {WORKOUT_LABELS[type as keyof typeof WORKOUT_LABELS] || type} × {count}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>🔥 {hardSessions} hard session{hardSessions !== 1 ? "s" : ""}</span>
          {hasLongRide && (
            <span className="flex items-center gap-1">
              <Bike className="h-3 w-3" /> Long ride
            </span>
          )}
          <span>😴 {restDays} rest day{restDays !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Rationale */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          Week Focus
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{rationale}</p>
        {week.phase?.workoutFocus && (
          <p className="text-xs text-muted-foreground">
            Focus: <span className="text-foreground font-medium">{week.phase.workoutFocus}</span>
          </p>
        )}
      </div>
    </div>
  );
}
