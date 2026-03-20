// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import constitution from "../_shared/constitution.json" assert { type: "json" };

// =============================================================================
// CORS — same pattern as intervals-proxy
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
// Supabase clients — same pattern as intervals-proxy
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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Parse available_days stored as string[] ("Tue","Thu"...) or number[] (0..6) */
function parseAvailableDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [1, 3, 5, 6];
  const dayMap: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
    Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
    Friday: 4, Saturday: 5, Sunday: 6,
  };
  return raw.map((v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string") return dayMap[v] ?? -1;
    return -1;
  }).filter((n) => n >= 0 && n <= 6);
}

/** Derive GoalType from EventDemandProfile */
function deriveGoalType(profile: string): "ftp_build" | "gran_fondo" | "endurance" {
  if (profile === "ftp_build") return "ftp_build";
  if (profile === "mixed_hobby_fitness") return "endurance";
  return "gran_fondo";
}

/** Derive durabilityPriority from eventDemandProfile */
function deriveDurabilityPriority(profile: string): "low" | "medium" | "high" {
  if (["steady_climbing", "ultra_endurance", "long_gravel"].includes(profile)) return "high";
  if (["time_trial", "punchy_stochastic", "ftp_build"].includes(profile)) return "medium";
  return "low";
}

/** ISO date string for Monday of the current week */
function currentWeekStartDate(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// =============================================================================
// Main handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Optional body params for special-week context
  let specialWeekType: string = "normal";
  let loadCompleteness: string = "unknown";
  let estimatedUntrackedLoad: { estimatedTss?: number; durationHours?: number; perceivedLoad?: string } = {};
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.specialWeekType) specialWeekType = body.specialWeekType;
      if (body.loadCompleteness) loadCompleteness = body.loadCompleteness;
      if (body.estimatedUntrackedLoad) estimatedUntrackedLoad = body.estimatedUntrackedLoad;
    }
  } catch (_) { /* non-fatal */ }

  const { supabaseAdmin, supabaseUser } = getSupabaseClients(authHeader);
  const user = await getAuthenticatedUser(supabaseUser);
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

  const userId = user.id;
  const planningNotes: string[] = [];

  // -------------------------------------------------------------------------
  // 1. athlete_profiles → FTP metrics
  // -------------------------------------------------------------------------
  let ftpWatts: number | undefined;
  let ftpAgeDays: number | undefined;
  let ftpStatus: "current" | "stale" | undefined;
  let profileWeight: number | undefined;

  try {
    const { data: profile } = await supabaseAdmin
      .from("athlete_profiles")
      .select("ftp, weight, synced_at")
      .eq("user_id", userId)
      .single();

    if (profile?.ftp != null) {
      ftpWatts = profile.ftp;
      if (profile.synced_at) {
        const syncedAt = new Date(profile.synced_at);
        ftpAgeDays = Math.floor((Date.now() - syncedAt.getTime()) / 86400000);
        ftpStatus = ftpAgeDays > constitution.ftp_stale_days ? "stale" : "current";
        if (ftpStatus === "stale") planningNotes.push("FTP_STALE");
      }
    }
    if (profile?.weight) profileWeight = profile.weight;
  } catch (e) {
    console.error("athlete_profiles fetch failed:", e.message);
  }

  // -------------------------------------------------------------------------
  // 2. wellness_days → CTL, ATL, TSB, recovery signals
  // -------------------------------------------------------------------------
  let ctl: number | undefined;
  let atl: number | undefined;
  let tsb: number | undefined;
  let rampRate: number | undefined;
  let latestHrv: number | undefined;
  let latestRestingHr: number | undefined;
  let latestSleepScore: number | undefined;
  let recentWellness: Array<{ date: string; ctl: number | null; atl: number | null; tsb: number | null; hrv: number | null; resting_hr: number | null; sleep_score: number | null }> = [];

  try {
    const { data: wellnessRows } = await supabaseAdmin
      .from("wellness_days")
      .select("date, ctl, atl, tsb, ramp_rate, hrv, resting_hr, sleep_score")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(14);

    if (wellnessRows && wellnessRows.length > 0) {
      recentWellness = wellnessRows;
      const latest = wellnessRows[0];
      if (latest.ctl != null) ctl = latest.ctl;
      if (latest.atl != null) atl = latest.atl;
      if (latest.tsb != null) tsb = latest.tsb;
      if (latest.ramp_rate != null) rampRate = latest.ramp_rate;

      // Find first non-null HRV / resting_hr / sleep in recent rows
      for (const row of wellnessRows) {
        if (latestHrv == null && row.hrv != null) latestHrv = row.hrv;
        if (latestRestingHr == null && row.resting_hr != null) latestRestingHr = row.resting_hr;
        if (latestSleepScore == null && row.sleep_score != null) latestSleepScore = row.sleep_score;
      }
    }
  } catch (e) {
    console.error("wellness_days fetch failed:", e.message);
  }

  // -------------------------------------------------------------------------
  // 3. athlete_preferences → Training setup (primary source)
  //    Fallback to most recent plans if preferences are empty
  // -------------------------------------------------------------------------
  let eventDemandProfile = "mixed_hobby_fitness";
  let eventDate: string | undefined;
  let hoursPerWeek = 8;
  let availableDays: number[] = [1, 3, 5, 6];
  let preferOutdoorLongRide = false;
  let preferIndoorIntervals = false;
  let trainingTimeOfDay: string | undefined;
  let strengthSessionsPerWeek = 0;
  let usedPreferencesFallback = false;

  try {
    const { data: prefs } = await supabaseAdmin
      .from("athlete_preferences")
      .select(
        "event_demand_profile, event_date, hours_per_week, available_days, " +
        "prefer_outdoor_long_ride, prefer_indoor_intervals, " +
        "strength_sessions_per_week"
      )
      .eq("user_id", userId)
      .single();

    const hasPrefs =
      prefs &&
      (prefs.event_demand_profile != null ||
        prefs.hours_per_week != null ||
        (Array.isArray(prefs.available_days) && prefs.available_days.length > 0));

    if (hasPrefs) {
      if (prefs.event_demand_profile) eventDemandProfile = prefs.event_demand_profile;
      if (prefs.event_date) eventDate = prefs.event_date;
      if (prefs.hours_per_week != null) hoursPerWeek = Number(prefs.hours_per_week);
      if (Array.isArray(prefs.available_days) && prefs.available_days.length > 0) {
        availableDays = parseAvailableDays(prefs.available_days);
      }
      if (prefs.prefer_outdoor_long_ride != null) preferOutdoorLongRide = prefs.prefer_outdoor_long_ride;
      if (prefs.prefer_indoor_intervals != null) preferIndoorIntervals = prefs.prefer_indoor_intervals;
      if (prefs.strength_sessions_per_week != null) strengthSessionsPerWeek = prefs.strength_sessions_per_week;
    } else {
      // Transitional fallback: read from most recent plan
      usedPreferencesFallback = true;
      try {
        const { data: latestPlan } = await supabaseAdmin
          .from("plans")
          .select("event_demand_profile, event_date, hours_per_week, available_days")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (latestPlan) {
          if (latestPlan.event_demand_profile) eventDemandProfile = latestPlan.event_demand_profile;
          if (latestPlan.event_date) eventDate = latestPlan.event_date;
          if (latestPlan.hours_per_week != null) hoursPerWeek = Number(latestPlan.hours_per_week);
          if (Array.isArray(latestPlan.available_days) && latestPlan.available_days.length > 0) {
            availableDays = parseAvailableDays(latestPlan.available_days);
          }
          planningNotes.push("TRAINING_SETUP_FROM_PLAN_FALLBACK");
        }
      } catch (e) {
        console.error("plans fallback fetch failed:", e.message);
      }
    }
  } catch (e) {
    console.error("athlete_preferences fetch failed:", e.message);
  }

  // -------------------------------------------------------------------------
  // 4. activities → durabilityScore, phase/reentryContext, confidence inputs
  // -------------------------------------------------------------------------
  let durabilityScore: number | undefined;
  let mostRecentActivityDate: Date | null = null;
  let activityCount = 0;
  let weeksOfHistoryFraction = 0;
  let recentWeeklyTss: number[] = [];      // most-recent first, up to 8 weeks
  let recentPeakWeeklyTss: number | undefined; // max weekly TSS in last 12 weeks

  try {
    const { data: activities } = await supabaseAdmin
      .from("activities")
      .select("start_date, duration_seconds, normalized_power, tss")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })
      .limit(200);

    if (activities && activities.length > 0) {
      activityCount = activities.length;
      mostRecentActivityDate = new Date(activities[0].start_date);

      // Group activities by ISO week (Monday-keyed)
      const weekTssMap: Map<string, number> = new Map();
      for (const a of activities) {
        const d = new Date(a.start_date);
        const day = d.getUTCDay();
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
        const weekKey = monday.toISOString().slice(0, 10);
        weekTssMap.set(weekKey, (weekTssMap.get(weekKey) ?? 0) + (a.tss ?? 0));
      }

      // Sort weeks descending (most recent first)
      const sortedWeeks = Array.from(weekTssMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]));

      // Weeks of history fraction (capped at 8 weeks = 1.0)
      const uniqueWeeks = new Set(sortedWeeks.map(([k]) => k));
      weeksOfHistoryFraction = Math.min(uniqueWeeks.size / 8.0, 1.0);

      // recentWeeklyTss: last 8 completed weeks (skip the current in-progress week)
      const nowWeekMonday = (() => {
        const d = new Date();
        const day = d.getUTCDay();
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
        return monday.toISOString().slice(0, 10);
      })();
      const completedWeeks = sortedWeeks.filter(([k]) => k < nowWeekMonday);
      recentWeeklyTss = completedWeeks.slice(0, 8).map(([, tss]) => tss);

      // recentPeakWeeklyTss: max TSS across last 12 weeks
      const cutoff12w = new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10);
      const last12 = sortedWeeks.filter(([k]) => k >= cutoff12w && k < nowWeekMonday);
      if (last12.length > 0) {
        recentPeakWeeklyTss = Math.max(...last12.map(([, tss]) => tss));
      }

      // Durability score: from long rides (>= 3h) with normalized_power
      const longRides = activities.filter(
        (a) =>
          a.duration_seconds != null &&
          a.duration_seconds >= 10800 &&
          a.normalized_power != null
      );

      if (longRides.length >= 2) {
        // Use last 4 qualifying rides; only compute if we have reliable segment data.
        // Without per-segment power, use the conservative proxy:
        // ratio ≈ 0.5 + 0.1 per ride where normalized_power / tss_rate looks stable.
        // Per spec: if no reliable segmentation exists, use default 0.5.
        // We do NOT have segment data here → use 0.5 as the safe default.
        durabilityScore = 0.5;
        if (longRides.length >= 4) planningNotes.push("DURABILITY_FROM_LONG_RIDE_COUNT");
      } else {
        durabilityScore = 0.5;
        planningNotes.push("LOW_DURABILITY_SIGNAL");
      }
    }
  } catch (e) {
    console.error("activities fetch failed:", e.message);
  }

  // -------------------------------------------------------------------------
  // 5. planned_workouts → recentExecutionQuality
  // -------------------------------------------------------------------------
  let recentExecutionQuality = 0.8;

  try {
    const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const { data: recentWorkouts } = await supabaseAdmin
      .from("planned_workouts")
      .select("planned_tss, executed_tss, completion_status")
      .eq("user_id", userId)
      .gte("planned_date", cutoff)
      .not("completion_status", "eq", "planned")
      .gt("planned_tss", 0);

    if (recentWorkouts && recentWorkouts.length > 0) {
      const totalPlanned = recentWorkouts.reduce((s, w) => s + (w.planned_tss ?? 0), 0);
      const totalExecuted = recentWorkouts.reduce((s, w) => s + (w.executed_tss ?? 0), 0);
      if (totalPlanned > 0) {
        recentExecutionQuality = clamp(totalExecuted / totalPlanned, 0, 1);
      }
    }
  } catch (e) {
    console.error("planned_workouts fetch failed:", e.message);
  }

  // -------------------------------------------------------------------------
  // 6. Derive currentPhase and reentryContext
  // -------------------------------------------------------------------------
  let currentPhase: "base" | "build" | "peak" | "taper" = "base";
  let reentryContext:
    | "none"
    | "after_illness"
    | "after_travel"
    | "after_inconsistency"
    | "after_injury" = "none";

  const now = new Date();
  const daysSinceLastActivity = mostRecentActivityDate
    ? (now.getTime() - mostRecentActivityDate.getTime()) / 86400000
    : Infinity;

  // active_vacation: athlete was active but uploads may be missing — suppress reentry caution
  const suppressReentryForVacation = specialWeekType === "active_vacation";

  if (!suppressReentryForVacation && daysSinceLastActivity > constitution.re_entry_gap_days) {
    currentPhase = "base";
    reentryContext = "after_inconsistency";
    planningNotes.push("REENTRY_AFTER_GAP");
  } else if (eventDate) {
    const daysToEvent = (new Date(eventDate).getTime() - now.getTime()) / 86400000;
    if (daysToEvent <= 14 && daysToEvent >= 0) {
      currentPhase = "taper";
    } else if (
      rampRate != null && rampRate > 8 &&
      recentWellness.length >= 3
    ) {
      currentPhase = "build";
    }
  } else if (
    rampRate != null && rampRate > 8 &&
    recentWellness.length >= 3
  ) {
    currentPhase = "build";
  }

  // -------------------------------------------------------------------------
  // 7. confidence
  // -------------------------------------------------------------------------
  let confidence = 0.3;

  if (activityCount >= 14) {
    const ftpFreshness = ftpAgeDays != null && ftpAgeDays <= 28 ? 1.0 : 0.5;
    confidence = clamp(weeksOfHistoryFraction * ftpFreshness * recentExecutionQuality, 0, 1);
  } else {
    planningNotes.push("LOW_CONFIDENCE_SPARSE_DATA");
  }

  // -------------------------------------------------------------------------
  // 8. Recovery signals
  // -------------------------------------------------------------------------
  const hrvAvailable = latestHrv != null;
  const restingHrAvailable = latestRestingHr != null;
  const sleepAvailable = latestSleepScore != null;

  let readinessLevel: "unknown" | "good" | "moderate" | "low" = "unknown";
  if (tsb != null) {
    if (tsb >= -5) readinessLevel = "good";
    else if (tsb >= -20) readinessLevel = "moderate";
    else readinessLevel = "low";
  }

  // lowReadinessPattern: TSB < -10 for 2+ consecutive recent days
  let lowReadinessPattern = false;
  if (recentWellness.length >= 2) {
    let consecutiveLow = 0;
    for (const row of recentWellness.slice(0, 7)) {
      if (row.tsb != null && row.tsb < -10) {
        consecutiveLow++;
        if (consecutiveLow >= 2) { lowReadinessPattern = true; break; }
      } else {
        consecutiveLow = 0;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 9. weeklyStressBudget (planning context, not part of AthleteState interface
  //    but stored alongside it in state_json for the planning pipeline)
  // -------------------------------------------------------------------------
  const budgetDefaults = constitution.stress_budget_defaults;
  const typologyMap = constitution.typology_defaults as Record<string, string>;
  const typology = typologyMap[eventDemandProfile] ?? "PYRAMIDAL";
  // Use recent weekly TSS baseline if available; CTL×7 as fallback only
  const weeklyTssTarget = recentWeeklyTss.length > 0
    ? Math.round(recentWeeklyTss.slice(0, 4).reduce((s, v, i, arr) => s + v / arr.length, 0))
    : (ctl != null ? ctl * 7 : hoursPerWeek * 50);

  const weeklyStressBudget = {
    weeklyTssTarget,
    maxThresholdSessions: budgetDefaults.threshold_per_week,
    maxVo2Sessions: budgetDefaults.vo2max_per_week,
    maxNeuromuscularSessions: budgetDefaults.neuromuscular_per_week,
    maxDurabilityBlocks: budgetDefaults.durability_blocks_per_week,
    maxStrengthSessions: strengthSessionsPerWeek > 0 ? strengthSessionsPerWeek : 2,
    plannedThreshold: 0,
    plannedVo2: 0,
    plannedNeuromuscular: 0,
    plannedDurability: 0,
    plannedStrength: 0,
    plannedLongRide: false,
    exceptionApplied: false,
    typology,
  };

  // -------------------------------------------------------------------------
  // 10. Derived planning priors
  // -------------------------------------------------------------------------
  const strengthPriority: "low" | "medium" | "high" =
    strengthSessionsPerWeek >= 3 ? "high" :
    strengthSessionsPerWeek >= 1 ? "medium" : "low";

  const durabilityPriority = deriveDurabilityPriority(eventDemandProfile);

  const indoorOutdoorPreference = preferIndoorIntervals && !preferOutdoorLongRide
    ? "indoor_preferred"
    : preferOutdoorLongRide && !preferIndoorIntervals
    ? "outdoor_preferred"
    : "flexible";

  // -------------------------------------------------------------------------
  // 11. Assemble AthleteState
  // -------------------------------------------------------------------------
  const weekStartDate = currentWeekStartDate();
  const goalType = deriveGoalType(eventDemandProfile);

  const athleteState = {
    userId,

    // Goal & event
    goalType,
    eventDemandProfile,
    ...(eventDate ? { eventDate } : {}),
    currentPhase,

    // User input layers
    preferences: {
      preferOutdoorLongRide,
      preferIndoorIntervals,
      ...(trainingTimeOfDay ? { trainingTimeOfDay } : {}),
      strengthSessionsPerWeek,
      indoorOutdoorPreference,
    },
    weeklyContext: {
      weekStartDate,
      hoursAvailable: hoursPerWeek,
      availableDays,
      specialWeekType,
      loadCompleteness,
      ...(Object.keys(estimatedUntrackedLoad).length > 0 ? { estimatedUntrackedLoad } : {}),
      ...(recentWeeklyTss.length > 0 ? { recentWeeklyTss } : {}),
    },
    userOverrides: [],

    // Constraints (populated by user-facing flows, empty at context compile time)
    athleteConstraints: [],
    dayConstraints: [],

    // Training load & performance
    recentLoad: {
      ...(ctl != null ? { ctl } : {}),
      ...(atl != null ? { atl } : {}),
      ...(tsb != null ? { tsb } : {}),
    },
    performance: {
      ...(ftpWatts != null ? { ftpWatts } : {}),
      ...(ftpAgeDays != null ? { ftpAgeDays } : {}),
      ...(ftpStatus != null ? { ftpStatus } : {}),
      ...(durabilityScore != null ? { durabilityScore } : {}),
      recentExecutionQuality,
      ...(recentPeakWeeklyTss != null ? { recentPeakWeeklyTss } : {}),
    },
    recovery: {
      readinessLevel,
      hrvAvailable,
      restingHrAvailable,
      sleepAvailable,
      subjectiveFatigueAvailable: false,
      lowReadinessPattern,
    },

    // Compliance
    executionQualityScore: recentExecutionQuality,

    // Special state flags
    reentryContext,
    injuryFlag: false,
    illnessFlag: false,

    // Planning priors
    defaultMaxHardSessions: 2,
    strengthPriority,
    durabilityPriority,

    // Confidence
    confidence,
    planningNotes: planningNotes.length > 0 ? planningNotes : undefined,
  };

  // weeklyStressBudget stored alongside AthleteState in state_json
  const stateJson = {
    ...athleteState,
    weeklyStressBudget,
    _meta: {
      constitutionVersion: constitution.version,
      computedAt: now.toISOString(),
      usedPreferencesFallback,
    },
  };

  // -------------------------------------------------------------------------
  // 12. Upsert into athlete_state
  // -------------------------------------------------------------------------
  try {
    await supabaseAdmin
      .from("athlete_state")
      .upsert(
        {
          user_id: userId,
          computed_at: now.toISOString(),
          state_json: stateJson,
        },
        { onConflict: "user_id" }
      );
  } catch (e) {
    console.error("athlete_state upsert failed:", e.message);
    // Non-fatal — still return the computed state
  }

  return jsonResponse({ state_json: stateJson });
});
