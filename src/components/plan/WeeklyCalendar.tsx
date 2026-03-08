import { WeekData, DayData } from "@/types/trainingPlan";
import { Progress } from "@/components/ui/progress";
import { format, parseISO, isSameDay } from "date-fns";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  weeks: WeekData[];
  onDayClick: (day: DayData) => void;
  weekRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}

export function WeeklyCalendar({ weeks, onDayClick, weekRefs }: Props) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Weekly Plan</h2>

      {/* Day labels header */}
      <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-1">
        <div />
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {weeks.map((week) => {
        const progressPct = week.tssTarget > 0 ? Math.min(100, (week.tssActual / week.tssTarget) * 100) : 0;
        return (
          <div
            key={week.startDate}
            ref={(el) => { if (week.phase) weekRefs.current[week.phase.id] = el; }}
            className="grid grid-cols-[200px_repeat(7,1fr)] gap-1"
          >
            {/* Week header */}
            <div className="rounded-lg border border-border bg-card p-2 space-y-1">
              <p className="text-xs font-semibold">
                {format(parseISO(week.startDate), "MMM d")} – {format(parseISO(week.endDate), "MMM d")}
              </p>
              {week.phaseWeekLabel && (
                <p className="text-[10px] text-muted-foreground">
                  {week.phaseWeekLabel}
                </p>
              )}
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground">
                  {week.tssActual} / {week.tssTarget} TSS
                </p>
                <Progress value={progressPct} className="h-1.5" />
              </div>
            </div>

            {/* Day cells */}
            {week.days.map((day) => {
              const hasPlanned = !!day.planned;
              const hasCompleted = !!day.completed;
              const dayDate = parseISO(day.date);
              const isMissed = hasPlanned && !hasCompleted && dayDate < today && !isSameDay(dayDate, today);
              const isToday = day.date === todayStr;
              const dayNum = format(dayDate, "d");

              return (
                <button
                  key={day.date}
                  onClick={() => onDayClick(day)}
                  className={cn(
                    "rounded-lg border bg-card p-1.5 min-h-[76px] text-left transition-colors hover:bg-accent relative",
                    isToday ? "border-primary border-2" : "border-border",
                    hasCompleted && "ring-1 ring-success/30"
                  )}
                >
                  <span className={cn(
                    "text-[10px]",
                    isToday ? "text-primary font-bold" : "text-muted-foreground"
                  )}>{dayNum}</span>

                  {hasPlanned && (
                    <div
                      className="mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium truncate"
                      style={{ backgroundColor: day.planned!.color + "22", color: day.planned!.color }}
                    >
                      {day.planned!.name}
                      {day.planned!.tssTarget != null && (
                        <span className="ml-1 opacity-70">{day.planned!.tssTarget} TSS</span>
                      )}
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
                    <span className="text-[10px] text-muted-foreground/40 block mt-2 text-center" />
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
