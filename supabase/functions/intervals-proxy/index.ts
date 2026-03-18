// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

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

async function testIntervalsCredentials(athleteId: string, apiKey: string) {
  const res = await fetch(
    `https://intervals.icu/api/v1/athlete/${athleteId}`,
    {
      headers: {
        Authorization: "Basic " + btoa(`API_KEY:${apiKey}`),
      },
    }
  );
  return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : await res.text() };
}

function intervalsHeaders(apiKey: string) {
  return { Authorization: "Basic " + btoa(`API_KEY:${apiKey}`) };
}

async function fetchIntervalsApi(athleteId: string, apiKey: string, path: string, params?: Record<string, string>) {
  const url = new URL(`https://intervals.icu/api/v1/athlete/${athleteId}/${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: intervalsHeaders(apiKey) });
  if (!res.ok) throw new Error(`Intervals API ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { supabaseAdmin, supabaseUser } = getSupabaseClients(authHeader);
    const user = await getAuthenticatedUser(supabaseUser);
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    // --- Save credentials & test connection ---
    if (action === "save-credentials") {
      const { athleteId, apiKey } = body;
      if (!athleteId || !apiKey) {
        return jsonResponse({ error: "Missing athleteId or apiKey" }, 400);
      }

      const test = await testIntervalsCredentials(athleteId, apiKey);
      if (!test.ok) {
        await supabaseAdmin
          .from("athlete_connections")
          .upsert(
            {
              user_id: userId,
              intervals_athlete_id: athleteId,
              intervals_api_key: apiKey,
              connection_status: "error",
              last_error: `API returned ${test.status}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        return jsonResponse({ error: "Invalid credentials", status: test.status }, 401);
      }

      const { error: upsertError } = await supabaseAdmin
        .from("athlete_connections")
        .upsert(
          {
            user_id: userId,
            intervals_athlete_id: athleteId,
            intervals_api_key: apiKey,
            connection_status: "connected",
            connected_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        return jsonResponse({ error: upsertError.message }, 500);
      }

      return jsonResponse({ success: true, athleteName: test.body?.name ?? null });
    }

    // --- Test existing connection ---
    if (action === "test-connection") {
      const { data: conn, error: connError } = await supabaseAdmin
        .from("athlete_connections")
        .select("intervals_athlete_id, intervals_api_key")
        .eq("user_id", userId)
        .single();

      if (connError || !conn) {
        return jsonResponse({ connected: false, error: "No credentials stored" });
      }

      const test = await testIntervalsCredentials(conn.intervals_athlete_id, conn.intervals_api_key);
      
      await supabaseAdmin
        .from("athlete_connections")
        .update({
          connection_status: test.ok ? "connected" : "error",
          last_error: test.ok ? null : `API returned ${test.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return jsonResponse({
        connected: test.ok,
        athleteId: conn.intervals_athlete_id,
        athleteName: test.ok ? test.body?.name ?? null : null,
        error: test.ok ? null : `API returned ${test.status}`,
      });
    }

    // --- Check connection status (from DB only) ---
    if (action === "check-connection") {
      const { data: conn } = await supabaseAdmin
        .from("athlete_connections")
        .select("intervals_athlete_id, connection_status, connected_at, last_sync_at, last_error")
        .eq("user_id", userId)
        .single();

      if (!conn || conn.connection_status === "disconnected") {
        return jsonResponse({ connected: false, status: "disconnected" });
      }

      return jsonResponse({
        connected: conn.connection_status === "connected",
        status: conn.connection_status,
        athleteId: conn.intervals_athlete_id,
        connectedAt: conn.connected_at,
        lastSyncAt: conn.last_sync_at,
        lastError: conn.last_error,
      });
    }

    // --- Disconnect ---
    if (action === "disconnect") {
      await supabaseAdmin
        .from("athlete_connections")
        .update({
          connection_status: "disconnected",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return jsonResponse({ success: true });
    }

    // --- SYNC: Full import of profile, activities, wellness ---
    if (action === "sync") {
      const { data: conn, error: connError } = await supabaseAdmin
        .from("athlete_connections")
        .select("intervals_athlete_id, intervals_api_key")
        .eq("user_id", userId)
        .single();

      if (connError || !conn) {
        return jsonResponse({ error: "No Intervals.icu credentials found." }, 404);
      }

      const athleteId = conn.intervals_athlete_id;
      const apiKey = conn.intervals_api_key;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      // 90 days back for activities, 42 for wellness
      const oldest90 = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
      const oldest42 = new Date(now.getTime() - 42 * 86400000).toISOString().slice(0, 10);

      const results = { profile: false, activities: 0, wellness: 0, errors: [] as string[] };

      // 1) Sync athlete profile
      try {
        const profile = await fetchIntervalsApi(athleteId, apiKey, "");
        const sport = Array.isArray(profile.sport_settings)
          ? profile.sport_settings[0]
          : null;
        await supabaseAdmin.from("athlete_profiles").upsert({
          user_id: userId,
          intervals_athlete_id: athleteId,
          name: profile.name ?? null,
          email: profile.email ?? null,
          ftp: sport?.ftp ?? null,
          max_hr: sport?.max_hr ?? null,
          resting_hr: profile.icu_resting_hr ?? null,
          weight: profile.icu_weight ?? null,
          sport_types: profile.sport_settings ?? [],
          raw_data: profile,
          synced_at: now.toISOString(),
          updated_at: now.toISOString(),
        }, { onConflict: "user_id" });
        results.profile = true;
      } catch (e) {
        results.errors.push(`Profile: ${e.message}`);
      }

      // 2) Sync activities (last 90 days)
      try {
        const acts = await fetchIntervalsApi(athleteId, apiKey, "activities", {
          oldest: oldest90,
          newest: today,
        });
        if (Array.isArray(acts) && acts.length > 0) {
          // Batch upsert in chunks of 50
          for (let i = 0; i < acts.length; i += 50) {
            const chunk = acts.slice(i, i + 50).map((a: Record<string, unknown>) => ({
              user_id: userId,
              external_id: String(a.id),
              name: (a.name as string) ?? null,
              sport_type: (a.type as string) ?? null,
              start_date: String(a.start_date_local ?? a.start_date ?? today).slice(0, 10),
              duration_seconds: (a.moving_time as number) ?? null,
              distance_meters: (a.distance as number) ?? null,
              tss: (a.icu_training_load as number) ?? null,
              normalized_power: (a.icu_weighted_avg_watts as number) ?? null,
              ftp_at_time: (a.icu_ftp as number) ?? null,
              avg_hr: (a.average_heartrate as number) ?? null,
              intensity_factor: a.icu_weighted_avg_watts && a.icu_ftp
                ? Number(((a.icu_weighted_avg_watts as number) / (a.icu_ftp as number)).toFixed(3))
                : null,
              source: "intervals",
              raw_data: a,
            }));
            await supabaseAdmin.from("activities").upsert(chunk, {
              onConflict: "user_id,external_id",
            });
          }
          results.activities = acts.length;
        }
      } catch (e) {
        results.errors.push(`Activities: ${e.message}`);
      }

      // 3) Sync wellness (last 42 days)
      try {
        const well = await fetchIntervalsApi(athleteId, apiKey, "wellness", {
          oldest: oldest42,
          newest: today,
        });
        if (Array.isArray(well) && well.length > 0) {
          const rows = well.map((w: Record<string, unknown>) => ({
            user_id: userId,
            date: String(w.id ?? w.date ?? today),
            ctl: (w.ctl as number) ?? null,
            atl: (w.atl as number) ?? null,
            tsb: w.ctl != null && w.atl != null ? (w.ctl as number) - (w.atl as number) : null,
            ramp_rate: (w.rampRate as number) ?? null,
            hrv: (w.hrv as number) ?? null,
            resting_hr: (w.restingHR as number) ?? null,
            sleep_score: (w.sleepScore as number) ?? null,
            weight: (w.weight as number) ?? null,
            source: "intervals",
          }));
          // Batch in chunks of 50
          for (let i = 0; i < rows.length; i += 50) {
            await supabaseAdmin.from("wellness_days").upsert(rows.slice(i, i + 50), {
              onConflict: "user_id,date",
            });
          }
          results.wellness = well.length;
        }
      } catch (e) {
        results.errors.push(`Wellness: ${e.message}`);
      }

      // Update last_sync_at
      await supabaseAdmin
        .from("athlete_connections")
        .update({ last_sync_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("user_id", userId);

      return jsonResponse({
        success: results.errors.length === 0,
        ...results,
      });
    }

    // --- Fetch data from Intervals.icu (legacy direct proxy) ---
    if (action === "fetch") {
      const { data: conn, error: connError } = await supabaseAdmin
        .from("athlete_connections")
        .select("intervals_athlete_id, intervals_api_key")
        .eq("user_id", userId)
        .single();

      if (connError || !conn) {
        return jsonResponse(
          { error: "No Intervals.icu credentials found. Please connect your account." },
          404
        );
      }

      const { endpoint, params } = body;
      const athleteId = conn.intervals_athlete_id;
      const headers = {
        Authorization: "Basic " + btoa(`API_KEY:${conn.intervals_api_key}`),
      };

      let url: string;

      switch (endpoint) {
        case "wellness": {
          const { oldest, newest } = params || {};
          url = `https://intervals.icu/api/v1/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`;
          break;
        }
        case "activities": {
          const { oldest, newest, fields } = params || {};
          url = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`;
          if (fields) url += `&fields=${fields}`;
          break;
        }
        case "events": {
          const { oldest, newest, category } = params || {};
          url = `https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`;
          if (category) url += `&category=${category}`;
          break;
        }
        default:
          return jsonResponse({ error: `Unknown endpoint: ${endpoint}` }, 400);
      }

      const apiRes = await fetch(url, { headers });
      if (!apiRes.ok) {
        const text = await apiRes.text();
        return jsonResponse(
          { error: `Intervals.icu API error: ${apiRes.status} ${text}` },
          apiRes.status
        );
      }

      const data = await apiRes.json();

      return jsonResponse(data);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
