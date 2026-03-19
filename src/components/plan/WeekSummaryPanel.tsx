import { WeekSkeleton, WeekContext, SLOT_TYPE_COLORS, SLOT_TYPE_LABELS, PHASE_COLORS, PHASE_LABELS } from "@/types/pipeline";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Flame, Bike, Info, AlertTriangle } from "lucide-react";

interface WeekSummaryPanelProps {
  weekSkeleton: WeekSkeleton | null;
  weekContext: WeekContext | null;
  loading?: boolean;
}

export function WeekSummaryPanel({ weekSkeleton, weekContext, loading }: WeekSummaryPanelProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!weekSkeleton || !weekContext) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Keine Wochendaten verfügbar.
      </div>
    );
  }

  const budget = weekSkeleton.weeklyStressBudget;
  const hardSessions = budget.plannedThreshold + budget.plannedVo2 + budget.plannedNeuromuscular;
  const maxHard = budget.maxThresholdSessions + budget.maxVo2Sessions + budget.maxNeuromuscularSessions;

  return (
    <div className="space-y-5">
      {/* Deload banner */}
      {weekContext.isDeloadWeek && (
        <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Deload-Woche — reduziertes Volumen
        </div>
      )}

      {/* Week focus */}
      <div>
        <h3 className="font-semibold text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Wochenfokus: {weekSkeleton.weekFocus}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {weekSkeleton.rationaleShort}
        </p>
      </div>

      {/* Phase badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          className="text-[10px]"
          style={{
            backgroundColor: PHASE_COLORS[weekContext.phase] + "22",
            color: PHASE_COLORS[weekContext.phase],
          }}
        >
          {PHASE_LABELS[weekContext.phase]} Phase — Woche {weekContext.weekNumberInPhase}
        </Badge>
        {weekContext.isFirstWeekOfPhase && (
          <Badge variant="outline" className="text-[10px]">Phasenanfang</Badge>
        )}
        {weekContext.isLastWeekOfPhase && (
          <Badge variant="outline" className="text-[10px]">Phasenende</Badge>
        )}
      </div>

      {/* Stress Budget table */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-primary" />
          Stress Budget
        </div>
        <div className="rounded-lg border border-border overflow-hidden text-xs">
          <table className="w-full">
            <tbody>
              <tr className="border-b border-border">
                <td className="p-2 text-muted-foreground">TSS Ziel</td>
                <td className="p-2 font-semibold text-right">{budget.weeklyTssTarget}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 text-muted-foreground">Harte Sessions</td>
                <td className="p-2 font-semibold text-right">{hardSessions} / {maxHard}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 text-muted-foreground">Long Ride</td>
                <td className="p-2 font-semibold text-right">{budget.plannedLongRide ? "✓" : "—"}</td>
              </tr>
              <tr>
                <td className="p-2 text-muted-foreground">Typology</td>
                <td className="p-2 font-semibold text-right">{budget.typology}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Session type breakdown */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Flame className="h-4 w-4 text-destructive" />
          Session-Typen
        </div>
        <div className="flex flex-wrap gap-1.5">
          {weekSkeleton.slots.map((slot, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-[10px] gap-1"
              style={{
                backgroundColor: SLOT_TYPE_COLORS[slot.slotType] + "22",
                color: SLOT_TYPE_COLORS[slot.slotType],
              }}
            >
              {SLOT_TYPE_LABELS[slot.slotType]}
            </Badge>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>🔥 {hardSessions} harte Session{hardSessions !== 1 ? "s" : ""}</span>
          {budget.plannedLongRide && (
            <span className="flex items-center gap-1">
              <Bike className="h-3 w-3" /> Long Ride
            </span>
          )}
          <span>😴 {7 - weekSkeleton.slots.length} Ruhetag{7 - weekSkeleton.slots.length !== 1 ? "e" : ""}</span>
        </div>
      </div>
    </div>
  );
}
