import { Phase } from "@/types/trainingPlan";
import { PHASE_COLORS } from "@/lib/planUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings2, TrendingUp, Calendar, Clock, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  phases: Phase[];
  currentCTL: number;
  weeksToEvent: number;
  onEditPhases: () => void;
  onPhaseClick: (phaseId: string) => void;
}

export function MacrocycleTimeline({ phases, currentCTL, weeksToEvent, onEditPhases, onPhaseClick }: Props) {
  const totalWeeks = phases.reduce((s, p) => s + p.weeks, 0);
  const projectedCTL = phases.length > 0 ? phases[phases.length - 1].targetCTLRange[1] : currentCTL;
  const totalHours = Math.round(phases.reduce((s, p) => s + (p.weeklyTSSTarget / 60) * p.weeks, 0));
  const peakTSB = phases.find((p) => p.type === "TAPER") ? "+15" : "+5";

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
                  style={{ width: `${widthPct}%`, backgroundColor: PHASE_COLORS[phase.type] }}
                  onClick={() => onPhaseClick(phase.id)}
                >
                  <span className="font-bold text-background">{phase.type}</span>
                  <span className="text-background/80">{phase.weeks}w</span>
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

      {/* KPI projections */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">CTL Projection</p>
              <p className="text-lg font-bold">{currentCTL} → {projectedCTL}</p>
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
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
              <p className="text-lg font-bold">{totalHours}h</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Peak TSB (Race Day)</p>
              <p className="text-lg font-bold text-success">{peakTSB}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
