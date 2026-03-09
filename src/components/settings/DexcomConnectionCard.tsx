import { useState } from "react";
import { Droplets, CheckCircle2, RefreshCw, Unlink, Eye, EyeOff, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useDexcomConnection } from "@/hooks/useDexcomConnection";
import { format, formatDistanceToNow } from "date-fns";

function maskUsername(u: string) {
  const [local, domain] = u.split("@");
  if (!domain) return u.slice(0, 2) + "***";
  return local.slice(0, 1) + "***@" + domain;
}

export default function DexcomConnectionCard() {
  const { status, loading, saving, syncing, disconnecting, error, connect, syncGlucose, disconnect } = useDexcomConnection();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const handleConnect = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter both username and password");
      return;
    }
    try {
      await connect(username.trim(), password.trim());
      toast.success("Dexcom CGM connected successfully");
      setUsername("");
      setPassword("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      toast.error(msg.includes("Invalid") ? "Invalid Dexcom credentials. Check your Dexcom Share username and password." : msg);
    }
  };

  const handleSync = async () => {
    try {
      const readings = await syncGlucose();
      toast.success(`Synced ${readings.length} glucose readings`);
    } catch {
      toast.error("Glucose sync failed. Session may have expired.");
    }
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    await disconnect();
    setConfirmDisconnect(false);
    toast.success("Dexcom disconnected");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground text-sm">
          <Droplets className="h-4 w-4 animate-pulse" />
          Loading Dexcom status…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Dexcom CGM</CardTitle>
          </div>
          {status.connected ? (
            <Badge className="gap-1.5 text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Not connected</Badge>
          )}
        </div>
        <CardDescription>
          {status.connected
            ? "Your Dexcom Share account is linked. Glucose data overlays on activity streams."
            : "Connect your Dexcom Share account to overlay real-time glucose data on your activities."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {status.connected ? (
          /* ── Connected state ── */
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 border border-border px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account</span>
                <span className="font-mono text-xs">{status.username ? maskUsername(status.username) : "—"}</span>
              </div>
              {status.connectedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Connected</span>
                  <span className="text-xs">{format(new Date(status.connectedAt), "MMM d, yyyy")}</span>
                </div>
              )}
              {status.lastSyncAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last sync</span>
                  <span className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync glucose now"}
              </Button>

              <Button
                size="sm"
                variant={confirmDisconnect ? "destructive" : "ghost"}
                className="gap-1.5 ml-auto"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                <Unlink className="h-3.5 w-3.5" />
                {disconnecting ? "Disconnecting…" : confirmDisconnect ? "Confirm disconnect?" : "Disconnect"}
              </Button>
            </div>

            {confirmDisconnect && (
              <p className="text-xs text-muted-foreground">
                Click "Confirm disconnect?" again to remove your Dexcom connection. Stored credentials will be deleted.
              </p>
            )}
          </div>
        ) : (
          /* ── Disconnected state ── */
          <div className="space-y-4">
            <div className="rounded-md bg-muted/30 border border-dashed border-border px-4 py-3 text-xs text-muted-foreground leading-relaxed">
              <strong>Dexcom Share</strong> must be enabled in your Dexcom app under <em>Share &amp; Follow</em>.
              Use your Dexcom account username (email) and password.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dexcom-username" className="text-xs">Dexcom Username</Label>
                <Input
                  id="dexcom-username"
                  type="text"
                  placeholder="your@email.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dexcom-password" className="text-xs">Dexcom Password</Label>
                <div className="relative">
                  <Input
                    id="dexcom-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Separator />

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={saving || !username || !password}
                className="gap-1.5"
              >
                <Droplets className="h-3.5 w-3.5" />
                {saving ? "Connecting…" : "Connect Dexcom"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
