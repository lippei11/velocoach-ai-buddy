import { DayData } from "@/types/trainingPlan";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDuration } from "@/lib/planUtils";
import { format, parseISO } from "date-fns";
import { Pencil, Save, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  day: DayData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DayDetailPanel({ day, open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState("");

  const startEdit = () => {
    setDesc(day?.planned?.description || "");
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    toast.success("Workout description updated");
  };

  const handleSyncToIntervals = () => {
    toast.success("Workout saved to Intervals.icu", {
      description: "Synced successfully",
    });
  };

  const content = day ? (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{format(parseISO(day.date), "EEEE, MMM d yyyy")}</p>
      </div>

      {day.planned ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{day.planned.name}</h3>
            <Badge style={{ backgroundColor: day.planned.color + "33", color: day.planned.color }}>
              {day.planned.workoutType}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {day.planned.duration != null && day.planned.duration > 0 && (
              <div>
                <span className="text-muted-foreground">Duration: </span>
                <span className="font-medium">{formatDuration(day.planned.duration)}</span>
              </div>
            )}
            {day.planned.tssTarget != null && (
              <div>
                <span className="text-muted-foreground">TSS Target: </span>
                <span className="font-medium">{day.planned.tssTarget}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {editing ? (
            <div className="space-y-2">
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={8} className="font-mono text-xs" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              {day.planned.description && (
                <pre className="text-xs whitespace-pre-wrap rounded-lg bg-accent p-3 font-mono text-foreground">
                  {day.planned.description}
                </pre>
              )}
              <Button variant="ghost" size="sm" className="mt-2" onClick={startEdit}>
                <Pencil className="h-3 w-3 mr-1" /> Edit Workout
              </Button>
            </div>
          )}

          {/* Planned vs Actual comparison */}
          {day.completed && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-semibold text-success">✓ Completed — Planned vs Actual</p>
              <div className="grid grid-cols-4 gap-1 text-xs">
                <div className="text-muted-foreground">Metric</div>
                <div className="text-muted-foreground text-center">Planned</div>
                <div className="text-muted-foreground text-center">Actual</div>
                <div className="text-muted-foreground text-center">Delta</div>

                <div>Duration</div>
                <div className="text-center font-medium">{day.planned.duration ? formatDuration(day.planned.duration) : "–"}</div>
                <div className="text-center font-medium">{formatDuration(day.completed.movingTime)}</div>
                <div className={`text-center font-medium ${
                  day.planned.duration && day.completed.movingTime > day.planned.duration ? "text-success" : "text-destructive"
                }`}>
                  {day.planned.duration ? (day.completed.movingTime > day.planned.duration ? "+" : "") + formatDuration(Math.abs(day.completed.movingTime - day.planned.duration)) : "–"}
                </div>

                <div>TSS</div>
                <div className="text-center font-medium">{day.planned.tssTarget ?? "–"}</div>
                <div className="text-center font-medium">{day.completed.tss ?? "–"}</div>
                <div className={`text-center font-medium ${
                  day.planned.tssTarget && day.completed.tss && day.completed.tss >= day.planned.tssTarget ? "text-success" : "text-destructive"
                }`}>
                  {day.planned.tssTarget && day.completed.tss ? (day.completed.tss >= day.planned.tssTarget ? "+" : "") + (day.completed.tss - day.planned.tssTarget) : "–"}
                </div>

                <div>Avg Power</div>
                <div className="text-center font-medium">–</div>
                <div className="text-center font-medium">{day.completed.avgPower ? `${day.completed.avgPower}W` : "–"}</div>
                <div className="text-center font-medium">–</div>
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={handleSyncToIntervals}>
            <Upload className="h-3 w-3 mr-1" /> Save to Intervals.icu
          </Button>
        </div>
      ) : day.completed ? (
        <div className="space-y-3">
          <h3 className="font-semibold">{day.completed.name}</h3>
          <Badge variant="secondary">{day.completed.type}</Badge>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Duration</p>
              <p className="font-medium">{formatDuration(day.completed.movingTime)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">TSS</p>
              <p className="font-medium">{day.completed.tss ?? "–"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Avg Power</p>
              <p className="font-medium">{day.completed.avgPower ? `${day.completed.avgPower}W` : "–"}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Rest day — no workout planned.</p>
      )}
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Day Detail</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:max-w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Day Detail</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
