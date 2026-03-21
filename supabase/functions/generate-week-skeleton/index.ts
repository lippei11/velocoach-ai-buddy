// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import constitution from "../_shared/constitution.json" assert { type: "json" };
import {
  generatePlanStructure,
  getWeekContext,
  buildWeeklyStressBudget,
  tallyPlannedSessions,
  validateWeekSkeleton,
} from "../_shared/planningCore.ts";

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
// Helpers
// =============================================================================

/** Current ISO date in YYYY-MM-DD (UTC) */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Monday of the week containing the given ISO date string */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0 = Sun
  const daysToMon = (dow + 6) % 7;
  const mon = new Date(d.getTime() - daysToMon * 86400000);
  return mon.toISOString().slice(0, 10);
}

/** Parse available_days stored as string[] or number[] */
function parseAvailableDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [1, 3, 5, 6]; // default: Tue/Thu/Sat/Sun
  const dayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  };
  return raw
    .map((v) => {
      if (typeof v === "number") return v;
      if (typeof v === "string") return dayMap[v] ?? -1;
      return -1;
    })
    .filter((n) => n >= 0 && n <= 6);
}

// =============================================================================
// Prompt builder
// =============================================================================

function buildSystemPrompt(): string {
  return `You are an elite cycling coach AI (VeloCoach Planning Agent).
Your task is to generate a structured WeekSkeleton JSON object for a cyclist's training week.

CRITICAL — budget ownership:
The weeklyStressBudget values (weeklyTssTarget, weeklyTssMin, weeklyTssMax,
maxThresholdSessions, maxVo2Sessions, maxNeuromuscularSessions, maxDurabilityBlocks,
maxStrengthSessions) are computed server-side and provided to you in weeklyStressBudget.
Copy them verbatim into your output weeklyStressBudget.  Do NOT invent, adjust, or
round these numbers.  Your only job is to decide WHICH sessions to place and WHERE.

Rules (enforced by the validator — violations will cause a retry):
1. Only schedule sessions on the athlete's available days.
2. No back-to-back threshold/vo2max/neuromuscular sessions.
3. Do not exceed the session-type caps in weeklyStressBudget.
4. Sum of slot targetTss must stay within weeklyTssMin … weeklyTssMax.
5. phase must match the plan phase provided.
6. Every slot must have: day (0=Mon…6=Sun), plannedDate (YYYY-MM-DD), slotType, purpose,
   priority, durationMinutes (>=15), targetTss (>=0), indoorOutdoor, rationaleShort.
7. Respond ONLY with valid JSON. No prose, no markdown fences.

CRITICAL — use exact TypeScript enum values only (validator rejects anything else):

slotType must be exactly one of:
  "recovery" | "endurance_base" | "threshold" | "vo2max" |
  "durability" | "neuromuscular" | "strength"

purpose must be exactly one of:
  "recovery" | "endurance" | "long_ride" | "sweet_spot" |
  "threshold" | "back_to_back" | "climb_simulation" |
  "vo2max" | "sprint" | "strength"

indoorOutdoor must be exactly one of:
  "indoor_only" | "outdoor_only" | "indoor_preferred" |
  "outdoor_preferred" | "flexible"

slotType ≠ purpose. They are different fields:
  slotType = physiological stress category
  purpose  = specific workout type

Required purpose → slotType mapping (always follow this):
  purpose "endurance"        → slotType "endurance_base"
  purpose "long_ride"        → slotType "durability"
  purpose "back_to_back"     → slotType "durability"
  purpose "sweet_spot"       → slotType "threshold"
  purpose "threshold"        → slotType "threshold"
  purpose "climb_simulation" → slotType "threshold"
  purpose "vo2max"           → slotType "vo2max"
  purpose "sprint"           → slotType "neuromuscular"
  purpose "recovery"         → slotType "recovery"
  purpose "strength"         → slotType "strength"

Do NOT use free text for purpose (e.g. "aerobic base" is wrong — use "endurance").
Do NOT use shorthand for indoorOutdoor (e.g. "indoor" is wrong — use "indoor_preferred").

Output schema (TypeScript for reference):
{
  userId: string;
  weekStartDate: string;           // ISO YYYY-MM-DD (Monday)
  phase: "base" | "build" | "peak" | "taper";
  goalType: string;
  eventDemandProfile: string;
  weeklyStressBudget: {
    weeklyTssTarget: number;
    weeklyTssMin: number;
    weeklyTssMax: number;
    maxThresholdSessions: number;
    maxVo2Sessions: number;
    maxNeuromuscularSessions: number;
    maxDurabilityBlocks: number;
    maxStrengthSessions: number;
    plannedThreshold: number;
    plannedVo2: number;
    plannedNeuromuscular: number;
    plannedDurability: number;
    plannedStrength: number;
    plannedLongRide: boolean;
    exceptionApplied: boolean;
    exceptionReason?: string;
  };
  intensityDistribution: { lowPct?: number; moderatePct?: number; highPct?: number };
  keySessionTypes: Array<"recovery" | "endurance_base" | "threshold" | "vo2max" | "durability" | "neuromuscular" | "strength">;
  slots: Array<{
    day: number;
    plannedDate: string;
    slotType: "recovery" | "endurance_base" | "threshold" | "vo2max" | "durability" | "neuromuscular" | "strength";
    purpose: "recovery" | "endurance" | "long_ride" | "sweet_spot" | "threshold" | "back_to_back" | "climb_simulation" | "vo2max" | "sprint" | "strength";
    priority: "low" | "medium" | "high";
    durationMinutes: number;
    targetTss: number;
    indoorOutdoor: "indoor_only" | "outdoor_only" | "indoor_preferred" | "outdoor_preferred" | "flexible";
    rationaleShort: string;
  }>;
  weekFocus: string;
  rationaleShort: string;
  planningAgentVersion: string;
  confidence: number;
  warnings?: string[];
}`;
}

