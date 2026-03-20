// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { validateWeekSkeleton } from "../_shared/planningCore.ts";

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// JSON extraction
// ─────────────────────────────────────────────────────────────────────────────

/** Extract a JSON object from a string that may contain markdown fences or prose. */
function extractJson(text: string): unknown {
  // Direct parse
  try { return JSON.parse(text.trim()); } catch {}

  // Strip markdown code fence
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch {}
  }

  // Extract between first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  throw new Error("Could not extract JSON from model response");
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildAthleteContext(state: Record<string, unknown>): string {
  const weeklyCtx = (state.weeklyContext as Record<string, unknown>) ?? {};
  const recentLoad = (state.recentLoad as Record<string, unknown>) ?? {};
  const performance = (state.performance as Record<string, unknown>) ?? {};
  const recovery = (state.recovery as Record<string, unknown>) ?? {};
  const budget = (state.weeklyStressBudget as Record<string, unknown>) ?? {};
  const prefs = (state.preferences as Record<string, unknown>) ?? {};

  const availableDayNames = Array.isArray(weeklyCtx.availableDays)
    ? (weeklyCtx.availableDays as number[]).map((n) => DAY_NAMES[n] ?? n).join(", ")
    : "not specified";

  return [
    "=== ATHLETE TRAINING CONTEXT ===",
    "",
    `Phase: ${state.currentPhase ?? "base"}`,
    `Goal: ${state.goalType ?? "endurance"} (${state.eventDemandProfile ?? "mixed_hobby_fitness"})`,
    `Event date: ${state.eventDate ?? "not set"}`,
    `Week start (Monday): ${weeklyCtx.weekStartDate ?? "unknown"}`,
    `Available training days: ${availableDayNames}`,
    `Training hours per week: ${weeklyCtx.hoursAvailable ?? 8}h`,
    `Training typology: ${(budget.typology as string) ?? "PYRAMIDAL"}`,
    "",
    "--- Fitness Load ---",
    `CTL (fitness): ${recentLoad.ctl ?? "unknown"}`,
    `ATL (fatigue): ${recentLoad.atl ?? "unknown"}`,
    `TSB (form): ${recentLoad.tsb ?? "unknown"}`,
    `Readiness: ${recovery.readinessLevel ?? "unknown"}`,
    `Low readiness pattern (TSB < -10 for 2+ days): ${recovery.lowReadinessPattern ?? false}`,
    "",
    "--- Performance ---",
    `FTP: ${performance.ftpWatts ? `${performance.ftpWatts}W (${performance.ftpStatus ?? "current"})` : "unknown"}`,
    `Durability score: ${performance.durabilityScore ?? 0.5}`,
    `Recent execution quality: ${performance.recentExecutionQuality ?? 0.8}`,
    "",
    "--- Weekly Stress Budget ---",
    `Target weekly TSS: ${budget.weeklyTssTarget ?? 400}`,
    `Max threshold sessions: ${budget.maxThresholdSessions ?? 2}`,
    `Max VO2max sessions: ${budget.maxVo2Sessions ?? 1}`,
    `Max neuromuscular sessions: ${budget.maxNeuromuscularSessions ?? 1}`,
    `Max durability blocks: ${budget.maxDurabilityBlocks ?? 1}`,
    `Strength sessions per week: ${prefs.strengthSessionsPerWeek ?? 0}`,
    "",
    "--- Athlete Preferences ---",
    `Prefer outdoor long ride: ${prefs.preferOutdoorLongRide ?? false}`,
    `Prefer indoor intervals: ${prefs.preferIndoorIntervals ?? false}`,
    "",
    "--- Planning Notes ---",
    Array.isArray(state.planningNotes) && (state.planningNotes as string[]).length > 0
      ? (state.planningNotes as string[]).join(", ")
      : "none",
  ].join("\n");
}

