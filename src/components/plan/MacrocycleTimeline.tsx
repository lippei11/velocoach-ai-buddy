import { PlanStructure, WeekContext, PHASE_COLORS, PHASE_LABELS, PipelinePhase } from "@/types/pipeline";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Target, Zap, TrendingUp } from "lucide-react";

interface MacrocycleTimelineProps {
  planStructure: PlanStructure | null;
  weekContext: WeekContext | null;
  loading?: boolean;
}

const ALL_PHASES: PipelinePhase[] = ["base", "build", "peak", "taper"];

export function MacrocycleTimeline({ planStructure, weekContext, loading }: MacrocycleTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  if (!planStructure || !weekContext) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Macrocycle Overview</h2>
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
          <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Generiere einen Plan, um dein Macrocycle zu sehen</p>
        </div>
      </div>
    );
  }

  const currentPhase = weekContext.phase;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Macrocycle Overview</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            Strategie: {planStructure.macroStrategy}
          </Badge>
          {weekContext.isDeloadWeek && (
            <Badge className="text-[10px] bg-warning/20 text-warning border-warning/30">
              Deload-Woche
            </Badge>
          )}
        </div>
      </div>

      {/* Phase timeline bar */}
      <div className="flex h-14 rounded-lg overflow-hidden border border-border">
        {ALL_PHASES.map((phase) => {
          const isActive = phase === currentPhase;
          const color = PHASE_COLORS[phase];
          return (
            <div
              key={phase}
              className="relative flex flex-col items-center justify-center text-xs font-medium flex-1 transition-all"
              style={{
                backgroundColor: isActive ? color : color + "33",
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <span className={`font-bold ${isActive ? "text-white" : "text-foreground"}`}>
                {PHASE_LABELS[phase]}
              </span>
              {isActive && (
                <span className="text-white/80 text-[10px]">
                  Woche {weekContext.weekNumberInPhase}
                </span>
              )}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: color }} />
              )}
            </div>
          );
        })}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Phase</p>
              <p className="text-lg font-bold" style={{ color: PHASE_COLORS[currentPhase] }}>
                {PHASE_LABELS[currentPhase]}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Woche im Plan</p>
              <p className="text-lg font-bold">{weekContext.weekNumberInPlan} / {planStructure.totalWeeks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Wochen bis Event</p>
              <p className="text-lg font-bold">
                {planStructure.weeksUntilEvent != null ? planStructure.weeksUntilEvent : "–"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Woche in Phase</p>
              <p className="text-lg font-bold">{weekContext.weekNumberInPhase}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
