import { Phase } from "@/types/trainingPlan";
import { PHASE_HEX } from "@/lib/planUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings2, TrendingUp, Calendar, Target, Zap, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  phases: Phase[];
  currentCTL: number;
  projectedCTL: number;
  weeksToEvent: number;
  targetTSB: string;
  hasPlan: boolean;
  onEditPhases: () => void;
  onPhaseClick: (phaseId: string) => void;
}

export function MacrocycleTimeline({
  phases,
  currentCTL,
  projectedCTL,
  weeksToEvent,
  targetTSB,
  hasPlan,
  onEditPhases,
  onPhaseClick,
}: Props) {
  if (!hasPlan) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Macrocycle Overview</h2>
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Generate a plan to see your macrocycle</p>
        </div>
      </div>
    );
  }

  const totalWeeks = phases.reduce((s, p) => s + p.weeks, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Macrocycle Overview</h2>
        <Button variant="outline" size="sm" onClick={onEditPhases}>
          <Settings2 className="h-4 w-4 mr-1" /> Edit Phases
        </Button>
      </div>

      {/* Timeline bar */}
      <div className="flex h-16 rounded-lg overflow-hidden border border-border">
        {phases.map((phase) => {
          const widthPct = (phase.weeks / totalWeeks) * 100;
          return (
            <Tooltip key={phase.id}>
              <TooltipTrigger asChild>
                <button
                  className="relative flex flex-col items-center justify-center text-xs font-medium transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ width: `${widthPct}%`, backgroundColor: PHASE_HEX[phase.type] }}
                  onClick={() => onPhaseClick(phase.id)}
                >
                  <span className="font-bold text-white">{phase.type}</span>
                  <span className="text-white/80">{phase.weeks}w · {phase.weeklyTSSTarget} TSS</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{phase.type} Phase — {phase.weeks} weeks</p>
                <p>CTL: {phase.targetCTLRange[0]}–{phase.targetCTLRange[1]}</p>
                <p>TSS: ~{phase.weeklyTSSTarget}/week</p>
                <p>{phase.workoutFocus}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* KPI projection cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Current CTL</p>
              <p className="text-lg font-bold">{currentCTL}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Projected CTL</p>
              <p className="text-lg font-bold">{projectedCTL}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Weeks to Event</p>
              <p className="text-lg font-bold">{weeksToEvent}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Race-day TSB</p>
              <p className="text-lg font-bold text-success">{targetTSB}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
