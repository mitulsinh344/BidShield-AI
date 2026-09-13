import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getBidWorkspace, recordDecision, runAiAssist, runVerification } from "@/lib/bidshield.functions";
import { useViewer } from "@/lib/useViewer";
import { Guard } from "@/components/bidshield/Guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AdvisoryNotice,
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

export const Route = createFileRoute("/_authenticated/bids/$bidId")({
  head: () => ({
    meta: [
      { title: "Bid workspace | BidShield AI" },
      {
        name: "description",
        content: "Documents, verification, compliance, risk evidence and officer decision for a single bid.",
      },
      { property: "og:title", content: "Bid workspace | BidShield AI" },
      { property: "og:description", content: "Compliance, verification, risk evidence and officer decision." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Guard permission="bid.view">
      <BidWorkspace />
    </Guard>
  ),
});

function BidWorkspace() {
  const { bidId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: viewer } = useViewer();

  const workspaceFn = useServerFn(getBidWorkspace);
  const decisionFn = useServerFn(recordDecision);
  const verifyFn = useServerFn(runVerification);
  const aiFn = useServerFn(runAiAssist);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bid", bidId],
    queryFn: () => workspaceFn({ data: { bidId } }),
  });

  const [decision, setDecision] = useState("qualify");
  const [rationale, setRationale] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const decide = useMutation({
    mutationFn: () => decisionFn({ data: { bidId, decision, rationale } }),
    onSuccess: () => {
      toast.success("Decision recorded and written to the audit trail.");
      setRationale("");
      queryClient.invalidateQueries({ queryKey: ["bid", bidId] });
      queryClient.invalidateQueries({ queryKey: ["bids"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: () => verifyFn({ data: { bidId } }),
    onSuccess: (r: { checked: number }) => {
      toast.success(`Re-queried ${r.checked} sandbox verification source(s).`);
      queryClient.invalidateQueries({ queryKey: ["bid", bidId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ai = useMutation({
    mutationFn: () => aiFn({ data: { bidId } }),
    onSuccess: (r: { summary: string }) => setAiSummary(r.summary),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingRows rows={8} />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data) return <EmptyState title="Bid not found" />;

  const { bid, tender, vendor, flags, documents, compliance, verifications, recommendation, decision: recorded, linkedBids, auditEvents } = data;
  const canDecide = Boolean(viewer?.permissions.includes("decision.make"));
  const canRunVerification = Boolean(viewer?.permissions.includes("verification.run"));
  const canSeeRecommendation = Boolean(viewer?.permissions.includes("recommendation.view"));

  return (
    <>
      <PageHeader
        title={`Bid ${bid.bid_code ?? ""} — ${vendor.name}`}
        subtitle={`${tender.reference} · ${tender.title} · Scenario ${bid.scenario}`}
        breadcrumbs={[
          { label: "Home", to: "/dashboard" },
          { label: "Bids", to: "/bids" },
          { label: bid.bid_code ?? "Bid" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={recorded ? recorded.decision : bid.status} />
            <RiskPill score={bid.risk_score} />
            {canRunVerification && (
              <Button size="sm" variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>
                {verify.isPending ? "Re-checking…" : "Run verification"}
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="ai">AI Recommendation</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ overview */}
        <TabsContent value="overview" className="grid gap-4 xl:grid-cols-3">
          <SectionCard title="Submission">
            <EvidenceRow label="Bid ID" value={bid.bid_code ?? "—"} />
            <EvidenceRow label="Tender" value={<Link to="/tenders/$tenderId" params={{ tenderId: tender.id }} className="text-primary hover:underline">{tender.reference}</Link>} />
            <EvidenceRow label="Amount" value={formatMoney(bid.amount, tender.currency)} />
            <EvidenceRow label="Submitted on" value={formatDate(bid.submitted_at)} />
            <EvidenceRow label="Workflow status" value={<StatusBadge value={bid.status} />} />
            <EvidenceRow label="Compliance score" value={<ScoreBar score={bid.compliance_score} />} />
            <EvidenceRow label="Verification" value={<StatusBadge value={bid.verification_status} />} />
          </SectionCard>

          <SectionCard title="Bidder">
            <EvidenceRow label="Name" value={vendor.name} />
            <EvidenceRow label="Registration" value={vendor.registration_no} />
            <EvidenceRow label="PAN" value={vendor.pan ?? "Not supplied"} />
            <EvidenceRow label="GSTIN" value={vendor.gstin ?? "Not supplied"} />
            <EvidenceRow label="Udyam" value={vendor.udyam ?? "Not supplied"} />
            <EvidenceRow label="MSME class" value={vendor.msme_class ?? "—"} />
            <EvidenceRow
              label="Annual turnover"
              value={vendor.annual_turnover ? formatMoney(Number(vendor.annual_turnover)) : "—"}
            />
            <EvidenceRow label="Incorporated" value={formatDay(vendor.incorporated_on)} />
            <EvidenceRow label="Contact" value={`${vendor.contact_email} · ${vendor.contact_phone}`} />
          </SectionCard>

          <SectionCard title="Officer decision" description="Recorded decisions are immutable.">
            {recorded ? (
              <div className="space-y-2 text-sm">
                <StatusBadge value={recorded.decision} />
                <p className="text-muted-foreground">{recorded.rationale}</p>
                <p className="text-xs text-muted-foreground">Recorded {formatDate(recorded.decided_at)}</p>
              </div>
            ) : canDecide ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (rationale.trim().length < 20) {
                    toast.error("Please write at least 20 characters of officer remarks.");
                    return;
                  }
                  setConfirmOpen(true);
                }}
              >
                <fieldset>
                  <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Decision
                  </legend>
                  <RadioGroup value={decision} onValueChange={setDecision} className="gap-1.5">
                    {[
                      { v: "qualify", l: "Qualify" },
                      { v: "disqualify", l: "Disqualify" },
                      { v: "hold", l: "Manual review" },
                    ].map((o) => (
                      <div key={o.v} className="flex items-center gap-2">
                        <RadioGroupItem value={o.v} id={`decision-${o.v}`} />
                        <Label htmlFor={`decision-${o.v}`} className="text-sm font-normal">
                          {o.l}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </fieldset>
                <div>
                  <Label htmlFor="rationale" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Officer remarks
                  </Label>
                  <Textarea
                    id="rationale"
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    rows={4}
                    placeholder="Record the evidence you relied on and the reasoning for this decision."
                    className="mt-1"
                    required
                  />
                </div>
                <p className="rounded-sm border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-foreground">
                  AI-generated analysis is decision-support only. Final procurement responsibility remains with
                  the authorised officer.
                </p>
                <Button type="submit" disabled={decide.isPending}>
                  {decide.isPending ? "Recording…" : "Record decision"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                No decision has been recorded. Only an authorised Government Procurement Officer can record the
                final qualification decision.
              </p>
            )}
          </SectionCard>
        </TabsContent>

        {/* ----------------------------------------------- documents */}
        <TabsContent value="documents">
          <SectionCard title="Submitted documents" description="AI extraction confidence and verification status.">
            {documents.length === 0 ? (
              <EmptyState title="No documents uploaded" description="The bidder has not submitted documents." />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>File</Th>
                    <Th>Status</Th>
                    <Th>AI confidence</Th>
                    <Th>Verification</Th>
                    <Th>Pages</Th>
                    <Th>Uploaded</Th>
                    <Th>Extracted values</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d: any) => (
                    <tr key={d.id}>
                      <Td className="font-medium">{d.doc_type}</Td>
                      <Td className="text-muted-foreground">{d.file_name}</Td>
                      <Td>
                        <StatusBadge value={d.status} />
                      </Td>
                      <Td>
                        <ScoreBar score={d.ai_confidence} />
                      </Td>
                      <Td>
                        <StatusBadge value={d.verification_status} />
                      </Td>
                      <Td className="tabular-nums">{d.page_count}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatDate(d.uploaded_at)}</Td>
                      <Td className="max-w-xs">
                        <span className="block truncate text-xs text-muted-foreground">
                          {Object.entries(d.extracted ?? {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ") || "—"}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </SectionCard>
        </TabsContent>

        {/* -------------------------------------------- verification */}
        <TabsContent value="verification">
          <SectionCard
            title="Verification results"
            description="Simulated sandbox responses — no live government registry is contacted."
          >
            {verifications.length === 0 ? (
              <EmptyState title="No verification attempts recorded" />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Source</Th>
                    <Th>Status</Th>
                    <Th>Reference</Th>
                    <Th>Detail</Th>
                    <Th>Checked at</Th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((v: any) => (
                    <tr key={v.id}>
                      <Td className="font-medium">{v.source_code}</Td>
                      <Td>
                        <StatusBadge value={v.status} />
                      </Td>
                      <Td className="font-mono text-xs">{v.reference}</Td>
                      <Td className="text-muted-foreground">{v.detail}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatDate(v.checked_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------- compliance */}
        <TabsContent value="compliance">
          <SectionCard title="Requirement checks" description="Every configured tender requirement and its outcome.">
            {compliance.length === 0 ? (
              <EmptyState title="No compliance checks recorded" />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Requirement</Th>
                    <Th>Expected</Th>
                    <Th>Detected</Th>
                    <Th>Evidence</Th>
                    <Th>Verification</Th>
                    <Th>Result</Th>
                    <Th>Confidence</Th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.map((c: any) => (
                    <tr key={c.id}>
                      <Td className="font-medium">{c.requirement_title}</Td>
                      <Td className="text-muted-foreground">{c.expected_value}</Td>
                      <Td>{c.detected_value}</Td>
                      <Td className="text-xs text-muted-foreground">
                        {c.evidence_document}
                        {c.evidence_page ? `, p.${c.evidence_page}` : ""}
                      </Td>
                      <Td>
                        <StatusBadge value={c.verification_status} />
                      </Td>
                      <Td>
                        <StatusBadge value={c.result} />
                      </Td>
                      <Td>
                        <ScoreBar score={c.confidence} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </SectionCard>
        </TabsContent>

        {/* ---------------------------------------------------- risk */}
        <TabsContent value="risk" className="grid gap-4 xl:grid-cols-3">
          <SectionCard title="Risk score">
            <p className="text-4xl font-semibold tabular-nums">{bid.risk_score}</p>
            <div className="mt-2">
              <RiskPill score={bid.risk_score} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Bands: 0–30 low, 31–60 medium, 61–100 high. Scores come from configured rules, not from AI.
            </p>
          </SectionCard>
          <SectionCard title="Risk factors" className="xl:col-span-2">
            {flags.length === 0 ? (
              <EmptyState title="No risk signals raised" />
            ) : (
              <ul className="space-y-3">
                {flags.map((f) => (
                  <li key={f.id} className="rounded-sm border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{f.title}</p>
                      <StatusBadge value={f.severity} />
                    </div>
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-xs font-medium text-primary">Why flagged</summary>
                      <p className="mt-1 text-sm text-muted-foreground">{f.rationale}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Source: {f.source} · Rule code: {f.code} · Weight: {f.score}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------ evidence */}
        <TabsContent value="evidence" className="space-y-4">
          <SectionCard title="Evidence ledger" description="Every result traced to its rule, source and document.">
            <TableShell>
              <thead>
                <tr>
                  <Th>Rule / requirement</Th>
                  <Th>Expected</Th>
                  <Th>Detected</Th>
                  <Th>Source document</Th>
                  <Th>Page</Th>
                  <Th>Checked</Th>
                  <Th>Confidence</Th>
                  <Th>Verification</Th>
                </tr>
              </thead>
              <tbody>
                {compliance.map((c: any) => (
                  <tr key={`ev-${c.id}`}>
                    <Td className="font-medium">{c.requirement_title}</Td>
                    <Td className="text-muted-foreground">{c.expected_value}</Td>
                    <Td>{c.detected_value}</Td>
                    <Td className="text-muted-foreground">{c.evidence_document}</Td>
                    <Td className="tabular-nums">{c.evidence_page ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{formatDate(c.checked_at)}</Td>
                    <Td>
                      <ScoreBar score={c.confidence} />
                    </Td>
                    <Td>
                      <StatusBadge value={c.verification_status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </SectionCard>

          <SectionCard title="Cross-submission signals" description="Metadata shared with other bids on this tender.">
            {linkedBids.length === 0 ? (
              <EmptyState title="No shared submission metadata detected" />
            ) : (
              <ul className="space-y-2 text-sm">
                {linkedBids.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                    <Link to="/bids/$bidId" params={{ bidId: l.id }} className="font-medium text-primary hover:underline">
                      {l.bidCode}
                    </Link>
                    <span className="text-muted-foreground">{l.vendorName}</span>
                    {l.sharedIp && <StatusBadge value="SHARED IP" />}
                    {l.sharedDevice && <StatusBadge value="SHARED DEVICE" />}
                    {l.sharedDocument && <StatusBadge value="IDENTICAL DOCUMENT" />}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Submission IP {bid.submission_ip} · Device {bid.device_fingerprint} · Document hash{" "}
              {bid.document_hash} · Document author {bid.document_author}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ------------------------------------------------------ ai */}
        <TabsContent value="ai">
          <SectionCard
            title="AI Recommendation"
            description="Advisory analysis. The AI never finalises a procurement decision."
            actions={
              canSeeRecommendation && (
                <Button size="sm" variant="outline" onClick={() => ai.mutate()} disabled={ai.isPending}>
                  {ai.isPending ? "Analysing…" : "Generate advisory summary"}
                </Button>
              )
            }
          >
            {!canSeeRecommendation ? (
              <p className="text-sm text-muted-foreground">You do not have permission to view AI analysis.</p>
            ) : (
              <div className="space-y-4">
                {recommendation ? (
                  <div className="rounded-sm border border-border p-3">
                    <StatusBadge value={recommendation.recommendation} />
                    <p className="mt-2 text-sm text-foreground">{recommendation.rationale}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Model {recommendation.model} · Confidence {recommendation.confidence}% · Generated{" "}
                      {formatDate(recommendation.generated_at)}
                    </p>
                  </div>
                ) : (
                  <EmptyState title="No stored recommendation for this bid" />
                )}
                {aiSummary && (
                  <div className="whitespace-pre-wrap rounded-sm border border-border bg-muted/40 p-3 text-sm">
                    {aiSummary}
                  </div>
                )}
                <AdvisoryNotice />
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* --------------------------------------------------- audit */}
        <TabsContent value="audit">
          <SectionCard title="Audit history for this bid">
            {auditEvents.length === 0 ? (
              <EmptyState title="No audit events recorded yet" />
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Timestamp</Th>
                    <Th>Actor</Th>
                    <Th>Role</Th>
                    <Th>Action</Th>
                    <Th>Detail</Th>
                    <Th>Result</Th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((a: any) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatDate(a.created_at)}</Td>
                      <Td>
                        {a.actor_label}
                        <span className="block text-xs text-muted-foreground">{a.actor_code}</span>
                      </Td>
                      <Td className="text-muted-foreground">{a.actor_role}</Td>
                      <Td className="font-mono text-xs">{a.action}</Td>
                      <Td className="max-w-md text-muted-foreground">{a.detail}</Td>
                      <Td>
                        <StatusBadge value={a.result} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm final procurement decision</AlertDialogTitle>
            <AlertDialogDescription>
              {viewer?.fullName} ({viewer?.userCode}) will record <strong>{decision.toUpperCase()}</strong> for
              bid {bid.bid_code} by {vendor.name}. This decision is immutable and will be written to the audit
              trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => decide.mutate()}>Confirm decision</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
