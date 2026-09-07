import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Severity = "high" | "medium" | "low";

export type RiskFlag = {
  id: string;
  bid_id: string;
  code: string;
  title: string;
  severity: string;
  score: number;
  rationale: string;
  source: string;
};

export type Vendor = {
  id: string;
  name: string;
  registration_no: string;
  country: string;
  incorporated_on: string;
  bank_fingerprint: string;
  contact_email: string;
  contact_phone: string;
  address: string;
};

export type Tender = {
  id: string;
  reference: string;
  title: string;
  buyer: string;
  category: string;
  estimated_value: number;
  currency: string;
  closes_at: string;
  status: string;
};

export type Decision = {
  id: string;
  bid_id: string;
  decision: string;
  rationale: string;
  decided_by: string;
  decided_at: string;
};

export type BidRow = {
  id: string;
  tender_id: string;
  amount: number;
  submitted_at: string;
  submission_ip: string;
  device_fingerprint: string;
  document_hash: string;
  document_author: string;
  risk_score: number;
  vendor: Vendor;
  flags: RiskFlag[];
  decision: Decision | null;
};

function severityRank(s: string) {
  return s === "high" ? 0 : s === "medium" ? 1 : 2;
}

/** Advisory band only — never a qualification outcome. */
export function riskBand(score: number): Severity {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export const getViewer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("full_name, organisation").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r: { role: string }) => r.role);
    return {
      userId,
      fullName: (profile?.full_name as string | null) ?? "Reviewer",
      organisation: (profile?.organisation as string | null) ?? "Demo Procurement Authority",
      roles: roleList,
      canDecide: roleList.includes("admin") || roleList.includes("reviewer"),
    };
  });

export const listTenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: tenders, error } = await supabase
      .from("tenders")
      .select("*")
      .order("closes_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: bids } = await supabase.from("bids").select("id, tender_id, risk_score");
    const { data: decisions } = await supabase.from("decisions").select("bid_id, decision");
    const decided = new Set((decisions ?? []).map((d: { bid_id: string }) => d.bid_id));

    return (tenders ?? []).map((t: Tender) => {
      const own = (bids ?? []).filter((b: { tender_id: string }) => b.tender_id === t.id);
      return {
        ...t,
        estimated_value: Number(t.estimated_value),
        bidCount: own.length,
        highRiskCount: own.filter((b: { risk_score: number }) => riskBand(b.risk_score) === "high")
          .length,
        pendingReview: own.filter((b: { id: string }) => !decided.has(b.id)).length,
      };
    });
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadBids(supabase: any, tenderId: string): Promise<BidRow[]> {
  const { data: bids } = await supabase
    .from("bids")
    .select("*, vendor:vendors(*)")
    .eq("tender_id", tenderId)
    .order("risk_score", { ascending: false });
  const rows = (bids ?? []) as (BidRow & { vendor: Vendor })[];
  const ids = rows.map((b) => b.id);
  if (ids.length === 0) return [];
  const [{ data: flags }, { data: decisions }] = await Promise.all([
    supabase.from("risk_flags").select("*").in("bid_id", ids),
    supabase.from("decisions").select("*").in("bid_id", ids),
  ]);
  const flagList = (flags ?? []) as RiskFlag[];
  const decisionList = (decisions ?? []) as Decision[];
  return rows.map((b) => ({
    ...b,
    amount: Number(b.amount),
    flags: flagList
      .filter((f) => f.bid_id === b.id)
      .sort((a, z) => severityRank(a.severity) - severityRank(z.severity)),
    decision: decisionList.find((d) => d.bid_id === b.id) ?? null,
  }));
}

export const getTenderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenderId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tender, error } = await supabase
      .from("tenders")
      .select("*")
      .eq("id", data.tenderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tender) return null;
    const bids = await loadBids(supabase, data.tenderId);
    return {
      tender: { ...(tender as Tender), estimated_value: Number((tender as Tender).estimated_value) },
      bids,
    };
  });

export const getBidDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: bid, error } = await supabase
      .from("bids")
      .select("*, vendor:vendors(*), tender:tenders(*)")
      .eq("id", data.bidId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bid) return null;
    const row = bid as BidRow & { tender: Tender };
    const [{ data: flags }, { data: decisions }, { data: siblings }] = await Promise.all([
      supabase.from("risk_flags").select("*").eq("bid_id", row.id),
      supabase.from("decisions").select("*").eq("bid_id", row.id),
      supabase
        .from("bids")
        .select("id, amount, submission_ip, device_fingerprint, document_hash, vendor:vendors(name)")
        .eq("tender_id", row.tender_id),
    ]);
    const flagList = ((flags ?? []) as RiskFlag[]).sort(
      (a, z) => severityRank(a.severity) - severityRank(z.severity),
    );
    const linked = ((siblings ?? []) as {
      id: string;
      submission_ip: string;
      device_fingerprint: string;
      document_hash: string;
      vendor: { name: string };
    }[])
      .filter(
        (s) =>
          s.id !== row.id &&
          (s.submission_ip === row.submission_ip ||
            s.device_fingerprint === row.device_fingerprint ||
            s.document_hash === row.document_hash),
      )
      .map((s) => ({
        id: s.id,
        vendorName: s.vendor?.name ?? "Unknown bidder",
        sharedIp: s.submission_ip === row.submission_ip,
        sharedDevice: s.device_fingerprint === row.device_fingerprint,
        sharedDocument: s.document_hash === row.document_hash,
      }));
    return {
      bid: { ...row, amount: Number(row.amount) },
      tender: { ...row.tender, estimated_value: Number(row.tender.estimated_value) },
      vendor: row.vendor,
      flags: flagList,
      decision: ((decisions ?? []) as Decision[])[0] ?? null,
      linkedBids: linked,
    };
  });

