/**
 * WeeklyContextInputs
 *
 * Compact UI for the user to specify the character of their recent/current
 * training week before triggering weekly planning.  The values are passed
 * directly to the compute-athlete-context Edge Function, which stores them
 * in athlete_state.weeklyContext so that generate-week-skeleton can use
 * them for progression-aware TSS targeting.
 *
 * Fields surfaced:
 *   specialWeekType        — normal | active_vacation | true_rest | illness | travel
 *   loadCompleteness       — complete | partial | unknown
 *   estimatedUntrackedLoad — estimatedTss, durationHours, perceivedLoad
 *     (shown only when specialWeekType ≠ normal or loadCompleteness = partial)
 */

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type {
  SpecialWeekType,
  LoadCompleteness,
} from "@/lib/coaching/velocoach-interfaces";

export interface WeeklyContextValues {
  specialWeekType: SpecialWeekType;
  loadCompleteness: LoadCompleteness;
  estimatedUntrackedLoad: {
    estimatedTss?: number;
    durationHours?: number;
    perceivedLoad?: "low" | "moderate" | "high";
  };
}

export const defaultWeeklyContextValues: WeeklyContextValues = {
  specialWeekType: "normal",
  loadCompleteness: "unknown",
  estimatedUntrackedLoad: {},
};

interface Props {
  value: WeeklyContextValues;
  onChange: (v: WeeklyContextValues) => void;
}

export function WeeklyContextInputs({ value, onChange }: Props) {
  const showEstimated =
    value.specialWeekType !== "normal" ||
    value.loadCompleteness === "partial";

  function setUntracked(
    patch: Partial<WeeklyContextValues["estimatedUntrackedLoad"]>
  ) {
    onChange({
      ...value,
      estimatedUntrackedLoad: { ...value.estimatedUntrackedLoad, ...patch },
    });
  }

  return (
    <div className="space-y-3">
      {/* Row 1: specialWeekType + loadCompleteness */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Letzte Woche</Label>
          <Select
            value={value.specialWeekType}
            onValueChange={(v) =>
              onChange({ ...value, specialWeekType: v as SpecialWeekType })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="active_vacation">Aktiver Urlaub</SelectItem>
              <SelectItem value="true_rest">Volle Erholung</SelectItem>
              <SelectItem value="illness">Krankheit</SelectItem>
              <SelectItem value="travel">Reise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Datenlage</Label>
          <Select
            value={value.loadCompleteness}
            onValueChange={(v) =>
              onChange({ ...value, loadCompleteness: v as LoadCompleteness })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unknown">Unbekannt</SelectItem>
              <SelectItem value="complete">Vollständig</SelectItem>
              <SelectItem value="partial">Teilweise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: estimated untracked load — shown when context deviates from normal */}
      {showEstimated && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Gesch. TSS
            </Label>
            <Input
              type="number"
              min={0}
              max={1500}
              className="h-8 text-xs"
              placeholder="z. B. 250"
              value={value.estimatedUntrackedLoad.estimatedTss ?? ""}
              onChange={(e) => {
                const n =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setUntracked({ estimatedTss: n });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Stunden</Label>
            <Input
              type="number"
              min={0}
              max={40}
              step={0.5}
              className="h-8 text-xs"
              placeholder="z. B. 6"
              value={value.estimatedUntrackedLoad.durationHours ?? ""}
              onChange={(e) => {
                const n =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setUntracked({ durationHours: n });
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Belastung</Label>
            <Select
              value={value.estimatedUntrackedLoad.perceivedLoad ?? ""}
              onValueChange={(v) =>
                setUntracked({
                  perceivedLoad:
                    v === ""
                      ? undefined
                      : (v as "low" | "moderate" | "high"),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Niedrig</SelectItem>
                <SelectItem value="moderate">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
