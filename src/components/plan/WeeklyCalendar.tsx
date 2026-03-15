import { WeekData, DayData } from "@/types/trainingPlan";
import { Progress } from "@/components/ui/progress";
import { format, parseISO, isSameDay } from "date-fns";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKOUT_LABELS } from "@/lib/planUtils";
import React from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  weeks: WeekData[];
  onDayClick: (day: DayData) => void;
  onWeekClick: (week: WeekData) => void;
  selectedWeek?: WeekData | null;
  selectedDay?: DayData | null;
  weekRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export function WeeklyCalendar({ weeks, onDayClick, onWeekClick, selectedWeek, selectedDay, weekRefs }: Props) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <div className="space-y-2">
      {/* Day labels header */}
      <div className="grid grid-cols-[140px_repeat(7,1fr)] gap-1">
        <div />
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {weeks.map((week) => {
        const progressPct = week.tssTarget > 0 ? Math.min(100, (week.tssActual / week.tssTarget) * 100) : 0;
        const isSelectedWeek = selectedWeek?.startDate === week.startDate;

        return (
          <div
            key={week.startDate}
            ref={(el) => { if (week.phase) weekRefs.current[week.phase.id] = el; }}
            className="grid grid-cols-[140px_repeat(7,1fr)] gap-1"
          >
            {/* Week header — clickable for week context */}
            <button
              onClick={() => onWeekClick(week)}
              className={cn(
                "rounded-lg border bg-card p-2 space-y-1 text-left transition-colors hover:bg-accent",
                isSelectedWeek ? "border-primary ring-1 ring-primary/30" : "border-border"
              )}
            >
              <p className="text-xs font-semibold">
                {format(parseISO(week.startDate), "MMM d")} – {format(parseISO(week.endDate), "MMM d")}
              </p>
              {week.phaseWeekLabel && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {week.phaseWeekLabel}
                </p>
              )}
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">
                  {week.tssActual} / {week.tssTarget} TSS
                </p>
                <Progress value={progressPct} className="h-1.5" />
              </div>
            </button>

            {/* Day cells */}
            {week.days.map((day) => {
              const hasPlanned = !!day.planned;
              const hasCompleted = !!day.completed;
              const dayDate = parseISO(day.date);
              const isMissed = hasPlanned && !hasCompleted && dayDate < today && !isSameDay(dayDate, today);
              const isToday = day.date === todayStr;
              const isSelected = selectedDay?.date === day.date;
              const dayNum = format(dayDate, "d");

              return (
                <button
                  key={day.date}
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "rounded-lg border bg-card p-1.5 min-h-[80px] text-left transition-colors hover:bg-accent relative",
                    isToday ? "border-primary border-2" : isSelected ? "border-primary/60 ring-1 ring-primary/20" : "border-border",
                    hasCompleted && "ring-1 ring-success/30"
                  )}
                >
                  <span className={cn(
                    "text-[10px]",
                    isToday ? "text-primary font-bold" : "text-muted-foreground"
                  )}>{dayNum}</span>

                  {hasPlanned && (
                    <div
                      className="mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                      style={{ backgroundColor: day.planned!.color + "22", color: day.planned!.color }}
                    >
                      <span className="block truncate">{day.planned!.name}</span>
                      <span className="opacity-60 text-[9px]">
                        {WORKOUT_LABELS[day.planned!.workoutType] || day.planned!.workoutType}
                        {day.planned!.tssTarget != null && ` · ${day.planned!.tssTarget}`}
                      </span>
                    </div>
                  )}

                  {hasCompleted && (
                    <div className="absolute top-1 right-1 flex items-center gap-0.5">
                      <Check className="h-3 w-3 text-success" />
                      {day.completed!.tss != null && (
                        <span className="text-[9px] text-success">{day.completed!.tss}</span>
                      )}
                    </div>
                  )}

                  {isMissed && (
                    <div className="absolute top-1 right-1">
                      <X className="h-3 w-3 text-destructive" />
                    </div>
                  )}

                  {!hasPlanned && !hasCompleted && (
                    <span className="text-[10px] text-muted-foreground/30 block mt-3 text-center">Rest</span>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
