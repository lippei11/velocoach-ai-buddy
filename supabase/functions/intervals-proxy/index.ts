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
        // Save as error state
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
      
      // Update status
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

    // --- Check connection status (from DB only, no API call) ---
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

    // --- Fetch data from Intervals.icu ---
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

      // Update last_sync_at
      await supabaseAdmin
        .from("athlete_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", userId);

      return jsonResponse(data);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
