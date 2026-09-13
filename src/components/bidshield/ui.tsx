import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/* ---------------------------------------------------------------- header */

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; to?: string }[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {b.to ? (
                <Link to={b.to} className="hover:text-foreground hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span className="text-foreground">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- cards */

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 shadow-xs">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card shadow-xs", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- badges */

const STATUS_TONES: Record<string, string> = {
  PASS: "border-success/30 bg-success/10 text-success",
  VERIFIED: "border-success/30 bg-success/10 text-success",
  ACTIVE: "border-success/30 bg-success/10 text-success",
  AVAILABLE: "border-success/30 bg-success/10 text-success",
  COMPLETED: "border-success/30 bg-success/10 text-success",
  ELIGIBLE: "border-success/30 bg-success/10 text-success",
  EXTRACTED: "border-success/30 bg-success/10 text-success",
  QUALIFY: "border-success/30 bg-success/10 text-success",

  REVIEW: "border-warning/40 bg-warning/10 text-warning",
  MANUAL_REVIEW: "border-warning/40 bg-warning/10 text-warning",
  PARTIAL: "border-warning/40 bg-warning/10 text-warning",
  PENDING: "border-warning/40 bg-warning/10 text-warning",
  PROCESSING: "border-warning/40 bg-warning/10 text-warning",
  DEGRADED: "border-warning/40 bg-warning/10 text-warning",
  UNDER_REVIEW: "border-warning/40 bg-warning/10 text-warning",
  HOLD: "border-warning/40 bg-warning/10 text-warning",
  INACTIVE: "border-warning/40 bg-warning/10 text-warning",

  FAIL: "border-destructive/30 bg-destructive/10 text-destructive",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  MISMATCH: "border-destructive/30 bg-destructive/10 text-destructive",
  NOT_ELIGIBLE: "border-destructive/30 bg-destructive/10 text-destructive",
  SUSPENDED: "border-destructive/30 bg-destructive/10 text-destructive",
  UNAVAILABLE: "border-destructive/30 bg-destructive/10 text-destructive",
  DISQUALIFY: "border-destructive/30 bg-destructive/10 text-destructive",

  SUBMITTED: "border-border bg-secondary text-secondary-foreground",
  SIMULATED: "border-border bg-secondary text-secondary-foreground",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const key = (value ?? "").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        STATUS_TONES[key] ?? "border-border bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {key.replace(/_/g, " ")}
    </span>
  );
}

export function RoleBadge({ role }: { role: string | null }) {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    procurement_admin: "Procurement Admin",
    government_officer: "Government Officer",
    bidder: "Bidder",
    auditor: "Auditor",
  };
  const tones: Record<string, string> = {
    super_admin: "border-primary/30 bg-primary/10 text-primary",
    procurement_admin: "border-info/30 bg-info/10 text-info",
    government_officer: "border-success/30 bg-success/10 text-success",
    bidder: "border-warning/40 bg-warning/10 text-warning",
    auditor: "border-border bg-secondary text-secondary-foreground",
  };
  if (!role) return <span className="text-xs text-muted-foreground">No role assigned</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold",
        tones[role] ?? "border-border bg-secondary text-secondary-foreground",
      )}
    >
      {labels[role] ?? role}
    </span>
  );
}

export function RiskPill({ score }: { score: number }) {
  const band = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const tone =
    band === "high"
      ? "border-risk-high/30 bg-risk-high/10 text-risk-high"
      : band === "medium"
        ? "border-risk-medium/40 bg-risk-medium/10 text-risk-medium"
        : "border-risk-low/30 bg-risk-low/10 text-risk-low";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase",
        tone,
      )}
    >
      {band} <span className="tabular-nums">{score}</span>
    </span>
  );
}

export function ScoreBar({ score, tone = "primary" }: { score: number; tone?: "primary" | "risk" }) {
  const color =
    tone === "risk"
      ? score >= 60
        ? "bg-risk-high"
        : score >= 30
          ? "bg-risk-medium"
          : "bg-risk-low"
      : score >= 80
        ? "bg-success"
        : score >= 50
          ? "bg-warning"
          : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", color)} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{score}</span>
    </div>
  );
}

/* ------------------------------------------------------------ table bits */

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-md border border-border bg-card shadow-xs", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-border bg-muted/60 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-border px-3 py-2 align-middle", className)}>{children}</td>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm">
      <p className="font-medium text-destructive">Something went wrong</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- notices */

export function AccessRestricted({ what }: { what?: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">403</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Access Restricted</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You do not have permission to access this resource
        {what ? ` (${what})` : ""}. If you believe this is an error, contact your system administrator.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function AdvisoryNotice({ className = "" }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      AI-generated analysis is decision-support only. Final procurement responsibility remains with the
      authorised officer.
    </p>
  );
}

export function EvidenceRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatMoney(amount: number, currency = "INR") {
  return `${currency} ${amount.toLocaleString("en-IN")}`;
}
