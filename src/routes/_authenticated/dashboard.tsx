import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenders, getViewer } from "@/lib/bidshield.functions";
import { AdvisoryNotice } from "@/components/bidshield/DemoBanner";
import { RiskBadge } from "@/components/bidshield/RiskBadge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Tender screening queue — BidShield AI" },
      {
        name: "description",
        content: "Open tenders with flagged bids awaiting human review in the BidShield AI sandbox.",
      },
      { property: "og:title", content: "Tender screening queue — BidShield AI" },
      { property: "og:description", content: "Open tenders with flagged bids awaiting review." },
    ],
  }),
  component: Dashboard,
});

const money = (v: number, c: string) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(
    v,
  );

function Dashboard() {
  const fetchTenders = useServerFn(listTenders);
  const fetchViewer = useServerFn(getViewer);
  const tenders = useQuery({ queryKey: ["tenders"], queryFn: () => fetchTenders() });
  const viewer = useQuery({ queryKey: ["viewer"], queryFn: () => fetchViewer() });

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Screening queue
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Welcome back{viewer.data ? `, ${viewer.data.fullName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {viewer.data
            ? `${viewer.data.organisation} · role: ${viewer.data.roles.join(", ") || "viewer"}`
            : "Loading your reviewer profile…"}
        </p>
        <AdvisoryNotice className="mt-3" />
      </div>

      {tenders.isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {tenders.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Could not load the screening queue. Please refresh.
        </p>
      )}

      <div className="space-y-3">
        {(tenders.data ?? []).map((t) => (
          <Link
            key={t.id}
            to="/tenders/$tenderId"
            params={{ tenderId: t.id }}
            className="block rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {t.reference}
                </span>
                <h2 className="mt-1 text-lg font-semibold">{t.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.buyer} · {t.category} · closes{" "}
                  {new Date(t.closes_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-lg tabular-nums">
                  {money(t.estimated_value, t.currency)}
                </p>
                <p className="text-xs text-muted-foreground">buyer estimate</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <RiskBadge severity="low">{t.bidCount} bids</RiskBadge>
              {t.highRiskCount > 0 && (
                <RiskBadge severity="high">{t.highRiskCount} high-risk</RiskBadge>
              )}
              <RiskBadge severity="medium">{t.pendingReview} awaiting decision</RiskBadge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
