import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDashboard, listBids } from "@/lib/bidshield.functions";
import { useViewer } from "@/lib/useViewer";
import { Guard } from "@/components/bidshield/Guard";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  RiskPill,
  ScoreBar,
  SectionCard,
  StatCard,
  StatusBadge,
  TableShell,
  Td,
  Th,
  formatDate,
} from "@/components/bidshield/ui";
import { roleLabel } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Procurement Dashboard | BidShield AI" },
      {
        name: "description",
        content:
          "Operational overview of tenders, bids, compliance, verification and risk for government procurement officers.",
      },
      { property: "og:title", content: "Procurement Dashboard | BidShield AI" },
      {
        property: "og:description",
        content: "Operational overview of tenders, bids, compliance, verification and risk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardRoute,
});

function DistributionBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {value} <span className="text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-sm bg-muted">
        <div className={tone} style={{ width: `${pct}%`, height: "100%" }} />
      </div>
    </div>
  );
}

function DashboardRoute() {
  const { data: viewer } = useViewer();
  if (viewer?.isBidder) return <Navigate to="/bidder" replace />;
  return (
    <Guard permission="dashboard.view">
      <Dashboard />
    </Guard>
  );
}

function Dashboard() {
  const { data: viewer } = useViewer();
  const dashboardFn = useServerFn(getDashboard);
  const bidsFn = useServerFn(listBids);

  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardFn() });
  const bids = useQuery({ queryKey: ["bids"], queryFn: () => bidsFn() });

  if (dashboard.isLoading) return <LoadingRows rows={6} />;
  if (dashboard.isError)
    return <ErrorState message={(dashboard.error as Error).message} onRetry={() => dashboard.refetch()} />;

  const d = dashboard.data!;
  const s = d.stats;
  const totalRisk = d.riskBuckets.high + d.riskBuckets.medium + d.riskBuckets.low;
  const complianceTotal = Object.values(d.complianceBuckets).reduce((a, b) => a + b, 0);
  const verificationTotal = Object.values(d.verificationBuckets).reduce((a, b) => a + b, 0);
  const tenderTotal = Object.values(d.tenderBuckets).reduce((a, b) => a + b, 0);

  const attention = (bids.data ?? [])
    .filter((b) => b.riskScore >= 60 || b.status === "MANUAL_REVIEW" || b.verificationStatus === "PENDING")
    .slice(0, 8);

  const actions = [
    { count: s.manualReview, text: "bids marked for manual review", to: "/bids" },
    { count: s.verificationPending, text: "bids awaiting verification results", to: "/verification" },
    { count: s.highRiskBids, text: "high-risk bids detected by the rule engine", to: "/risk" },
    { count: s.documentsAwaitingReview, text: "documents pending verification", to: "/documents" },
  ].filter((a) => a.count > 0);

  return (
    <>
      <PageHeader
        title={
          viewer?.role === "auditor"
            ? "Audit Overview"
            : viewer?.role === "government_officer"
              ? "Officer Operations Dashboard"
              : "Procurement Operations Dashboard"
        }
        subtitle={`Signed in as ${viewer?.fullName ?? ""} · ${roleLabel(viewer?.role)} · ${viewer?.organisation ?? ""}`}
        breadcrumbs={[{ label: "Home" }, { label: "Dashboard" }]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Tenders" value={s.activeTenders} />
        <StatCard label="Total Bids" value={s.totalBids} />
        <StatCard label="Pending Reviews" value={s.pendingReviews} tone="warning" />
        <StatCard label="High Risk Bids" value={s.highRiskBids} tone="danger" />
        <StatCard label="Verification Pending" value={s.verificationPending} tone="warning" />
        <StatCard label="Documents Awaiting Review" value={s.documentsAwaitingReview} />
        <StatCard label="Manual Review Queue" value={s.manualReview} tone="warning" />
        <StatCard label="Completed Evaluations" value={s.completedEvaluations} tone="success" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <SectionCard title="Action Required" description="Items waiting on an officer.">
          {actions.length === 0 ? (
            <EmptyState title="Nothing needs attention" description="Every bid has been processed." />
          ) : (
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.text} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <span className="text-sm">
                    <strong className="tabular-nums">{a.count}</strong> {a.text}
                  </span>
                  <Link to={a.to as never} className="text-xs font-medium text-primary hover:underline">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Risk Distribution" description="Rule-engine bands across all submissions.">
          <DistributionBar label="High (61–100)" value={d.riskBuckets.high} total={totalRisk} tone="bg-risk-high" />
          <DistributionBar label="Medium (31–60)" value={d.riskBuckets.medium} total={totalRisk} tone="bg-risk-medium" />
          <DistributionBar label="Low (0–30)" value={d.riskBuckets.low} total={totalRisk} tone="bg-risk-low" />
        </SectionCard>

        <SectionCard title="Compliance Distribution" description="Requirement checks across all bids.">
          {Object.entries(d.complianceBuckets).map(([k, v]) => (
            <DistributionBar
              key={k}
              label={k}
              value={v}
              total={complianceTotal}
              tone={
                k === "PASS"
                  ? "bg-success"
                  : k === "FAIL"
                    ? "bg-destructive"
                    : k === "REVIEW"
                      ? "bg-warning"
                      : "bg-muted-foreground"
              }
            />
          ))}
        </SectionCard>

        <SectionCard title="Verification & Tender Status" description="Sandbox verification outcomes and tender stages.">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification</p>
          {Object.entries(d.verificationBuckets).map(([k, v]) => (
            <DistributionBar
              key={k}
              label={k}
              value={v}
              total={verificationTotal}
              tone={k === "VERIFIED" ? "bg-success" : k === "PENDING" ? "bg-warning" : "bg-primary"}
            />
          ))}
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tenders</p>
          {Object.entries(d.tenderBuckets).map(([k, v]) => (
            <DistributionBar key={k} label={k} value={v} total={tenderTotal} tone="bg-primary" />
          ))}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="Bids needing officer attention"
          description="High risk, manual review or pending verification."
          actions={
            <Link to="/bids" className="text-xs font-medium text-primary hover:underline">
              View all bids
            </Link>
          }
        >
          {bids.isLoading ? (
            <LoadingRows />
          ) : attention.length === 0 ? (
            <EmptyState title="No bids need attention" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Bid ID</Th>
                  <Th>Tender</Th>
                  <Th>Bidder</Th>
                  <Th>Submitted</Th>
                  <Th>Compliance</Th>
                  <Th>Risk</Th>
                  <Th>Verification</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {attention.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/50">
                    <Td>
                      <Link to="/bids/$bidId" params={{ bidId: b.id }} className="font-medium text-primary hover:underline">
                        {b.bidCode}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{b.tenderRef}</Td>
                    <Td>{b.bidderName}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(b.submittedAt)}</Td>
                    <Td>
                      <ScoreBar score={b.complianceScore} />
                    </Td>
                    <Td>
                      <RiskPill score={b.riskScore} />
                    </Td>
                    <Td>
                      <StatusBadge value={b.verificationStatus} />
                    </Td>
                    <Td>
                      <StatusBadge value={b.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </SectionCard>
      </div>
    </>
  );
}
