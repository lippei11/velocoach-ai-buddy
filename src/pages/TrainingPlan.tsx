import { useState } from "react";
import { Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MacrocycleTimeline } from "@/components/plan/MacrocycleTimeline";
import { WeeklyCalendar } from "@/components/plan/WeeklyCalendar";
import { DayDetailPanel } from "@/components/plan/DayDetailPanel";
import { WeekSummaryPanel } from "@/components/plan/WeekSummaryPanel";
import { SessionSlot, PlanStructure, WeekContext, WeekSkeleton } from "@/types/pipeline";
import { MOCK_PIPELINE_RESPONSE } from "@/mocks/pipeline";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { format, startOfWeek } from "date-fns";

export default function TrainingPlan() {
  // Pipeline data — use mock for now
  const [pipelineData] = useState(() => MOCK_PIPELINE_RESPONSE);
  const [loading] = useState(false);

  const planStructure: PlanStructure | null = pipelineData?.planStructure ?? null;
  const weekContext: WeekContext | null = pipelineData?.weekContext ?? null;
  const weekSkeleton: WeekSkeleton | null = pipelineData?.weekSkeleton ?? null;
  const slots: SessionSlot[] = weekSkeleton?.slots ?? [];

  const hasPlan = slots.length > 0;

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

  // Panel content
  const panelContent = panelMode === "detail" ? (
    <DayDetailPanel slot={selectedSlot} onClose={handleCloseDetail} />
  ) : panelMode === "summary" ? (
    <WeekSummaryPanel weekSkeleton={weekSkeleton} weekContext={weekContext} loading={loading} />
  ) : (
    <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
      Klicke auf eine Session für Details
    </div>
  );

  const panelTitle = panelMode === "detail" ? "Session Detail" : "Wochenübersicht";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Plan</h1>
      </div>

      {/* Macrocycle */}
      <MacrocycleTimeline
        planStructure={planStructure}
        weekContext={weekContext}
        loading={loading}
      />

      {/* Empty state */}
      {!loading && !hasPlan && (
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-4">
          <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Noch kein Trainingsplan vorhanden.</p>
          <Button onClick={() => {}}>
            <Sparkles className="h-4 w-4 mr-2" /> Plan generieren
          </Button>
        </div>
      )}

      {/* Main: Calendar + Side Panel */}
      {hasPlan && (
        <div className="flex gap-4">
          {/* Calendar */}
          <div className="flex-1 min-w-0">
            <WeeklyCalendar
              slots={slots}
              weekStartDate={weekStartDate}
              onSlotClick={handleSlotClick}
              loading={loading}
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
      {isMobile && panelMode && hasPlan && (
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
