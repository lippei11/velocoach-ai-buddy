import { Calendar } from "lucide-react";

export default function TrainingPlan() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Training Plan</h1>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Your AI-generated training plan will appear here.
        </p>
      </div>
    </div>
  );
}
