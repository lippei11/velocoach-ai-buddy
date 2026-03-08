import { useState, useCallback, useEffect } from "react";
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from "date-fns";

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

function getAuth() {
  const athleteId = localStorage.getItem("intervals_athlete_id");
  const apiKey = localStorage.getItem("intervals_api_key");
  if (!athleteId || !apiKey) return null;
  return {
    athleteId,
    headers: {
      Authorization: "Basic " + btoa(`API_KEY:${apiKey}`),
    },
  };
}

export function useIntervalsData() {
  const [wellness, setWellness] = useState<WellnessRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const auth = getAuth();
    if (!auth) {
      setError("No Intervals.icu credentials found. Please connect your account.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const today = format(new Date(), "yyyy-MM-dd");
    const oldest = format(subDays(new Date(), 30), "yyyy-MM-dd");

    try {
      const [wellnessRes, activitiesRes] = await Promise.all([
        fetch(
          `https://intervals.icu/api/v1/athlete/${auth.athleteId}/wellness?oldest=${oldest}&newest=${today}`,
          { headers: auth.headers }
        ),
        fetch(
          `https://intervals.icu/api/v1/athlete/${auth.athleteId}/activities?oldest=${oldest}&newest=${today}&fields=name,type,start_date_local,moving_time,distance,icu_training_load,icu_weighted_avg_watts,icu_ftp,sport_info`,
          { headers: auth.headers }
        ),
      ]);

      if (!wellnessRes.ok || !activitiesRes.ok) {
        throw new Error("Failed to fetch data from Intervals.icu");
      }

      const wellnessData = await wellnessRes.json();
      const activitiesData = await activitiesRes.json();

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

  // Derived data
  const latestWellness = wellness.length > 0 ? wellness[wellness.length - 1] : null;
  const prevWellness = wellness.length > 1 ? wellness[wellness.length - 2] : null;

  const last7Wellness = wellness.slice(-7);

  // Weekly TSS from activities (last 8 weeks)
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
