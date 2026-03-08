import { RefreshCw, TrendingUp, TrendingDown, Minus, Activity, Bike, Footprints, Dumbbell, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { useIntervalsData, WellnessRecord } from "@/hooks/useIntervalsData";
import { format } from "date-fns";

function TrendArrow({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (current > previous) return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (current < previous) return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function Sparkline({ data, dataKey }: { data: WellnessRecord[]; dataKey: keyof WellnessRecord }) {
  const chartData = data.map((d, i) => ({ i, v: (d[dataKey] as number) ?? 0 }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="v" stroke="hsl(217, 91%, 60%)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function tsbColor(tsb: number | null) {
  if (tsb == null) return "text-muted-foreground";
  if (tsb > 0) return "text-green-400";
  if (tsb >= -10) return "text-yellow-400";
  return "text-red-400";
}

function rampColor(ramp: number | null) {
  if (ramp == null) return "text-muted-foreground";
  if (ramp >= 3 && ramp <= 7) return "text-green-400";
  if (ramp > 7) return "text-orange-400";
  return "text-red-400";
}

function tssBarColor(tss: number) {
  if (tss < 300) return "hsl(142, 71%, 45%)";
  if (tss < 500) return "hsl(217, 91%, 60%)";
  if (tss < 700) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

function sportIcon(type: string) {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("ride") || t.includes("cycling")) return <Bike className="h-4 w-4" />;
  if (t.includes("run")) return <Run className="h-4 w-4" />;
  if (t.includes("swim")) return <Waves className="h-4 w-4" />;
  if (t.includes("weight") || t.includes("strength")) return <Dumbbell className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard() {
  const {
    wellness, activities, latestWellness, prevWellness,
    last7Wellness, weeklyTSS, loading, error, refresh,
  } = useIntervalsData();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  const rampRate = latestWellness?.ctl != null && last7Wellness.length >= 7 && last7Wellness[0]?.ctl != null
    ? +(latestWellness.ctl - last7Wellness[0].ctl).toFixed(1)
    : null;

  const chartData = wellness.map((w) => ({
    date: w.id,
    CTL: w.ctl ?? 0,
    ATL: w.atl ?? 0,
    TSB: w.tsb ?? 0,
  }));

  const last10 = [...activities].sort(
    (a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()
  ).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* SECTION 1 — KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardContent></Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">CTL (Fitness)</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono">{latestWellness?.ctl?.toFixed(0) ?? "—"}</span>
                  <TrendArrow current={latestWellness?.ctl ?? null} previous={prevWellness?.ctl ?? null} />
                </div>
                <Sparkline data={last7Wellness} dataKey="ctl" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">ATL (Fatigue)</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono">{latestWellness?.atl?.toFixed(0) ?? "—"}</span>
                  <TrendArrow current={latestWellness?.atl ?? null} previous={prevWellness?.atl ?? null} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">TSB (Form)</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-2xl font-bold font-mono ${tsbColor(latestWellness?.tsb ?? null)}`}>
                    {latestWellness?.tsb?.toFixed(0) ?? "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Ramp Rate</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-2xl font-bold font-mono ${rampColor(rampRate)}`}>
                    {rampRate != null ? rampRate : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">/wk</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* SECTION 2 — Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fitness / Fatigue / Form (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 22%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} tickFormatter={(v) => { try { return format(new Date(v), "MMM d"); } catch { return v; }}} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(217, 33%, 22%)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="CTL" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ATL" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="TSB" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly TSS (8 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyTSS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 22%)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(215, 20%, 55%)" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(217, 33%, 17%)", border: "1px solid hsl(217, 33%, 22%)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="tss" name="TSS" radius={[4, 4, 0, 0]}
                    fill="hsl(217, 91%, 60%)"
                    // @ts-ignore
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      return <rect x={x} y={y} width={width} height={height} rx={4} fill={tssBarColor(payload.tss)} />;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3 — Recent Activities */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : last10.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activities found in the last 30 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Activity</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Duration</TableHead>
                    <TableHead className="text-xs text-right">TSS</TableHead>
                    <TableHead className="text-xs text-right">Avg Power</TableHead>
                    <TableHead className="text-xs text-right">IF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {last10.map((a) => {
                    const intensityFactor = a.icu_weighted_avg_watts && a.icu_ftp
                      ? (a.icu_weighted_avg_watts / a.icu_ftp).toFixed(2)
                      : "—";
                    return (
                      <TableRow key={a.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                        <TableCell className="text-xs font-mono">
                          {(() => { try { return format(new Date(a.start_date_local), "MMM d"); } catch { return "—"; } })()}
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[200px] truncate">{a.name || "Untitled"}</TableCell>
                        <TableCell>{sportIcon(a.type)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{a.moving_time ? formatDuration(a.moving_time) : "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{a.icu_training_load?.toFixed(0) ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{a.icu_weighted_avg_watts?.toFixed(0) ?? "—"}w</TableCell>
                        <TableCell className="text-right text-xs font-mono">{intensityFactor}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
