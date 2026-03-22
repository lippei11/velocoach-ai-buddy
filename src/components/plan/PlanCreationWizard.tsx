import { useState, useMemo, useEffect } from "react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { CalendarIcon, ChevronRight, ChevronLeft, Loader2, AlertTriangle, Flag, Palmtree, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { useAthletePreferences } from "@/hooks/useAthletePreferences";
import { usePlanPipeline } from "@/hooks/usePlanPipeline";
import {
  generatePlanStructure,
  deriveBlocksFromPlan,
  type PlanStructure,
  type DerivedBlock,
  type EventDemandProfile,
} from "@/lib/coaching/planningCore";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEMAND_PROFILES = [
  { value: "steady_climbing", label: "Gran Fondo (Alpine / Hilly)" },
  { value: "long_gravel", label: "Gran Fondo (Gravel / Flat)" },
  { value: "time_trial", label: "Time Trial / Triathlon" },
  { value: "punchy_stochastic", label: "Criterium / Road Race" },
  { value: "ultra_endurance", label: "Ultra Endurance (12h+)" },
  { value: "ftp_build", label: "FTP Development" },
  { value: "mixed_hobby_fitness", label: "General Fitness" },
];

const ENTRY_STATES = [
  { value: "fresh_start", label: "Starting fresh — no recent consistent training" },
  { value: "mid_training", label: "Currently training consistently" },
  { value: "returning_after_break", label: "Returning after a break (illness, travel, etc.)" },
];

const TYPOLOGY_OPTIONS = [
  { value: "PYRAMIDAL", label: "Pyramidal (balanced)", description: "Recommended for 6–10h/week. Balanced intensity distribution." },
  { value: "POLARIZED", label: "Polarized (80/20)", description: "For 10h+/week with strong aerobic base. High volume, high intensity, minimal middle zone." },
  { value: "SS_THRESHOLD", label: "Sweet Spot / Threshold", description: "For ≤8h/week or FTP-focused goals. Time-efficient quality sessions." },
];

const TYPOLOGY_DEFAULTS: Record<string, string> = {
  steady_climbing: "PYRAMIDAL",
  time_trial: "SS_THRESHOLD",
  punchy_stochastic: "PYRAMIDAL",
  long_gravel: "PYRAMIDAL",
  ultra_endurance: "POLARIZED",
  ftp_build: "SS_THRESHOLD",
  mixed_hobby_fitness: "PYRAMIDAL",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PHASE_COLORS: Record<string, string> = {
  base: "bg-blue-500",
  build: "bg-orange-500",
  peak: "bg-red-500",
  taper: "bg-green-500",
};

const PHASE_COLORS_LIGHT: Record<string, string> = {
  base: "bg-blue-500/40",
  build: "bg-orange-500/40",
  peak: "bg-red-500/40",
  taper: "bg-green-500/40",
};

const PHASE_LABELS: Record<string, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
};

