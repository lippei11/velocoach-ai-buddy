import { useState } from "react";
import { Phase, PhaseType } from "@/types/trainingPlan";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PHASE_COLORS } from "@/lib/planUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phases: Phase[];
  onSave: (phases: Phase[]) => void;
}

const PHASE_TYPES: PhaseType[] = ["BASE", "BUILD", "PEAK", "TAPER", "RECOVERY"];

export function EditPhasesDialog({ open, onOpenChange, phases, onSave }: Props) {
  const [edited, setEdited] = useState<Phase[]>(phases);

  const updatePhase = (index: number, field: string, value: any) => {
    setEdited((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Training Phases</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {edited.map((phase, i) => (
            <div key={phase.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[phase.type] }} />
                <span className="font-semibold text-sm">{phase.type} Phase</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Phase Type</Label>
                  <Select value={phase.type} onValueChange={(v) => updatePhase(i, "type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PHASE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Weeks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={phase.weeks}
                    onChange={(e) => updatePhase(i, "weeks", parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Weekly TSS Target</Label>
                  <Input
                    type="number"
                    min={100}
                    max={1000}
                    value={phase.weeklyTSSTarget}
                    onChange={(e) => updatePhase(i, "weeklyTSSTarget", parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(edited); onOpenChange(false); }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
