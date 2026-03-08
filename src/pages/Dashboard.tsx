import { RefreshCw, Activity, Bike, Footprints, Dumbbell, Waves, AlertCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from "recharts";
import { useIntervalsData } from "@/hooks/useIntervalsData";
import { format } from "date-fns";

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function tsbColor(tsb: number | null) {
  if (tsb == null) return "text-muted-foreground";
  if (tsb > 5) return "text-green-400";
  if (tsb >= -10) return "text-yellow-400";
  return "text-red-400";
}

function tsbLabel(tsb: number | null) {
  if (tsb == null) return "";
  if (tsb > 5) return "Fresh";
  if (tsb >= -10) return "Neutral";
  return "Fatigued";
}

function sportIcon(type: string) {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("ride") || t.includes("cycling")) return <Bike className="h-4 w-4" />;
  if (t.includes("run")) return <Footprints className="h-4 w-4" />;
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
    wellness, activities, latestWellness, last14Wellness,
    currentWeekTSS, weeklyTSS, loading, error, refresh,
  } = useIntervalsData();

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-card p-8 text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const ctl = latestWellness?.ctl ?? null;
  const atl = latestWellness?.atl ?? null;
  const tsb = ctl != null && atl != null ? ctl - atl : null;

  const sparklineData = last14Wellness.map((d) => ({ v: d.ctl ?? 0 }));

  // Chart data — 42 days
  const chartData = wellness.map((w) => ({
    date: w.id,
    CTL: w.ctl ?? 0,
    ATL: w.atl ?? 0,
    TSB: (w.ctl ?? 0) - (w.atl ?? 0),
  }));

  // Bar chart with target line
  const ctlTarget = ctl != null ? Math.round(ctl * 5.5) : null;
  const barData = weeklyTSS.map((w) => ({
    ...w,
    fill: ctl != null && w.tss > ctl * 7 ? "#3B82F6" : "hsl(var(--muted-foreground) / 0.4)",
  }));

  // Recent activities
  const last10 = [...activities]
    .sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Sync Now
        </Button>
      </div>

      {/* SECTION 1 — KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* CTL */}
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fitness</p>
                <span className="text-2xl font-bold font-mono text-blue-400">
                  {ctl?.toFixed(0) ?? "—"}
                </span>
                <Sparkline data={sparklineData} color="#3B82F6" />
              </CardContent>
            </Card>

            {/* ATL */}
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fatigue</p>
                <span className="text-2xl font-bold font-mono text-orange-400">
                  {atl?.toFixed(0) ?? "—"}
                </span>
              </CardContent>
            </Card>

            {/* TSB */}
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Form</p>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold font-mono ${tsbColor(tsb)}`}>
                    {tsb != null ? tsb.toFixed(0) : "—"}
                  </span>
                  {tsb != null && (
                    <span className={`text-xs ${tsbColor(tsb)}`}>{tsbLabel(tsb)}</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weekly TSS */}
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">This Week</p>
                <span className="text-2xl font-bold font-mono">{currentWeekTSS}</span>
                <p className="text-xs text-muted-foreground">TSS</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* SECTION 2 — Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fitness / Fatigue / Form (42d)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => {
                      try { return format(new Date(v), "MMM d"); } catch { return v; }
                    }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="CTL" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ATL" stroke="#F97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="TSB" stroke="#22C55E" strokeWidth={2} dot={false} />
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
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  {ctlTarget != null && (
                    <ReferenceLine
                      y={ctlTarget}
                      stroke="#F97316"
                      strokeDasharray="4 4"
                      label={{ value: `Target ${ctlTarget}`, fill: "#F97316", fontSize: 10, position: "right" }}
                    />
                  )}
                  <Bar
                    dataKey="tss"
                    name="TSS"
                    radius={[4, 4, 0, 0]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      return (
                        <rect
                          x={x} y={y} width={width} height={height}
                          rx={4} fill={payload.fill}
                        />
                      );
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
            <p className="text-sm text-muted-foreground py-8 text-center">No recent activities found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Duration</TableHead>
                    <TableHead className="text-xs text-right">TSS</TableHead>
                    <TableHead className="text-xs text-right">Avg Watts</TableHead>
                    <TableHead className="text-xs text-right">IF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {last10.map((a, idx) => {
                    const intensityFactor =
                      a.icu_weighted_avg_watts && a.icu_ftp
                        ? (a.icu_weighted_avg_watts / a.icu_ftp).toFixed(2)
                        : "—";
                    return (
                      <TableRow
                        key={a.id}
                        className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                          idx % 2 === 1 ? "bg-muted/30" : ""
                        }`}
                      >
                        <TableCell className="text-xs font-mono">
                          {(() => {
                            try { return format(new Date(a.start_date_local), "MMM d"); }
                            catch { return "—"; }
                          })()}
                        </TableCell>
                        <TableCell className="text-sm font-medium max-w-[200px] truncate">
                          {a.name || "Untitled"}
                        </TableCell>
                        <TableCell>{sportIcon(a.type)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {a.moving_time ? formatDuration(a.moving_time) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {a.icu_training_load?.toFixed(0) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {a.icu_weighted_avg_watts?.toFixed(0) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {intensityFactor}
                        </TableCell>
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
