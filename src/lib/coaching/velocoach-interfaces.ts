/**
 * VeloCoach AI Buddy — Agent Pipeline Interfaces
 * Version: 1.0 — March 2026
 *
 * Pipeline:
 * AthleteState
 *   → WeekSkeleton
 *     → WorkoutSession[]
 *       → ValidationResult
 *         → (if changes) AdjustmentRequest
 *           → AdjustmentResult
 *             → CoachExplanation
 */

// =============================================================================
// SHARED ENUMS & HELPER TYPES
// =============================================================================

export type GoalType =
  | "ftp_build"
  | "gran_fondo"
  | "endurance";

/**
 * Replaces coarse GoalType for plan generation.
 * Set during onboarding, updatable via chat.
 * Drives typology, phase emphasis, durability priority.
 */
export type EventDemandProfile =
  | "steady_climbing"      // L'Étape, Maratona, alpine gran fondo
  | "time_trial"           // TT, triathlon bike leg, hill climb
  | "punchy_stochastic"    // Criterium, road race, cyclocross
  | "long_gravel"          // Unbound, gravel fondo, mixed terrain 5–10h
  | "ultra_endurance"      // 12h+ events, bikepacking
  | "ftp_build"            // No specific event — fitness goal
  | "mixed_hobby_fitness"; // No event, general health/fitness

export type Phase =
  | "base"
  | "build"
  | "peak"
  | "taper";

/**
 * Internal classification for every session.
 * Drives per-type weekly stress budget (replaces blunt "hard session" counter).
 * Never shown to athlete directly.
 */
export type SessionStressType =
  | "recovery"         // Z1, no cap, always available
  | "endurance_base"   // Z1–Z2, no cap, required minimum 1/week
  | "durability"       // Long ride + B2B, separate budget, NOT a hard session
  | "threshold"        // SS + Z4, combined metabolic cap with vo2max
  | "vo2max"           // Z5, cap 1/week default, 48h gap required
  | "neuromuscular"    // Z6+, punchy_stochastic profile only
  | "strength";        // Gym — fully independent budget

export type SessionPurpose =
  | "recovery"
  | "endurance"
  | "long_ride"
  | "sweet_spot"
  | "threshold"
  | "back_to_back"
  | "climb_simulation"
  | "vo2max"
  | "sprint"
  | "strength";

export type IndoorOutdoorPreference =
  | "indoor_only"
  | "outdoor_only"
  | "indoor_preferred"
  | "outdoor_preferred"
  | "flexible";

export type ReadinessLevel =
  | "unknown"
  | "good"
  | "moderate"
  | "low";

export type ReentryContext =
  | "none"
  | "after_illness"
  | "after_travel"
  | "after_inconsistency"
  | "after_injury";  // Requires medical clearance confirmed by athlete

export type ConstraintSeverity =
  | "hard"   // Non-negotiable — plan around it
  | "soft";  // Preferred — bend if necessary

export type ConstraintType =
  | "time_limit"
  | "unavailable_day"
  | "fixed_session"
  | "indoor_only"
  | "outdoor_only"
  | "no_vo2"
  | "no_strength"
  | "injury_limit"
  | "travel"
  | "other";

export type ValidationStatus =
  | "pass"
  | "pass_with_warnings"
  | "fail";

export type ViolationCode =
  | "TOO_MANY_HARD_SESSIONS"
  | "BACK_TO_BACK_HARD_DAYS"
  | "EXCEEDS_HOURS_BUDGET"
  | "EXCEEDS_STRESS_BUDGET"
  | "MISSING_LONG_RIDE"
  | "MISSING_RECOVERY_DAY"
  | "INVALID_REENTRY_PROGRESS"
  | "STRENGTH_INTERFERENCE"
  | "PHASE_MISMATCH"
  | "GOAL_MISMATCH"
  | "INVALID_WORKOUT_DESCRIPTION"
  | "OUTSIDE_AVAILABLE_DAYS"
  | "LOW_CONFIDENCE_PLAN"
  | "FTP_STALE"
  | "DURABILITY_GAP"        // Low durability_score vs. event requirements
  | "MISSING_CADENCE"       // Required for vo2max / climb_sim / neuromuscular
  | "OTHER";

/**
 * Reason categories for mid-week adjustments.
 * Maps to Chat Action Contract (S10 of Constitution v7).
 */
