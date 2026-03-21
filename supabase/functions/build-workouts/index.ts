// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import constitution from "../_shared/constitution.json" assert { type: "json" };
import { getTemplate, buildDescription } from "../_shared/workoutsCore.ts";

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
// Anthropic LLM
// =============================================================================

const WORKOUT_MODEL = Deno.env.get("WORKOUT_MODEL") ?? "claude-sonnet-4-5-20251022";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

async function callWorkoutLLM(systemPrompt: string, userPrompt: string): Promise<string> {
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
      model: WORKOUT_MODEL,
      max_tokens: 2048,
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

/** Extract JSON object from raw LLM text (strips accidental markdown fences) */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const jsonStr = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonStr);
}

// =============================================================================
// Validation
// =============================================================================

function validateSessionResponse(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") return ["Response is not a JSON object"];
  const s = raw as Record<string, unknown>;

  if (!s.name || typeof s.name !== "string") errors.push("name must be a non-empty string");
  if (!s.description || typeof s.description !== "string") errors.push("description must be a non-empty string");
  if (typeof s.durationMinutes !== "number" || s.durationMinutes < 5) {
    errors.push("durationMinutes must be a number >= 5");
  }

  if (!s.targets || typeof s.targets !== "object") {
    errors.push("targets must be an object");
  } else {
    const t = s.targets as Record<string, unknown>;
    if (typeof t.targetTss !== "number" || t.targetTss < 0) {
      errors.push("targets.targetTss must be a non-negative number");
    }
  }

  if (!s.basedOnSkeletonRationale || typeof s.basedOnSkeletonRationale !== "string") {
    errors.push("basedOnSkeletonRationale must be a non-empty string");
  }

  if (!["low", "medium", "high"].includes(s.sessionPriority as string)) {
    errors.push("sessionPriority must be 'low', 'medium', or 'high'");
  }

  if (!s.indoorOutdoor || typeof s.indoorOutdoor !== "string") {
    errors.push("indoorOutdoor must be a non-empty string");
  }

  return errors;
}

// =============================================================================
// Prompt builders
// =============================================================================

function buildSystemPrompt(): string {
  return `You are VeloCoach Workout Builder — an elite cycling coach AI.
Your task is to generate ONE concrete WorkoutSession JSON for a cyclist training slot.
You will receive the slot specification, the workout template, and athlete context.

Rules (enforced by a validator — violations will cause a retry):
1. Respond ONLY with valid JSON. No prose, no markdown fences.
2. All required fields must be present and correctly typed.
3. durationMinutes must equal the slot's durationMinutes.
4. targets.targetTss must equal the slot's targetTss.
5. indoorOutdoor must match the slot's indoorOutdoor value.
6. sessionPriority must match the slot's priority.
7. intervalBlocks should reflect the session's actual interval structure (repeat/work/recovery).
8. If the template requires cadence, include targets.cadenceRecommendationRpm as [min, max].
9. description must be plain text, Intervals.icu-compatible (no markdown).

Output schema (TypeScript for reference):
{
  name: string;                        // e.g. "Sweet Spot — 2×20 min"
  description: string;                 // Plain text, Intervals.icu-compatible
  durationMinutes: number;             // Must exactly match slot.durationMinutes
  targets: {
    targetTss: number;                 // Must exactly match slot.targetTss
    estimatedIf?: number;              // Intensity factor 0.5–1.5 (optional)
    cadenceRecommendationRpm?: [number, number];  // Only when template.cadenceRequired is true
  };
  intervalBlocks?: Array<{
    label?: string;
    repeat?: number;
    workDurationSec?: number;
    recoveryDurationSec?: number;
    target?: string;                   // e.g. "92–95% FTP", "Z2", "110% FTP"
    notes?: string;
  }>;
  basedOnSkeletonRationale: string;    // 1–2 sentences: why this workout given the context
  sessionPriority: "low" | "medium" | "high";  // Must match slot.priority
  indoorOutdoor: string;               // Must match slot.indoorOutdoor
  notesToAthlete?: string[];           // Plain language tips (optional)
}`;
}

