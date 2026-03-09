import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DexcomStatus {
  connected: boolean;
  username: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

interface GlucoseReading {
  timestamp: string;
  value: number;       // mg/dL
  valueMmol: number;   // mmol/L
  trend: string;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dexcom-sync`;

async function callDexcomSync(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export function useDexcomConnection() {
  const [status, setStatus] = useState<DexcomStatus>({
    connected: false,
    username: null,
    connectedAt: null,
    lastSyncAt: null,
    lastError: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await callDexcomSync({ action: "check-status" });
      setStatus({
        connected: data.connected ?? false,
        username: data.username ?? null,
        connectedAt: data.connectedAt ?? null,
        lastSyncAt: data.lastSyncAt ?? null,
        lastError: data.lastError ?? null,
      });
    } catch {
      // ignore — user may not have any connection row yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async (username: string, password: string) => {
    setError(null);
    setSaving(true);
    try {
      const data = await callDexcomSync({ action: "save-credentials", username, password });
      if (data.connected) {
        await refresh();
      }
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const syncGlucose = useCallback(async (minutes = 1440): Promise<GlucoseReading[]> => {
    setSyncing(true);
    try {
      const data = await callDexcomSync({ action: "sync-glucose", minutes });
      await refresh();
      return data.readings ?? [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      setError(msg);
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await callDexcomSync({ action: "disconnect" });
      setStatus({ connected: false, username: null, connectedAt: null, lastSyncAt: null, lastError: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Disconnect failed";
      setError(msg);
    } finally {
      setDisconnecting(false);
    }
  }, []);

  return {
    status,
    loading,
    saving,
    syncing,
    disconnecting,
    error,
    connect,
    syncGlucose,
    disconnect,
    refresh,
  };
}
