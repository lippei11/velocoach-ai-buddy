import { useState, useCallback, useEffect } from "react";
import { format, subWeeks, addWeeks } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { PlannedWorkout, DayData } from "@/types/trainingPlan";
import { classifyWorkout, WORKOUT_COLORS } from "@/lib/planUtils";

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

export function useTrainingPlanData() {
  const [plannedWorkouts, setPlannedWorkouts] = useState<PlannedWorkout[]>([]);
  const [completedMap, setCompletedMap] = useState<Map<string, DayData["completed"]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const today = format(new Date(), "yyyy-MM-dd");
    const pastStart = format(subWeeks(new Date(), 4), "yyyy-MM-dd");
    const futureEnd = format(addWeeks(new Date(), 4), "yyyy-MM-dd");

    try {
      const [events, activities] = await Promise.all([
        proxyFetch("events", { oldest: today, newest: futureEnd, category: "WORKOUT" }),
        proxyFetch("activities", {
          oldest: pastStart,
          newest: today,
          fields: "name,type,start_date_local,moving_time,icu_training_load,icu_weighted_avg_watts,icu_ftp",
        }),
      ]);

      const planned: PlannedWorkout[] = (events || []).map((e: any) => {
        const wType = classifyWorkout(e.name || "", e.category);
        return {
          id: e.id?.toString() || Math.random().toString(),
          date: e.start_date_local?.split("T")[0] || "",
          name: e.name || "Workout",
          category: e.category || "",
          description: e.description || "",
          duration: e.moving_time || e.duration || 0,
          tssTarget: e.icu_training_load || e.load_target || null,
          workoutType: wType,
          color: WORKOUT_COLORS[wType],
        };
      });

      const cMap = new Map<string, DayData["completed"]>();
      for (const a of activities || []) {
        const date = a.start_date_local?.split("T")[0];
        if (!date) continue;
        cMap.set(date, {
          id: a.id,
          date,
          name: a.name || "",
          type: a.type || "",
          movingTime: a.moving_time || 0,
          tss: a.icu_training_load,
          avgPower: a.icu_weighted_avg_watts,
          ftp: a.icu_ftp,
        });
      }

      setPlannedWorkouts(planned);
      setCompletedMap(cMap);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { plannedWorkouts, completedMap, loading, error, refresh: fetchData };
}