export type AdjustmentReason =
  | "legs_heavy"
  | "time_shortage"
  | "illness"
  | "injury"
  | "travel"
  | "missed_session"
  | "session_swap"
  | "duration_change"
  | "intensity_change"
  | "day_move"
  | "indoor_outdoor_switch"
  | "add_strength"
  | "remove_strength"
  | "typology_change"
  | "ftp_test_request"
  | "user_request_other";

/**
 * Maps to Chat Action Contract actions.
 */
export type AdjustmentActionType =
  | "SHIFT_WORKOUT"
  | "REPLACE_WORKOUT"
  | "REDUCE_DURATION"
  | "INSERT_RECOVERY"
  | "REBALANCE_WEEK"
  | "EXPLAIN_WORKOUT"
  | "UPDATE_AVAILABILITY"
  | "RECALIBRATE_PLAN"
  | "SWITCH_INDOOR_OUTDOOR"
  | "ADJUST_TYPOLOGY"
  | "REQUEST_FTP_TEST"
  | "INSERT_STRENGTH"
  | "SWAP_STRENGTH_DAY"
  | "STRENGTH_OFFLOAD_WEEK"
  | "NO_ACTION_NEEDED";

// =============================================================================
// SHARED SUB-INTERFACES
// =============================================================================

export interface DayConstraint {
  day: number;              // 0 = Monday … 6 = Sunday
  type: ConstraintType;
  severity: ConstraintSeverity;
  note?: string;
  maxDurationMinutes?: number;
}

export interface PersistentPreferences {
  preferOutdoorLongRide: boolean;
  preferIndoorIntervals: boolean;
  trainingTimeOfDay?: "morning" | "midday" | "evening" | "flexible";
  strengthSessionsPerWeek?: number;
  avoidVo2OnTrainer?: boolean;
  indoorOutdoorPreference: IndoorOutdoorPreference;
}

export interface WeeklyContext {
  weekStartDate: string;       // ISO date YYYY-MM-DD
  hoursAvailable: number;
  availableDays: number[];     // 0 = Monday … 6 = Sunday
  unavailableDays?: number[];
  fixedSessions?: string[];    // e.g. ["sunday_group_ride"]
  travel?: boolean;
  notes?: string[];
}

export interface UserOverride {
  key: string;
  value: string | number | boolean | string[];
  note?: string;
}

export interface RecentLoadMetrics {
  recent7dTss?: number;
  recent28dTss?: number;
  ctl?: number;               // Model metric — not biological truth
  atl?: number;               // Model metric — not biological truth
  tsb?: number;               // Model metric — not biological truth
  loadModelConfidence?: number; // 0..1
}

export interface PerformanceMetrics {
  ftpWatts?: number;
  ftpDetectedAt?: string;          // ISO datetime
  ftpAgeDays?: number;
  ftpStatus?: "current" | "stale"; // stale = >8 weeks
  best5MinPower?: number;
  best20MinPower?: number;
  best40to60MinEstimate?: number;
  thresholdTimeToExhaustionMin?: number;
  durabilityScore?: number;        // 0..1, computed from long ride power drop
  powerHrDecouplingPct?: number;   // % HR drift vs. stable power in Z2 sessions
  longRideTolerance?: number;      // 0..1, recent long rides completed vs. planned
  recentExecutionQuality?: number; // 0..1, planned vs. actual TSS last 2 weeks
}

export interface RecoverySignals {
  readinessLevel: ReadinessLevel;
  hrvAvailable: boolean;
  restingHrAvailable: boolean;
  sleepAvailable: boolean;
  subjectiveFatigueAvailable: boolean;
  lowReadinessPattern: boolean;    // Poor 2+ consecutive days
  notes?: string[];
}

export interface AthleteConstraint {
  type: ConstraintType;
  severity: ConstraintSeverity;
  note?: string;
}

export interface SessionSlot {
  day: number;                 // 0 = Monday … 6 = Sunday
  plannedDate: string;         // ISO date
  slotType: SessionStressType;
  purpose: SessionPurpose;
  priority: "low" | "medium" | "high";
  durationMinutes: number;
  targetTss: number;
  indoorOutdoor: IndoorOutdoorPreference;
  rationaleShort: string;
  constraintsApplied?: string[];
}

