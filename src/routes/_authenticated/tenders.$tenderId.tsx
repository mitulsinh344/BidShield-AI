import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTenderDetail } from "@/lib/bidshield.functions";
import { Guard } from "@/components/bidshield/Guard";
import {
  EmptyState,
  ErrorState,
  EvidenceRow,
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
  formatDay,
  formatMoney,
} from "@/components/bidshield/ui";

export const Route = createFileRoute("/_authenticated/tenders/$tenderId")({
  head: () => ({
    meta: [
      { title: "Tender detail | BidShield AI" },
      { name: "description", content: "Tender requirements, submitted bids and evaluation progress." },
      { property: "og:title", content: "Tender detail | BidShield AI" },
      { property: "og:description", content: "Tender requirements, submitted bids and evaluation progress." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Guard permission="tender.view">
      <TenderDetail />
    </Guard>
  ),
});

function TenderDetail() {
  const { tenderId } = Route.useParams();
  const fn = useServerFn(getTenderDetail);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tender", tenderId],
    queryFn: () => fn({ data: { tenderId } }),
  });

  if (isLoading) return <LoadingRows rows={6} />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data) return <EmptyState title="Tender not found" description="It may have been withdrawn." />;

  const { tender, bids, requirements } = data;

  return (
    <>
      <PageHeader
        title={tender.title}
        subtitle={`${tender.reference} · ${tender.buyer}`}
        breadcrumbs={[
          { label: "Home", to: "/dashboard" },
          { label: "Tenders", to: "/tenders" },
          { label: tender.reference },
        ]}
        actions={<StatusBadge value={tender.status} />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Tender particulars" className="xl:col-span-1">
          <EvidenceRow label="Department" value={tender.department} />
          <EvidenceRow label="Category" value={tender.category} />
          <EvidenceRow label="Estimated value" value={formatMoney(tender.estimated_value, tender.currency)} />
          <EvidenceRow label="Closing date" value={formatDay(tender.closes_at)} />
          <EvidenceRow label="Submissions" value={bids.length} />
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">{tender.description}</p>
        </SectionCard>

        <SectionCard title="Eligibility requirements" className="xl:col-span-2">
          {requirements.length === 0 ? (
            <EmptyState title="No requirements configured" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Requirement</Th>
                  <Th>Expected value</Th>
                  <Th>Mandatory</Th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r: any) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-xs">{r.code}</Td>
                    <Td>{r.title}</Td>
                    <Td className="text-muted-foreground">{r.expected_value}</Td>
                    <Td>{r.mandatory ? "Yes" : "No"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard title="Submitted bids" description="Ranked by rule-engine risk score.">
          {bids.length === 0 ? (
            <EmptyState title="No bids submitted yet" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Bid ID</Th>
                  <Th>Bidder</Th>
                  <Th>Amount</Th>
                  <Th>Submitted</Th>
                  <Th>Compliance</Th>
                  <Th>Risk</Th>
                  <Th>Verification</Th>
                  <Th>Status</Th>
                  <Th>Decision</Th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/50">
                    <Td>
                      <Link to="/bids/$bidId" params={{ bidId: b.id }} className="font-medium text-primary hover:underline">
                        {b.bid_code ?? "—"}
                      </Link>
                    </Td>
                    <Td>{b.vendor.name}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{formatMoney(b.amount, tender.currency)}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(b.submitted_at)}</Td>
                    <Td>
                      <ScoreBar score={b.compliance_score} />
                    </Td>
                    <Td>
                      <RiskPill score={b.risk_score} />
                    </Td>
                    <Td>
                      <StatusBadge value={b.verification_status} />
                    </Td>
                    <Td>
                      <StatusBadge value={b.status} />
                    </Td>
                    <Td>{b.decision ? <StatusBadge value={b.decision.decision} /> : <span className="text-xs text-muted-foreground">Pending officer</span>}</Td>
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