function buildUserPrompt(
  athleteState: unknown,
  weekStartDate: string,
  weekCtx: unknown,
  budget: unknown
): string {
  const wc = (athleteState as Record<string, unknown>)?.weeklyContext as Record<string, unknown> ?? {};
  const specialWeekType = (wc.specialWeekType as string) ?? "normal";
  const loadCompleteness = (wc.loadCompleteness as string) ?? "unknown";
  const estimatedUntrackedLoad = wc.estimatedUntrackedLoad ?? null;
  const recentWeeklyTss = (wc.recentWeeklyTss as number[] | undefined) ?? [];
  const perf = (athleteState as Record<string, unknown>)?.performance as Record<string, unknown> ?? {};
  const recentPeakWeeklyTss = perf.recentPeakWeeklyTss as number | undefined;

  // Effective load baseline (simple average of last 4 weeks for LLM context)
  const effectiveLoadBaseline = recentWeeklyTss.length > 0
    ? Math.round(recentWeeklyTss.slice(0, 4).reduce((s, v, i, arr) => s + v / arr.length, 0))
    : null;

  // Coach note for active vacation: do not treat near-zero tracked TSS as detraining
  const coachingContext = specialWeekType === "active_vacation"
    ? "ACTIVE_VACATION: athlete was away but stayed active. Tracked TSS may be near zero due to missing uploads, NOT detraining. Do NOT apply conservative re-entry logic. Plan next week at normal progression relative to the effectiveLoadBaseline."
    : specialWeekType === "illness"
    ? "ILLNESS_RETURN: athlete is returning from illness. Apply conservative targets. Prioritise recovery, reduce intensity."
    : specialWeekType === "true_rest"
    ? "TRUE_REST: athlete took a deliberate rest week. Return conservatively — less so than illness."
    : specialWeekType === "travel"
    ? "TRAVEL: athlete's week was disrupted by travel. Minor conservative adjustment, nearly normal progression."
    : null;

  return JSON.stringify({
    instruction: "Generate a WeekSkeleton JSON for the week described below. Respond ONLY with the JSON object.",
    weekStartDate,
    weekContext: weekCtx,
    weeklyStressBudget: budget,
    athleteState,
    loadContext: {
      specialWeekType,
      loadCompleteness,
      ...(estimatedUntrackedLoad ? { estimatedUntrackedLoad } : {}),
      ...(effectiveLoadBaseline != null ? { effectiveLoadBaseline } : {}),
      ...(recentPeakWeeklyTss != null ? { recentPeakWeeklyTss } : {}),
      ...(coachingContext ? { coachingContext } : {}),
    },
    planningAgentVersion: "1.0",
  });
}