function buildUserPrompt(
  slot: Record<string, unknown>,
  template: Record<string, unknown>,
  athleteContext: Record<string, unknown>,
  generatedDescription: string,
  validationErrors?: string[]
): string {
  return JSON.stringify({
    instruction: "Generate a WorkoutSession JSON for the slot below. Respond ONLY with the JSON object.",
    slot: {
      day: slot.day,
      plannedDate: slot.plannedDate,
      purpose: slot.purpose,
      slotType: slot.slotType,
      durationMinutes: slot.durationMinutes,
      targetTss: slot.targetTss,
      indoorOutdoor: slot.indoorOutdoor,
      priority: slot.priority,
      rationaleShort: slot.rationaleShort,
    },
    template: {
      inAppDefinition: template.inAppDefinition,
      zone: template.zone,
      ftpPctRange: template.ftpPctRange,
      sessionVolumeClass: template.sessionVolumeClass,
      cadenceRequired: template.cadenceRequired,
      cadenceRpm: template.cadenceRpm,
      typicalFormats: template.typicalFormats,
      rpeRange: template.rpeRange,
      coachNotes: template.coachNotes,
    },
    athleteContext,
    generatedDescriptionExample: generatedDescription,
    ...(validationErrors?.length
      ? { validationErrors, instruction_retry: "Fix ALL validation errors listed above." }
      : {}),
  });
}

// =============================================================================
// Deterministic fallback session builders
// =============================================================================

function buildFallbackBikeSession(
  slot: Record<string, unknown>,
  userId: string,
  weekSkeleton: Record<string, unknown>,
  constitutionVersion: string
): Record<string, unknown> {
  const purpose = slot.purpose as string;
  const template = getTemplate(purpose as any);
  const ftp = (weekSkeleton._ftpWatts as number) ?? 200;
  const description = buildDescription(template, ftp);

  const purposeLabel = purpose.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const name = template.typicalFormats.length > 0
    ? `${purposeLabel} — ${template.typicalFormats[0]}`
    : purposeLabel;

  const targets: Record<string, unknown> = {
    targetTss: slot.targetTss,
  };
  if (template.cadenceRequired && template.cadenceRpm) {
    targets.cadenceRecommendationRpm = template.cadenceRpm;
  }

  return {
    userId,
    weekStartDate: weekSkeleton.weekStartDate,
    plannedDate: slot.plannedDate,
    day: slot.day,
    phase: weekSkeleton.phase,
    stressType: slot.slotType,
    purpose: slot.purpose,
    name,
    description,
    durationMinutes: slot.durationMinutes,
    targets,
    basedOnSkeletonRationale: (slot.rationaleShort as string) ?? "Deterministic fallback session.",
    sessionPriority: slot.priority,
    indoorOutdoor: slot.indoorOutdoor,
    metadata: {
      indoorVersionAvailable: true,
      outdoorVersionAvailable: slot.indoorOutdoor !== "indoor_only",
      intervalsIcuCompatible: true,
      generatedBy: "workout_builder",
      methodologyVersion: constitutionVersion,
    },
  };
}

