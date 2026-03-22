// Pipeline response types for generate-week-skeleton Edge Function
// Core types re-exported from velocoach-interfaces (single source of truth)

export type {
  SessionStressType,
  SessionPurpose,
  SessionSlot,
  WeeklyStressBudget,
  IndoorOutdoorPreference as IndoorOutdoor,
  Phase as PipelinePhase,
} from "@/lib/coaching/velocoach-interfaces";

import type {
  SessionStressType,
  SessionPurpose,
  SessionSlot,
  WeeklyStressBudget,
  Phase,
} from "@/lib/coaching/velocoach-interfaces";

export type SlotPriority = "low" | "medium" | "high";

// UI-facing WeekSkeleton (subset of the full velocoach WeekSkeleton)
// The edge function response only includes these fields.
export interface WeekSkeleton {
  slots: SessionSlot[];
  weekFocus: string;
  rationaleShort: string;
  weeklyStressBudget: WeeklyStressBudget;
}

// Pipeline-specific types (not in velocoach-interfaces)

export interface WeekContext {
  phase: Phase;
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

export interface BlockContext {
  blockNumber: number;
  blockNumberInPhase: number;
  phase: string;
  weekInBlock: number;
  isDeloadWeek: boolean;
  blockWeeks: number;
  blockLoadWeeks: number;
}

export interface PipelineResponse {
  weekSkeleton: WeekSkeleton;
  weekContext: WeekContext;
  planStructure: PlanStructure;
}

export interface CreatePlanResult {
  planId: string;
  planStructure: unknown;
  blocks: unknown[];
  weekContext: WeekContext | null;
  blockContext: BlockContext | null;
  weekSkeleton: WeekSkeleton | null;
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
  strength: "Strength",
};

export const PHASE_COLORS: Record<Phase, string> = {
  base: "#3B82F6",
  build: "#F97316",
  peak: "#EF4444",
  taper: "#22C55E",
};

export const PHASE_LABELS: Record<Phase, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
};
