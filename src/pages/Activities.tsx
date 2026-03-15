import { Activity, Bike, Footprints, Dumbbell, Waves, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIntervalsData } from "@/hooks/useIntervalsData";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

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

export default function Activities() {
  const { activities, loading, error, refresh } = useIntervalsData();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Activities</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Alle Aktivitäten</CardTitle>
              <span className="text-xs text-muted-foreground">{activities.length} gesamt</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Keine Aktivitäten gefunden. Verbinde Intervals.icu in den Settings.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Datum</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Typ</TableHead>
                      <TableHead className="text-xs text-right">Dauer</TableHead>
                      <TableHead className="text-xs text-right">Distanz</TableHead>
                      <TableHead className="text-xs text-right">TSS</TableHead>
                      <TableHead className="text-xs text-right">NP</TableHead>
                      <TableHead className="text-xs text-right">IF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((a, idx) => (
                      <TableRow
                        key={a.id}
                        className={`hover:bg-accent/50 transition-colors cursor-pointer ${
                          idx % 2 === 1 ? "bg-muted/30" : ""
                        }`}
                        onClick={() => navigate(`/activities/${a.id}`)}
                      >
                        <TableCell className="text-xs font-mono">
                          {(() => {
                            try { return format(new Date(a.start_date), "dd.MM.yy"); }
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
                          {a.distance_meters ? `${(a.distance_meters / 1000).toFixed(1)} km` : "—"}
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
      )}
    </div>
  );
}