function buildStrengthSession(
  slot: Record<string, unknown>,
  userId: string,
  weekSkeleton: Record<string, unknown>,
  constitutionVersion: string
): Record<string, unknown> {
  return {
    userId,
    weekStartDate: weekSkeleton.weekStartDate,
    plannedDate: slot.plannedDate,
    day: slot.day,
    phase: weekSkeleton.phase,
    stressType: "strength",
    purpose: "strength",
    name: "Strength Training",
    description:
      "Gym session — compound strength work.\n" +
      "Session type: strength\n" +
      "Volume class: small\n" +
      "RPE: 6–8/10\n" +
      "→ Focus on compound movements: squat, hinge, single-leg work.\n" +
      "→ Leave 2–3 reps in reserve on each set. Avoid muscular failure.\n" +
      "→ Schedule before or after easy cycling days, not before hard intervals.",
    durationMinutes: slot.durationMinutes,
    targets: {
      targetTss: slot.targetTss,
    },
    intervalBlocks: [
      {
        label: "Warm-up",
        workDurationSec: 600,
        notes: "Mobility and activation — glutes, hip flexors, thoracic spine",
      },
      {
        label: "Main strength block",
        repeat: 3,
        workDurationSec: 1200,
        notes: "Compound lifts — squat/hinge/single-leg. 3×6–8 reps per exercise.",
      },
      {
        label: "Cool-down",
        workDurationSec: 300,
        notes: "Light stretching and foam rolling",
      },
    ],
    basedOnSkeletonRationale: (slot.rationaleShort as string) ?? "Strength session for functional cycling power.",
    sessionPriority: slot.priority,
    indoorOutdoor: "indoor_only",
    notesToAthlete: [
      "Complete this session at least 24 hours before a hard cycling session.",
      "If legs feel heavy the next day, reduce squat load by 20%.",
    ],
    metadata: {
      indoorVersionAvailable: true,
      outdoorVersionAvailable: false,
      intervalsIcuCompatible: true,
      generatedBy: "workout_builder",
      methodologyVersion: constitutionVersion,
    },
  };
}

// =============================================================================
// Per-slot session builder (LLM with one retry + deterministic fallback)
// =============================================================================

