import React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export default function AuditTimeline({ steps }) {
  const safeSteps = Array.isArray(steps) ? steps : [];

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="p-6">
        <div className="text-sm font-semibold">Analysis timeline</div>
        <div className="mt-4 space-y-3">
          {safeSteps.map((s, idx) => {
            const done = s.status === "done";
            const running = s.status === "running";

            return (
              <div key={`${s.id || idx}`} className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center border",
                    done ? "bg-primary text-primary-foreground border-primary" : "bg-background",
                    running ? "border-primary" : "border-border",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : running ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  {s.detail ? (
                    <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{done ? "Done" : running ? "Running" : "Queued"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
