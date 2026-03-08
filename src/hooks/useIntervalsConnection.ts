import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnectionStatus = "disconnected" | "connected" | "error" | "loading";

export interface ConnectionState {
  status: ConnectionStatus;
  athleteId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface SyncResult {
  success: boolean;
  profile: boolean;
  activities: number;
  wellness: number;
  errors: string[];
}

const INITIAL_STATE: ConnectionState = {
  status: "loading",
  athleteId: null,
  connectedAt: null,
  lastSyncAt: null,
  lastError: null,
};

async function callProxy(action: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await supabase.functions.invoke("intervals-proxy", {
    body: { action, ...extra },
  });

  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function useIntervalsConnection() {
  const [state, setState] = useState<ConnectionState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      setState((s) => ({ ...s, status: "loading" }));
      const data = await callProxy("check-connection");
      setState({
        status: data.status ?? (data.connected ? "connected" : "disconnected"),
        athleteId: data.athleteId ?? null,
        connectedAt: data.connectedAt ?? null,
        lastSyncAt: data.lastSyncAt ?? null,
        lastError: data.lastError ?? null,
      });
    } catch {
      setState({ ...INITIAL_STATE, status: "disconnected" });
    }
  }, []);

  const saveCredentials = useCallback(async (athleteId: string, apiKey: string) => {
    setSaving(true);
    try {
      const data = await callProxy("save-credentials", { athleteId, apiKey });
      if (data.error) {
        setState((s) => ({ ...s, status: "error", lastError: data.error }));
        return { success: false, error: data.error };
      }
      setState({
        status: "connected",
        athleteId,
        connectedAt: new Date().toISOString(),
        lastSyncAt: null,
        lastError: null,
      });
      return { success: true, athleteName: data.athleteName };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, status: "error", lastError: msg }));
      return { success: false, error: msg };
    } finally {
      setSaving(false);
    }
  }, []);

  const testConnection = useCallback(async () => {
    try {
      setState((s) => ({ ...s, status: "loading" }));
      const data = await callProxy("test-connection");
      setState((s) => ({
        ...s,
        status: data.connected ? "connected" : "error",
        lastError: data.error ?? null,
      }));
      return { connected: data.connected, error: data.error };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, status: "error", lastError: msg }));
      return { connected: false, error: msg };
    }
  }, []);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    setSyncing(true);
    setLastSyncResult(null);
    try {
      const data = await callProxy("sync");
      const result: SyncResult = {
        success: data.success ?? false,
        profile: data.profile ?? false,
        activities: data.activities ?? 0,
        wellness: data.wellness ?? 0,
        errors: data.errors ?? [],
      };
      setLastSyncResult(result);
      // Update lastSyncAt in state
      setState((s) => ({ ...s, lastSyncAt: new Date().toISOString() }));
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const result: SyncResult = { success: false, profile: false, activities: 0, wellness: 0, errors: [msg] };
      setLastSyncResult(result);
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await callProxy("disconnect");
      setState({ ...INITIAL_STATE, status: "disconnected" });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: msg };
    }
  }, []);

  return { ...state, saving, syncing, lastSyncResult, checkConnection, saveCredentials, testConnection, syncNow, disconnect };
}
