import { useState, useEffect } from "react";
import { Calendar, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MacrocycleTimeline } from "@/components/plan/MacrocycleTimeline";
import { WeeklyCalendar } from "@/components/plan/WeeklyCalendar";
import { DayDetailPanel } from "@/components/plan/DayDetailPanel";
import { WeekSummaryPanel } from "@/components/plan/WeekSummaryPanel";
import { PlanCreationWizard } from "@/components/plan/PlanCreationWizard";
import { SessionSlot, PlanStructure, WeekContext, WeekSkeleton } from "@/types/pipeline";
import { useActivePlan } from "@/hooks/useActivePlan";
import { usePlanPipeline } from "@/hooks/usePlanPipeline";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek } from "date-fns";
import type { PlanStructure as CorePlanStructure } from "@/lib/coaching/planningCore";

/** Adapt the full planningCore PlanStructure to the simplified UI PlanStructure */
function toUiPlanStructure(core: CorePlanStructure, weekCtx: WeekContext | null): PlanStructure {
  return {
    totalWeeks: core.totalWeeks,
    macroStrategy: core.macroStrategy,
    currentPhase: weekCtx?.phase ?? core.phases[0]?.phase ?? "base",
    weeksUntilEvent: weekCtx?.weeksUntilEvent ?? null,
  };
}

export default function TrainingPlan() {
  const { data: activePlan, loading: planLoading, refetch: refetchPlan } = useActivePlan();
  const {
    loadCurrentWeek,
    skeleton: pipelineSkeleton,
    weekContext: pipelineWeekContext,
    blockContext,
    loading: pipelineLoading,
    error: pipelineError,
  } = usePlanPipeline();

  const [showWizard, setShowWizard] = useState(false);

  // Local overrides from freshly-created plan (instant display)
  const [freshSkeleton, setFreshSkeleton] = useState<WeekSkeleton | null>(null);
  const [freshWeekContext, setFreshWeekContext] = useState<WeekContext | null>(null);
  const [freshPlanStructure, setFreshPlanStructure] = useState<PlanStructure | null>(null);

  // Derived state
  const hasPlan = !!activePlan && !showWizard;
  const weekSkeleton: WeekSkeleton | null = freshSkeleton ?? pipelineSkeleton ?? null;
  const weekContext: WeekContext | null = freshWeekContext ?? pipelineWeekContext ?? null;

  // Build UI PlanStructure from core planStructure + weekContext
  const planStructure: PlanStructure | null = freshPlanStructure
    ?? (activePlan?.planStructure ? toUiPlanStructure(activePlan.planStructure, weekContext) : null);

  const slots: SessionSlot[] = weekSkeleton?.slots ?? [];
  const loading = planLoading || pipelineLoading;

  // Load current week skeleton when plan exists but no skeleton loaded
  useEffect(() => {
    if (activePlan && !showWizard && !freshSkeleton && !pipelineSkeleton && !pipelineLoading) {
      loadCurrentWeek(activePlan.plan.id);
    }
  }, [activePlan, showWizard, freshSkeleton, pipelineSkeleton, pipelineLoading, loadCurrentWeek]);

  // Panel state
  const [selectedSlot, setSelectedSlot] = useState<SessionSlot | null>(null);
  const [panelMode, setPanelMode] = useState<"summary" | "detail" | null>("summary");
  const isMobile = useIsMobile();

  const weekStartDate = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const handleSlotClick = (slot: SessionSlot) => {
    setSelectedSlot(slot);
    setPanelMode("detail");
  };

  const handleCloseDetail = () => {
    setSelectedSlot(null);
    setPanelMode("summary");
  };

  const closeMobilePanel = () => {
    setPanelMode(null);
    setSelectedSlot(null);
  };

  const handlePlanCreated = (result: any) => {
    // Set fresh data for instant display
    if (result?.weekSkeleton) setFreshSkeleton(result.weekSkeleton);
    if (result?.weekContext) setFreshWeekContext(result.weekContext);
    if (result?.planStructure) setFreshPlanStructure(result.planStructure);
    refetchPlan();
    setShowWizard(false);
  };

  const handleNewPlan = () => {
    setFreshSkeleton(null);
    setFreshWeekContext(null);
    setFreshPlanStructure(null);
    setShowWizard(true);
  };

  // Show wizard when no plan exists (after loading)
  if (!planLoading && !activePlan && !showWizard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Plan</h1>
        </div>
        <PlanCreationWizard onPlanCreated={handlePlanCreated} />
      </div>
    );
  }

  // Show wizard explicitly
  if (showWizard) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Plan</h1>
          <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)}>
            Cancel
          </Button>
        </div>
        <PlanCreationWizard onPlanCreated={handlePlanCreated} />
      </div>
    );
  }

  // Loading state
  if (planLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Plan</h1>
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  // Panel content
  const panelContent = panelMode === "detail" ? (
    <DayDetailPanel slot={selectedSlot} onClose={handleCloseDetail} />
  ) : panelMode === "summary" ? (
    <WeekSummaryPanel weekSkeleton={weekSkeleton} weekContext={weekContext} loading={pipelineLoading} />
  ) : (
    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
      Click a session for details
    </div>
  );

  const panelTitle = panelMode === "detail" ? "Session Detail" : "Week Overview";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Plan</h1>
        {hasPlan && (
          <Button variant="outline" size="sm" onClick={handleNewPlan} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" /> New Plan
          </Button>
        )}
      </div>

      {/* Macrocycle */}
      <MacrocycleTimeline
        planStructure={planStructure}
        weekContext={weekContext}
        loading={pipelineLoading}
      />

      {/* Empty skeleton state */}
      {!pipelineLoading && slots.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-4">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Loading weekly plan...</p>
        </div>
      )}

      {/* Main: Calendar + Side Panel */}
      {slots.length > 0 && (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <WeeklyCalendar
              slots={slots}
              weekStartDate={weekStartDate}
              onSlotClick={handleSlotClick}
              loading={pipelineLoading}
            />
          </div>

          {/* Right panel — desktop */}
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
      )}

      {/* Mobile drawer */}
      {isMobile && panelMode && slots.length > 0 && (
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
    </div>
  );
}