export const recordDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string; decision: string; rationale: string }) => {
    if (!["qualify", "disqualify", "hold"].includes(input.decision)) {
      throw new Error("Choose qualify, disqualify or hold.");
    }
    const rationale = input.rationale.trim();
    if (rationale.length < 20) {
      throw new Error("Please write at least 20 characters explaining your decision.");
    }
    if (rationale.length > 2000) throw new Error("Rationale is too long.");
    return { bidId: input.bidId, decision: input.decision, rationale };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("decisions")
      .select("id")
      .eq("bid_id", data.bidId)
      .maybeSingle();
    if (existing) throw new Error("This bid already has a recorded decision.");

    const { error } = await supabase.from("decisions").insert({
      bid_id: data.bidId,
      decision: data.decision,
      rationale: data.rationale,
      decided_by: userId,
    });
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    await supabase.from("audit_events").insert({
      actor_id: userId,
      actor_label: (profile?.full_name as string | null) ?? "Reviewer",
      action: `decision.${data.decision}`,
      entity_type: "bid",
      entity_id: data.bidId,
      detail: data.rationale.slice(0, 300),
    });
    return { ok: true };
  });

export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      actor_label: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      detail: string;
      created_at: string;
    }[];
  });

export const runAiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: bid } = await supabase
      .from("bids")
      .select("*, vendor:vendors(*), tender:tenders(*)")
      .eq("id", data.bidId)
      .maybeSingle();
    if (!bid) throw new Error("Bid not found.");
    const row = bid as BidRow & { tender: Tender };
    const { data: flags } = await supabase.from("risk_flags").select("*").eq("bid_id", row.id);

    const evidence = {
      tender: { reference: row.tender.reference, title: row.tender.title },
      bidder: row.vendor.name,
      amount: row.amount,
      submitted_at: row.submitted_at,
      signals: ((flags ?? []) as RiskFlag[]).map((f) => ({
        title: f.title,
        severity: f.severity,
        rationale: f.rationale,
      })),
    };

    const apiKey = process.env["LOVABLE_API_KEY"];
    let summary: string;
    if (!apiKey) {
      summary = fallbackSummary(evidence);
    } else {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            messages: [
              {
                role: "system",
                content:
                  "You are an advisory assistant for public procurement integrity analysts working on a clearly labelled DEMO/SANDBOX dataset. Summarise the supplied risk signals, list what a human should verify, and note the limitations of the evidence. You must NEVER state or imply a qualification outcome, never recommend qualifying, disqualifying or excluding a bidder, and never assert wrongdoing. End with the sentence: 'Advisory only — the qualification decision rests with the human reviewer.' Keep it under 200 words, plain prose with short bullet lines.",
              },
              { role: "user", content: JSON.stringify(evidence) },
            ],
          }),
        });
        if (!res.ok) throw new Error(`gateway ${res.status}`);
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        summary = json.choices?.[0]?.message?.content?.trim() || fallbackSummary(evidence);
      } catch {
        summary = fallbackSummary(evidence);
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    await supabase.from("audit_events").insert({
      actor_id: userId,
      actor_label: (profile?.full_name as string | null) ?? "Reviewer",
      action: "ai.assist_requested",
      entity_type: "bid",
      entity_id: row.id,
      detail: "AI advisory summary generated (no decision made by AI).",
    });

    return { summary };
  });

function fallbackSummary(evidence: {
  bidder: string;
  signals: { title: string; severity: string; rationale: string }[];
}): string {
  const lines = evidence.signals.length
    ? evidence.signals.map((s) => `• ${s.title} (${s.severity}): ${s.rationale}`).join("\n")
    : "• No rule-based signals were raised for this submission in the sandbox dataset.";
  return `Signals recorded against ${evidence.bidder}:\n${lines}\n\nSuggested checks for the reviewer: confirm the shared identifiers against source documents, request clarification from the bidders involved, and verify ownership declarations with the company registry.\n\nAdvisory only — the qualification decision rests with the human reviewer.`;
}
