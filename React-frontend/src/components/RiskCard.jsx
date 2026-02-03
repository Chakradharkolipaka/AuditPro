import React from "react";
import { AlertTriangle, ShieldCheck, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const severityMeta = {
  high: {
    label: "High",
    badge: "destructive",
    icon: AlertTriangle,
    ring: "ring-1 ring-destructive/30",
  },
  medium: {
    label: "Medium",
    badge: "secondary",
    icon: Info,
    ring: "ring-1 ring-yellow-500/25",
  },
  low: {
    label: "Low",
    badge: "outline",
    icon: ShieldCheck,
    ring: "ring-1 ring-emerald-500/20",
  },
};

export default function RiskCard({ title, severity = "low", summary, tags = [] }) {
  const meta = severityMeta[severity] || severityMeta.low;
  const Icon = meta.icon;

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", meta.ring)}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" /> {title}
          </CardTitle>
          <Badge variant={meta.badge}>{meta.label}</Badge>
        </div>
        {tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="opacity-80">
                {t}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
      </CardContent>
    </Card>
  );
}