const SYSTEM_PROMPT = `You are VeloCoach, an expert cycling training planner. Generate a 7-day weekly training skeleton.

RESPOND WITH ONLY VALID JSON — no prose, no markdown fences, no explanation outside the JSON.

Required output schema:
{
  "weekStartDate": "YYYY-MM-DD",
  "phase": "base|build|peak|taper",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayOfWeek": 0,
      "workoutType": "recovery|endurance|long_ride|sweet_spot|threshold|vo2max|climb_simulation|sprint|strength|rest",
      "stressType": "recovery|endurance_base|threshold|vo2max|neuromuscular|durability|strength|none",
      "plannedTss": 0,
      "durationMinutes": 0,
      "name": "Short workout name",
      "description": "Specific workout prescription (sets, intervals, targets)",
      "purpose": "Why this session on this day"
    }
  ],
  "totalTss": 0,
  "rationale": "2-3 sentence explanation of the week design strategy"
}

Guardrails (strictly enforced):
- dayOfWeek: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
- Include exactly 7 days covering Mon–Sun of the given weekStartDate
- Only schedule training sessions on the athlete's available days; all other days must use workoutType "rest" with plannedTss=0 and durationMinutes=0
- Never schedule back-to-back threshold and vo2max sessions
- Respect max hard session counts from the budget
- If TSB < -15 or readiness is "low" or "lowReadinessPattern" is true: reduce hard sessions to 1 max; prioritize recovery and endurance
- If phase is "taper": reduce total volume by ~40%, keep 1 short intensity session only
- If FTP_STALE note is present: add a note in the rationale that FTP test is recommended
- rationale must be in English`;

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY2");
  if (!ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY2 not configured" }, 500);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const userId = user.id;

  // ── Load athlete state ────────────────────────────────────────────────────

  const { data: stateRow, error: stateError } = await supabaseAdmin
    .from("athlete_state")
    .select("state_json, computed_at")
    .eq("user_id", userId)
    .single();

  if (stateError || !stateRow) {
    return jsonResponse(
      {
        error: "Athlete state not found — run compute-athlete-context first.",
        _debug: {
          authenticatedUserId: userId,
          userIdMatchesKnown: userId === "8fe4b639-34f0-42f0-99b5-7376ed20c219",
          stateQueryError: stateError
            ? { message: stateError.message, code: stateError.code, details: stateError.details }
            : null,
          stateRowFound: stateRow != null,
        },
      },
      422
    );
  }

  const state = stateRow.state_json as Record<string, unknown>;
  const athleteContext = buildAthleteContext(state);

  // ── Call Anthropic ────────────────────────────────────────────────────────

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: athleteContext }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    console.error("Anthropic error:", anthropicRes.status, errText);
    return jsonResponse({ error: `Anthropic API error: ${anthropicRes.status}` }, 502);
  }

  const anthropicData = await anthropicRes.json();
  const rawText: string = anthropicData?.content?.[0]?.text ?? "";

  // ── Parse & validate ──────────────────────────────────────────────────────

  let skeleton: ReturnType<typeof validateWeekSkeleton>;
  try {
    const parsed = extractJson(rawText);
    skeleton = validateWeekSkeleton(parsed);
  } catch (e) {
    console.error("WeekSkeleton validation failed:", e.message);
    console.error("Raw response (first 1000 chars):", rawText.slice(0, 1000));
    return jsonResponse({ error: `Invalid model response: ${e.message}` }, 502);
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  const weeklyCtx = (state.weeklyContext as Record<string, unknown>) ?? {};
  const recentLoad = (state.recentLoad as Record<string, unknown>) ?? {};
  const budget = (state.weeklyStressBudget as Record<string, unknown>) ?? {};
  const meta = (state._meta as Record<string, unknown>) ?? {};

  const { data: plan, error: planError } = await supabaseAdmin
    .from("plans")
    .insert({
      user_id: userId,
      goal_type: state.goalType ?? "endurance",
      event_date: state.eventDate ?? null,
      hours_per_week: (weeklyCtx.hoursAvailable as number) ?? null,
      available_days: weeklyCtx.availableDays ?? null,
      current_ctl: (recentLoad.ctl as number) ?? null,
      event_demand_profile: state.eventDemandProfile ?? null,
      typology: (budget.typology as string) ?? null,
      constitution_version: (meta.constitutionVersion as string) ?? null,
      rationale: skeleton.rationale,
      fitness_context: {
        phase: skeleton.phase,
        planningNotes: state.planningNotes ?? [],
        stateComputedAt: stateRow.computed_at,
      },
      phases: [skeleton.phase],
    })
    .select("id")
    .single();

  if (planError) {
    console.error("plans insert failed:", planError.message);
    return jsonResponse({ error: "Failed to save plan snapshot" }, 500);
  }

  const planId = plan.id;

  // Insert one row per non-rest day
  const workoutRows = skeleton.days
    .filter((d) => d.workoutType !== "rest")
    .map((d) => ({
      user_id: userId,
      plan_id: planId,
      planned_date: d.date,
      name: d.name,
      description: d.description,
      purpose: d.purpose,
      workout_type: d.workoutType,
      stress_type: d.stressType,
      planned_tss: d.plannedTss,
      completion_status: "planned",
      synced_to_intervals: false,
    }));

  if (workoutRows.length > 0) {
    const { error: workoutsError } = await supabaseAdmin
      .from("planned_workouts")
      .insert(workoutRows);

    if (workoutsError) {
      // Non-fatal — plan snapshot saved; surface the warning but don't fail
      console.error("planned_workouts insert failed:", workoutsError.message);
    }
  }

  // ── Response ──────────────────────────────────────────────────────────────

  return jsonResponse({
    planId,
    weekSkeleton: skeleton,
    stateComputedAt: stateRow.computed_at,
    generatedAt: new Date().toISOString(),
  });
});
