// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import constitution from "../_shared/constitution.json" assert { type: "json" };
import {
  generatePlanStructure,
  getWeekContext,
  buildWeeklyStressBudget,
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

Rules (enforced by the validator — violations will cause a retry):
1. Only schedule sessions on the athlete's available days.
2. No back-to-back threshold/vo2max/neuromuscular sessions.
3. Respect the weeklyStressBudget caps exactly (maxThresholdSessions, maxVo2Sessions, etc.).
4. Total planned TSS must stay within weeklyTssMin … weeklyTssMax.
5. phase must match the plan phase provided.
6. Every slot must have: day (0=Mon…6=Sun), plannedDate (YYYY-MM-DD), slotType, purpose,
   priority, durationMinutes (>=15), targetTss (>=0), indoorOutdoor, rationaleShort.
7. Respond ONLY with valid JSON. No prose, no markdown fences.

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
  keySessionTypes: string[];
  slots: Array<{
    day: number;
    plannedDate: string;
    slotType: string;
    purpose: string;
    priority: "low" | "medium" | "high";
    durationMinutes: number;
    targetTss: number;
    indoorOutdoor: string;
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
  return JSON.stringify({
    instruction: "Generate a WeekSkeleton JSON for the week described below. Respond ONLY with the JSON object.",
    weekStartDate,
    weekContext: weekCtx,
    weeklyStressBudget: budget,
    athleteState,
    planningAgentVersion: "1.0",
  });
}

// =============================================================================
// Anthropic call
// =============================================================================

const PLANNING_MODEL = Deno.env.get("PLANNING_MODEL") ?? "claude-opus-4-6";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

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
      { error: "AthleteState not found. Run compute-athlete-context first." },
      404
    );
  }

  const athleteState = stateRow.state_json as Record<string, unknown>;

  // --- Build plan structure from AthleteState ---
  const plan = generatePlanStructure({
    eventDate: (athleteState.eventDate as string | null) ?? null,
    todayDate: todayIso(),
    currentCtl: (athleteState.recentLoad as Record<string, unknown>)?.ctl as number | null ?? null,
    eventDemandProfile: (athleteState.eventDemandProfile as string | null) ?? null,
    hoursPerWeek:
      ((athleteState.weeklyContext as Record<string, unknown>)?.hoursAvailable as number) ?? 8,
    strengthSessionsPerWeek:
      ((athleteState.preferences as Record<string, unknown>)?.strengthSessionsPerWeek as number | undefined),
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

  // --- Return result ---
  return jsonResponse({
    weekSkeleton: skeleton,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    debug: {
      planningMode: "llm",
      planningImplementation: "weekly-planning-agent-v1",
    },
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