export interface WeeklyStressBudget {
  weeklyTssTarget: number;
  weeklyTssMin?: number;
  weeklyTssMax?: number;
  // Per-type caps (from Constitution S4b)
  maxThresholdSessions: number;     // default 2
  maxVo2Sessions: number;           // default 1
  maxNeuromuscularSessions: number; // default 1, punchy_stochastic only
  maxDurabilityBlocks: number;      // default 1 B2B block — separate from hard cap
  maxStrengthSessions: number;      // per S7a, independent budget
  // Planned vs. cap
  plannedThreshold: number;
  plannedVo2: number;
  plannedNeuromuscular: number;
  plannedDurability: number;
  plannedStrength: number;
  plannedLongRide: boolean;
  exceptionApplied: boolean;        // true if 3rd hard session allowed
  exceptionReason?: string;
  typology?: string;                // e.g. "PYRAMIDAL", "POLARIZED", "SS_THRESHOLD"
}

export interface WorkoutIntervalBlock {
  label?: string;
  repeat?: number;
  workDurationSec?: number;
  recoveryDurationSec?: number;
  target?: string;             // e.g. "92–95% FTP", "Z2", "110% FTP"
  notes?: string;
}

export interface WorkoutTargets {
  targetTss: number;
  estimatedIf?: number;
  cadenceRecommendationRpm?: [number, number]; // Only for vo2max, climb_sim, neuromuscular
}

export interface WorkoutMetadata {
  indoorVersionAvailable: boolean;
  outdoorVersionAvailable: boolean;
  intervalsIcuCompatible: boolean;
  generatedBy: "workout_builder";
  methodologyVersion: string;       // Constitution version that generated this
}

// =============================================================================
// 1. ATHLETE STATE
// Output of: Athlete State Agent
// Input to:  Planning Agent, Workout Builder Agent, Validation Agent
// =============================================================================

export interface AthleteState {
  userId: string;

  // Goal & event
  goalType: GoalType;
  eventDemandProfile: EventDemandProfile;
  eventDate?: string;         // ISO date
  currentPhase: Phase;

  // User input layers (three types)
  preferences: PersistentPreferences;     // A: Persistent — rarely changes
  weeklyContext: WeeklyContext;           // B: Weekly — set each week
  userOverrides?: UserOverride[];         // C: Acute — mid-week adjustments

  // Constraints
  athleteConstraints: AthleteConstraint[];
  dayConstraints: DayConstraint[];

  // Training load & performance
  recentLoad: RecentLoadMetrics;
  performance: PerformanceMetrics;
  recovery: RecoverySignals;

  // Compliance & quality signals
  complianceScore?: number;        // 0..1, last 4 weeks
  executionQualityScore?: number;  // 0..1, planned vs. actual

  // Special state flags
  reentryContext: ReentryContext;
  injuryFlag?: boolean;
  illnessFlag?: boolean;

  // Planning priors (derived from profile + context)
  defaultMaxHardSessions: number;
  strengthPriority: "low" | "medium" | "high";
  durabilityPriority: "low" | "medium" | "high";  // CRITICAL for steady_climbing

  // Confidence & explainability
  confidence: number;           // 0..1 — drives plan conservatism
  planningNotes?: string[];     // Human-readable flags for agent chain
}

// =============================================================================
// 2. WEEK SKELETON
// Output of: Planning Agent
// Input to:  Workout Builder Agent, Validation Agent
// Intentionally abstract — no concrete intervals yet.
// =============================================================================

export interface WeekSkeleton {
  userId: string;
  weekStartDate: string;       // ISO date
  phase: Phase;

  goalType: GoalType;
  eventDemandProfile: EventDemandProfile;

  weeklyStressBudget: WeeklyStressBudget;

  // TID priors as actually applied (not targets, actual planned distribution)
  intensityDistribution: {
    lowPct?: number;       // Z1–Z2 fraction
    moderatePct?: number;  // Z3–SS fraction
    highPct?: number;      // Z5+ fraction
  };

  // Which stress types appear this week
  keySessionTypes: SessionStressType[];

  // Slots: one per training day, abstract
  slots: SessionSlot[];

  // Planning rationale
  weekFocus: string;          // e.g. "threshold development + long ride durability"
  rationaleShort: string;     // Why this structure given state + profile

  // Planning metadata
  planningAgentVersion: string;
  confidence: number;         // 0..1
  warnings?: string[];        // e.g. "FTP_STALE", "LOW_DURABILITY_SIGNAL"
}

