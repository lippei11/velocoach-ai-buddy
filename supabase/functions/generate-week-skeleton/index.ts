// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import constitution from "../_shared/constitution.json" assert { type: "json" };

// =============================================================================
// CORS
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =============================================================================
// Supabase clients
// =============================================================================

function getSupabaseClients(authHeader: string) {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  return { supabaseAdmin, supabaseUser };
}

async function getAuthenticatedUser(supabaseUser: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) return null;
  return user;
}

// =============================================================================
// Types (inline — Deno can't import from src/)
// =============================================================================

type Phase = "base" | "build" | "peak" | "taper";
type SessionStressType = "recovery" | "endurance_base" | "threshold" | "vo2max" | "durability" | "neuromuscular" | "strength";
type SessionPurpose = "recovery" | "endurance" | "long_ride" | "sweet_spot" | "threshold" | "vo2max" | "climb_simulation" | "back_to_back" | "sprint" | "strength";
type IndoorOutdoorPreference = "indoor_only" | "outdoor_only" | "indoor_preferred" | "outdoor_preferred" | "flexible";

interface SessionSlot {
  day: number;
  plannedDate: string;
  slotType: SessionStressType;
  purpose: SessionPurpose;
  priority: "low" | "medium" | "high";
  durationMinutes: number;
  targetTss: number;
  indoorOutdoor: IndoorOutdoorPreference;
  rationaleShort: string;
}

interface WeeklyStressBudget {
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

// =============================================================================
// Helpers
// =============================================================================

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function parseAvailableDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [1, 3, 5, 6];
  const dayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6,
  };
  return raw.map((v: unknown) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return dayMap[v] ?? -1;
    return -1;
  }).filter((n: number) => n >= 0 && n <= 6);
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// =============================================================================
// Macro Plan Logic (simplified — mirrors src/lib/coaching/macroPlan.ts)
// =============================================================================

function selectMacroStrategy(profile: string, hoursPerWeek: number): string {
  if (["steady_climbing", "long_gravel", "ultra_endurance"].includes(profile)) return "base_heavy";
  if (["time_trial", "ftp_build"].includes(profile)) return "specificity_heavy";
  return "balanced";
}

function computePhaseDurations(strategy: string, totalWeeks: number) {
  const taper = totalWeeks >= 8 ? 2 : 1;
  const peak = totalWeeks <= 8 ? 1 : totalWeeks <= 16 ? 2 : 3;
  const remainder = totalWeeks - taper - peak;

  let base: number, build: number;
  if (strategy === "base_heavy") {
    base = Math.ceil(remainder * 0.6);
    build = remainder - base;
  } else if (strategy === "specificity_heavy") {
    build = Math.ceil(remainder * 0.7);
    base = remainder - build;
  } else {
    build = Math.ceil(remainder * 0.55);
    base = remainder - build;
  }
  if (base < 1 && remainder >= 2) { base = 1; build = remainder - 1; }
  if (build < 1 && remainder >= 2) { build = 1; base = remainder - 1; }

  return { base, build, peak, taper };
}

function getPhaseForWeek(
  totalWeeks: number,
  weekNumber: number,
  durations: { base: number; build: number; peak: number; taper: number }
): { phase: Phase; weekNumberInPhase: number; isFirstWeekOfPhase: boolean; isLastWeekOfPhase: boolean } {
  let offset = 0;
  const phases: Array<{ phase: Phase; weeks: number }> = [
    { phase: "base", weeks: durations.base },
    { phase: "build", weeks: durations.build },
    { phase: "peak", weeks: durations.peak },
    { phase: "taper", weeks: durations.taper },
  ].filter(p => p.weeks > 0);

  for (const p of phases) {
    if (weekNumber <= offset + p.weeks) {
      const weekInPhase = weekNumber - offset;
      return {
        phase: p.phase,
        weekNumberInPhase: weekInPhase,
        isFirstWeekOfPhase: weekInPhase === 1,
        isLastWeekOfPhase: weekInPhase === p.weeks,
      };
    }
    offset += p.weeks;
  }
  // fallback
  const last = phases[phases.length - 1];
  return { phase: last.phase, weekNumberInPhase: last.weeks, isFirstWeekOfPhase: false, isLastWeekOfPhase: true };
}

