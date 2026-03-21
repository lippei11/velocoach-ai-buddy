import { useState } from "react";
import { RefreshCw, Activity, Bike, Footprints, Dumbbell, Waves, AlertCircle, Settings, Clock, TrendingUp, Bug, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { useIntervalsData } from "@/hooks/useIntervalsData";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  WeeklyContextInputs,
  defaultWeeklyContextValues,
  type WeeklyContextValues,
} from "@/components/plan/WeeklyContextInputs";

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  if (data.length < 2) return null;
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

function sportIcon(type: string | null) {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("ride") || t.includes("cycling") || t.includes("virtual")) return <Bike className="h-4 w-4" />;
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

function SyncStatusBadge({ lastSyncAt }: { lastSyncAt: string | null }) {
  if (!lastSyncAt) {
    return (
      <Badge variant="outline" className="gap-1 text-xs font-normal">
        <Clock className="h-3 w-3" />
        Noch nicht synchronisiert
      </Badge>
    );
  }
  const ago = formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: de });
  return (
    <Badge variant="secondary" className="gap-1 text-xs font-normal">
      <Clock className="h-3 w-3" />
      Sync {ago}
    </Badge>
  );
}

export default function Dashboard() {
  const {
    state, wellness, activities, latestWellness, last14Wellness,
    currentWeekTSS, weeklyTSS, loading, syncing, error, notConnected,
    lastSyncAt, athleteName, refresh, syncAndReload,
  } = useIntervalsData();
  const navigate = useNavigate();
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [debugModalTitle, setDebugModalTitle] = useState("");
  const [debugJson, setDebugJson] = useState<string | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [weeklyCtx, setWeeklyCtx] = useState<WeeklyContextValues>(defaultWeeklyContextValues);
  // Temporary: holds last successful weekSkeleton for build-workouts debug
  const [lastWeekSkeleton, setLastWeekSkeleton] = useState<Record<string, unknown> | null>(null);

  /** Formats a Supabase FunctionsError into a readable debug string. */
  async function formatFnError(e: any): Promise<string> {
    let detail = `[${e.name ?? "Error"}] ${e.message}`;
    if (e.context instanceof Response) {
      // FunctionsHttpError — read HTTP status + body
      try {
        const body = await e.context.text();
        detail += `\nHTTP ${e.context.status} ${e.context.statusText}\n${body}`;
      } catch { /* response already consumed */ }
    } else if (e.context?.message) {
      // FunctionsFetchError — underlying fetch/network error
      detail += `\nCause: ${e.context.message}`;
    }
    return detail;
  }

  async function handleTestContext() {
    setDebugLoading(true);
    setDebugJson(null);
    setDebugModalTitle("compute-athlete-context Response");
    setDebugModalOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-athlete-context", {
        body: {
          specialWeekType: weeklyCtx.specialWeekType,
          loadCompleteness: weeklyCtx.loadCompleteness,
          ...(Object.keys(weeklyCtx.estimatedUntrackedLoad).length > 0
            ? { estimatedUntrackedLoad: weeklyCtx.estimatedUntrackedLoad }
            : {}),
        },
      });
      if (error) {
        console.error("compute-athlete-context error:", error);
        setDebugJson(`Error:\n${await formatFnError(error)}`);
        return;
      }
      console.log("compute-athlete-context response:", data);
      setDebugJson(JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.error("compute-athlete-context unexpected error:", e);
      setDebugJson(`Unexpected error:\n${e.message}`);
    } finally {
      setDebugLoading(false);
    }
  }

  async function handleTestWeekSkeleton() {
    setDebugLoading(true);
    setDebugJson(null);
    setDebugModalTitle("generate-week-skeleton Response");
    setDebugModalOpen(true);
    // Use current week's Monday so the date always falls within an active plan horizon
    const weekStartDate = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    try {
      const { data, error } = await supabase.functions.invoke("generate-week-skeleton", {
        body: { weekStartDate },
      });
      if (error) {
        console.error("generate-week-skeleton error:", error);
        setDebugJson(`Error:\n${await formatFnError(error)}`);
        return;
      }
      console.log("generate-week-skeleton response:", data);
      setDebugJson(JSON.stringify(data, null, 2));
      if (data?.weekSkeleton) setLastWeekSkeleton(data.weekSkeleton);
    } catch (e: any) {
      console.error("generate-week-skeleton unexpected error:", e);
      setDebugJson(`Unexpected error:\n${e.message}`);
    } finally {
      setDebugLoading(false);
    }
  }

  async function handleTestBuildWorkouts() {
    if (!lastWeekSkeleton) return;
    setDebugLoading(true);
    setDebugJson(null);
    setDebugModalTitle("build-workouts Response");
    setDebugModalOpen(true);
    const weekStartDate = lastWeekSkeleton.weekStartDate as string;
    try {
      const { data, error } = await supabase.functions.invoke("build-workouts", {
        body: { weekSkeleton: lastWeekSkeleton, weekStartDate },
      });
      if (error) {
        console.error("build-workouts error:", error);
        const errText = await formatFnError(error);
        setDebugJson(
          `// === REQUEST: weekSkeleton ===\n${JSON.stringify(lastWeekSkeleton, null, 2)}\n\n// === ERROR ===\n${errText}`
        );
        return;
      }
      console.log("build-workouts response:", data);
      setDebugJson(
        `// === REQUEST: weekSkeleton ===\n${JSON.stringify(lastWeekSkeleton, null, 2)}\n\n// === RESPONSE: build-workouts ===\n${JSON.stringify(data, null, 2)}`
      );
    } catch (e: any) {
      console.error("build-workouts unexpected error:", e);
      setDebugJson(
        `// === REQUEST: weekSkeleton ===\n${JSON.stringify(lastWeekSkeleton, null, 2)}\n\n// === UNEXPECTED ERROR ===\n${e.message}`
      );
    } finally {
      setDebugLoading(false);
    }
  }

  // --- Not Connected ---
  if (state === "not-connected") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-4 max-w-lg mx-auto mt-12">
          <Bike className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-lg font-semibold">Willkommen bei VeloCoach AI</h2>
          <p className="text-sm text-muted-foreground">
            Verbinde dein Intervals.icu Konto, um deine Fitness-, Belastungs- und Aktivitätsdaten hier zu sehen.
          </p>
          <Button onClick={() => navigate("/settings")} className="mt-2">
            <Settings className="h-4 w-4 mr-2" />
            Intervals.icu verbinden
          </Button>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (state === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-card p-10 text-center space-y-4 max-w-lg mx-auto mt-12">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Fehler beim Laden</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  // --- No Data (connected but not synced) ---
  if (state === "no-data") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <div className="rounded-lg border border-border bg-card p-10 text-center space-y-4 max-w-lg mx-auto mt-8">
          {syncing ? (
            <>
              <RefreshCw className="h-12 w-12 text-primary mx-auto animate-spin" />
              <h2 className="text-lg font-semibold">Daten werden synchronisiert…</h2>
              <p className="text-sm text-muted-foreground">
                Aktivitäten, Wellness und Profil werden von Intervals.icu importiert.
              </p>
            </>
          ) : (
            <>
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold">Noch keine Daten</h2>
              <p className="text-sm text-muted-foreground">
                Dein Intervals.icu Konto ist verbunden. Starte jetzt deinen ersten Sync, um Aktivitäten und Fitness-Daten zu importieren.
              </p>
              <Button onClick={async () => { await syncAndReload(); refresh(false); }} disabled={syncing}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Jetzt synchronisieren
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Ready / Loading with data ---
  const ctl = latestWellness?.ctl ?? null;
  const atl = latestWellness?.atl ?? null;
  const tsb = latestWellness?.tsb ?? (ctl != null && atl != null ? ctl - atl : null);
  const sparklineData = last14Wellness.map((d) => ({ v: d.ctl ?? 0 }));

  const chartData = wellness.map((w) => ({
    date: w.date,
    CTL: w.ctl ?? 0,
    ATL: w.atl ?? 0,
    TSB: w.tsb ?? ((w.ctl ?? 0) - (w.atl ?? 0)),
  }));

  const barData = weeklyTSS.map((w) => ({
    ...w,
    fill: "hsl(var(--primary))",
  }));

  const last10 = activities.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {athleteName ? `Hey ${athleteName}` : "Dashboard"}
          </h1>
          <div className="mt-1">
            <SyncStatusBadge lastSyncAt={lastSyncAt} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleTestContext} disabled={debugLoading}>
            <Bug className="h-4 w-4 mr-1" />
            Test Context
          </Button>
          <Button variant="outline" size="sm" onClick={handleTestWeekSkeleton} disabled={debugLoading}>
            <Bug className="h-4 w-4 mr-1" />
            Test Week Skeleton
          </Button>
          <Button variant="outline" size="sm" onClick={handleTestBuildWorkouts} disabled={debugLoading || !lastWeekSkeleton}>
            <Bug className="h-4 w-4 mr-1" />
            Test Build Workouts
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Weekly Planning Context */}
      <Card className="border-dashed">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Wochenkontext für Planung
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <WeeklyContextInputs value={weeklyCtx} onChange={setWeeklyCtx} />
          <p className="text-[11px] text-muted-foreground mt-3">
            Kontext wird beim nächsten <strong>Test Context</strong>-Aufruf an den Planer übergeben.
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards */}
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
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fitness (CTL)</p>
                <span className="text-2xl font-bold font-mono text-blue-400">
                  {ctl != null ? ctl.toFixed(0) : "—"}
                </span>
                <Sparkline data={sparklineData} color="#3B82F6" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fatigue (ATL)</p>
                <span className="text-2xl font-bold font-mono text-orange-400">
                  {atl != null ? atl.toFixed(0) : "—"}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Form (TSB)</p>
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

            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Woche</p>
                <span className="text-2xl font-bold font-mono">{currentWeekTSS}</span>
                <p className="text-xs text-muted-foreground">TSS</p>
                {weeklyTSS.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    4-Wochen-Schnitt: {Math.round(weeklyTSS.slice(-4).reduce((s, w) => s + w.tss, 0) / Math.min(4, weeklyTSS.length))} TSS
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fitness / Fatigue / Form (42 Tage)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Keine Wellness-Daten verfügbar</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => {
                      try { return format(new Date(v), "d. MMM", { locale: de }); } catch { return v; }
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
                    labelFormatter={(v) => {
                      try { return format(new Date(v), "dd.MM.yyyy"); } catch { return v; }
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="CTL" stroke="#3B82F6" strokeWidth={2} dot={false} name="Fitness" />
                  <Line type="monotone" dataKey="ATL" stroke="#F97316" strokeWidth={2} dot={false} name="Fatigue" />
                  <Line type="monotone" dataKey="TSB" stroke="#22C55E" strokeWidth={2} dot={false} name="Form" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Wochenbelastung (8 Wochen)</CardTitle>
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
                  <Bar
                    dataKey="tss"
                    name="TSS"
                    radius={[4, 4, 0, 0]}
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      return (
                        <rect x={x} y={y} width={width} height={height} rx={4} fill={payload.fill} />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Letzte Aktivitäten</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary" onClick={() => navigate("/activities")}>
              Alle anzeigen →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : last10.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Keine Aktivitäten gefunden</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Datum</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Typ</TableHead>
                    <TableHead className="text-xs text-right">Dauer</TableHead>
                    <TableHead className="text-xs text-right">TSS</TableHead>
                    <TableHead className="text-xs text-right">NP</TableHead>
                    <TableHead className="text-xs text-right">IF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {last10.map((a, idx) => (
                    <TableRow
                      key={a.id}
                      className={`hover:bg-accent/50 transition-colors cursor-pointer ${
                        idx % 2 === 1 ? "bg-muted/30" : ""
                      }`}
                      onClick={() => navigate(`/activities/${a.id}`)}
                    >
                      <TableCell className="text-xs font-mono">
                        {(() => {
                          try { return format(new Date(a.start_date), "dd.MM."); }
                          catch { return "—"; }
                        })()}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-[200px] truncate">
                        {a.name || "Ohne Titel"}
                      </TableCell>
                      <TableCell>{sportIcon(a.sport_type)}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {a.duration_seconds ? formatDuration(a.duration_seconds) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {a.tss?.toFixed(0) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {a.normalized_power?.toFixed(0) ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {a.intensity_factor?.toFixed(2) ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Modal */}
      <Dialog open={debugModalOpen} onOpenChange={setDebugModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-mono">{debugModalTitle}</DialogTitle>
              {debugJson && !debugLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(debugJson);
                    import("sonner").then(({ toast }) => toast.success("JSON kopiert"));
                  }}
                >
                  Kopieren
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {debugLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <pre className="text-xs font-mono bg-muted p-4 rounded-md whitespace-pre-wrap break-all">
                {debugJson ?? "No data"}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
