import { Settings, Target, Link2, Dumbbell, Calendar, Clock, Mountain, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import IntervalsConnectionCard from "@/components/settings/IntervalsConnectionCard";
import DexcomConnectionCard from "@/components/settings/DexcomConnectionCard";
import { useAthletePreferences } from "@/hooks/useAthletePreferences";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEMAND_PROFILES = [
  { value: "steady_climbing", label: "Gran Fondo (Alpine / Hilly)" },
  { value: "long_gravel", label: "Gran Fondo (Gravel / Flat)" },
  { value: "time_trial", label: "Time Trial / Triathlon" },
  { value: "punchy_stochastic", label: "Criterium / Road Race" },
  { value: "ultra_endurance", label: "Ultra Endurance (12h+)" },
  { value: "ftp_build", label: "FTP Development" },
  { value: "mixed_hobby_fitness", label: "General Fitness" },
];

export default function SettingsPage() {
  const { prefs, setPrefs, loading, saving, save } = useAthletePreferences();

  const toggleDay = (day: string) => {
    setPrefs((p) => ({
      ...p,
      available_days: p.available_days.includes(day)
        ? p.available_days.filter((d) => d !== day)
        : [...p.available_days, day],
    }));
  };

  const handleSaveSetup = async () => {
    const ok = await save(prefs);
    if (ok) toast.success("Training setup saved");
    else toast.error("Failed to save training setup");
  };

  return (
    <div className="space-y-10 max-w-2xl">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 1: TRAINING SETUP
          ═══════════════════════════════════════════ */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Training Setup</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Your coaching profile — goal, schedule, and training preferences. The AI coach uses these to build and adjust your plan.
        </p>

        {loading ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* ── Goal & Event ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Mountain className="h-3.5 w-3.5 text-muted-foreground" />
                  Goal &amp; Event
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="goal-type" className="text-xs">Goal Type</Label>
                    <Select value={prefs.goal_type} onValueChange={(v) => setPrefs((p) => ({ ...p, goal_type: v }))}>
                      <SelectTrigger id="goal-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">Target Event</SelectItem>
                        <SelectItem value="general_fitness">General Fitness</SelectItem>
                        <SelectItem value="base_building">Base Building</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="demand-profile" className="text-xs">Event Demand Profile</Label>
                    <Select value={prefs.event_demand_profile} onValueChange={(v) => setPrefs((p) => ({ ...p, event_demand_profile: v }))}>
                      <SelectTrigger id="demand-profile"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEMAND_PROFILES.map((dp) => (
                          <SelectItem key={dp.value} value={dp.value}>{dp.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="event-name" className="text-xs">Event Name</Label>
                    <Input
                      id="event-name"
                      placeholder="e.g. Ötztaler Radmarathon"
                      value={prefs.event_name}
                      onChange={(e) => setPrefs((p) => ({ ...p, event_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="event-date" className="text-xs">Event Date</Label>
                    <Input
                      id="event-date"
                      type="date"
                      value={prefs.event_date}
                      onChange={(e) => setPrefs((p) => ({ ...p, event_date: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Schedule ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Availability
                </h3>

                <div className="space-y-2">
                  <Label className="text-xs">Available Training Days</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDay(d)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                          prefs.available_days.includes(d)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Weekly Hours</Label>
                    <span className="text-sm font-mono font-medium">{prefs.hours_per_week}h</span>
                  </div>
                  <Slider
                    min={3}
                    max={25}
                    step={0.5}
                    value={[prefs.hours_per_week]}
                    onValueChange={([v]) => setPrefs((p) => ({ ...p, hours_per_week: v }))}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>3h</span>
                    <span>25h</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Training Style ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                  Training Style
                </h3>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Prefer Outdoor Long Rides</Label>
                    <p className="text-[11px] text-muted-foreground">Long endurance sessions default to outdoor</p>
                  </div>
                  <Switch
                    checked={prefs.prefer_outdoor_long_ride}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, prefer_outdoor_long_ride: v }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">Prefer Indoor Intervals</Label>
                    <p className="text-[11px] text-muted-foreground">High-intensity sessions default to trainer</p>
                  </div>
                  <Switch
                    checked={prefs.prefer_indoor_intervals}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, prefer_indoor_intervals: v }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Strength Sessions / Week</Label>
                    <span className="text-sm font-mono font-medium">{prefs.strength_sessions_per_week}</span>
                  </div>
                  <Slider
                    min={0}
                    max={4}
                    step={1}
                    value={[prefs.strength_sessions_per_week]}
                    onValueChange={([v]) => setPrefs((p) => ({ ...p, strength_sessions_per_week: v }))}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span>4</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* ── Constraints ── */}
              <div className="space-y-2">
                <Label htmlFor="constraints" className="text-xs">Constraints &amp; Notes</Label>
                <Textarea
                  id="constraints"
                  placeholder="e.g. No training on Wednesday evenings, max 90min weekday sessions, lower volume in July…"
                  value={prefs.constraints_notes}
                  onChange={(e) => setPrefs((p) => ({ ...p, constraints_notes: e.target.value }))}
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* Save */}
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={handleSaveSetup} disabled={saving}>
                  {saving ? "Saving…" : "Save Training Setup"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ═══════════════════════════════════════════
          SECTION 2: CONNECTIONS
          ═══════════════════════════════════════════ */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Connections</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          External services for syncing activities, workouts, and health data.
        </p>

        <div className="space-y-4">
          <IntervalsConnectionCard />
          <DexcomConnectionCard />
        </div>
      </section>
    </div>
  );
}