function isDeloadWeek(phase: Phase, weekInPhase: number): boolean {
  if (phase === "peak" || phase === "taper") return false;
  if (phase === "base") return weekInPhase % 3 === 0 && weekInPhase > 2;
  // build: every 3rd week
  return weekInPhase % 3 === 0 && weekInPhase > 2;
}

// =============================================================================
// Session Slot Builder
// =============================================================================

const PURPOSE_STRESS_MAP: Record<string, SessionStressType> = {
  recovery: "recovery",
  endurance: "endurance_base",
  long_ride: "durability",
  sweet_spot: "threshold",
  threshold: "threshold",
  vo2max: "vo2max",
  climb_simulation: "threshold",
  back_to_back: "durability",
  sprint: "neuromuscular",
  strength: "strength",
};

const PURPOSE_DURATION: Record<string, number> = {
  recovery: 45,
  endurance: 75,
  long_ride: 180,
  sweet_spot: 75,
  threshold: 70,
  vo2max: 60,
  climb_simulation: 90,
  back_to_back: 120,
  sprint: 50,
  strength: 60,
};

const PURPOSE_TSS_PER_HOUR: Record<string, number> = {
  recovery: 30,
  endurance: 50,
  long_ride: 55,
  sweet_spot: 75,
  threshold: 85,
  vo2max: 95,
  climb_simulation: 70,
  back_to_back: 50,
  sprint: 60,
  strength: 40,
};

function getIndoorOutdoor(purpose: SessionPurpose, prefs: { preferIndoorIntervals: boolean; preferOutdoorLongRide: boolean }): IndoorOutdoorPreference {
  if (purpose === "long_ride" || purpose === "back_to_back" || purpose === "endurance") {
    return prefs.preferOutdoorLongRide ? "outdoor_preferred" : "flexible";
  }
  if (["sweet_spot", "threshold", "vo2max"].includes(purpose)) {
    return prefs.preferIndoorIntervals ? "indoor_preferred" : "flexible";
  }
  return "flexible";
}

