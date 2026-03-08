import { useEffect, useState } from "react";
import { Link2, CheckCircle2, XCircle, Wifi, WifiOff, Loader2, RefreshCw, Unplug, TestTube2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useIntervalsConnection, ConnectionStatus } from "@/hooks/useIntervalsConnection";

function StatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="default" className="gap-1.5">
          <CheckCircle2 className="h-3 w-3" /> Connected
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1.5">
          <XCircle className="h-3 w-3" /> Error
        </Badge>
      );
    case "loading":
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Checking…
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1.5">
          <WifiOff className="h-3 w-3" /> Not connected
        </Badge>
      );
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function IntervalsConnectionCard() {
  const {
    status, athleteId, connectedAt, lastSyncAt, lastError,
    saving, syncing, lastSyncResult,
    checkConnection, saveCredentials, testConnection, syncNow, disconnect,
  } = useIntervalsConnection();

  const [formAthleteId, setFormAthleteId] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleSave = async () => {
    if (!formAthleteId.trim() || !formApiKey.trim()) {
      toast.error("Please enter both Athlete ID and API Key");
      return;
    }
    const result = await saveCredentials(formAthleteId.trim(), formApiKey.trim());
    if (result.success) {
      toast.success(`Connected${result.athleteName ? ` as ${result.athleteName}` : ""}!`);
      setFormApiKey("");
    } else {
      toast.error(result.error || "Connection failed");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await testConnection();
    setTesting(false);
    if (result.connected) {
      toast.success("Connection is healthy ✓");
    } else {
      toast.error(result.error || "Connection test failed");
    }
  };

  const handleSync = async () => {
    const result = await syncNow();
    if (result.success) {
      toast.success(`Synced: ${result.activities} activities, ${result.wellness} wellness days, profile ${result.profile ? "✓" : "—"}`);
    } else {
      toast.error(`Sync completed with errors: ${result.errors.join(", ")}`);
    }
  };

  const handleDisconnect = async () => {
    const result = await disconnect();
    if (result.success) {
      toast.success("Disconnected from Intervals.icu");
      setFormAthleteId("");
      setFormApiKey("");
    } else {
      toast.error(result.error || "Failed to disconnect");
    }
  };

  const isConnected = status === "connected";
  const isDisconnected = status === "disconnected";

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Intervals.icu</CardTitle>
          </div>
          <StatusBadge status={status} />
        </div>
        <CardDescription>Sync activities, wellness data, and planned workouts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connected state */}
        {isConnected && (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wifi className="h-4 w-4 text-primary" />
                <span>
                  Athlete ID: <span className="font-mono text-foreground">{athleteId}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                <span>Connected since</span>
                <span className="text-foreground">{formatDate(connectedAt)}</span>
                <span>Last sync</span>
                <span className="text-foreground">{formatDate(lastSyncAt)}</span>
              </div>
            </div>

            {/* Sync result */}
            {lastSyncResult && (
              <div className={`text-xs rounded-md px-3 py-2 ${lastSyncResult.success ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                {lastSyncResult.success
                  ? `✓ Synced: ${lastSyncResult.activities} activities, ${lastSyncResult.wellness} wellness days${lastSyncResult.profile ? ", profile updated" : ""}`
                  : `Errors: ${lastSyncResult.errors.join(", ")}`}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || syncing}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <TestTube2 className="h-3.5 w-3.5 mr-1.5" />}
                  Test connection
                </Button>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || testing}>
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Sync now
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDisconnect}
              >
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          </>
        )}

        {/* Error state */}
        {status === "error" && (
          <>
            {lastError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {lastError}
              </p>
            )}
            <Separator />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Retry
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={handleDisconnect}
              >
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          </>
        )}

        {/* Disconnected / connect form */}
        {(isDisconnected || status === "error") && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Find your API key at{" "}
                <a
                  href="https://intervals.icu/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary hover:text-primary/80"
                >
                  intervals.icu/settings
                </a>
                {" "}→ Developer Settings.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="athlete-id" className="text-xs">Athlete ID</Label>
                  <Input
                    id="athlete-id"
                    placeholder="i12345"
                    value={formAthleteId}
                    onChange={(e) => setFormAthleteId(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-key" className="text-xs">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="••••••••"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Connect & Verify
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
