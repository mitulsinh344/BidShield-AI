import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { listTenders } from "@/lib/bidshield.functions";
import { Guard } from "@/components/bidshield/Guard";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  SectionCard,
  StatusBadge,
  TableShell,
  Td,
  Th,
  formatDay,
  formatMoney,
} from "@/components/bidshield/ui";

export const Route = createFileRoute("/_authenticated/tenders")({
  head: () => ({
    meta: [
      { title: "Tenders | BidShield AI" },
      { name: "description", content: "Browse GeM procurement tenders, their requirements and submitted bids." },
      { property: "og:title", content: "Tenders | BidShield AI" },
      { property: "og:description", content: "Browse procurement tenders, requirements and submitted bids." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Guard permission="tender.view">
      <Tenders />
    </Guard>
  ),
});

function Tenders() {
  const fn = useServerFn(listTenders);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tenders"],
    queryFn: () => fn(),
  });
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((t) =>
      [t.reference, t.title, t.buyer, t.department, t.category].join(" ").toLowerCase().includes(needle),
    );
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Tenders"
        subtitle="Published procurement notices and their evaluation progress."
        breadcrumbs={[{ label: "Home", to: "/dashboard" }, { label: "Tenders" }]}
        actions={
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by reference, title or department"
            className="h-8 w-72"
            aria-label="Filter tenders"
          />
        }
      />
      <SectionCard title={`${rows.length} tender(s)`}>
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No tenders match your filter" description="Adjust the filter and try again." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Title</Th>
                <Th>Department</Th>
                <Th>Category</Th>
                <Th>Estimated value</Th>
                <Th>Closes</Th>
                <Th>Bids</Th>
                <Th>High risk</Th>
                <Th>Pending</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <Td>
                    <Link
                      to="/tenders/$tenderId"
                      params={{ tenderId: t.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {t.reference}
                    </Link>
                  </Td>
                  <Td className="max-w-xs truncate">{t.title}</Td>
                  <Td className="text-muted-foreground">{t.department}</Td>
                  <Td className="text-muted-foreground">{t.category}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatMoney(t.estimated_value, t.currency)}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">{formatDay(t.closes_at)}</Td>
                  <Td className="tabular-nums">{t.bidCount}</Td>
                  <Td className="tabular-nums text-destructive">{t.highRiskCount}</Td>
                  <Td className="tabular-nums">{t.pendingReview}</Td>
                  <Td>
                    <StatusBadge value={t.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </SectionCard>
    </>
  );
}
