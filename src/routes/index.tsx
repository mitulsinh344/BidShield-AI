import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Network, ScrollText, UserCheck } from "lucide-react";
import { DemoBanner } from "@/components/bidshield/DemoBanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BidShield AI — Bid & Vendor Fraud Screening" },
      {
        name: "description",
        content:
          "BidShield AI surfaces collusion and vendor-risk signals across public tenders, while every qualification decision stays with a named human reviewer.",
      },
      { property: "og:title", content: "BidShield AI — Bid & Vendor Fraud Screening" },
      {
        property: "og:description",
        content:
          "Screen tenders for collusion patterns, shared identifiers and cover pricing. Advisory signals only — humans decide.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Network,
    title: "Collusion link analysis",
    body: "Shared bank fingerprints, addresses, devices and document metadata are cross-matched across every bid on a tender.",
  },
  {
    icon: ShieldCheck,
    title: "Explainable risk signals",
    body: "Each signal carries a severity, a score contribution and a written rationale you can put in front of an auditor.",
  },
  {
    icon: UserCheck,
    title: "Human-only decisions",
    body: "AI drafts an advisory summary. Qualify, disqualify or hold is always recorded against a named reviewer with a rationale.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit trail",
    body: "Every review, AI assist and decision is written to an immutable log for procurement oversight.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-primary">
          BidShield<span className="text-foreground"> AI</span>
        </span>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Enter demo
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="border-l-2 border-primary/60 py-14 pl-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Procurement integrity control room
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Catch bid rigging before the award, not after the audit.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            BidShield AI screens every submission on a tender for collusion patterns, shell-company
            indicators and cover pricing — then hands a fully evidenced case file to your reviewer.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open the sandbox
            </Link>
            <a
              href="#how"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              How screening works
            </a>
          </div>
        </section>

        <section id="how" className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-7">
              <f.icon className="h-5 w-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 rounded-lg border border-border bg-card p-7">
          <h2 className="text-base font-semibold">What this demo contains</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Three fictional tenders, eight fictional suppliers and twelve bids, seeded with realistic
            collusion patterns — a shared bank fingerprint between two "competing" bidders, identical
            document authorship, and a suspected bid-rotation sequence. No real company, registry or
            sanctions list is queried; all verification is simulated and labelled DEMO / SANDBOX.
          </p>
        </section>
      </main>
    </div>
  );
}