// =============================================================================
// 3. WORKOUT SESSION
// Output of: Workout Builder Agent
// Input to:  Validation Agent, DB, Intervals.icu push
// Concrete — includes all athlete-facing detail.
// =============================================================================

export interface WorkoutSession {
  userId: string;
  planId?: string;

  weekStartDate: string;       // ISO date
  plannedDate: string;         // ISO date
  day: number;                 // 0 = Monday … 6 = Sunday

  phase: Phase;
  stressType: SessionStressType;
  purpose: SessionPurpose;

  // Athlete-facing (always populated)
  name: string;                // e.g. "Sweet Spot — 2×20 min"
  description: string;         // Intervals.icu-compatible plain text

  durationMinutes: number;
  targets: WorkoutTargets;

  // Interval structure (populated for structured sessions)
  intervalBlocks?: WorkoutIntervalBlock[];

  // Planning context
  basedOnSkeletonRationale: string;
  sessionPriority: "low" | "medium" | "high";

  // Practicality
  indoorOutdoor: IndoorOutdoorPreference;
  notesToAthlete?: string[];   // plain language tips

  metadata: WorkoutMetadata;
}

// =============================================================================
// 4. VALIDATION RESULT
// Output of: Validation Layer (TypeScript — no LLM)
// Input to:  DB write gate | Adjustment Agent | Communication Agent
// =============================================================================

export interface ValidationViolation {
  code: ViolationCode;
  severity: "warning" | "error";
  message: string;
  affectedDay?: number;
  affectedPlannedDate?: string;  // ISO date
  suggestedFix?: string;
}

export interface ValidationResult {
  status: ValidationStatus;

  passed: boolean;
  warningsCount: number;
  errorsCount: number;

  violations: ValidationViolation[];

  // Normalised week summary for UI + debugging
  normalizedSummary?: {
    hardSessionsCount: number;    // THRESHOLD + VO2MAX + NEUROMUSCULAR combined
    durabilityBlocksCount: number;
    strengthSessionsCount: number;
    longRidePresent: boolean;
    recoveryDayPresent: boolean;
    weeklyTssPlanned: number;
    hoursPlanned: number;
    backToBackHardDays: boolean;
    ftpStale: boolean;
  };

  // Auto-fix hints passed to Adjustment Agent if status === "fail"
  suggestedActions?: string[];

  constitutionVersion: string;   // Which constitution version validated against
  validatorVersion: string;
}

// =============================================================================
// 5. ADJUSTMENT REQUEST
// Output of: Chat / User (via Orchestrator)
// Input to:  Adjustment Agent
// Captures all mid-week change requests before the agent reasons about them.
// =============================================================================

export interface AdjustmentTarget {
  day?: number;                  // Target day (0 = Monday)
  plannedDate?: string;          // ISO date
  sessionPurpose?: SessionPurpose;
  sessionName?: string;
}

export interface AdjustmentRequest {
  userId: string;
  planId: string;
  requestedAt: string;           // ISO datetime

  // What the user said (raw + parsed intent)
  userText: string;              // Raw chat input: "Beine schwer heute"
  parsedReason: AdjustmentReason;
  parsedAction: AdjustmentActionType;
  confidence: number;            // 0..1 — how certain the intent parse is

  // What to change
  target?: AdjustmentTarget;
  targetDay?: number;
  targetDate?: string;           // ISO date

  // Change parameters (populated based on action type)
  newDay?: number;               // For SHIFT_WORKOUT
  newDate?: string;              // For SHIFT_WORKOUT
  newDurationMinutes?: number;   // For REDUCE_DURATION
  newPurpose?: SessionPurpose;   // For REPLACE_WORKOUT
  newIndoorOutdoor?: IndoorOutdoorPreference; // For SWITCH_INDOOR_OUTDOOR

  // Context at time of request
  currentWeekState: {
    weekStartDate: string;
    sessionsCompleted: number;
    sessionsMissed: number;
    currentTss: number;
    remainingAvailableDays: number[];
  };

  // Input type (determines which pipeline step to use)
  inputType: "A_persistent" | "B_weekly" | "C_acute";
}

// =============================================================================
// 6. ADJUSTMENT RESULT
// Output of: Adjustment Agent (+ Validation)
// Input to:  DB write | Communication Agent
// Contains both what changed and validation of the change.
// =============================================================================