// =============================================================================
// Model config
// =============================================================================

const PLANNING_MODEL = Deno.env.get("PLANNING_MODEL") ?? "claude-sonnet-4-5-20251022";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// =============================================================================
// Cache helpers
// =============================================================================

/**
 * Compute a short hex fingerprint of the planning inputs that affect output.
 * Cache entries with a different fingerprint are considered stale.
 *
 * Inputs:
 *   userId               — per-user isolation
 *   weekStartDate        — which week
 *   athleteStateComputedAt — changes whenever compute-athlete-context reruns;
 *                           this is the primary staleness signal
 *   planningModel        — model changes can alter slot allocation
 */
export async function computeInputFingerprint(
  userId: string,
  weekStartDate: string,
  athleteStateComputedAt: string,
  planningModel: string
): Promise<string> {
  const raw = [userId, weekStartDate, athleteStateComputedAt, planningModel].join(":");
  const data = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function lookupCachedSkeleton(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  weekStartDate: string,
  fingerprint: string
): Promise<unknown | null> {
  const { data, error } = await supabaseAdmin
    .from("week_skeleton_cache")
    .select("week_skeleton_json")
    .eq("user_id", userId)
    .eq("week_start_date", weekStartDate)
    .eq("input_fingerprint", fingerprint)
    .maybeSingle();
  if (error || !data) return null;
  return data.week_skeleton_json;
}

async function writeCachedSkeleton(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  weekStartDate: string,
  fingerprint: string,
  athleteStateComputedAt: string,
  weekSkeletonJson: unknown
): Promise<void> {
  await supabaseAdmin.from("week_skeleton_cache").upsert(
    {
      user_id: userId,
      week_start_date: weekStartDate,
      input_fingerprint: fingerprint,
      athlete_state_computed_at: athleteStateComputedAt,
      planning_model: PLANNING_MODEL,
      week_skeleton_json: weekSkeletonJson,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date" }
  );
}

async function callPlanningLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY2");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY2 not configured");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: PLANNING_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const text: string = json?.content?.[0]?.text ?? "";
  if (!text) throw new Error("Anthropic returned empty content");
  return text;
}

/** Extract JSON object from raw LLM text (strips any accidental markdown fences) */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip markdown fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const jsonStr = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonStr);
}

