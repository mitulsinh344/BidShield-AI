import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getBidDetail, recordDecision, runAiAssist, getViewer } from "@/lib/bidshield.functions";
import { RiskBadge, ScoreMeter } from "@/components/bidshield/RiskBadge";
import { AdvisoryNotice } from "@/components/bidshield/DemoBanner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/bids/$bidId")({
  head: () => ({
    meta: [
      { title: "Bid case file — BidShield AI" },
      {
        name: "description",
        content:
          "Full case file for a single bid: risk signals, linked bidders, AI advisory summary and the human qualification decision.",
      },
      { property: "og:title", content: "Bid case file — BidShield AI" },
      {
        property: "og:description",
        content: "Risk signals, linked bidders and the recorded human decision for this bid.",
      },
    ],
  }),
  component: BidDetail,
});

const money = (v: number, c: string) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(
    v,
  );

const options = [
  { value: "qualify", label: "Qualify" },
  { value: "hold", label: "Hold for clarification" },
  { value: "disqualify", label: "Disqualify" },
];

function BidDetail() {
  const { bidId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchBid = useServerFn(getBidDetail);
  const fetchViewer = useServerFn(getViewer);
  const decide = useServerFn(recordDecision);
  const assist = useServerFn(runAiAssist);

  const [choice, setChoice] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["bid", bidId], queryFn: () => fetchBid({ data: { bidId } }) });
  const viewer = useQuery({ queryKey: ["viewer"], queryFn: () => fetchViewer() });

  const aiMutation = useMutation({
    mutationFn: () => assist({ data: { bidId } }),
    onSuccess: (res) => {
      setSummary(res.summary);
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: () => toast.error("The AI assistant is unavailable right now."),
  });

  const decisionMutation = useMutation({
    mutationFn: () => decide({ data: { bidId, decision: choice, rationale } }),
    onSuccess: () => {
      toast.success("Decision recorded and written to the audit trail.");
      setRationale("");
      setChoice("");
      queryClient.invalidateQueries({ queryKey: ["bid", bidId] });
      queryClient.invalidateQueries({ queryKey: ["tenders"] });
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record the decision."),
  });

  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.isError)
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
        Could not load this bid.
      </p>
    );
  if (!q.data) return <p className="text-sm text-muted-foreground">Bid not found.</p>;

  const { bid, tender, vendor, flags, decision, linkedBids } = q.data;
  const canDecide = viewer.data?.canDecide ?? false;

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/tenders/$tenderId"
          params={{ tenderId: tender.id }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {tender.reference} · {tender.title}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{vendor.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bid {money(bid.amount, tender.currency)} · submitted{" "}
          {new Date(bid.submitted_at).toLocaleString("en-GB")}
        </p>
        <div className="mt-3">
          <ScoreMeter score={bid.risk_score} />
        </div>
        <AdvisoryNotice className="mt-3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Risk signals</h2>
            <ul className="mt-4 space-y-4">
              {flags.map((f) => (
                <li key={f.id} className="border-l-2 border-border pl-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge severity={f.severity}>{f.severity}</RiskBadge>
                    <span className="font-medium">{f.title}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      +{f.score} · {f.source}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.rationale}</p>
                </li>
              ))}
              {flags.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No signals were raised for this submission.
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold">AI advisory summary</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Never decides
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
              >
                {aiMutation.isPending ? "Analysing…" : "Generate summary"}
              </Button>
            </div>
            {summary ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {summary}
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Ask the assistant to summarise the evidence and suggest verification steps. It cannot
                qualify or disqualify a bidder.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Human qualification decision</h2>
            {decision ? (
              <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
                <RiskBadge severity={decision.decision === "qualify" ? "low" : "high"}>
                  {decision.decision}
                </RiskBadge>
                <p className="mt-3 text-sm">{decision.rationale}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Recorded {new Date(decision.decided_at).toLocaleString("en-GB")} · locked
                </p>
              </div>
            ) : !canDecide ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Your account has view-only access, so you cannot record a decision on this bid.
              </p>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!choice) {
                    toast.error("Choose an outcome first.");
                    return;
                  }
                  if (rationale.trim().length < 20) {
                    toast.error("Please write at least 20 characters of rationale.");
                    return;
                  }
                  decisionMutation.mutate();
                }}
              >
                <div className="flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setChoice(o.value)}
                      className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                        choice === o.value
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rationale">Reviewer rationale (required, min 20 characters)</Label>
                  <Textarea
                    id="rationale"
                    rows={4}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Explain the evidence you relied on and the checks you carried out."
                  />
                </div>
                <Button type="submit" disabled={decisionMutation.isPending}>
                  {decisionMutation.isPending ? "Recording…" : "Record decision"}
                </Button>
              </form>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Bidder</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Registration", vendor.registration_no],
                ["Country", vendor.country],
                ["Incorporated", vendor.incorporated_on],
                ["Bank fingerprint", vendor.bank_fingerprint],
                ["Email", vendor.contact_email],
                ["Phone", vendor.contact_phone],
                ["Address", vendor.address],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-primary">
              Demo record — no registry check performed
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Submission fingerprints</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["IP", bid.submission_ip],
                ["Device", bid.device_fingerprint],
                ["Doc hash", bid.document_hash],
                ["Doc author", bid.document_author],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-mono text-xs">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Linked bids on this tender</h2>
            {linkedBids.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No shared identifiers found.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {linkedBids.map((l) => (
                  <li key={l.id}>
                    <Link
                      to="/bids/$bidId"
                      params={{ bidId: l.id }}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {l.vendorName}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {l.sharedIp && <RiskBadge severity="medium">same IP</RiskBadge>}
                      {l.sharedDevice && <RiskBadge severity="high">same device</RiskBadge>}
                      {l.sharedDocument && <RiskBadge severity="high">same document</RiskBadge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
