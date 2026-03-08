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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = format(new Date(), "yyyy-MM-dd");
    const oldest = format(subDays(new Date(), 30), "yyyy-MM-dd");

    try {
      const [wellnessData, activitiesData] = await Promise.all([
        proxyFetch("wellness", { oldest, newest: today }),
        proxyFetch("activities", {
          oldest,
          newest: today,
          fields: "name,type,start_date_local,moving_time,distance,icu_training_load,icu_weighted_avg_watts,icu_ftp,sport_info",
        }),
      ]);

      setWellness(wellnessData);
      setActivities(activitiesData);
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
  const prevWellness = wellness.length > 1 ? wellness[wellness.length - 2] : null;
  const last7Wellness = wellness.slice(-7);

  const weeklyTSS: WeeklyTSS[] = (() => {
    const weeks: WeeklyTSS[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekActivities = activities.filter((a) => {
        const d = new Date(a.start_date_local);
        return d >= weekStart && d <= weekEnd;
      });
      const tss = weekActivities.reduce((sum, a) => sum + (a.icu_training_load || 0), 0);
      weeks.push({ week: format(weekStart, "MMM d"), tss: Math.round(tss) });
    }
    return weeks;
  })();

  return {
    wellness,
    activities,
    latestWellness,
    prevWellness,
    last7Wellness,
    weeklyTSS,
    loading,
    error,
    refresh: fetchData,
  };
}