// =============================================================================
// Main handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

  const { supabaseAdmin, supabaseUser } = getSupabaseClients(authHeader);
  const user = await getAuthenticatedUser(supabaseUser);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  // --- Parse request body (optional weekStartDate override) ---
  let requestedWeekStart: string | null = null;
  try {
    const body = await req.json();
    if (body?.weekStartDate) requestedWeekStart = body.weekStartDate;
  } catch {
    // no body or invalid JSON — use current week
  }

  const weekStartDate = requestedWeekStart ?? mondayOf(todayIso());

  // --- Load AthleteState from athlete_state table ---
  const { data: stateRow, error: stateErr } = await supabaseAdmin
    .from("athlete_state")
    .select("state_json, computed_at")
    .eq("user_id", user.id)
    .single();

  if (stateErr || !stateRow?.state_json) {
    return jsonResponse(
      {
        error: "AthleteState not found. Run compute-athlete-context first.",
        _debug: {
          authenticatedUserId: user.id,
          userIdMatchesKnown: user.id === "8fe4b639-34f0-42f0-99b5-7376ed20c219",
          stateQueryError: stateErr
            ? { message: stateErr.message, code: stateErr.code, details: stateErr.details }
            : null,
          stateRowFound: stateRow != null,
        },
      },
      404
    );
  }

  const athleteState = stateRow.state_json as Record<string, unknown>;
  const athleteStateComputedAt: string = stateRow.computed_at ?? "";

  // --- Cache check ---
  const fingerprint = await computeInputFingerprint(
    user.id,
    weekStartDate,
    athleteStateComputedAt,
    PLANNING_MODEL
  );
  const cached = await lookupCachedSkeleton(supabaseAdmin, user.id, weekStartDate, fingerprint);
  if (cached) {
    // Build deterministic context fields for the response (no LLM needed)
    const planForCtx = generatePlanStructure({
      eventDate: (athleteState.eventDate as string | null) ?? null,
      todayDate: weekStartDate,
      currentCtl: (athleteState.recentLoad as Record<string, unknown>)?.ctl as number | null ?? null,
      eventDemandProfile: (athleteState.eventDemandProfile as string | null) ?? null,
      hoursPerWeek:
        ((athleteState.weeklyContext as Record<string, unknown>)?.hoursAvailable as number) ?? 8,
      strengthSessionsPerWeek:
        ((athleteState.preferences as Record<string, unknown>)?.strengthSessionsPerWeek as number | undefined),
      constitutionVersion: constitution.version,
    });
    const weekCtxForCache = getWeekContext(planForCtx, weekStartDate);
    return jsonResponse({
      debug: {
        planningMode: "cache",
        planningImplementation: "weekly-planning-agent-v1",
        cacheHit: true,
        planningModel: PLANNING_MODEL,
        inputFingerprint: fingerprint,
      },
      weekSkeleton: cached,
      weekContext: weekCtxForCache
        ? {
            phase: weekCtxForCache.phase.phase,
            weekNumberInPlan: weekCtxForCache.weekNumberInPlan,
            weekNumberInPhase: weekCtxForCache.weekNumberInPhase,
            isDeloadWeek: weekCtxForCache.isDeloadWeek,
            isLastWeekOfPhase: weekCtxForCache.isLastWeekOfPhase,
            isFirstWeekOfPhase: weekCtxForCache.isFirstWeekOfPhase,
            weeksUntilEvent: weekCtxForCache.weeksUntilEvent,
            keySessionTypes: weekCtxForCache.phase.keySessionTypes,
          }
        : null,
      planSummary: {
        macroStrategy: planForCtx.macroStrategy,
        totalWeeks: planForCtx.totalWeeks,
        planStartDate: planForCtx.planStartDate,
        eventDate: planForCtx.eventDate,
        constitutionVersion: planForCtx.constitutionVersion,
        phases: planForCtx.phases.map((p) => ({
          phase: p.phase,
          weeks: p.weeks,
          startDate: p.startDate,
          endDate: p.endDate,
        })),
      },
    });
  }

  // --- Build plan structure from AthleteState ---
  const plan = generatePlanStructure({
    eventDate: (athleteState.eventDate as string | null) ?? null,
    todayDate: weekStartDate,
    currentCtl: (athleteState.recentLoad as Record<string, unknown>)?.ctl as number | null ?? null,
    eventDemandProfile: (athleteState.eventDemandProfile as string | null) ?? null,
    hoursPerWeek:
      ((athleteState.weeklyContext as Record<string, unknown>)?.hoursAvailable as number) ?? 8,
    strengthSessionsPerWeek:
      ((athleteState.preferences as Record<string, unknown>)?.strengthSessionsPerWeek as number | undefined),
    constitutionVersion: constitution.version,
  });

  // --- Get week context ---
  const weekCtx = getWeekContext(plan, weekStartDate);
  if (!weekCtx) {
    return jsonResponse(
      { error: `weekStartDate ${weekStartDate} is outside the plan horizon (${plan.planStartDate} … ${plan.phases.at(-1)?.endDate})` },
      400
    );
  }

  // --- Build budget ---
  const availableDays = parseAvailableDays(
    (athleteState.weeklyContext as Record<string, unknown>)?.availableDays
  );
  const budget = buildWeeklyStressBudget(weekCtx, constitution, athleteState as unknown);

  // --- Build prompts ---
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(athleteState, weekStartDate, weekCtx, budget);

  // --- Call LLM (with one retry on validation failure) ---
  let skeleton: unknown = null;
  let validationErrors: ReturnType<typeof validateWeekSkeleton> = [];
  let lastLlmError: string | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let rawText: string;
    try {
      rawText = await callPlanningLLM(systemPrompt, userPrompt);
    } catch (e) {
      lastLlmError = (e as Error).message;
      break; // LLM unreachable — stop retrying
    }

    try {
      skeleton = extractJson(rawText);
    } catch {
      lastLlmError = "LLM returned non-JSON response";
      if (attempt === 2) break;
      continue; // retry
    }

    validationErrors = validateWeekSkeleton(skeleton, plan, weekStartDate, availableDays);

    if (validationErrors.length === 0) break; // success

    if (attempt === 1) {
      // Inject validation errors into retry prompt
      lastLlmError = `Validation failed: ${JSON.stringify(validationErrors)}`;
    }
  }

  if (lastLlmError && (!skeleton || validationErrors.length > 0)) {
    return jsonResponse(
      {
        error: "Planning agent failed to produce a valid WeekSkeleton",
        details: lastLlmError,
        validationErrors,
      },
      502
    );
  }

  // --- Overwrite ALL budget-critical fields with server-computed values ---
  // The LLM is responsible only for slot placement, within-budget session
  // distribution, and rationale text.  ALL numeric budget limits must come
  // from buildWeeklyStressBudget(), never from LLM output.  This prevents:
  //   • run-to-run variance in weeklyTssTarget (LLM choosing its own target)
  //   • session-cap inflation (LLM adding extra threshold/VO2 sessions)
  //   • budget inversion bugs (LLM setting min > max)
  //
  // planned* fields are counted from the final slot list, not taken from the
  // LLM output (which is frequently stale or mismatched).
  if (skeleton && typeof skeleton === "object") {
    const sk = skeleton as Record<string, unknown>;
    if (sk.weeklyStressBudget && typeof sk.weeklyStressBudget === "object") {
      const b = sk.weeklyStressBudget as Record<string, unknown>;
      // TSS range — deterministic from progression model
      b.weeklyTssTarget          = budget.weeklyTssTarget;
      b.weeklyTssMin             = budget.weeklyTssMin;
      b.weeklyTssMax             = budget.weeklyTssMax;
      // Session-type caps — deterministic from phase / recovery / reentry signals
      b.maxThresholdSessions     = budget.maxThresholdSessions;
      b.maxVo2Sessions           = budget.maxVo2Sessions;
      b.maxNeuromuscularSessions = budget.maxNeuromuscularSessions;
      b.maxDurabilityBlocks      = budget.maxDurabilityBlocks;
      b.maxStrengthSessions      = budget.maxStrengthSessions;
      // planned* counters — derived from the actual returned slots
      const slots = Array.isArray(sk.slots)
        ? (sk.slots as Array<{ purpose?: string }>)
        : [];
      const tally = tallyPlannedSessions(slots);
      b.plannedThreshold     = tally.plannedThreshold;
      b.plannedVo2           = tally.plannedVo2;
      b.plannedNeuromuscular = tally.plannedNeuromuscular;
      b.plannedDurability    = tally.plannedDurability;
      b.plannedStrength      = tally.plannedStrength;
      b.plannedLongRide      = tally.plannedLongRide;
    }
  }

  // --- Persist valid skeleton to cache (fire-and-forget; errors are non-fatal) ---
  writeCachedSkeleton(
    supabaseAdmin,
    user.id,
    weekStartDate,
    fingerprint,
    athleteStateComputedAt,
    skeleton
  ).catch((e) => console.error("week_skeleton_cache write failed (non-fatal):", e));

  // --- Return result ---
  return jsonResponse({
    debug: {
      planningMode: "llm",
      planningImplementation: "weekly-planning-agent-v1",
      cacheHit: false,
      planningModel: PLANNING_MODEL,
      inputFingerprint: fingerprint,
    },
    weekSkeleton: skeleton,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    weekContext: {
      phase: weekCtx.phase.phase,
      weekNumberInPlan: weekCtx.weekNumberInPlan,
      weekNumberInPhase: weekCtx.weekNumberInPhase,
      isDeloadWeek: weekCtx.isDeloadWeek,
      isLastWeekOfPhase: weekCtx.isLastWeekOfPhase,
      isFirstWeekOfPhase: weekCtx.isFirstWeekOfPhase,
      weeksUntilEvent: weekCtx.weeksUntilEvent,
      keySessionTypes: weekCtx.phase.keySessionTypes,
    },
    planSummary: {
      macroStrategy: plan.macroStrategy,
      totalWeeks: plan.totalWeeks,
      planStartDate: plan.planStartDate,
      eventDate: plan.eventDate,
      constitutionVersion: plan.constitutionVersion,
      phases: plan.phases.map((p) => ({
        phase: p.phase,
        weeks: p.weeks,
        startDate: p.startDate,
        endDate: p.endDate,
      })),
    },
  });
});
