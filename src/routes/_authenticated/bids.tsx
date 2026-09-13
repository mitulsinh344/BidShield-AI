import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { listBids } from "@/lib/bidshield.functions";
import { Guard } from "@/components/bidshield/Guard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  RiskPill,
  ScoreBar,
  SectionCard,
  StatusBadge,
  TableShell,
  Td,
  Th,
  formatDate,
  formatMoney,
} from "@/components/bidshield/ui";

const STATUSES = ["ALL", "SUBMITTED", "PROCESSING", "UNDER_REVIEW", "VERIFIED", "MANUAL_REVIEW", "COMPLETED"];
const PAGE_SIZE = 10;

export const Route = createFileRoute("/_authenticated/bids")({
  validateSearch: (search: Record<string, unknown>) => ({ q: (search.q as string) || "" }),
  head: () => ({
    meta: [
      { title: "Bids | BidShield AI" },
      { name: "description", content: "All bid submissions with compliance, verification and risk status." },
      { property: "og:title", content: "Bids | BidShield AI" },
      { property: "og:description", content: "All bid submissions with compliance, verification and risk status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BidsLayout,
});

function BidsLayout() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId === "/_authenticated/bids/$bidId");
  if (isChild) return <Outlet />;
  return (
    <Guard permission="bid.view">
      <Bids />
    </Guard>
  );
}

function Bids() {
  const { q: initialQ } = Route.useSearch();
  const fn = useServerFn(listBids);
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["bids"], queryFn: () => fn() });
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((b) => {
      const matchesText =
        !needle ||
        [b.bidCode, b.bidderName, b.tenderRef, b.tenderTitle].join(" ").toLowerCase().includes(needle);
      const matchesStatus = status === "ALL" || b.status === status;
      return matchesText && matchesStatus;
    });
  }, [data, q, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Bids"
        subtitle="Every submission received against published tenders."
        breadcrumbs={[{ label: "Home", to: "/dashboard" }, { label: "Bids" }]}
        actions={
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search bid, bidder or tender"
              className="h-8 w-64"
              aria-label="Search bids"
            />
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <SectionCard title={`${rows.length} bid(s)`}>
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState title="No bids match your filters" description="Clear the search or status filter." />
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>Bid ID</Th>
                  <Th>Tender</Th>
                  <Th>Bidder</Th>
                  <Th>Submitted on</Th>
                  <Th>Amount</Th>
                  <Th>Docs</Th>
                  <Th>Compliance</Th>
                  <Th>Risk</Th>
                  <Th>Verification</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/50">
                    <Td className="font-medium">{b.bidCode}</Td>
                    <Td className="text-muted-foreground">{b.tenderRef}</Td>
                    <Td>{b.bidderName}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(b.submittedAt)}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatMoney(b.amount)}</Td>
                    <Td className="tabular-nums">{b.documentCount}</Td>
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
                      {b.decision ? <StatusBadge value={b.decision} /> : <StatusBadge value={b.status} />}
                    </Td>
                    <Td>
                      <Link
                        to="/bids/$bidId"
                        params={{ bidId: b.id }}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open workspace
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {current} of {pageCount}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={current >= pageCount}
                  onClick={() => setPage(current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}
