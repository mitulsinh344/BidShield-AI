import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTenderDetail } from "@/lib/bidshield.functions";
import { RiskBadge, ScoreMeter } from "@/components/bidshield/RiskBadge";
import { AdvisoryNotice } from "@/components/bidshield/DemoBanner";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/tenders/$tenderId")({
  head: () => ({
    meta: [
      { title: "Tender bid comparison — BidShield AI" },
      {
        name: "description",
        content:
          "Compare every bid on a tender side by side with its risk score, linked bidders and review status.",
      },
      { property: "og:title", content: "Tender bid comparison — BidShield AI" },
      {
        property: "og:description",
        content: "Every bid on this tender with its advisory risk signals and review status.",
      },
    ],
  }),
  component: TenderDetail,
});

const money = (v: number, c: string) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(
    v,
  );

const band = (s: number) => (s >= 60 ? "high" : s >= 30 ? "medium" : "low");

function TenderDetail() {
  const { tenderId } = Route.useParams();
  const fetchTender = useServerFn(getTenderDetail);
  const q = useQuery({
    queryKey: ["tender", tenderId],
    queryFn: () => fetchTender({ data: { tenderId } }),
  });

  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError)
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
        Could not load this tender.
      </p>
    );
  if (!q.data) return <p className="text-sm text-muted-foreground">Tender not found.</p>;

  const { tender, bids } = q.data;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← Screening queue
        </Link>
        <span className="mt-4 block font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {tender.reference}
        </span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tender.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tender.buyer} · {tender.category} · estimate{" "}
          {money(tender.estimated_value, tender.currency)} · closes{" "}
          {new Date(tender.closes_at).toLocaleString("en-GB")}
        </p>
        <AdvisoryNotice className="mt-3" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Bidder</th>
              <th className="px-4 py-3">Bid amount</th>
              <th className="px-4 py-3">Risk score</th>
              <th className="px-4 py-3">Top signals</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((b) => (
              <tr key={b.id} className="border-t border-border align-top hover:bg-secondary/30">
                <td className="px-4 py-4">
                  <Link
                    to="/bids/$bidId"
                    params={{ bidId: b.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {b.vendor.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {b.vendor.country} · {b.vendor.registration_no}
                  </p>
                </td>
                <td className="px-4 py-4 font-mono tabular-nums">
                  {money(b.amount, tender.currency)}
                </td>
                <td className="px-4 py-4">
                  <ScoreMeter score={b.risk_score} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex max-w-xs flex-wrap gap-1.5">
                    {b.flags.slice(0, 3).map((f) => (
                      <RiskBadge key={f.id} severity={f.severity}>
                        {f.title}
                      </RiskBadge>
                    ))}
                    {b.flags.length === 0 && (
                      <span className="text-xs text-muted-foreground">No signals</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {b.decision ? (
                    <RiskBadge severity={b.decision.decision === "qualify" ? "low" : "high"}>
                      {b.decision.decision}
                    </RiskBadge>
                  ) : (
                    <RiskBadge severity={band(b.risk_score)}>Awaiting review</RiskBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
