import { useState } from "react";
import { Settings, User, Dumbbell, Puzzle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import IntervalsConnectionCard from "@/components/settings/IntervalsConnectionCard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsPage() {
  // Athlete Profile (stub)
  const [name, setName] = useState("Alex Rider");
  const [ftp, setFtp] = useState("260");
  const [weight, setWeight] = useState("72");
  const [experience, setExperience] = useState("intermediate");
  // Training Preferences (stub)
  const [trainingDays, setTrainingDays] = useState(["Tue", "Thu", "Sat", "Sun"]);
  const [hoursPerWeek, setHoursPerWeek] = useState([10]);
  const [preferOutdoor, setPreferOutdoor] = useState(true);

  const toggleDay = (day: string) => {
    setTrainingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    toast.success("Settings saved (mock)");
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* 1. Athlete Profile */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Athlete Profile</CardTitle>
          </div>
          <CardDescription>Your physical stats and training background</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="experience" className="text-xs">Experience Level</Label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger id="experience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ftp" className="text-xs">FTP (watts)</Label>
              <Input id="ftp" type="number" value={ftp} onChange={(e) => setFtp(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight" className="text-xs">Weight (kg)</Label>
              <Input id="weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave}>Save Profile</Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Intervals.icu */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Intervals.icu</CardTitle>
            </div>
            <Badge
              variant={intervalsConnected ? "default" : "destructive"}
              className="gap-1.5"
            >
              {intervalsConnected ? (
                <><CheckCircle2 className="h-3 w-3" /> Connected</>
              ) : (
                <><XCircle className="h-3 w-3" /> Disconnected</>
              )}
            </Badge>
          </div>
          <CardDescription>Sync activities, wellness data, and planned workouts</CardDescription>
        </CardHeader>
        <CardContent>
          {intervalsConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wifi className="h-4 w-4 text-success" />
                <span>Athlete ID: <span className="font-mono text-foreground">i12345</span></span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toast.info("Reconnect flow (mock)")}>
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => { setIntervalsConnected(false); toast.success("Disconnected (mock)"); }}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WifiOff className="h-4 w-4" />
                <span>No account linked</span>
              </div>
              <Button size="sm" onClick={() => { setIntervalsConnected(true); toast.success("Connected (mock)"); }}>
                Connect
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Training Preferences */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Training Preferences</CardTitle>
          </div>
          <CardDescription>Default availability and training style</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Available Days */}
          <div className="space-y-2">
            <Label className="text-xs">Available Training Days</Label>
            <div className="flex gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                    trainingDays.includes(d)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Weekly Hours */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Weekly Hours</Label>
              <span className="text-sm font-mono font-medium">{hoursPerWeek[0]}h</span>
            </div>
            <Slider min={5} max={20} step={0.5} value={hoursPerWeek} onValueChange={setHoursPerWeek} />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5h</span>
              <span>20h</span>
            </div>
          </div>

          <Separator />

          {/* Indoor / Outdoor */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs">Prefer Outdoor Rides</Label>
              <p className="text-[11px] text-muted-foreground">
                When enabled, workouts default to outdoor format
              </p>
            </div>
            <Switch checked={preferOutdoor} onCheckedChange={setPreferOutdoor} />
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave}>Save Preferences</Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Integrations */}
      <Card className="opacity-50 pointer-events-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base text-muted-foreground">Dexcom CGM</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px]">Coming in a future version</Badge>
          </div>
          <CardDescription>
            Real-time glucose monitoring for fueling insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Not available yet</span>
            <Button size="sm" variant="outline" disabled>Connect</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