function buildSlots(
  weekStartDate: string,
  availableDays: number[],
  phase: Phase,
  isDeload: boolean,
  eventDemandProfile: string,
  weeklyTssTarget: number,
  prefs: { preferIndoorIntervals: boolean; preferOutdoorLongRide: boolean }
): { slots: SessionSlot[]; budget: WeeklyStressBudget } {
  const startDate = new Date(weekStartDate + "T00:00:00Z");
  const sorted = [...availableDays].sort((a, b) => a - b);

  // Determine session purposes based on phase
  const sessionPlan: SessionPurpose[] = [];
  const numDays = sorted.length;

  if (isDeload) {
    // Deload: only easy sessions
    for (let i = 0; i < numDays; i++) {
      sessionPlan.push(i === numDays - 1 ? "endurance" : "recovery");
    }
  } else if (phase === "base") {
    // Base: endurance focus + long ride + 1 sweet spot
    for (let i = 0; i < numDays; i++) {
      if (i === numDays - 1) sessionPlan.push("long_ride");
      else if (i === Math.floor(numDays / 2)) sessionPlan.push("sweet_spot");
      else if (i === 0) sessionPlan.push("recovery");
      else sessionPlan.push("endurance");
    }
  } else if (phase === "build") {
    // Build: 2 quality + long ride
    const buildPurposes = getBuildPurposes(eventDemandProfile);
    for (let i = 0; i < numDays; i++) {
      if (i === numDays - 1) sessionPlan.push("long_ride");
      else if (i === 1 && buildPurposes.length > 0) sessionPlan.push(buildPurposes[0]);
      else if (i === 3 && buildPurposes.length > 1) sessionPlan.push(buildPurposes[1]);
      else if (i === Math.floor(numDays / 2) && buildPurposes.length > 0 && numDays <= 3) sessionPlan.push(buildPurposes[0]);
      else if (i === 0) sessionPlan.push("recovery");
      else sessionPlan.push("endurance");
    }
  } else if (phase === "peak") {
    // Peak: maintain intensity, reduce volume
    const buildPurposes = getBuildPurposes(eventDemandProfile);
    for (let i = 0; i < numDays; i++) {
      if (i === numDays - 1) sessionPlan.push("long_ride");
      else if (i === 1 && buildPurposes.length > 0) sessionPlan.push(buildPurposes[0]);
      else if (i === 0) sessionPlan.push("recovery");
      else sessionPlan.push("endurance");
    }
  } else {
    // Taper: minimal
    for (let i = 0; i < numDays; i++) {
      if (i === Math.floor(numDays / 2)) sessionPlan.push("threshold");
      else sessionPlan.push(i === 0 ? "recovery" : "endurance");
    }
  }

  // Scale durations to hit TSS target
  const rawSlots: SessionSlot[] = [];
  let totalRawTss = 0;
  for (let i = 0; i < numDays; i++) {
    const purpose = sessionPlan[i] || "endurance";
    const dur = PURPOSE_DURATION[purpose] ?? 60;
    const tss = Math.round((dur / 60) * (PURPOSE_TSS_PER_HOUR[purpose] ?? 50));
    totalRawTss += tss;
  }

  const scaleFactor = totalRawTss > 0 ? weeklyTssTarget / totalRawTss : 1;

  let plannedThreshold = 0;
  let plannedVo2 = 0;
  let plannedNeuromuscular = 0;
  let plannedDurability = 0;
  let plannedStrength = 0;
  let plannedLongRide = false;

  for (let i = 0; i < numDays; i++) {
    const dayNum = sorted[i];
    const purpose = sessionPlan[i] || "endurance";
    const baseDur = PURPOSE_DURATION[purpose] ?? 60;
    const dur = Math.round(baseDur * Math.min(scaleFactor, 1.3));
    const tss = Math.round((dur / 60) * (PURPOSE_TSS_PER_HOUR[purpose] ?? 50));
    const slotType = PURPOSE_STRESS_MAP[purpose] ?? "endurance_base";
    const plannedDate = isoDate(addDays(startDate, dayNum));

    let priority: "low" | "medium" | "high" = "medium";
    if (purpose === "recovery") priority = "low";
    if (["vo2max", "threshold", "long_ride"].includes(purpose)) priority = "high";

    // Count types
    if (slotType === "threshold") plannedThreshold++;
    if (slotType === "vo2max") plannedVo2++;
    if (slotType === "neuromuscular") plannedNeuromuscular++;
    if (slotType === "durability") plannedDurability++;
    if (slotType === "strength") plannedStrength++;
    if (purpose === "long_ride") plannedLongRide = true;

    rawSlots.push({
      day: dayNum,
      plannedDate,
      slotType,
      purpose,
      priority,
      durationMinutes: dur,
      targetTss: tss,
      indoorOutdoor: getIndoorOutdoor(purpose, prefs),
      rationaleShort: getRationale(purpose, phase, isDeload),
    });
  }

  const typologyMap = constitution.typology_defaults as Record<string, string>;

  const budget: WeeklyStressBudget = {
    weeklyTssTarget: Math.round(weeklyTssTarget),
    maxThresholdSessions: constitution.stress_budget_defaults.threshold_per_week,
    maxVo2Sessions: constitution.stress_budget_defaults.vo2max_per_week,
    maxNeuromuscularSessions: constitution.stress_budget_defaults.neuromuscular_per_week,
    maxDurabilityBlocks: constitution.stress_budget_defaults.durability_blocks_per_week,
    plannedThreshold,
    plannedVo2,
    plannedNeuromuscular,
    plannedDurability,
    plannedStrength,
    plannedLongRide,
    exceptionApplied: false,
    typology: typologyMap[eventDemandProfile] ?? "PYRAMIDAL",
  };

  return { slots: rawSlots, budget };
}