async function buildBikeSession(
  slot: Record<string, unknown>,
  userId: string,
  weekSkeleton: Record<string, unknown>,
  athleteContext: Record<string, unknown>,
  constitutionVersion: string
): Promise<{ session: Record<string, unknown>; isFallback: boolean }> {
  const purpose = slot.purpose as string;
  let template: ReturnType<typeof getTemplate>;
  try {
    template = getTemplate(purpose as any);
  } catch {
    // Unknown purpose — use deterministic fallback directly
    return {
      session: buildFallbackBikeSession(slot, userId, weekSkeleton, constitutionVersion),
      isFallback: true,
    };
  }

  const ftp = athleteContext.ftpWatts as number ?? 200;
  const generatedDescription = buildDescription(template, ftp);
  const systemPrompt = buildSystemPrompt();

  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const userPrompt = buildUserPrompt(
      slot,
      template as unknown as Record<string, unknown>,
      athleteContext,
      generatedDescription,
      attempt === 2 ? lastErrors : undefined
    );

    let rawText: string;
    try {
      rawText = await callWorkoutLLM(systemPrompt, userPrompt);
    } catch (e) {
      // LLM call failed — skip retry, go to fallback
      console.error(`LLM call failed for slot ${slot.purpose} on attempt ${attempt}: ${(e as Error).message}`);
      break;
    }

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch {
      lastErrors = ["Response was not valid JSON"];
      if (attempt === 2) break;
      continue;
    }

    lastErrors = validateSessionResponse(parsed);
    if (lastErrors.length === 0) {
      // Assemble the full WorkoutSession from LLM partial + deterministic fields
      const p = parsed as Record<string, unknown>;
      const session: Record<string, unknown> = {
        userId,
        weekStartDate: weekSkeleton.weekStartDate,
        plannedDate: slot.plannedDate,
        day: slot.day,
        phase: weekSkeleton.phase,
        stressType: slot.slotType,
        purpose: slot.purpose,
        name: p.name,
        description: p.description,
        durationMinutes: slot.durationMinutes, // Always use slot value
        targets: {
          targetTss: slot.targetTss, // Always use slot value
          ...(typeof (p.targets as Record<string, unknown>)?.estimatedIf === "number"
            ? { estimatedIf: (p.targets as Record<string, unknown>).estimatedIf }
            : {}),
          ...(template.cadenceRequired && template.cadenceRpm
            ? { cadenceRecommendationRpm: template.cadenceRpm }
            : {}),
        },
        ...(Array.isArray(p.intervalBlocks) && p.intervalBlocks.length > 0
          ? { intervalBlocks: p.intervalBlocks }
          : {}),
        basedOnSkeletonRationale: p.basedOnSkeletonRationale,
        sessionPriority: slot.priority, // Always use slot value
        indoorOutdoor: slot.indoorOutdoor, // Always use slot value
        ...(Array.isArray(p.notesToAthlete) && p.notesToAthlete.length > 0
          ? { notesToAthlete: p.notesToAthlete }
          : {}),
        metadata: {
          indoorVersionAvailable: true,
          outdoorVersionAvailable: slot.indoorOutdoor !== "indoor_only",
          intervalsIcuCompatible: true,
          generatedBy: "workout_builder",
          methodologyVersion: constitutionVersion,
        },
      };
      return { session, isFallback: false };
    }

    if (attempt === 2) break;
  }

  // Both attempts failed — deterministic fallback
  return {
    session: buildFallbackBikeSession(slot, userId, weekSkeleton, constitutionVersion),
    isFallback: true,
  };
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

  // --- Parse request body ---
  let weekSkeleton: Record<string, unknown>;
  let weekStartDate: string;
  try {
    const body = await req.json();
    if (!body?.weekSkeleton || typeof body.weekSkeleton !== "object") {
      return jsonResponse({ error: "Missing or invalid 'weekSkeleton' in request body" }, 400);
    }
    if (!body?.weekStartDate || typeof body.weekStartDate !== "string") {
      return jsonResponse({ error: "Missing or invalid 'weekStartDate' in request body" }, 400);
    }
    weekSkeleton = body.weekSkeleton as Record<string, unknown>;
    weekStartDate = body.weekStartDate as string;
  } catch {
    return jsonResponse({ error: "Invalid JSON in request body" }, 400);
  }

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
  const performance = (athleteState.performance as Record<string, unknown>) ?? {};
  const ftp = (performance.ftpWatts as number) ?? 200;

  // Athlete context passed to LLM prompts (lean, focused set)
  const athleteContext: Record<string, unknown> = {
    ftpWatts: ftp,
    ftpStatus: performance.ftpStatus ?? "unknown",
    phase: weekSkeleton.phase ?? athleteState.currentPhase,
    eventDemandProfile: weekSkeleton.eventDemandProfile ?? athleteState.eventDemandProfile,
    goalType: weekSkeleton.goalType ?? athleteState.goalType,
    weekFocus: weekSkeleton.weekFocus,
    weeklyTssTarget: (weekSkeleton.weeklyStressBudget as Record<string, unknown>)?.weeklyTssTarget,
    preferIndoorIntervals: (athleteState.preferences as Record<string, unknown>)?.preferIndoorIntervals,
    preferOutdoorLongRide: (athleteState.preferences as Record<string, unknown>)?.preferOutdoorLongRide,
    recentLoad: athleteState.recentLoad,
  };

  // Attach ftp to weekSkeleton reference for use in fallback builders
  weekSkeleton._ftpWatts = ftp;

  // --- Validate slots ---
  const slots = Array.isArray(weekSkeleton.slots)
    ? (weekSkeleton.slots as Record<string, unknown>[])
    : [];

  if (slots.length === 0) {
    return jsonResponse({ error: "weekSkeleton.slots is empty" }, 400);
  }

  const constitutionVersion = constitution.version as string;

  // --- Build sessions in parallel (one LLM call per non-strength slot) ---
  const results = await Promise.all(
    slots.map(async (slot): Promise<{ session: Record<string, unknown>; isFallback: boolean }> => {
      if (slot.purpose === "strength") {
        return {
          session: buildStrengthSession(slot, user.id, weekSkeleton, constitutionVersion),
          isFallback: false,
        };
      }
      return buildBikeSession(slot, user.id, weekSkeleton, athleteContext, constitutionVersion);
    })
  );

  const sessions = results.map((r) => r.session);
  const fallbackCount = results.filter((r) => r.isFallback).length;

  // --- Return result (do NOT persist to planned_workouts) ---
  return jsonResponse({
    sessions,
    weekStartDate,
    sessionCount: sessions.length,
    fallbackCount,
  });
});
