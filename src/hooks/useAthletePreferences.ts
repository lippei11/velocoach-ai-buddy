import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AthletePreferences {
  goal_type: string;
  event_name: string;
  event_date: string;
  event_demand_profile: string;
  hours_per_week: number;
  available_days: string[];
  prefer_outdoor_long_ride: boolean;
  prefer_indoor_intervals: boolean;
  strength_sessions_per_week: number;
  constraints_notes: string;
}

const DEFAULTS: AthletePreferences = {
  goal_type: "event",
  event_name: "",
  event_date: "",
  event_demand_profile: "road_race",
  hours_per_week: 10,
  available_days: ["Tue", "Thu", "Sat", "Sun"],
  prefer_outdoor_long_ride: true,
  prefer_indoor_intervals: true,
  strength_sessions_per_week: 0,
  constraints_notes: "",
};

export function useAthletePreferences() {
  const [prefs, setPrefs] = useState<AthletePreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("athlete_preferences" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const d = data as any;
      setPrefs({
        goal_type: d.goal_type ?? DEFAULTS.goal_type,
        event_name: d.event_name ?? "",
        event_date: d.event_date ?? "",
        event_demand_profile: d.event_demand_profile ?? DEFAULTS.event_demand_profile,
        hours_per_week: d.hours_per_week ?? DEFAULTS.hours_per_week,
        available_days: d.available_days ?? DEFAULTS.available_days,
        prefer_outdoor_long_ride: d.prefer_outdoor_long_ride ?? DEFAULTS.prefer_outdoor_long_ride,
        prefer_indoor_intervals: d.prefer_indoor_intervals ?? DEFAULTS.prefer_indoor_intervals,
        strength_sessions_per_week: d.strength_sessions_per_week ?? DEFAULTS.strength_sessions_per_week,
        constraints_notes: d.constraints_notes ?? "",
      });
      setUpdatedAt(d.updated_at ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updated: AthletePreferences) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return false; }

    const row = {
      user_id: user.id,
      ...updated,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from("athlete_preferences" as any) as any)
      .upsert(row, { onConflict: "user_id" });

    setSaving(false);
    if (error) return false;
    setPrefs(updated);
    return true;
  }, []);

  return { prefs, setPrefs, loading, saving, save };
}
