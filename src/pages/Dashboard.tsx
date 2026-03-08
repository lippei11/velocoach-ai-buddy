import { LayoutDashboard } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["Weekly TSS", "CTL (Fitness)", "ATL (Fatigue)"].map((metric) => (
          <div key={metric} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{metric}</p>
            <p className="text-2xl font-semibold mt-1">—</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Connect your Intervals.icu account to see your performance data here.
      </p>
    </div>
  );
}
