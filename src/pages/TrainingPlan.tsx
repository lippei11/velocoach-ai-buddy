import { useState, useRef, useMemo, useCallback } from "react";
import { Calendar, RefreshCw, AlertCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MacrocycleTimeline } from "@/components/plan/MacrocycleTimeline";
import { EditPhasesDialog } from "@/components/plan/EditPhasesDialog";
import { WeeklyCalendar } from "@/components/plan/WeeklyCalendar";
import { DayDetailPanel } from "@/components/plan/DayDetailPanel";
import { WeekContextPanel } from "@/components/plan/WeekContextPanel";
import { PlanGenerator } from "@/components/plan/PlanGenerator";
import { useTrainingPlanData } from "@/hooks/useTrainingPlanData";
import { Phase, DayData, WeekData, PlannedWorkout, GeneratedPlanResult } from "@/types/trainingPlan";
import { generateMockPlanResult, buildWeekData } from "@/lib/planUtils";
import { differenceInWeeks } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export default function TrainingPlan() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [generatedWorkouts, setGeneratedWorkouts] = useState<PlannedWorkout[]>([]);
  const [planResult, setPlanResult] = useState<GeneratedPlanResult | null>(null);
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [editPhasesOpen, setEditPhasesOpen] = useState(false);

  // Panel state: "week" | "day" | null
  const [panelMode, setPanelMode] = useState<"week" | "day" | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<WeekData | null>(null);

  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const calendarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const { plannedWorkouts, completedMap, loading, error, refresh } = useTrainingPlanData();

  const hasPlan = phases.length > 0;
  const weeksToEvent = eventDate ? differenceInWeeks(eventDate, new Date()) : 0;
  const currentCTL = planResult?.currentCTL ?? 48;
  const projectedCTL = planResult?.projectedCTL ?? currentCTL;

  const allPlannedWorkouts = useMemo(() => {
    const map = new Map<string, PlannedWorkout>();
    for (const w of generatedWorkouts) map.set(w.date + w.name, w);
    for (const w of plannedWorkouts) map.set(w.date + w.name, w);
    return Array.from(map.values());
  }, [plannedWorkouts, generatedWorkouts]);

  const weeks = useMemo(
    () => buildWeekData(new Date(), 8, phases, allPlannedWorkouts, completedMap),
    [phases, allPlannedWorkouts, completedMap]
  );

  const handleDayClick = (day: DayData) => {
    setSelectedDay(day);
    setPanelMode("day");
    // Also select the week this day belongs to
    const w = weeks.find((wk) => wk.days.some((d) => d.date === day.date));
    if (w) setSelectedWeek(w);
  };

  const handleWeekClick = (week: WeekData) => {
    setSelectedWeek(week);
    setSelectedDay(null);
    setPanelMode("week");
  };

  const handleBackToWeek = () => {
    setSelectedDay(null);
    setPanelMode("week");
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

  const closeMobilePanel = () => {
    setPanelMode(null);
    setSelectedDay(null);
  };

  // Panel content
  const panelContent = panelMode === "day" && selectedDay ? (
    <div>
      {selectedWeek && (
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={handleBackToWeek}>
          <ChevronLeft className="h-3 w-3 mr-1" /> Week overview
        </Button>
      )}
      <DayDetailPanel day={selectedDay} />
    </div>
  ) : panelMode === "week" && selectedWeek ? (
    <WeekContextPanel week={selectedWeek} />
  ) : (
    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
      Click a week or day to view details
    </div>
  );

  const panelTitle = panelMode === "day" ? "Session Detail" : panelMode === "week" ? "Week Overview" : "Detail";

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Plan</h1>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Plan</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Macrocycle — compact */}
      {loading ? (
        <Skeleton className="h-16 w-full" />
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

      {/* Main content: Calendar + Side Panel */}
      <div className="flex gap-4" ref={calendarRef}>
        {/* Calendar — takes most space */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <WeeklyCalendar
              weeks={weeks}
              onDayClick={handleDayClick}
              onWeekClick={handleWeekClick}
              selectedWeek={selectedWeek}
              selectedDay={selectedDay}
              weekRefs={weekRefs}
            />
          )}
        </div>

        {/* Right panel — desktop only */}
        {!isMobile && (
          <div className="w-[320px] shrink-0">
            <div className="sticky top-4 rounded-lg border border-border bg-card p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                {panelTitle}
              </h2>
              {panelContent}
            </div>
          </div>
        )}
      </div>

      {/* Mobile: Bottom sheet/drawer for panel */}
      {isMobile && panelMode && (
        <Drawer open={!!panelMode} onOpenChange={(open) => { if (!open) closeMobilePanel(); }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{panelTitle}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 max-h-[70vh] overflow-y-auto">
              {panelContent}
            </div>
          </DrawerContent>
        </Drawer>
      )}

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
