import { SessionSlot, SLOT_TYPE_COLORS, PURPOSE_LABELS, SLOT_TYPE_LABELS } from "@/types/pipeline";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, addDays, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function indoorIcon(val: SessionSlot["indoorOutdoor"]): string {
  switch (val) {
    case "indoor_only":
    case "indoor_preferred":
      return "🏠";
    case "outdoor_only":
    case "outdoor_preferred":
      return "🌤";
    default:
      return "~";
  }
}

interface WeeklyCalendarProps {
  slots: SessionSlot[];
  weekStartDate: string;
  onSlotClick: (slot: SessionSlot) => void;
  loading?: boolean;
}

export function WeeklyCalendar({ slots, weekStartDate, onSlotClick, loading }: WeeklyCalendarProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-6" />)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const monday = parseISO(weekStartDate);
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Build a map: day index → slot
  const slotMap = new Map<number, SessionSlot>();
  for (const s of slots) {
    slotMap.set(s.day, s);
  }

  return (
    <div className="space-y-2">
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => {
          const date = addDays(monday, i);
          const dateStr = format(date, "yyyy-MM-dd");
          const isToday = dateStr === todayStr;
          const slot = slotMap.get(i);
          const dayNum = format(date, "d");

          return (
            <button
              key={i}
              onClick={() => slot && onSlotClick(slot)}
              disabled={!slot}
              className={cn(
                "rounded-lg border bg-card p-2 min-h-[120px] text-left transition-colors relative",
                isToday ? "border-primary border-2" : "border-border",
                slot ? "hover:bg-accent cursor-pointer" : "opacity-60 cursor-default"
              )}
            >
              <span className={cn(
                "text-[10px]",
                isToday ? "text-primary font-bold" : "text-muted-foreground"
              )}>{dayNum}</span>

              {slot ? (
                <div className="mt-1.5 space-y-1">
                  {/* Purpose title */}
                  <div
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                    style={{
                      backgroundColor: SLOT_TYPE_COLORS[slot.slotType] + "22",
                      color: SLOT_TYPE_COLORS[slot.slotType],
                    }}
                  >
                    {PURPOSE_LABELS[slot.purpose]}
                  </div>

                  {/* Duration + TSS */}
                  <p className="text-[10px] text-muted-foreground">
                    {slot.durationMinutes} min · TSS {slot.targetTss}
                  </p>

                  {/* Priority + Indoor/Outdoor */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[8px] px-1 py-0 leading-tight",
                        slot.priority === "high" && "border-destructive text-destructive",
                        slot.priority === "medium" && "border-warning text-warning",
                        slot.priority === "low" && "border-muted-foreground text-muted-foreground"
                      )}
                    >
                      {slot.priority}
                    </Badge>
                    <span className="text-[10px]">{indoorIcon(slot.indoorOutdoor)}</span>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground/30 block mt-5 text-center">Rest</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
