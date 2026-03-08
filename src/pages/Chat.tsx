import { MessageSquare } from "lucide-react";

export default function Chat() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">AI Coach</h1>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Chat with your AI cycling coach here.
        </p>
      </div>
    </div>
  );
}
