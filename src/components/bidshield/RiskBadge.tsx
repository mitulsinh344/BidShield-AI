import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  high: "border-risk-high/40 bg-risk-high/15 text-risk-high",
  medium: "border-risk-medium/40 bg-risk-medium/15 text-risk-medium",
  low: "border-risk-low/40 bg-risk-low/15 text-risk-low",
};

export function RiskBadge({
  severity,
  children,
  className,
}: {
  severity: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider",
        styles[severity] ?? styles["low"],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ScoreMeter({ score }: { score: number }) {
  const band = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const color =
    band === "high" ? "bg-risk-high" : band === "medium" ? "bg-risk-medium" : "bg-risk-low";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-sm tabular-nums">{score}</span>
    </div>
  );
}
