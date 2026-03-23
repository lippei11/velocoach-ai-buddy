import { useState, useEffect } from "react";
import { Calendar, Sparkles, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MacrocycleTimeline } from "@/components/plan/MacrocycleTimeline";
import { BlockTimeline } from "@/components/plan/BlockTimeline";
import { WeeklyCalendar } from "@/components/plan/WeeklyCalendar";
import { DayDetailPanel } from "@/components/plan/DayDetailPanel";
import { WeekSummaryPanel } from "@/components/plan/WeekSummaryPanel";
import { PlanCreationWizard } from "@/components/plan/PlanCreationWizard";
import { SessionSlot, PlanStructure, WeekContext, WeekSkeleton, BlockContext } from "@/types/pipeline";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useActivePlan } from "@/hooks/useActivePlan";
import { usePlanPipeline } from "@/hooks/usePlanPipeline";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek } from "date-fns";
import type { PlanStructure as CorePlanStructure } from "@/lib/coaching/planningCore";
import type { Database } from "@/integrations/supabase/types";

type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

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
  // Task 8: useActivePlan returns { data, loading, error, refetch }
  // Destructure plan + blocks from data to match Task 8 contract
  const activePlan = useActivePlan();
  const plan = activePlan.data?.plan ?? null;
  const blocks = activePlan.data?.blocks ?? [];
  const planStructureCore = activePlan.data?.planStructure ?? null;
  const planLoading = activePlan.loading;
  const refetchPlan = activePlan.refetch;

  const { createPlan, loadCurrentWeek, skeleton, weekContext: pipelineWeekContext, blockContext: pipelineBlockContext, loading: pipelineLoading, error } = usePlanPipeline();

  const [showWizard, setShowWizard] = useState(false);

  // Local overrides from freshly-created plan (instant display)
  const [freshSkeleton, setFreshSkeleton] = useState<WeekSkeleton | null>(null);
  const [freshWeekContext, setFreshWeekContext] = useState<WeekContext | null>(null);
  const [freshPlanStructure, setFreshPlanStructure] = useState<PlanStructure | null>(null);
  const [freshBlocks, setFreshBlocks] = useState<BlockRow[] | null>(null);
  const [freshBlockContext, setFreshBlockContext] = useState<BlockContext | null>(null);

  // Derived state — Task 8 state machine
  const hasPlan = !!plan && !showWizard;
  const weekSkeleton: WeekSkeleton | null = freshSkeleton ?? skeleton ?? null;
  const weekContext: WeekContext | null = freshWeekContext ?? pipelineWeekContext ?? null;
  const blockContext: BlockContext | null = freshBlockContext ?? pipelineBlockContext ?? null;
  const activeBlocks: BlockRow[] = freshBlocks ?? blocks;

  // Build UI PlanStructure from plan.plan_structure_json + weekContext
  const planStructure: PlanStructure | null = freshPlanStructure
    ?? (planStructureCore ? toUiPlanStructure(planStructureCore, weekContext) : null);

  const slots: SessionSlot[] = weekSkeleton?.slots ?? [];

  // State machine: plan exists, skeleton not loaded → call loadCurrentWeek(plan.id)
  useEffect(() => {
    if (plan && !showWizard && !freshSkeleton && !skeleton && !pipelineLoading) {
      loadCurrentWeek(plan.id);
    }
  }, [plan, showWizard, freshSkeleton, skeleton, pipelineLoading, loadCurrentWeek]);

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

  // Task 8: handlePlanCreated uses result directly for instant display
  const handlePlanCreated = (result: any) => {
    // result contains: planId, planStructure, blocks, weekContext, weekSkeleton, blockContext
    if (result?.weekSkeleton) setFreshSkeleton(result.weekSkeleton);
    if (result?.weekContext) setFreshWeekContext(result.weekContext);
    if (result?.blockContext) setFreshBlockContext(result.blockContext);
    if (result?.planStructure) {
      setFreshPlanStructure({
        totalWeeks: result.planStructure.totalWeeks ?? 0,
        macroStrategy: result.planStructure.macroStrategy ?? "",
        currentPhase: result.weekContext?.phase ?? "base",
        weeksUntilEvent: result.weekContext?.weeksUntilEvent ?? null,
      });
    }
    if (result?.blocks) setFreshBlocks(result.blocks as BlockRow[]);
    refetchPlan();
    setShowWizard(false);
  };

  const handleNewPlan = () => {
    setFreshSkeleton(null);
    setFreshWeekContext(null);
    setFreshPlanStructure(null);
    setFreshBlocks(null);
    setFreshBlockContext(null);
    setShowWizard(true);
  };

  // --- State machine rendering ---

  // No active plan → wizard
  if (!planLoading && !plan && !showWizard) {
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

  // Show wizard explicitly (New Plan clicked)
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

  // Plan loading
  if (planLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Plan</h1>
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  // Panel content with blockContext info
  const panelContent = panelMode === "detail" ? (
    <DayDetailPanel slot={selectedSlot} onClose={handleCloseDetail} />
  ) : panelMode === "summary" ? (
    <div className="space-y-4">
      {/* Block context summary in the side panel */}
      {blockContext && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {blockContext.phase} Block {blockContext.blockNumberInPhase}
            </Badge>
            {blockContext.isDeloadWeek && (
              <Badge className="text-[10px] bg-warning/20 text-warning border-warning/30">
                Deload
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Week {blockContext.weekInBlock} of {blockContext.blockWeeks}
            {" · "}{blockContext.blockLoadWeeks} load week{blockContext.blockLoadWeeks !== 1 ? "s" : ""}
          </p>
        </div>
      )}
      <WeekSummaryPanel weekSkeleton={weekSkeleton} weekContext={weekContext} loading={pipelineLoading} />
    </div>
  ) : (
    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
      Click a session for details
    </div>
  );

  const panelTitle = panelMode === "detail" ? "Session Detail" : "Week Overview";

  // Plan exists, skeleton loaded (or loading) → full plan view
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

      {/* Block Timeline */}
      <BlockTimeline
        blocks={activeBlocks}
        blockContext={blockContext}
        loading={pipelineLoading}
      />

      {/* Pipeline error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading weekly plan</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Skeleton loading state */}
      {pipelineLoading && slots.length === 0 && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      )}

      {/* Empty state after loading */}
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
