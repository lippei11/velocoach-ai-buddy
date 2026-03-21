// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import constitution from "../_shared/constitution.json" assert { type: "json" };
import {
  generatePlanStructure,
  deriveBlocksFromPlan,
} from "../_shared/planningCore.ts";

// =============================================================================
// CORS — same pattern as compute-athlete-context
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
// Supabase clients — same pattern as compute-athlete-context
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

// =============================================================================
// Main handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Auth ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const { supabaseAdmin, supabaseUser } = getSupabaseClients(authHeader);
  const user = await getAuthenticatedUser(supabaseUser);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const userId = user.id;

  // --- Parse body ---
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const {
    eventDemandProfile,
    eventName,
    eventDate,
    hoursPerWeek,
    availableDays,
    strengthSessionsPerWeek,
    entryState,
    typology,
    vacationWeeks,
  } = body as {
    eventDemandProfile: string;
    eventName?: string;
    eventDate?: string;
    hoursPerWeek: number;
    availableDays: string[];
    strengthSessionsPerWeek?: number;
    entryState: string;
    typology?: string;
    vacationWeeks?: string[];
  };

  // --- Validate required fields ---
  if (!eventDemandProfile || !hoursPerWeek || !availableDays || !entryState) {
    return jsonResponse(
      { error: "Missing required fields: eventDemandProfile, hoursPerWeek, availableDays, entryState" },
      400
    );
  }

  const today = todayIso();

  // -------------------------------------------------------------------------
  // 1. Archive existing active plan
  // -------------------------------------------------------------------------
  const { error: archiveError } = await supabaseAdmin
    .from("plans")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");

  if (archiveError) {
    console.error("archive plans failed (non-fatal):", archiveError.message);
  }

  // -------------------------------------------------------------------------
  // 2. Call compute-athlete-context to refresh AthleteState
  // -------------------------------------------------------------------------
  try {
    await supabaseUser.functions.invoke("compute-athlete-context", { body: {} });
  } catch (e) {
    console.error("compute-athlete-context invoke failed (non-fatal):", (e as Error).message);
  }

  // -------------------------------------------------------------------------
  // 3. Read fresh athlete_state
  // -------------------------------------------------------------------------
  const { data: stateRow } = await supabaseAdmin
    .from("athlete_state")
    .select("state_json")
    .eq("user_id", userId)
    .single();

  const athleteState = (stateRow?.state_json as Record<string, unknown>) ?? {};
  const currentCtl =
    ((athleteState.recentLoad as Record<string, unknown>)?.ctl as number | null) ?? null;

  // -------------------------------------------------------------------------
  // 4. generatePlanStructure — pure function
  // -------------------------------------------------------------------------
  const planStructure = generatePlanStructure({
    eventDate: (eventDate as string | null) ?? null,
    todayDate: today,
    currentCtl,
    eventDemandProfile: eventDemandProfile as any,
    hoursPerWeek: Number(hoursPerWeek),
    strengthSessionsPerWeek: strengthSessionsPerWeek != null
      ? Number(strengthSessionsPerWeek)
      : undefined,
    constitutionVersion: constitution.version,
  });

  // -------------------------------------------------------------------------
  // 5. deriveBlocksFromPlan — pure function
  // -------------------------------------------------------------------------
  const derivedBlocks = deriveBlocksFromPlan(planStructure);

  // -------------------------------------------------------------------------
  // 6. INSERT into plans
  // -------------------------------------------------------------------------
  const resolvedTypology =
    typology ??
    (constitution.typology_defaults as Record<string, string>)[eventDemandProfile] ??
    "PYRAMIDAL";

  const { data: newPlan, error: planError } = await supabaseAdmin
    .from("plans")
    .insert({
      user_id: userId,
      status: "active",
      event_demand_profile: eventDemandProfile,
      event_date: eventDate ?? null,
      goal_event: eventName ?? null,
      hours_per_week: Number(hoursPerWeek),
      available_days: availableDays,
      plan_start_date: planStructure.planStartDate,
      macro_strategy: planStructure.macroStrategy,
      plan_structure_json: planStructure,
      typology: resolvedTypology,
      constitution_version: constitution.version,
      entry_state: entryState,
      current_ctl: currentCtl,
    })
    .select("id")
    .single();

  if (planError || !newPlan) {
    return jsonResponse(
      { error: "Failed to insert plan", details: planError?.message },
      500
    );
  }

  const planId = newPlan.id;

  // -------------------------------------------------------------------------
  // 7. INSERT blocks
  // -------------------------------------------------------------------------
  const todayDate = new Date(today + "T00:00:00Z");

  const blocksToInsert = derivedBlocks.map((b) => {
    const blockStart = new Date(b.startDate + "T00:00:00Z");
    const blockEnd = new Date(b.endDate + "T00:00:00Z");
    const isActive = blockStart <= todayDate && blockEnd >= todayDate;

    // Vacation weeks that fall within this block's date range
    const blockVacationWeeks = (vacationWeeks ?? []).filter((w: string) => {
      const weekDate = new Date(w + "T00:00:00Z");
      return weekDate >= blockStart && weekDate <= blockEnd;
    });

    const userInputsJson: Record<string, unknown> = {};
    if (blockVacationWeeks.length > 0) {
      userInputsJson.vacationWeeks = blockVacationWeeks;
    }

    return {
      plan_id: planId,
      user_id: userId,
      phase: b.phase,
      block_number: b.blockNumber,
      block_number_in_phase: b.blockNumberInPhase,
      start_date: b.startDate,
      end_date: b.endDate,
      weeks: b.weeks,
      load_weeks: b.loadWeeks,
      deload_week_numbers: b.deloadWeekNumbers,
      status: isActive ? "active" : "upcoming",
      user_inputs_json: userInputsJson,
    };
  });

  const { data: insertedBlocks, error: blocksError } = await supabaseAdmin
    .from("blocks")
    .insert(blocksToInsert)
    .select();

  if (blocksError) {
    return jsonResponse(
      { error: "Failed to insert blocks", details: blocksError.message },
      500
    );
  }

  // -------------------------------------------------------------------------
  // 8. Call generate-week-skeleton for the current week
  // -------------------------------------------------------------------------
  const weekStartDate = mondayOf(today);
  let weekSkeleton: unknown = null;
  let weekContext: unknown = null;
  let blockContext: unknown = null;

  try {
    const skeletonRes = await supabaseUser.functions.invoke("generate-week-skeleton", {
      body: { planId, weekStartDate },
    });
    if (skeletonRes.data) {
      weekSkeleton = skeletonRes.data.weekSkeleton;
      weekContext = skeletonRes.data.weekContext;
      blockContext = skeletonRes.data.blockContext ?? null;
    } else if (skeletonRes.error) {
      console.error("generate-week-skeleton error (non-fatal):", skeletonRes.error);
    }
  } catch (e) {
    console.error("generate-week-skeleton invoke failed (non-fatal):", (e as Error).message);
  }

  // -------------------------------------------------------------------------
  // 9. Return result
  // -------------------------------------------------------------------------
  return jsonResponse({
    planId,
    planStructure,
    blocks: insertedBlocks,
    weekContext,
    blockContext,
    weekSkeleton,
  });
});
