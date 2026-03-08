import { useState, useCallback, useEffect } from "react";
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface WellnessRecord {
  id: string;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
  rampRate: number | null;
  hrv: number | null;
  hrvSDNN: number | null;
  sleepScore: number | null;
  restingHR: number | null;
  weight: number | null;
  date?: string;
}

export interface Activity {
  id: string;
  name: string;
  type: string;
  start_date_local: string;
  moving_time: number;
  distance: number;
  icu_training_load: number | null;
  icu_weighted_avg_watts: number | null;
  icu_ftp: number | null;
  sport_info?: { icon?: string; color?: string };
}

export interface WeeklyTSS {
  week: string;
  tss: number;
}

async function proxyFetch(endpoint: string, params: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated. Please log in.");

  const res = await supabase.functions.invoke("intervals-proxy", {
    body: { action: "fetch", endpoint, params },
  });

  if (res.error) throw new Error(res.error.message || "Proxy request failed");
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export function useIntervalsData() {
  const [wellness, setWellness] = useState<WellnessRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);

    try {
      // Check connection first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated. Please log in.");
        setLoading(false);
        return;
      }

      const checkRes = await supabase.functions.invoke("intervals-proxy", {
        body: { action: "check-connection" },
      });

      if (!checkRes.data?.connected) {
        setNotConnected(true);
        setLoading(false);
        return;
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const oldest42 = format(subDays(new Date(), 42), "yyyy-MM-dd");
      const oldest60 = format(subDays(new Date(), 60), "yyyy-MM-dd");

      const [wellnessData, activitiesData] = await Promise.all([
        proxyFetch("wellness", { oldest: oldest42, newest: today }),
        proxyFetch("activities", {
          oldest: oldest60,
          newest: today,
          fields: "name,type,start_date_local,moving_time,distance,icu_training_load,icu_weighted_avg_watts,icu_ftp,sport_info",
        }),
      ]);

      setWellness(Array.isArray(wellnessData) ? wellnessData : []);
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
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
      const d = new Date(a.start_date_local);
      return d >= currentWeekStart && d <= currentWeekEnd;
    })
    .reduce((sum, a) => sum + (a.icu_training_load || 0), 0);

  // Weekly TSS last 8 weeks
  const weeklyTSS: WeeklyTSS[] = (() => {
    const weeks: WeeklyTSS[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const tss = activities
        .filter((a) => {
          const d = new Date(a.start_date_local);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
      weeks.push({ week: format(weekStart, "MMM d"), tss: Math.round(tss) });
    }
    return weeks;
  })();

  return {
    wellness,
    activities,
    latestWellness,
    last14Wellness,
    currentWeekTSS: Math.round(currentWeekTSS),
    weeklyTSS,
    loading,
    error,
    notConnected,
    refresh: fetchData,
  };
}
