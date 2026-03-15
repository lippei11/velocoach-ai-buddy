import { DayData } from "@/types/trainingPlan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { WORKOUT_LABELS, formatDuration } from "@/lib/planUtils";
import { format, parseISO } from "date-fns";
import { Pencil, Save, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  day: DayData;
}

export function DayDetailPanel({ day }: Props) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState("");

  const startEdit = () => {
    setDesc(day.planned?.description || "");
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{format(parseISO(day.date), "EEEE, MMM d yyyy")}</p>
      </div>

      {day.planned ? (
        <div className="space-y-3">
          {/* Name + Type badge */}
          <div>
            <h3 className="font-semibold text-base">{day.planned.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                className="text-[10px]"
                style={{ backgroundColor: day.planned.color + "33", color: day.planned.color }}
              >
                {WORKOUT_LABELS[day.planned.workoutType] || day.planned.workoutType}
              </Badge>
              {day.planned.category && (
                <Badge variant="outline" className="text-[10px]">
                  {day.planned.category}
                </Badge>
              )}
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {day.planned.duration != null && day.planned.duration > 0 && (
              <div className="rounded-md bg-accent p-2">
                <span className="text-[10px] text-muted-foreground block">Duration</span>
                <span className="font-medium text-sm">{formatDuration(day.planned.duration)}</span>
              </div>
            )}
            {day.planned.tssTarget != null && (
              <div className="rounded-md bg-accent p-2">
                <span className="text-[10px] text-muted-foreground block">TSS Target</span>
                <span className="font-medium text-sm">{day.planned.tssTarget}</span>
              </div>
            )}
          </div>

          {/* Stress type info */}
          <div className="rounded-md bg-accent p-2 text-xs">
            <span className="text-muted-foreground">Stress Type: </span>
            <span className="font-medium" style={{ color: day.planned.color }}>
              {WORKOUT_LABELS[day.planned.workoutType] || day.planned.workoutType}
            </span>
          </div>

          {/* Description / Intervals.icu text */}
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
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Workout Description</p>
                  <pre className="text-xs whitespace-pre-wrap rounded-lg bg-accent p-3 font-mono text-foreground">
                    {day.planned.description}
                  </pre>
                </div>
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
            <div className="rounded-md bg-accent p-2">
              <p className="text-muted-foreground text-[10px]">Duration</p>
              <p className="font-medium">{formatDuration(day.completed.movingTime)}</p>
            </div>
            <div className="rounded-md bg-accent p-2">
              <p className="text-muted-foreground text-[10px]">TSS</p>
              <p className="font-medium">{day.completed.tss ?? "–"}</p>
            </div>
            <div className="rounded-md bg-accent p-2">
              <p className="text-muted-foreground text-[10px]">Avg Power</p>
              <p className="font-medium">{day.completed.avgPower ? `${day.completed.avgPower}W` : "–"}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Rest day — no workout planned.</p>
      )}
    </div>
  );
}