const STEP_LABELS = ["Goal & Event", "Strategy & Schedule", "Phase & Block Preview", "Confirm & Create"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface WizardState {
  eventDemandProfile: string;
  eventName: string;
  eventDate: string | null;
  entryState: string;
  hoursPerWeek: number;
  availableDays: string[];
  strengthSessionsPerWeek: number;
  typology: string;
  preferOutdoorLongRide: boolean;
  preferIndoorIntervals: boolean;
  vacationWeeks: string[];
}

interface PlanCreationWizardProps {
  onPlanCreated: (result: any) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PlanCreationWizard({ onPlanCreated }: PlanCreationWizardProps) {
  const { prefs, loading: prefsLoading } = useAthletePreferences();
  const { createPlan, loading: creating } = usePlanPipeline();
  const [currentStep, setCurrentStep] = useState(1);
  const [prefsFilled, setPrefsFilled] = useState(false);

  const [state, setState] = useState<WizardState>({
    eventDemandProfile: "",
    eventName: "",
    eventDate: null,
    entryState: "",
    hoursPerWeek: 10,
    availableDays: ["Tue", "Thu", "Sat", "Sun"],
    strengthSessionsPerWeek: 0,
    typology: "PYRAMIDAL",
    preferOutdoorLongRide: true,
    preferIndoorIntervals: true,
  });

  // Pre-fill from athlete preferences once loaded
  useEffect(() => {
    if (!prefsLoading && !prefsFilled) {
      setState((s) => ({
        ...s,
        hoursPerWeek: prefs.hours_per_week || s.hoursPerWeek,
        availableDays: prefs.available_days?.length ? prefs.available_days : s.availableDays,
        strengthSessionsPerWeek: prefs.strength_sessions_per_week ?? s.strengthSessionsPerWeek,
        preferOutdoorLongRide: prefs.prefer_outdoor_long_ride ?? s.preferOutdoorLongRide,
        preferIndoorIntervals: prefs.prefer_indoor_intervals ?? s.preferIndoorIntervals,
        eventDemandProfile: prefs.event_demand_profile && prefs.event_demand_profile !== "road_race"
          ? prefs.event_demand_profile
          : s.eventDemandProfile,
      }));
      setPrefsFilled(true);
    }
  }, [prefsLoading, prefsFilled, prefs]);

  // Auto-select typology when demand profile changes
  useEffect(() => {
    if (state.eventDemandProfile && TYPOLOGY_DEFAULTS[state.eventDemandProfile]) {
      setState((s) => ({ ...s, typology: TYPOLOGY_DEFAULTS[s.eventDemandProfile] || s.typology }));
    }
  }, [state.eventDemandProfile]);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  // ─── Validation ──────────────────────────────────────────────────────────

  const canAdvanceStep1 = state.eventDemandProfile !== "" && state.entryState !== "";
  const canAdvanceStep2 = state.hoursPerWeek > 0 && state.availableDays.length >= 2;

  const canAdvance = (step: number) => {
    if (step === 1) return canAdvanceStep1;
    if (step === 2) return canAdvanceStep2;
    return true;
  };

  const handleNext = () => {
    if (!canAdvance(currentStep)) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // ─── Step 3: Plan Structure Preview ──────────────────────────────────────

  const planPreview = useMemo<{ structure: PlanStructure; blocks: DerivedBlock[] } | null>(() => {
    if (!state.eventDemandProfile) return null;
    try {
      const structure = generatePlanStructure({
        eventDate: state.eventDate || null,
        todayDate: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
        currentCtl: null,
        eventDemandProfile: state.eventDemandProfile as EventDemandProfile,
        hoursPerWeek: state.hoursPerWeek,
        strengthSessionsPerWeek: state.strengthSessionsPerWeek,
        constitutionVersion: "7",
      });
      const blocks = deriveBlocksFromPlan(structure);
      return { structure, blocks };
    } catch {
      return null;
    }
  }, [state.eventDemandProfile, state.eventDate, state.hoursPerWeek, state.strengthSessionsPerWeek]);

  // ─── Step 4: Create Plan ─────────────────────────────────────────────────

  const handleCreate = async () => {
    try {
      const result = await createPlan({
        eventDemandProfile: state.eventDemandProfile,
        eventName: state.eventName || undefined,
        eventDate: state.eventDate || undefined,
        hoursPerWeek: state.hoursPerWeek,
        availableDays: state.availableDays,
        strengthSessionsPerWeek: state.strengthSessionsPerWeek,
        entryState: state.entryState as "fresh_start" | "mid_training" | "returning_after_break",
        typology: state.typology as "PYRAMIDAL" | "POLARIZED" | "SS_THRESHOLD",
      });
      onPlanCreated(result);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create plan. Please try again.");
    }
  };

  // ─── Typology mismatch warnings ──────────────────────────────────────────

  const typologyWarning = useMemo(() => {
    if (state.typology === "POLARIZED" && state.hoursPerWeek < 8) {
      return `Polarized training needs sufficient low-intensity volume. With ${state.hoursPerWeek}h/week, Pyramidal may be more effective.`;
    }
    if (state.typology === "SS_THRESHOLD" && state.hoursPerWeek > 12) {
      return `With ${state.hoursPerWeek}h/week you have enough volume for a broader approach. Consider Pyramidal.`;
    }
    return null;
  }, [state.typology, state.hoursPerWeek]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Step Content */}
      {currentStep === 1 && (
        <StepGoalEvent state={state} update={update} />
      )}
      {currentStep === 2 && (
        <StepStrategy
          state={state}
          update={update}
          typologyWarning={typologyWarning}
        />
      )}
      {currentStep === 3 && (
        <StepPhasePreview
          planPreview={planPreview}
          eventDate={state.eventDate}
        />
      )}
      {currentStep === 4 && (
        <StepConfirm
          state={state}
          planPreview={planPreview}
          creating={creating}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        {currentStep > 1 ? (
          <Button variant="outline" onClick={handleBack} disabled={creating}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        ) : (
          <div />
        )}
        {currentStep < 4 ? (
          <Button onClick={handleNext} disabled={!canAdvance(currentStep)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating your training plan…
              </>
            ) : (
              "Create Plan"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isDone = step < currentStep;
        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "w-8 sm:w-12 h-0.5",
                  isDone ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                {step}
              </div>
              <span className="text-[10px] text-muted-foreground hidden sm:block max-w-[80px] text-center leading-tight">
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Goal & Event ────────────────────────────────────────────────────

function StepGoalEvent({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const eventDateObj = state.eventDate ? new Date(state.eventDate) : undefined;

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold mb-1">Goal & Event</h2>
          <p className="text-xs text-muted-foreground">
            What are you training for?
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Event Demand Profile <span className="text-destructive">*</span>
          </Label>
          <Select
            value={state.eventDemandProfile}
            onValueChange={(v) => update("eventDemandProfile", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your focus" />
            </SelectTrigger>
            <SelectContent>
              {DEMAND_PROFILES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Event Name (optional)</Label>
            <Input
              placeholder="e.g. L'Étape du Tour"
              value={state.eventName}
              onChange={(e) => update("eventName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Event Date (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !eventDateObj && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDateObj ? format(eventDateObj, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDateObj}
                  onSelect={(d) =>
                    update("eventDate", d ? format(d, "yyyy-MM-dd") : null)
                  }
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Entry State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={state.entryState}
            onValueChange={(v) => update("entryState", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Where are you in your training?" />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_STATES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Strategy & Schedule ─────────────────────────────────────────────

function StepStrategy({
  state,
  update,
  typologyWarning,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  typologyWarning: string | null;
}) {
  const toggleDay = (day: string) => {
    const days = state.availableDays.includes(day)
      ? state.availableDays.filter((d) => d !== day)
      : [...state.availableDays, day];
    update("availableDays", days);
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold mb-1">Strategy & Schedule</h2>
          <p className="text-xs text-muted-foreground">
            How much time do you have, and how should we structure your training?
          </p>
        </div>

        {/* Hours per week */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Weekly Hours</Label>
            <span className="text-sm font-mono font-medium">{state.hoursPerWeek}h</span>
          </div>
          <Slider
            min={3}
            max={15}
            step={1}
            value={[state.hoursPerWeek]}
            onValueChange={([v]) => update("hoursPerWeek", v)}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>3h</span>
            <span>15h</span>
          </div>
        </div>

        {/* Available days */}
        <div className="space-y-2">
          <Label className="text-xs">Available Training Days</Label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                  state.availableDays.includes(d)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-accent"
                )}
              >
                {d}
              </button>
            ))}
          </div>
          {state.availableDays.length < 2 && (
            <p className="text-[11px] text-destructive">Select at least 2 days</p>
          )}
        </div>

        {/* Strength sessions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Strength Sessions / Week</Label>
            <span className="text-sm font-mono font-medium">{state.strengthSessionsPerWeek}</span>
          </div>
          <Slider
            min={0}
            max={4}
            step={1}
            value={[state.strengthSessionsPerWeek]}
            onValueChange={([v]) => update("strengthSessionsPerWeek", v)}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0</span>
            <span>4</span>
          </div>
        </div>

        <Separator />

        {/* Typology */}
        <div className="space-y-3">
          <Label className="text-xs">Training Approach</Label>
          <RadioGroup
            value={state.typology}
            onValueChange={(v) => update("typology", v)}
            className="space-y-2"
          >
            {TYPOLOGY_OPTIONS.map((opt) => {
              const isRecommended =
                state.eventDemandProfile &&
                TYPOLOGY_DEFAULTS[state.eventDemandProfile] === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    state.typology === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <RadioGroupItem value={opt.value} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{opt.label}</span>
                      {isRecommended && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {typologyWarning && (
            <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-xs text-yellow-200">
                {typologyWarning}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* Preferences */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Prefer Outdoor Long Rides</Label>
              <p className="text-[11px] text-muted-foreground">Long endurance sessions default to outdoor</p>
            </div>
            <Switch
              checked={state.preferOutdoorLongRide}
              onCheckedChange={(v) => update("preferOutdoorLongRide", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Prefer Indoor Intervals</Label>
              <p className="text-[11px] text-muted-foreground">High-intensity sessions default to trainer</p>
            </div>
            <Switch
              checked={state.preferIndoorIntervals}
              onCheckedChange={(v) => update("preferIndoorIntervals", v)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Phase & Block Preview ───────────────────────────────────────────

function StepPhasePreview({
  planPreview,
  eventDate,
}: {
  planPreview: { structure: PlanStructure; blocks: DerivedBlock[] } | null;
  eventDate: string | null;
}) {
  if (!planPreview) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-8">
            Go back and select an event demand profile to see a preview.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { structure, blocks } = planPreview;
  const totalWeeks = structure.totalWeeks;

  // Build a week-by-week map for the timeline
  const weekData = useMemo(() => {
    const weeks: Array<{
      weekNum: number;
      phase: string;
      isDeload: boolean;
      isBlockBoundary: boolean;
    }> = [];

    for (const phase of structure.phases) {
      for (let i = 0; i < phase.weekNumbers.length; i++) {
        const wn = phase.weekNumbers[i];
        const isDeload = phase.deloadWeeks.includes(wn);

        // Check if this is the first week of a block
        let isBlockBoundary = false;
        for (const block of blocks) {
          const blockStartWeek = block.blockNumber === 1
            ? structure.phases[0].weekNumbers[0]
            : undefined;
          // A block boundary is the first week of any block that isn't week 1 of the plan
          if (block.startDate === format(
            new Date(new Date(structure.planStartDate).getTime() + (wn - 1) * 7 * 86400000),
            "yyyy-MM-dd"
          ) && wn !== structure.phases[0].weekNumbers[0]) {
            isBlockBoundary = true;
          }
        }

        weeks.push({
          weekNum: wn,
          phase: phase.phase,
          isDeload,
          isBlockBoundary,
        });
      }
    }
    return weeks;
  }, [structure, blocks]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold mb-1">Phase & Block Preview</h2>
          <p className="text-xs text-muted-foreground">
            Your training plan structure — {totalWeeks} weeks total
          </p>
        </div>

        {/* Phase timeline bar */}
        <div className="space-y-2">
          <div className="flex rounded-md overflow-hidden h-10 border border-border">
            {weekData.map((w, i) => (
              <div
                key={w.weekNum}
                className={cn(
                  "relative flex-1 min-w-0 transition-colors",
                  w.isDeload ? PHASE_COLORS_LIGHT[w.phase] : PHASE_COLORS[w.phase],
                  w.isBlockBoundary && "border-l-2 border-background"
                )}
                title={`Week ${w.weekNum} — ${PHASE_LABELS[w.phase]}${w.isDeload ? " (Deload)" : ""}`}
              >
                {/* Deload hatching */}
                {w.isDeload && (
                  <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)",
                  }} />
                )}
              </div>
            ))}
            {/* Event marker */}
            {eventDate && (
              <div className="relative w-0">
                <div className="absolute -left-px top-0 bottom-0 w-0.5 bg-foreground" />
                <Flag className="absolute -left-2 -top-3 h-4 w-4 text-foreground" />
              </div>
            )}
          </div>

          {/* Phase labels below bar */}
          <div className="flex">
            {structure.phases.map((p) => (
              <div
                key={p.phase}
                className="flex-1 text-center"
                style={{ flex: p.weeks }}
              >
                <span className="text-[10px] font-medium text-muted-foreground">
                  {PHASE_LABELS[p.phase]} ({p.weeks}w)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total Weeks" value={String(totalWeeks)} />
          <SummaryCard label="Blocks" value={String(blocks.length)} />
          <SummaryCard
            label="Strategy"
            value={structure.macroStrategy.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Deload Weeks"
            value={String(
              structure.phases.reduce((sum, p) => sum + p.deloadWeeks.length, 0)
            )}
          />
        </div>

        {/* Phase details */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Phase Breakdown</Label>
          <div className="flex flex-wrap gap-2">
            {structure.phases.map((p) => (
              <div
                key={p.phase}
                className="flex items-center gap-1.5 text-xs"
              >
                <div className={cn("w-2.5 h-2.5 rounded-sm", PHASE_COLORS[p.phase])} />
                <span>
                  {PHASE_LABELS[p.phase]}: {p.weeks}w
                  {p.deloadWeeks.length > 0 && (
                    <span className="text-muted-foreground"> ({p.deloadWeeks.length} deload)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Block details */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Block Structure</Label>
          <div className="space-y-1">
            {blocks.map((b) => (
              <div key={b.blockNumber} className="flex items-center gap-2 text-xs">
                <div className={cn("w-2 h-2 rounded-full", PHASE_COLORS[b.phase])} />
                <span className="text-muted-foreground">Block {b.blockNumber}</span>
                <span>
                  {PHASE_LABELS[b.phase]} · {b.weeks}w ({b.loadWeeks} load
                  {b.deloadWeekNumbers.length > 0 && ` + ${b.deloadWeekNumbers.length} deload`})
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-lg font-semibold capitalize">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Step 4: Confirm & Create ────────────────────────────────────────────────

function StepConfirm({
  state,
  planPreview,
  creating,
}: {
  state: WizardState;
  planPreview: { structure: PlanStructure; blocks: DerivedBlock[] } | null;
  creating: boolean;
}) {
  const profileLabel =
    DEMAND_PROFILES.find((p) => p.value === state.eventDemandProfile)?.label ?? state.eventDemandProfile;
  const entryLabel =
    ENTRY_STATES.find((s) => s.value === state.entryState)?.label ?? state.entryState;
  const typologyLabel =
    TYPOLOGY_OPTIONS.find((t) => t.value === state.typology)?.label ?? state.typology;

  if (creating) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Creating your training plan…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold mb-1">Confirm & Create</h2>
          <p className="text-xs text-muted-foreground">
            Review your selections before creating the plan.
          </p>
        </div>

        {/* Event */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Event</Label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Demand Profile</span>
            <span>{profileLabel}</span>
            {state.eventName && (
              <>
                <span className="text-muted-foreground">Name</span>
                <span>{state.eventName}</span>
              </>
            )}
            {state.eventDate && (
              <>
                <span className="text-muted-foreground">Date</span>
                <span>{format(new Date(state.eventDate), "PPP")}</span>
              </>
            )}
            <span className="text-muted-foreground">Entry State</span>
            <span>{entryLabel}</span>
          </div>
        </div>

        <Separator />

        {/* Strategy */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Strategy</Label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Typology</span>
            <span>{typologyLabel}</span>
            <span className="text-muted-foreground">Hours / Week</span>
            <span>{state.hoursPerWeek}h</span>
            <span className="text-muted-foreground">Available Days</span>
            <span>{state.availableDays.join(", ")}</span>
            <span className="text-muted-foreground">Strength / Week</span>
            <span>{state.strengthSessionsPerWeek}×</span>
          </div>
        </div>

        <Separator />

        {/* Structure */}
        {planPreview && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Structure</Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">Total Weeks</span>
              <span>{planPreview.structure.totalWeeks}</span>
              <span className="text-muted-foreground">Blocks</span>
              <span>{planPreview.blocks.length}</span>
              <span className="text-muted-foreground">Phases</span>
              <span>
                {planPreview.structure.phases
                  .map((p) => `${PHASE_LABELS[p.phase]} ${p.weeks}w`)
                  .join(" · ")}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
