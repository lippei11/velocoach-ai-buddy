import { useState, useRef, useMemo, useCallback } from "react";
import { Calendar, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MacrocycleTimeline } from "@/components/plan/MacrocycleTimeline";
import { EditPhasesDialog } from "@/components/plan/EditPhasesDialog";
import { WeeklyCalendar } from "@/components/plan/WeeklyCalendar";
import { DayDetailPanel } from "@/components/plan/DayDetailPanel";
import { PlanGenerator } from "@/components/plan/PlanGenerator";
import { useTrainingPlanData } from "@/hooks/useTrainingPlanData";
import { Phase, DayData, PlannedWorkout, GeneratedPlanResult } from "@/types/trainingPlan";
import { generateMockPlanResult, buildWeekData } from "@/lib/planUtils";
import { differenceInWeeks } from "date-fns";

export default function TrainingPlan() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [generatedWorkouts, setGeneratedWorkouts] = useState<PlannedWorkout[]>([]);
  const [planResult, setPlanResult] = useState<GeneratedPlanResult | null>(null);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [editPhasesOpen, setEditPhasesOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);

  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const calendarRef = useRef<HTMLDivElement>(null);

  const { plannedWorkouts, completedMap, loading, error, refresh } = useTrainingPlanData();

  const hasPlan = phases.length > 0;
  const weeksToEvent = eventDate ? differenceInWeeks(eventDate, new Date()) : 0;
  const currentCTL = planResult?.currentCTL ?? 48;
  const projectedCTL = planResult?.projectedCTL ?? currentCTL;

  // Merge API-fetched workouts with generated mock workouts
  const allPlannedWorkouts = useMemo(() => {
    const map = new Map<string, PlannedWorkout>();
    for (const w of generatedWorkouts) map.set(w.date + w.name, w);
    for (const w of plannedWorkouts) map.set(w.date + w.name, w);
    return Array.from(map.values());
  }, [plannedWorkouts, generatedWorkouts]);

  const weeks = useMemo(
    () => buildWeekData(new Date(), 4, phases, allPlannedWorkouts, completedMap),
    [phases, allPlannedWorkouts, completedMap]
  );

  const handleDayClick = (day: DayData) => {
    setSelectedDay(day);
    setDayPanelOpen(true);
  };

  const handlePhaseClick = (phaseId: string) => {
    const el = weekRefs.current[phaseId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToCalendar = () => {
    calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePlanGenerated = useCallback((date: Date) => {
    setEventDate(date);
    const result = generateMockPlanResult(date);
    setPlanResult(result);
    setPhases(result.phases);
    setGeneratedWorkouts(result.workouts);
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Training Plan</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-card p-8 text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Training Plan</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Level 1 — Macrocycle */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </div>
      ) : (
        <MacrocycleTimeline
          phases={phases}
          currentCTL={currentCTL}
          projectedCTL={projectedCTL}
          weeksToEvent={weeksToEvent}
          targetTSB={hasPlan ? "+15 to +25" : "–"}
          hasPlan={hasPlan}
          onEditPhases={() => setEditPhasesOpen(true)}
          onPhaseClick={handlePhaseClick}
        />
      )}

      {/* Level 2 — Weekly Calendar */}
      <div ref={calendarRef}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <WeeklyCalendar weeks={weeks} onDayClick={handleDayClick} weekRefs={weekRefs} />
        )}
      </div>

      {/* Level 3 — Day Detail Panel */}
      <DayDetailPanel day={selectedDay} open={dayPanelOpen} onOpenChange={setDayPanelOpen} />

      {/* Plan Generator */}
      <PlanGenerator
        onPlanGenerated={handlePlanGenerated}
        onScrollToCalendar={scrollToCalendar}
        result={planResult}
      />

      {/* Edit Phases Dialog */}
      {hasPlan && (
        <EditPhasesDialog
          open={editPhasesOpen}
          onOpenChange={setEditPhasesOpen}
          phases={phases}
          onSave={setPhases}
        />
      )}
    </div>
  );
}
