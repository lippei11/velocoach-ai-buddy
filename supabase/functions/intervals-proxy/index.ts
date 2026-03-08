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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

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
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    // --- Save credentials ---
    if (action === "save-credentials") {
      const { athleteId, apiKey } = body;
      if (!athleteId || !apiKey) {
        return jsonResponse({ error: "Missing athleteId or apiKey" }, 400);
      }

      // Validate credentials first
      const testRes = await fetch(
        `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=2025-01-01&newest=2025-01-02`,
        {
          headers: {
            Authorization: "Basic " + btoa(`API_KEY:${apiKey}`),
          },
        }
      );
      if (!testRes.ok) {
        await testRes.text();
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }
      await testRes.text();

      // Upsert into athlete_connections
      const { error: upsertError } = await supabaseAdmin
        .from("athlete_connections")
        .upsert(
          {
            user_id: userId,
            intervals_athlete_id: athleteId,
            intervals_api_key: apiKey,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        return jsonResponse({ error: upsertError.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    // --- Fetch data from Intervals.icu ---
    if (action === "fetch") {
      // Get credentials from DB
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

    // --- Check connection status ---
    if (action === "check-connection") {
      const { data: conn } = await supabaseAdmin
        .from("athlete_connections")
        .select("intervals_athlete_id")
        .eq("user_id", userId)
        .single();

      return jsonResponse({ connected: !!conn, athleteId: conn?.intervals_athlete_id ?? null });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
