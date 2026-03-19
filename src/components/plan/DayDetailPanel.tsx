import { SessionSlot, SLOT_TYPE_COLORS, SLOT_TYPE_LABELS, PURPOSE_LABELS } from "@/types/pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

function indoorLabel(val: SessionSlot["indoorOutdoor"]): string {
  switch (val) {
    case "indoor_only": return "🏠 Indoor only";
    case "indoor_preferred": return "🏠 Indoor preferred";
    case "outdoor_only": return "🌤 Outdoor only";
    case "outdoor_preferred": return "🌤 Outdoor preferred";
    default: return "~ Flexible";
  }
}

interface DayDetailPanelProps {
  slot: SessionSlot | null;
  onClose: () => void;
}

export function DayDetailPanel({ slot, onClose }: DayDetailPanelProps) {
  if (!slot) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Klicke auf eine Session für Details
      </div>
    );
  }

  const color = SLOT_TYPE_COLORS[slot.slotType];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(slot.plannedDate), "EEEE, d. MMM yyyy")}
          </p>
          <h3 className="font-semibold text-base mt-0.5">
            {PURPOSE_LABELS[slot.purpose]}
          </h3>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          className="text-[10px]"
          style={{ backgroundColor: color + "33", color }}
        >
          {SLOT_TYPE_LABELS[slot.slotType]}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            slot.priority === "high" && "border-destructive text-destructive",
            slot.priority === "medium" && "border-warning text-warning",
            slot.priority === "low" && "border-muted-foreground text-muted-foreground"
          )}
        >
          {slot.priority} priority
        </Badge>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-accent p-2">
          <span className="text-[10px] text-muted-foreground block">Dauer</span>
          <span className="font-medium text-sm">{slot.durationMinutes} min</span>
        </div>
        <div className="rounded-md bg-accent p-2">
          <span className="text-[10px] text-muted-foreground block">TSS Ziel</span>
          <span className="font-medium text-sm">{slot.targetTss}</span>
        </div>
      </div>

      {/* Indoor/Outdoor */}
      <div className="rounded-md bg-accent p-2 text-xs">
        <span className="text-muted-foreground">Ort: </span>
        <span className="font-medium">{indoorLabel(slot.indoorOutdoor)}</span>
      </div>

      {/* Rationale */}
      <div className="space-y-1">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Coach-Begründung</p>
        <p className="text-xs text-foreground leading-relaxed rounded-lg bg-accent p-3">
          {slot.rationaleShort}
        </p>
      </div>

      {/* Placeholder for full session details */}
      <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          Vollständige Session-Details werden nach Plan-Generierung verfügbar
        </p>
      </div>
    </div>
  );
}