function getBuildPurposes(profile: string): SessionPurpose[] {
  const map: Record<string, SessionPurpose[]> = {
    steady_climbing: ["sweet_spot", "climb_simulation"],
    time_trial: ["threshold", "sweet_spot"],
    punchy_stochastic: ["vo2max", "threshold"],
    long_gravel: ["sweet_spot", "endurance"],
    ultra_endurance: ["endurance", "sweet_spot"],
    ftp_build: ["sweet_spot", "threshold"],
    mixed_hobby_fitness: ["sweet_spot", "endurance"],
  };
  return map[profile] ?? ["sweet_spot", "threshold"];
}

function getRationale(purpose: SessionPurpose, phase: Phase, isDeload: boolean): string {
  if (isDeload) return "Deload-Woche: reduziertes Volumen und Intensität zur Erholung.";
  const map: Record<string, string> = {
    recovery: "Aktive Erholung — lockeres Fahren für Durchblutung.",
    endurance: "Aerobe Grundlage — Z2-Fahrt für den aeroben Motor.",
    long_ride: "Ankersession der Woche — Dauer ist der Stimulus.",
    sweet_spot: "Effizientes FTP-Training — comfortably hard.",
    threshold: "Direkte FTP-Entwicklung — Schwellenarbeit.",
    vo2max: "Maximale aerobe Leistung — kurze, harte Intervalle.",
    climb_simulation: "Bergspezifisches Training — hohes Drehmoment, niedrige Kadenz.",
    back_to_back: "B2B-Block: Leistung auf vorermüdeten Beinen.",
    sprint: "Neuromuskuläre Spitze — maximale Sprints.",
    strength: "Krafttraining — unabhängig vom Radbudget.",
  };
  return map[purpose] ?? `${phase}-Phase: ${purpose}`;
}

