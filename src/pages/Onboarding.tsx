import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, ChevronDown, Loader2, Target } from "lucide-react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAthletePreferences } from "@/hooks/useAthletePreferences";

const DEMAND_PROFILES = [
  { value: "steady_climbing", label: "Gran Fondo (Alpine / Hilly)" },
  { value: "long_gravel", label: "Gran Fondo (Gravel / Flat)" },
  { value: "time_trial", label: "Time Trial / Triathlon" },
  { value: "punchy_stochastic", label: "Criterium / Road Race" },
  { value: "ultra_endurance", label: "Ultra Endurance (12h+)" },
  { value: "ftp_build", label: "FTP Development" },
  { value: "mixed_hobby_fitness", label: "General Fitness" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { prefs, setPrefs, save } = useAthletePreferences();

  // Step management
  const [step, setStep] = useState<"connect" | "setup">("connect");

  // Step 1: Intervals connection
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [dexcomOpen, setDexcomOpen] = useState(false);

  // Step 2: Training setup
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [eventDate, setEventDate] = useState<Date | undefined>(
    prefs.event_date ? new Date(prefs.event_date) : undefined
  );

  const handleConnect = async () => {
    if (!athleteId.trim() || !apiKey.trim()) {
      toast.error("Please enter both Athlete ID and API Key");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please sign in first");
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("intervals-proxy", {
        body: {
          action: "save-credentials",
          athleteId: athleteId.trim(),
          apiKey: apiKey.trim(),
        },
      });

      if (res.error || res.data?.error) {
        throw new Error(res.data?.error || res.error?.message || "Failed to save credentials");
      }

      toast.success("Connected successfully!");
      setStep("setup");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials — check your Athlete ID and API Key");
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    const days = prefs.available_days.includes(day)
      ? prefs.available_days.filter((d) => d !== day)
      : [...prefs.available_days, day];
    setPrefs({ ...prefs, available_days: days });
  };

  const handleSaveSetup = async () => {
    setSavingPrefs(true);
    const updated = {
      ...prefs,
      event_date: eventDate ? format(eventDate, "yyyy-MM-dd") : "",
    };
    const ok = await save(updated);
    setSavingPrefs(false);
    if (ok) {
      toast.success("Training setup saved!");
      navigate("/dashboard");
    } else {
      toast.error("Failed to save — please try again");
    }
  };

  if (step === "setup") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl font-semibold">Your Training Setup</CardTitle>
            <CardDescription>
              Tell us about your goals so we can build your plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Event demand profile */}
            <div className="space-y-2">
              <Label>Event type / focus</Label>
              <Select
                value={prefs.event_demand_profile}
                onValueChange={(v) => setPrefs({ ...prefs, event_demand_profile: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your focus" />
                </SelectTrigger>
                <SelectContent>
                  {DEMAND_PROFILES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event date */}
            <div className="space-y-2">
              <Label>Target event date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !eventDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {eventDate ? format(eventDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={eventDate}
                    onSelect={setEventDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Hours per week */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Weekly training hours</Label>
                <span className="text-sm font-medium text-foreground">
                  {prefs.hours_per_week}h
                </span>
              </div>
              <Slider
                min={3}
                max={15}
                step={1}
                value={[prefs.hours_per_week]}
                onValueChange={([v]) => setPrefs({ ...prefs, hours_per_week: v })}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>3h</span>
                <span>15h</span>
              </div>
            </div>

            {/* Available days */}
            <div className="space-y-2">
              <Label>Available training days</Label>
              <div className="flex gap-1.5">
                {DAYS.map((day) => {
                  const active = prefs.available_days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "flex-1 rounded-md py-2 text-xs font-medium transition-colors border",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSaveSetup}
              disabled={savingPrefs}
            >
              {savingPrefs && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save & Continue
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/dashboard")}
            >
              Skip for now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bike className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl font-semibold">Connect your training data</CardTitle>
          <CardDescription>
            Link your Intervals.icu account to get started with VeloCoach AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="athleteId">Athlete ID</Label>
            <Input
              id="athleteId"
              placeholder="e.g. i12345"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Intervals.icu profile URL
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Your Intervals.icu API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Settings → Developer Settings → Generate API Key
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Connect & Continue
          </Button>

          <Collapsible open={dexcomOpen} onOpenChange={setDexcomOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <span>Dexcom CGM (optional)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${dexcomOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="dexcom-toggle" className="text-sm cursor-pointer">
                  I use a Dexcom CGM
                </Label>
                <Switch id="dexcom-toggle" />
              </div>
              <p className="text-xs text-muted-foreground">
                Dexcom integration coming soon. Toggle this to be notified when it's available.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}
