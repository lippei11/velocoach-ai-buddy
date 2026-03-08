import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function Onboarding() {
  const navigate = useNavigate();
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [dexcomOpen, setDexcomOpen] = useState(false);

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
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials — check your Athlete ID and API Key");
    } finally {
      setLoading(false);
    }
  };

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