// =============================================================================
// Main Handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { supabaseAdmin, supabaseUser } = getSupabaseClients(authHeader);
  const user = await getAuthenticatedUser(supabaseUser);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const userId = user.id;

  // Parse request body
  let weekStartDate: string;
  try {
    const body = await req.json();
    weekStartDate = body.weekStartDate;
    if (!weekStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      return jsonResponse({ error: "weekStartDate required (YYYY-MM-DD)" }, 400);
    }
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  console.log(`[generate-week-skeleton] user=${userId} weekStart=${weekStartDate}`);

  // -------------------------------------------------------------------------
  // 1. Fetch athlete context (from athlete_state or compute fresh)
  // -------------------------------------------------------------------------
  let stateJson: Record<string, unknown> | null = null;

  try {
    const { data } = await supabaseAdmin
      .from("athlete_state")
      .select("state_json")
      .eq("user_id", userId)
      .single();
    if (data?.state_json) {
      stateJson = data.state_json as Record<string, unknown>;
    }
  } catch (e) {
    console.log("athlete_state not found, will compute inline:", e.message);
  }

  // If no cached state, call compute-athlete-context
  if (!stateJson) {
    try {
      const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/compute-athlete-context`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({}),
      });
      if (resp.ok) {
        const result = await resp.json();
        stateJson = result.state_json;
      }
    } catch (e) {
      console.error("compute-athlete-context call failed:", e.message);
    }
  }

  // Fallback defaults if still no state
  const ctl = (stateJson?.recentLoad as any)?.ctl ?? null;
  const hoursPerWeek = (stateJson?.weeklyContext as any)?.hoursAvailable ?? 8;
  const availableDays = parseAvailableDays((stateJson?.weeklyContext as any)?.availableDays);
  const eventDemandProfile = (stateJson?.eventDemandProfile as string) ?? "mixed_hobby_fitness";
  const eventDate = (stateJson?.eventDate as string) ?? null;
  const preferIndoorIntervals = (stateJson?.preferences as any)?.preferIndoorIntervals ?? false;
  const preferOutdoorLongRide = (stateJson?.preferences as any)?.preferOutdoorLongRide ?? false;

  // -------------------------------------------------------------------------
  // 2. Compute macro plan structure
  // -------------------------------------------------------------------------
  const today = weekStartDate;
  const daysToEvent = eventDate ? diffDays(new Date(eventDate), new Date(today)) : null;

  let totalWeeks: number;
  let planStartDate: string;

  if (daysToEvent !== null && daysToEvent > 0) {
    totalWeeks = Math.max(6, Math.min(24, Math.round(daysToEvent / 7)));
    // Plan starts from today or earlier
    const weeksBack = Math.max(0, totalWeeks - Math.ceil(daysToEvent / 7));
    planStartDate = isoDate(addDays(new Date(today), -weeksBack * 7));
  } else {
    totalWeeks = 12;
    planStartDate = today;
  }

  const macroStrategy = selectMacroStrategy(eventDemandProfile, hoursPerWeek);
  const durations = computePhaseDurations(macroStrategy, totalWeeks);

  // Determine which week number this is
  const weekNumber = Math.max(1, Math.min(totalWeeks,
    Math.floor(diffDays(new Date(weekStartDate), new Date(planStartDate)) / 7) + 1
  ));

  const phaseInfo = getPhaseForWeek(totalWeeks, weekNumber, durations);
  const deload = isDeloadWeek(phaseInfo.phase, phaseInfo.weekNumberInPhase);

  // -------------------------------------------------------------------------
  // 3. Compute weekly TSS target
  // -------------------------------------------------------------------------
  const weeklyTssTarget = ctl != null ? ctl * 7 : hoursPerWeek * 50;
  const effectiveTssTarget = deload ? weeklyTssTarget * 0.6 : weeklyTssTarget;

  // -------------------------------------------------------------------------
  // 4. Build session slots
  // -------------------------------------------------------------------------
  const { slots, budget } = buildSlots(
    weekStartDate,
    availableDays,
    phaseInfo.phase,
    deload,
    eventDemandProfile,
    effectiveTssTarget,
    { preferIndoorIntervals, preferOutdoorLongRide }
  );

  // -------------------------------------------------------------------------
  // 5. Build response
  // -------------------------------------------------------------------------
  const weekFocusMap: Record<Phase, string> = {
    base: "Aerobe Basis + Long Ride",
    build: "Intensitätsentwicklung + Spezifik",
    peak: "Feinschliff — Volumen reduzieren, Intensität halten",
    taper: "Frische für Event — minimale Belastung",
  };

  const rationaleMap: Record<Phase, string> = {
    base: "Fokus auf aerobe Grundlage und Fettstoffwechsel. Qualitätssessions werden schrittweise eingeführt.",
    build: "Event-spezifische Intensität. TSS-Progression mit ausreichend Erholung.",
    peak: "Fitness schärfen bei reduziertem Volumen. Race-Pace Touches beibehalten.",
    taper: "Maximale Frische. Nur leichte Aktivierung, kein Fitnessaufbau.",
  };

  const weeksUntilEvent = eventDate
    ? Math.max(0, Math.ceil(diffDays(new Date(eventDate), new Date(weekStartDate)) / 7))
    : null;

  const response = {
    weekSkeleton: {
      slots,
      weekFocus: deload ? `Deload — ${weekFocusMap[phaseInfo.phase]}` : weekFocusMap[phaseInfo.phase],
      rationaleShort: deload
        ? "Deload-Woche: Volumen und Intensität um 40% reduziert für Supercompensation."
        : rationaleMap[phaseInfo.phase],
      weeklyStressBudget: budget,
    },
    weekContext: {
      phase: phaseInfo.phase,
      weekNumberInPhase: phaseInfo.weekNumberInPhase,
      weekNumberInPlan: weekNumber,
      isDeloadWeek: deload,
      isFirstWeekOfPhase: phaseInfo.isFirstWeekOfPhase,
      isLastWeekOfPhase: phaseInfo.isLastWeekOfPhase,
      weeksUntilEvent,
    },
    planStructure: {
      totalWeeks,
      macroStrategy,
      currentPhase: phaseInfo.phase,
      weeksUntilEvent,
    },
  };

  console.log(`[generate-week-skeleton] phase=${phaseInfo.phase} week=${weekNumber}/${totalWeeks} deload=${deload} slots=${slots.length}`);

  return jsonResponse(response);
});
