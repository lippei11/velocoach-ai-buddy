import { useState, useCallback, useEffect } from "react";
import { format, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface WellnessRecord {
  id: string;
  date: string;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  ramp_rate: number | null;
  hrv: number | null;
  resting_hr: number | null;
  sleep_score: number | null;
  weight: number | null;
}

export interface Activity {
  id: string;
  external_id: string;
  name: string | null;
  sport_type: string | null;
  start_date: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  tss: number | null;
  normalized_power: number | null;
  ftp_at_time: number | null;
  avg_hr: number | null;
  intensity_factor: number | null;
}

export interface WeeklyTSS {
  week: string;
  tss: number;
}

export type DashboardState = "loading" | "not-connected" | "no-data" | "error" | "ready";

export function useIntervalsData() {
  const [wellness, setWellness] = useState<WellnessRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [athleteName, setAthleteName] = useState<string | null>(null);

  const syncAndReload = useCallback(async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("intervals-proxy", {
        body: { action: "sync" },
      });
    } catch (e) {
      console.error("Auto-sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }, []);

  const fetchData = useCallback(async (autoSync = true) => {
    setLoading(true);
    setError(null);
    setNotConnected(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Bitte melde dich an, um deine Daten zu sehen.");
        setLoading(false);
        return;
      }

      // Check connection
      const checkRes = await supabase.functions.invoke("intervals-proxy", {
        body: { action: "check-connection" },
      });

      if (!checkRes.data?.connected) {
        setNotConnected(true);
        setLoading(false);
        return;
      }

      setLastSyncAt(checkRes.data.lastSyncAt ?? null);

      // Read from Supabase tables (synced data) + athlete profile
      const [wellnessRes, activitiesRes, profileRes] = await Promise.all([
        supabase
          .from("wellness_days")
          .select("*")
          .eq("user_id", session.user.id)
          .order("date", { ascending: true })
          .limit(42),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", session.user.id)
          .order("start_date", { ascending: false })
          .limit(200),
        supabase
          .from("athlete_profiles")
          .select("name")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (wellnessRes.error) throw new Error(wellnessRes.error.message);
      if (activitiesRes.error) throw new Error(activitiesRes.error.message);

      setAthleteName(profileRes.data?.name ?? null);

      const wellnessData: WellnessRecord[] = (wellnessRes.data ?? []).map((w) => ({
        id: w.id,
        date: w.date,
        ctl: w.ctl,
        atl: w.atl,
        tsb: w.tsb,
        ramp_rate: w.ramp_rate,
        hrv: w.hrv,
        resting_hr: w.resting_hr,
        sleep_score: w.sleep_score,
        weight: w.weight,
      }));

      const activityData: Activity[] = (activitiesRes.data ?? []).map((a) => ({
        id: a.id,
        external_id: a.external_id,
        name: a.name,
        sport_type: a.sport_type,
        start_date: a.start_date,
        duration_seconds: a.duration_seconds,
        distance_meters: a.distance_meters,
        tss: a.tss ? Number(a.tss) : null,
        normalized_power: a.normalized_power,
        ftp_at_time: a.ftp_at_time,
        avg_hr: a.avg_hr,
        intensity_factor: a.intensity_factor ? Number(a.intensity_factor) : null,
      }));

      setWellness(wellnessData);
      setActivities(activityData);

      // Auto-sync if connected but no data yet
      if (autoSync && wellnessData.length === 0 && activityData.length === 0) {
        await syncAndReload();
        // Re-fetch after sync (without triggering another auto-sync)
        await fetchData(false);
        return;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latestWellness = wellness.length > 0 ? wellness[wellness.length - 1] : null;
  const last14Wellness = wellness.slice(-14);

  // Current week TSS
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const currentWeekTSS = activities
    .filter((a) => {
      const d = new Date(a.start_date);
      return d >= currentWeekStart && d <= currentWeekEnd;
    })
    .reduce((sum, a) => sum + (a.tss || 0), 0);

  // Weekly TSS last 8 weeks
  const weeklyTSS: WeeklyTSS[] = (() => {
    const weeks: WeeklyTSS[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const tss = activities
        .filter((a) => {
          const d = new Date(a.start_date);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((sum, a) => sum + (a.tss || 0), 0);
      weeks.push({ week: format(weekStart, "MMM d"), tss: Math.round(tss) });
    }
    return weeks;
  })();

  // Derive dashboard state
  let state: DashboardState = "ready";
  if (loading) state = "loading";
  else if (notConnected) state = "not-connected";
  else if (error) state = "error";
  else if (activities.length === 0 && wellness.length === 0) state = "no-data";

  return {
    state,
    wellness,
    activities,
    latestWellness,
    last14Wellness,
    currentWeekTSS: Math.round(currentWeekTSS),
    weeklyTSS,
    loading,
    error,
    notConnected,
    lastSyncAt,
    athleteName,
    refresh: fetchData,
  };
}