export interface SessionDiff {
  field: string;
  before: string | number | boolean;
  after: string | number | boolean;
}

export interface AdjustedSession {
  original: WorkoutSession;
  adjusted: WorkoutSession;
  diff: SessionDiff[];
  changeDescription: string;     // Machine-readable change summary
}

export interface AdjustmentResult {
  userId: string;
  planId: string;
  adjustmentId: string;          // UUID
  requestedAt: string;           // ISO datetime — from AdjustmentRequest
  resolvedAt: string;            // ISO datetime

  // What actually happened
  actionApplied: AdjustmentActionType;
  actionSucceeded: boolean;

  // Session changes
  changedSessions: AdjustedSession[];
  removedSessions: WorkoutSession[];
  addedSessions: WorkoutSession[];

  // Validation of the adjusted plan
  validationResult: ValidationResult;

  // Week-level impact
  weekImpact: {
    tssChange: number;           // delta vs. before adjustment
    hoursChange: number;
    hardSessionsChange: number;
    longRideAffected: boolean;
    qualityImpact: "none" | "minor" | "moderate" | "significant";
  };

  // Fallback
  fallbackApplied: boolean;
  fallbackReason?: string;       // Why original request couldn't be fulfilled

  // For Communication Agent
  keyFacts: string[];            // ["Moved threshold from Tue to Thu", "TSS unchanged"]
}

// =============================================================================
// 7. COACH EXPLANATION
// Output of: Communication Agent
// Input to:  Chat UI
// Always in plain language. Tone-aware. Never raw data.
// =============================================================================

export type ExplanationTone =
  | "encouraging"    // Athlete hit their sessions, positive framing
  | "neutral"        // Factual, no strong emotional register
  | "cautious"       // Flagging risk or fatigue
  | "supportive";    // Athlete struggling, empathetic but direct

export type ExplanationContext =
  | "plan_created"
  | "plan_adjusted"
  | "session_explained"
  | "week_recap"
  | "reentry_guidance"
  | "red_flag_warning"
  | "ftp_staleness_prompt"
  | "durability_guidance"
  | "general_response";

export interface CoachExplanation {
  userId: string;
  planId?: string;
  generatedAt: string;            // ISO datetime
  context: ExplanationContext;
  tone: ExplanationTone;

  /**
   * WHAT / WHY / EFFECT / NEXT — from Constitution S10.1
   * All four blocks always populated. Short, plain language.
   * No physiological jargon unless athlete has asked for detail.
   */
  what: string;    // What changed or what the session is
  why: string;     // Athlete input + coaching rationale
  effect: string;  // Expected adaptation or trade-off
  next: string;    // Next priority session or action

  // Optional additional content
  warnings?: string[];            // Surfaced red flags in plain language
  tips?: string[];                // Optional practical tips (cadence, fueling, etc.)
  infoBoxes?: {                   // Terminology explanations (triggers ⓘ in UI)
    term: string;
    definition: string;
  }[];

  // For UI rendering
  primaryMessage: string;         // Single sentence shown in notification / preview
  fullMessage: string;            // Full formatted response for chat

  // Metadata
  communicationAgentVersion: string;
  basedOnAdjustmentId?: string;   // Link back to AdjustmentResult if applicable
}

// =============================================================================
// PIPELINE SUMMARY (for reference)
// =============================================================================

/**
 * Full pipeline flow:
 *
 * [User Chat / Intervals Sync]
 *       │
 *       ▼
 * Athlete State Agent (Sonnet 4.5)
 * → AthleteState
 *       │
 *       ▼ (new plan or week rebalance)
 * Planning Agent (Opus 4.6)
 * → WeekSkeleton
 *       │
 *       ▼
 * Workout Builder Agent (Sonnet 4.5)
 * → WorkoutSession[]
 *       │
 *       ▼
 * Validation Layer (TypeScript — no LLM)
 * → ValidationResult
 *       │
 *   pass / fail
 *       │
 * ┌────┴────┐
 * │   DB    │ ← on pass
 * └────┬────┘
 *       │
 *       ▼ (mid-week change)
 * Adjustment Agent (Sonnet 4.5)
 * [AdjustmentRequest] → [AdjustmentResult]
 *       │
 *       ▼
 * Communication Agent (Sonnet 4.5)
 * → CoachExplanation → Chat UI
 */
