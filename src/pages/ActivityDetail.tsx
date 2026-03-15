import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft, Bike, Footprints, Waves, Dumbbell, Activity,
  Clock, Zap, Heart, Flame, Bot, Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityRow {
  id: string;
  name: string | null;
  sport_type: string | null;
  start_date: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  tss: number | null;
  normalized_power: number | null;
  intensity_factor: number | null;
  avg_hr: number | null;
  ftp_at_time: number | null;
  raw_data: Record<string, unknown> | null;
  zone_times: Record<string, unknown> | null;
}

interface StreamPoint {
  t: number; // seconds from start
  power?: number;
  hr?: number;
  glucose?: number;
  elevation?: number;
  zone?: number;
}

// ─── Zone helpers ─────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<number, string> = {
  1: "hsl(220 10% 55%)",
  2: "hsl(217 91% 60%)",
  3: "hsl(142 71% 45%)",
  4: "hsl(38 92% 50%)",
  5: "hsl(0 84% 60%)",
  6: "hsl(280 80% 60%)",
};

const ZONE_LABELS = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6"];

function getPowerZone(power: number, ftp: number): number {
  const ratio = power / ftp;
  if (ratio < 0.56) return 1;
  if (ratio < 0.76) return 2;
  if (ratio < 0.91) return 3;
  if (ratio < 1.06) return 4;
  if (ratio < 1.21) return 5;
  return 6;
}

// ─── Mock stream generator ────────────────────────────────────────────────────

function generateMockStreams(durationSeconds: number, ftp: number): StreamPoint[] {
  const points: StreamPoint[] = [];
  const n = Math.min(Math.floor(durationSeconds / 5), 600); // 1 point per 5s, max 600
  let lastPower = ftp * 0.75;
  let lastHr = 140;
  let elevation = 50;

  for (let i = 0; i < n; i++) {
    const t = i * 5;
    lastPower = Math.max(50, Math.min(ftp * 1.5, lastPower + (Math.random() - 0.48) * 30));
    lastHr = Math.max(100, Math.min(195, lastHr + (Math.random() - 0.48) * 4));
    elevation = Math.max(0, elevation + (Math.random() - 0.45) * 3);
    const zone = getPowerZone(lastPower, ftp);
    points.push({
      t,
      power: Math.round(lastPower),
      hr: Math.round(lastHr),
      elevation: Math.round(elevation * 10) / 10,
      zone,
    });
  }
  return points;
}

