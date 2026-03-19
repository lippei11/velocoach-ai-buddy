// @ts-nocheck — Deno edge function; types resolved at Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const DEXCOM_BASE = "https://shareous1.dexcom.com/ShareWebServices/Services";
const DEXCOM_APP_ID = "d8665ade-9673-4e27-9ff6-92db4ce13d13";

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

// Authenticate against Dexcom Share API, returns sessionId or throws
async function dexcomAuthenticate(username: string, password: string): Promise<string> {
  const res = await fetch(
    `${DEXCOM_BASE}/General/AuthenticatePublisherAccount`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountName: username,
        password: password,
        applicationId: DEXCOM_APP_ID,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Dexcom auth failed: ${res.status}`);
  }

  const sessionId = await res.json();
  // Dexcom returns the sessionId as a bare JSON string
  if (typeof sessionId !== "string" || sessionId.length < 10) {
    throw new Error("Invalid Dexcom credentials");
  }
  return sessionId;
}

// Fetch glucose readings. minutes = how far back; maxCount = max readings
async function dexcomFetchGlucose(sessionId: string, minutes: number, maxCount: number) {
  const res = await fetch(
    `${DEXCOM_BASE}/Publisher/ReadPublisherLatestGlucoseValues` +
      `?sessionId=${encodeURIComponent(sessionId)}&minutes=${minutes}&maxCount=${maxCount}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dexcom glucose fetch failed: ${res.status} ${text}`);
  }

  return res.json();
}

// Parse Dexcom /Date(ms)/ timestamp format
function parseDexcomDate(dtStr: string): string {
  const match = dtStr.match(/\/Date\((\d+)\)\//);
  if (match) {
    return new Date(parseInt(match[1])).toISOString();
  }
  return dtStr;
}

// Store password in Vault and return vault_id
async function storeInVault(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  password: string
): Promise<string> {
  const secretName = `dexcom_pw_${userId}`;

  // Try to delete existing secret first (ignore errors)
  const { data: existing } = await supabaseAdmin
    .from("athlete_connections")
    .select("dexcom_password_vault_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.dexcom_password_vault_id) {
    try {
      await supabaseAdmin.rpc("vault_delete_secret" as never, {
        secret_id: existing.dexcom_password_vault_id,
      });
    } catch {
      // ignore — vault entry may not exist
    }
  }

  const { data, error } = await supabaseAdmin.rpc("vault_create_secret" as never, {
    p_secret: password,
    p_name: secretName,
  });

  if (error || !data) {
    throw new Error(`Vault store failed: ${error?.message ?? "no vault_id returned"}`);
  }

  return data as string;
}

// Decrypt password from Vault
async function decryptFromVault(
  supabaseAdmin: ReturnType<typeof createClient>,
  vaultId: string
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("vault_decrypt_secret" as never, {
    secret_id: vaultId,
  });

  if (error || !data) {
    throw new Error(`Vault decrypt failed: ${error?.message ?? "no data"}`);
  }

  return data as string;
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

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    // ─── save-credentials ────────────────────────────────────────────────────
    if (action === "save-credentials") {
      const { username, password } = body as { username?: string; password?: string };
      if (!username || !password) {
        return jsonResponse({ error: "Missing username or password" }, 400);
      }

      // 1. Authenticate against Dexcom
      let sessionId: string;
      try {
        sessionId = await dexcomAuthenticate(username, password);
      } catch (e) {
        return jsonResponse({ error: "Invalid Dexcom credentials", detail: e.message }, 401);
      }

      // 2. Store password in Vault
      let vaultId: string;
      try {
        vaultId = await storeInVault(supabaseAdmin, userId, password);
      } catch (e) {
        // Vault may not be enabled — fall back to storing session only
        console.error("Vault unavailable:", e.message);
        vaultId = "";
      }

      // 3. Update Dexcom columns only — never touch Intervals columns
      const now = new Date().toISOString();
      const dexcomFields = {
        dexcom_username: username,
        dexcom_password_vault_id: vaultId || null,
        dexcom_session_id: sessionId,
        dexcom_access_token: sessionId,
        dexcom_connected: true,
        dexcom_connected_at: now,
        dexcom_last_error: null,
        updated_at: now,
      };

      // Try update first; if no row exists, insert with required NOT NULL defaults
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("athlete_connections")
        .update(dexcomFields)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500);
      }

      if (!updated) {
        // No row yet — insert with required Intervals defaults
        const { error: insertError } = await supabaseAdmin
          .from("athlete_connections")
          .insert({
            user_id: userId,
            intervals_api_key: "",
            intervals_athlete_id: "",
            ...dexcomFields,
          });
        if (insertError) {
          return jsonResponse({ error: insertError.message }, 500);
        }
      }

      const vaultWarning = vaultId ? undefined : "Password not stored in Vault — session-only mode. Re-auth on session expiry will not work automatically.";
      if (vaultWarning) console.warn(vaultWarning);

      return jsonResponse({ success: true, connected: true, vaultWarning });
    }

    // ─── sync-glucose ─────────────────────────────────────────────────────────
    if (action === "sync-glucose") {
      const minutes = (body.minutes as number | undefined) ?? 1440;
      const maxCount = Math.ceil(minutes / 5) + 1;

      // 1. Load session from DB
      const { data: conn } = await supabaseAdmin
        .from("athlete_connections")
        .select("dexcom_session_id, dexcom_username, dexcom_password_vault_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!conn?.dexcom_session_id) {
        return jsonResponse({ error: "Dexcom not connected" }, 400);
      }

      let sessionId = conn.dexcom_session_id;
      let readings: unknown[];

      const tryFetch = async () => {
        const raw = await dexcomFetchGlucose(sessionId, minutes, maxCount);
        if (!Array.isArray(raw)) throw new Error("Unexpected Dexcom response");
        return raw;
      };

      try {
        readings = await tryFetch();
      } catch (e) {
        // Session may be expired — re-auth if we have vault credentials
        if (conn.dexcom_password_vault_id && conn.dexcom_username) {
          try {
            const password = await decryptFromVault(supabaseAdmin, conn.dexcom_password_vault_id);
            sessionId = await dexcomAuthenticate(conn.dexcom_username, password);

            // Store new sessionId
            await supabaseAdmin
              .from("athlete_connections")
              .update({ dexcom_session_id: sessionId, dexcom_access_token: sessionId, updated_at: new Date().toISOString() })
              .eq("user_id", userId);

            readings = await tryFetch();
          } catch (reAuthErr) {
            return jsonResponse({ error: "Dexcom session expired and re-auth failed", detail: reAuthErr.message }, 401);
          }
        } else {
          return jsonResponse({ error: `Dexcom fetch failed: ${e.message}` }, 500);
        }
      }

      // Update last sync time
      await supabaseAdmin
        .from("athlete_connections")
        .update({ dexcom_last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      // Parse readings
      const parsed = (readings as Array<Record<string, unknown>>).map((r) => ({
        timestamp: parseDexcomDate(String(r.WT ?? r.DT ?? "")),
        value: Number(r.Value ?? 0),
        valueMmol: Math.round(Number(r.Value ?? 0) / 18.0182 * 10) / 10, // mg/dL → mmol/L
        trend: String(r.Trend ?? ""),
      }));

      return jsonResponse({ readings: parsed });
    }

    // ─── disconnect ──────────────────────────────────────────────────────────
    if (action === "disconnect") {
      // Load vault_id first to clean up Vault
      const { data: conn } = await supabaseAdmin
        .from("athlete_connections")
        .select("dexcom_password_vault_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (conn?.dexcom_password_vault_id) {
        try {
          await supabaseAdmin.rpc("vault_delete_secret" as never, {
            secret_id: conn.dexcom_password_vault_id,
          });
        } catch {
          // ignore vault errors
        }
      }

      await supabaseAdmin
        .from("athlete_connections")
        .update({
          dexcom_username: null,
          dexcom_password_vault_id: null,
          dexcom_session_id: null,
          dexcom_access_token: null,
          dexcom_connected: false,
          dexcom_connected_at: null,
          dexcom_last_error: null,
          dexcom_last_sync_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return jsonResponse({ success: true });
    }

    // ─── check-status ─────────────────────────────────────────────────────────
    if (action === "check-status") {
      const { data: conn } = await supabaseAdmin
        .from("athlete_connections")
        .select("dexcom_connected, dexcom_username, dexcom_connected_at, dexcom_last_sync_at, dexcom_last_error")
        .eq("user_id", userId)
        .maybeSingle();

      if (!conn) {
        return jsonResponse({ connected: false });
      }

      return jsonResponse({
        connected: conn.dexcom_connected ?? false,
        username: conn.dexcom_username ?? null,
        connectedAt: conn.dexcom_connected_at ?? null,
        lastSyncAt: conn.dexcom_last_sync_at ?? null,
        lastError: conn.dexcom_last_error ?? null,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message || "Internal error" }, 500);
  }
});
