// Pipeline response types from generate-week-skeleton Edge Function

export type SessionStressType =
  | "recovery"
  | "endurance_base"
  | "threshold"
  | "vo2max"
  | "durability"
  | "neuromuscular"
  | "strength";

export type SessionPurpose =
  | "recovery"
  | "endurance"
  | "long_ride"
  | "sweet_spot"
  | "threshold"
  | "vo2max"
  | "climb_simulation"
  | "back_to_back"
  | "sprint";

export type SlotPriority = "low" | "medium" | "high";

export type IndoorOutdoor =
  | "indoor_only"
  | "outdoor_only"
  | "indoor_preferred"
  | "outdoor_preferred"
  | "flexible";

export interface SessionSlot {
  day: number; // 0=Mon … 6=Sun
  plannedDate: string; // ISO YYYY-MM-DD
  slotType: SessionStressType;
  purpose: SessionPurpose;
  priority: SlotPriority;
  durationMinutes: number;
  targetTss: number;
  indoorOutdoor: IndoorOutdoor;
  rationaleShort: string;
}

export interface WeeklyStressBudget {
  weeklyTssTarget: number;
  maxThresholdSessions: number;
  maxVo2Sessions: number;
  maxNeuromuscularSessions: number;
  maxDurabilityBlocks: number;
  plannedThreshold: number;
  plannedVo2: number;
  plannedNeuromuscular: number;
  plannedDurability: number;
  plannedStrength: number;
  plannedLongRide: boolean;
  exceptionApplied: boolean;
  typology: string;
}

export interface WeekSkeleton {
  slots: SessionSlot[];
  weekFocus: string;
  rationaleShort: string;
  weeklyStressBudget: WeeklyStressBudget;
}

export type PipelinePhase = "base" | "build" | "peak" | "taper";

export interface WeekContext {
  phase: PipelinePhase;
  weekNumberInPhase: number;
  weekNumberInPlan: number;
  isDeloadWeek: boolean;
  isFirstWeekOfPhase: boolean;
  isLastWeekOfPhase: boolean;
  weeksUntilEvent: number | null;
}

export interface PlanStructure {
  totalWeeks: number;
  macroStrategy: string;
  currentPhase: string;
  weeksUntilEvent: number | null;
}

export interface PipelineResponse {
  weekSkeleton: WeekSkeleton;
  weekContext: WeekContext;
  planStructure: PlanStructure;
}

// Color maps for pipeline types
export const SLOT_TYPE_COLORS: Record<SessionStressType, string> = {
  recovery: "#6B7280",
  endurance_base: "#3B82F6",
  threshold: "#F97316",
  vo2max: "#EF4444",
  durability: "#8B5CF6",
  neuromuscular: "#EAB308",
  strength: "#22C55E",
};

export const SLOT_TYPE_LABELS: Record<SessionStressType, string> = {
  recovery: "Recovery",
  endurance_base: "Endurance",
  threshold: "Threshold",
  vo2max: "VO2max",
  durability: "Durability",
  neuromuscular: "Neuromuscular",
  strength: "Strength",
};

export const PURPOSE_LABELS: Record<SessionPurpose, string> = {
  recovery: "Recovery",
  endurance: "Endurance",
  long_ride: "Long Ride",
  sweet_spot: "Sweet Spot",
  threshold: "Threshold",
  vo2max: "VO2max",
  climb_simulation: "Climb Simulation",
  back_to_back: "Back-to-Back",
  sprint: "Sprint",
};

export const PHASE_COLORS: Record<PipelinePhase, string> = {
  base: "#3B82F6",
  build: "#F97316",
  peak: "#EF4444",
  taper: "#22C55E",
};

export const PHASE_LABELS: Record<PipelinePhase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
};