function generateMockGlucose(durationSeconds: number): StreamPoint[] {
  const n = Math.min(Math.floor(durationSeconds / 300), 24); // every 5 min
  const pts: StreamPoint[] = [];
  let g = 6.5;
  for (let i = 0; i < n; i++) {
    g = Math.max(3.5, Math.min(12, g + (Math.random() - 0.5) * 0.8));
    pts.push({ t: i * 300, glucose: Math.round(g * 10) / 10 });
  }
  return pts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(s: number | null) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDistance(m: number | null) {
  if (!m) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function sportIcon(type: string | null) {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("ride") || t.includes("cycling") || t.includes("virtual")) return <Bike className="h-4 w-4" />;
  if (t.includes("run")) return <Footprints className="h-4 w-4" />;
  if (t.includes("swim")) return <Waves className="h-4 w-4" />;
  if (t.includes("weight") || t.includes("strength")) return <Dumbbell className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function sportLabel(type: string | null) {
  if (!type) return "Activity";
  const t = type.toLowerCase();
  if (t.includes("virtual")) return "Virtual Ride";
  if (t.includes("ride") || t.includes("cycling")) return "Ride";
  if (t.includes("run")) return "Run";
  if (t.includes("swim")) return "Swim";
  return type;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        </div>
        <p className="text-xl font-bold font-mono">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ZoneBar({ zoneTimes }: { zoneTimes: number[] }) {
  const total = zoneTimes.reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">No zone data</p>;

  return (
    <div className="space-y-2">
      <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
        {zoneTimes.map((t, i) => {
          const pct = (t / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div
              key={i}
              style={{ width: `${pct}%`, backgroundColor: ZONE_COLORS[i + 1] }}
              className="transition-all"
            />
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {zoneTimes.map((t, i) => {
          const pct = ((t / total) * 100).toFixed(0);
          return (
            <div key={i} className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ZONE_COLORS[i + 1] }} />
              <span className="text-xs text-muted-foreground">{ZONE_LABELS[i]} {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const chartTooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 11,
  color: "hsl(var(--foreground))",
};

const axisStyle = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
const gridStyle = "hsl(var(--border))";

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [dexcomConnected, setDexcomConnected] = useState(false);
  const [streams, setStreams] = useState<StreamPoint[]>([]);
  const [glucoseStream, setGlucoseStream] = useState<StreamPoint[]>([]);
  const [zoneTimes, setZoneTimes] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const [actRes, connRes] = await Promise.all([
        supabase.from("activities").select("*").eq("id", id).eq("user_id", session.user.id).maybeSingle(),
        supabase.from("athlete_connections").select("dexcom_connected, dexcom_session_id").eq("user_id", session.user.id).maybeSingle(),
      ]);

      const act = actRes.data as ActivityRow | null;
      setActivity(act);

      // Dexcom connected flag from the new dedicated column
      const hasDexcom = !!(connRes.data?.dexcom_connected);
      setDexcomConnected(hasDexcom);

      if (act) {
        const ftp = act.ftp_at_time ?? 250;
        const dur = act.duration_seconds ?? 3600;

        // Try parsing raw_data streams, else mock
        const rawData = act.raw_data as Record<string, unknown> | null;
        let streamPoints: StreamPoint[] = [];

        if (rawData && Array.isArray(rawData.watts) && rawData.watts.length > 0) {
          const watts = rawData.watts as number[];
          const heartrate = Array.isArray(rawData.heartrate) ? rawData.heartrate as number[] : [];
          const altitudeArr = Array.isArray(rawData.altitude) ? rawData.altitude as number[] : [];
          streamPoints = watts.map((w, i) => ({
            t: i,
            power: w,
            hr: heartrate[i] ?? undefined,
            elevation: altitudeArr[i] ?? undefined,
            zone: getPowerZone(w, ftp),
          }));
        } else {
          streamPoints = generateMockStreams(dur, ftp);
        }

        setStreams(streamPoints);

        if (hasDexcom) {
          // Fetch real glucose readings from edge function for this activity's time window
          try {
            const durationMins = Math.ceil((act.duration_seconds ?? 3600) / 60) + 30;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const res = await fetch(`${supabaseUrl}/functions/v1/dexcom-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ action: "sync-glucose", minutes: durationMins }),
            });
            if (res.ok) {
              const json = await res.json();
              if (Array.isArray(json.readings) && json.readings.length > 0) {
                // Convert timestamps to seconds-offset from activity start
                const actStart = new Date(act.start_date).getTime();
                const pts: StreamPoint[] = json.readings
                  .map((r: { timestamp: string; valueMmol: number }) => ({
                    t: Math.max(0, Math.round((new Date(r.timestamp).getTime() - actStart) / 1000)),
                    glucose: r.valueMmol,
                  }))
                  .filter((p: StreamPoint) => p.t >= 0 && p.t <= (act.duration_seconds ?? 86400));
                if (pts.length > 0) {
                  setGlucoseStream(pts);
                } else {
                  setGlucoseStream(generateMockGlucose(dur));
                }
              } else {
                setGlucoseStream(generateMockGlucose(dur));
              }
            } else {
              setGlucoseStream(generateMockGlucose(dur));
            }
          } catch {
            setGlucoseStream(generateMockGlucose(dur));
          }
        }

        // Zone times — parse zone_times jsonb or derive from streams
        const zt = act.zone_times as Record<string, unknown> | null;
        if (zt && typeof zt === "object") {
          const parsed = [1, 2, 3, 4, 5, 6].map((z) => {
            const v = zt[`z${z}`] ?? zt[String(z)] ?? 0;
            return typeof v === "number" ? v : 0;
          });
          if (parsed.some((v) => v > 0)) {
            setZoneTimes(parsed);
          } else {
            // Derive from stream
            const counts = [0, 0, 0, 0, 0, 0];
            streamPoints.forEach((p) => { if (p.zone) counts[p.zone - 1]++; });
            setZoneTimes(counts);
          }
        } else {
          const counts = [0, 0, 0, 0, 0, 0];
          streamPoints.forEach((p) => { if (p.zone) counts[p.zone - 1]++; });
          setZoneTimes(counts);
        }
      }

      setLoading(false);
    }

    load();
  }, [id]);

  // ─── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Activity className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Activity not found.</p>
        <Button variant="outline" onClick={() => navigate("/activities")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Alle Aktivitäten
        </Button>
      </div>
    );
  }

  const ftp = activity.ftp_at_time ?? 250;
  const kj = activity.normalized_power && activity.duration_seconds
    ? Math.round((activity.normalized_power * activity.duration_seconds) / 1000)
    : null;

  const avgPowerEst = activity.normalized_power
    ? Math.round(activity.normalized_power * (activity.intensity_factor ?? 0.75))
    : null;

  const maxHrEst = activity.avg_hr ? Math.round(activity.avg_hr * 1.12) : null;
  const maxPowerEst = activity.normalized_power ? Math.round(activity.normalized_power * 1.35) : null;

  const dateStr = (() => {
    try { return format(new Date(activity.start_date), "EEEE, MMMM d, yyyy"); }
    catch { return activity.start_date; }
  })();

  // Elevation gain estimate
  const elevGain = streams.length > 0
    ? Math.round(streams.reduce((gain, p, i) => {
        if (i === 0) return gain;
        const delta = (p.elevation ?? 0) - (streams[i - 1].elevation ?? 0);
        return gain + (delta > 0 ? delta : 0);
      }, 0))
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">

      {/* ── Back nav ── */}
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/activities")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Alle Aktivitäten
      </Button>

      {/* ── Header ── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1.5 text-xs">
                  {sportIcon(activity.sport_type)}
                  {sportLabel(activity.sport_type)}
                </Badge>
                <span className="text-xs text-muted-foreground">{dateStr}</span>
              </div>
              <h1 className="text-2xl font-bold">{activity.name || "Untitled Activity"}</h1>
            </div>

            <div className="flex gap-6 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Duration</p>
                <p className="text-lg font-bold font-mono">{formatDuration(activity.duration_seconds)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Distance</p>
                <p className="text-lg font-bold font-mono">{formatDistance(activity.distance_meters)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Elevation</p>
                <p className="text-lg font-bold font-mono">
                  {elevGain != null ? `+${elevGain}m` : "—"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="TSS" value={activity.tss?.toFixed(0) ?? "—"} icon={<Flame className="h-3.5 w-3.5" />} />
        <MetricCard label="NP" value={activity.normalized_power ? `${activity.normalized_power}w` : "—"} icon={<Zap className="h-3.5 w-3.5" />} />
        <MetricCard label="IF" value={activity.intensity_factor?.toFixed(2) ?? "—"} icon={<Zap className="h-3.5 w-3.5" />} />
        <MetricCard
          label="Heart Rate"
          value={activity.avg_hr ? `${activity.avg_hr}` : "—"}
          sub={maxHrEst ? `Max ~${maxHrEst} bpm` : "avg bpm"}
          icon={<Heart className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Power"
          value={avgPowerEst ? `${avgPowerEst}w` : "—"}
          sub={maxPowerEst ? `Max ~${maxPowerEst}w` : "avg"}
          icon={<Zap className="h-3.5 w-3.5" />}
        />
        <MetricCard label="Kilojoules" value={kj ? `${kj}` : "—"} sub="kJ" icon={<Flame className="h-3.5 w-3.5" />} />
      </div>

      {/* ── Multi-Stream Charts ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activity Streams</h2>

        {/* Power */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> Power (FTP: {ftp}w)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={streams} syncId="activity" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} strokeOpacity={0.4} />
                <XAxis dataKey="t" tickFormatter={formatTime} tick={axisStyle} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} width={36} unit="w" />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelFormatter={(v) => `Time: ${formatTime(Number(v))}`}
                  formatter={(v: number) => [`${v}w`, "Power"]}
                />
                <Area
                  type="monotone"
                  dataKey="power"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="url(#powerGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Heart Rate */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-destructive" /> Heart Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={streams} syncId="activity" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} strokeOpacity={0.4} />
                <XAxis dataKey="t" tickFormatter={formatTime} tick={axisStyle} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} width={36} unit="" domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelFormatter={(v) => `Time: ${formatTime(Number(v))}`}
                  formatter={(v: number) => [`${v} bpm`, "HR"]}
                />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Glucose — conditional */}
        {dexcomConnected ? (
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5" style={{ color: "hsl(280 80% 65%)" }} /> Glucose (mmol/L)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={glucoseStream} syncId="activity" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} strokeOpacity={0.4} />
                  <XAxis dataKey="t" tickFormatter={formatTime} tick={axisStyle} interval="preserveStartEnd" />
                  <YAxis tick={axisStyle} width={36} domain={[3, 13]} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={(v) => `Time: ${formatTime(Number(v))}`}
                    formatter={(v: number) => [`${v} mmol/L`, "Glucose"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="glucose"
                    stroke="hsl(280 80% 65%)"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-6 flex items-center justify-center gap-3">
              <Droplets className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Connect Dexcom to see glucose overlay during activity.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
                Connect Dexcom
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Elevation */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Elevation (m)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={streams} syncId="activity" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} strokeOpacity={0.4} />
                <XAxis dataKey="t" tickFormatter={formatTime} tick={axisStyle} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} width={36} unit="m" domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelFormatter={(v) => `Time: ${formatTime(Number(v))}`}
                  formatter={(v: number) => [`${v}m`, "Elevation"]}
                />
                <Area
                  type="monotone"
                  dataKey="elevation"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  fill="url(#elevGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Zone Distribution ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Power Zone Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ZoneBar zoneTimes={zoneTimes} />
        </CardContent>
      </Card>

      {/* ── AI Coach Analysis ── */}
      <Card className="border border-border bg-card/60">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="rounded-full p-2 bg-primary/10 flex-shrink-0">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">AI Coach Analysis</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Analysis will appear after sync. Once your activity data is fully processed, your AI coach will provide
              personalized insights on pacing, zone distribution, and recovery recommendations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
