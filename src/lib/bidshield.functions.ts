/* eslint-disable @typescript-eslint/no-explicit-any */
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
  pan: string | null;
  gstin: string | null;
  udyam: string | null;
  annual_turnover: number | null;
  msme_class: string | null;
  owner_user_id: string | null;
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
  department: string;
  description: string;
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
  bid_code: string | null;
  tender_id: string;
  amount: number;
  submitted_at: string;
  submission_ip: string;
  device_fingerprint: string;
  document_hash: string;
  document_author: string;
  risk_score: number;
  status: string;
  compliance_score: number;
  verification_status: string;
  scenario: string;
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

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`FORBIDDEN:${permission}`);
  }
}

/** Server-side permission gate. Never trust the browser. */
async function ensure(context: any, permission: string) {
  const { data, error } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _perm: permission,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new ForbiddenError(permission);
}

async function actor(context: any) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    context.supabase
      .from("profiles")
      .select("full_name, user_code, organisation")
      .eq("id", context.userId)
      .maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
  ]);
  return {
    label: profile?.full_name ?? "Unknown user",
    code: profile?.user_code ?? "",
    organisation: profile?.organisation ?? "",
    role: (roles ?? [])[0]?.role ?? "",
  };
}

export async function writeAudit(
  context: any,
  entry: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    detail: string;
    old_value?: string | null;
    new_value?: string | null;
    result?: string;
  },
) {
  const a = await actor(context);
  await context.supabase.from("audit_events").insert({
    actor_id: context.userId,
    actor_label: a.label,
    actor_code: a.code,
    actor_role: a.role,
    organisation: a.organisation,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    detail: entry.detail.slice(0, 500),
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
    result: entry.result ?? "SUCCESS",
    client_info: "Web application (DEMO / SANDBOX)",
  });
}

/* =========================================================
 * Viewer / session
 * ======================================================= */
export const getViewer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, organization:organizations(code, name)")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r: any) => r.role as string);

    let permissions: string[] = [];
    let ownPermissions: string[] = [];
    if (roleList.length) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission_code, scope")
        .in("role", roleList);
      const rows = (perms ?? []) as any[];
      // Only 'all' scope grants platform-wide access; 'own' scope is limited to
      // the signed-in party's own records and is enforced by row-level security.
      permissions = [...new Set(rows.filter((p) => p.scope === "all").map((p) => p.permission_code as string))];
      ownPermissions = [...new Set(rows.filter((p) => p.scope === "own").map((p) => p.permission_code as string))];
    }

    const primaryRole = roleList[0] ?? null;
    const p: any = profile ?? {};
    return {
      userId,
      fullName: (p.full_name as string | null) ?? "User",
      userCode: (p.user_code as string | null) ?? "—",
      email: (p.email as string | null) ?? "",
      phone: (p.phone as string | null) ?? "",
      department: (p.department as string | null) ?? "",
      status: (p.status as string | null) ?? "ACTIVE",
      organisation: p.organization?.name ?? (p.organisation as string | null) ?? "Demo Organization",
      organisationCode: p.organization?.code ?? "DEMO-ORG",
      lastLoginAt: (p.last_login_at as string | null) ?? null,
      loginCount: (p.login_count as number | null) ?? 0,
      roles: roleList,
      role: primaryRole,
      permissions,
      ownPermissions,
      isBidder: primaryRole === "bidder",
      canDecide: permissions.includes("decision.make"),
    };
  });

/** Records a login for the activity trail. Called once after sign-in. */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("login_count, status")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.status && profile.status !== "ACTIVE") {
      return { ok: false, status: profile.status as string };
    }
    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString(), login_count: (profile?.login_count ?? 0) + 1 })
      .eq("id", userId);
    await writeAudit(context, {
      action: "auth.login",
      entity_type: "session",
      entity_id: userId,
      detail: "User signed in.",
    });
    return { ok: true, status: "ACTIVE" };
  });

/* =========================================================
 * Dashboard
 * ======================================================= */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "dashboard.view");
    const { supabase } = context;

    const [{ data: tenders }, { data: bids }, { data: decisions }, { data: documents }, { data: checks }] =
      await Promise.all([
        supabase.from("tenders").select("id, status"),
        supabase.from("bids").select("id, status, risk_score, verification_status, compliance_score"),
        supabase.from("decisions").select("bid_id, decision"),
        supabase.from("documents").select("id, status, verification_status"),
        supabase.from("compliance_checks").select("result"),
      ]);

    const bidList = bids ?? [];
    const decided = new Set((decisions ?? []).map((d: any) => d.bid_id));

    const riskBuckets = { high: 0, medium: 0, low: 0 };
    for (const b of bidList) riskBuckets[riskBand(b.risk_score)] += 1;

    const complianceBuckets = { PASS: 0, FAIL: 0, REVIEW: 0, PENDING: 0 } as Record<string, number>;
    for (const c of checks ?? []) complianceBuckets[c.result] = (complianceBuckets[c.result] ?? 0) + 1;

    const verificationBuckets: Record<string, number> = {};
    for (const b of bidList)
      verificationBuckets[b.verification_status] = (verificationBuckets[b.verification_status] ?? 0) + 1;

    const tenderBuckets: Record<string, number> = {};
    for (const t of tenders ?? []) tenderBuckets[t.status] = (tenderBuckets[t.status] ?? 0) + 1;

    return {
      stats: {
        activeTenders: (tenders ?? []).length,
        totalBids: bidList.length,
        pendingReviews: bidList.filter((b: any) => !decided.has(b.id)).length,
        highRiskBids: riskBuckets.high,
        verificationPending: bidList.filter((b: any) => b.verification_status === "PENDING").length,
        documentsAwaitingReview: (documents ?? []).filter(
          (d: any) => d.verification_status !== "VERIFIED",
        ).length,
        completedEvaluations: decided.size,
        manualReview: bidList.filter((b: any) => b.status === "MANUAL_REVIEW").length,
      },
      riskBuckets,
      complianceBuckets,
      verificationBuckets,
      tenderBuckets,
    };
  });

/* =========================================================
 * Tenders
 * ======================================================= */
export const listTenders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "tender.view");
    const { supabase } = context;
    const { data: tenders, error } = await supabase
      .from("tenders")
      .select("*")
      .order("closes_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: bids } = await supabase.from("bids").select("id, tender_id, risk_score, status");
    const { data: decisions } = await supabase.from("decisions").select("bid_id");
    const decided = new Set((decisions ?? []).map((d: any) => d.bid_id));

    return (tenders ?? []).map((t: any) => {
      const own = (bids ?? []).filter((b: any) => b.tender_id === t.id);
      return {
        ...t,
        estimated_value: Number(t.estimated_value),
        bidCount: own.length,
        highRiskCount: own.filter((b: any) => riskBand(b.risk_score) === "high").length,
        pendingReview: own.filter((b: any) => !decided.has(b.id)).length,
      } as Tender & {
        bidCount: number;
        highRiskCount: number;
        pendingReview: number;
      };
    });
  });

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
    await ensure(context, "tender.view");
    const { supabase } = context;
    const { data: tender, error } = await supabase
      .from("tenders")
      .select("*")
      .eq("id", data.tenderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tender) return null;
    const [bids, { data: requirements }] = await Promise.all([
      loadBids(supabase, data.tenderId),
      supabase
        .from("tender_requirements")
        .select("*")
        .eq("tender_id", data.tenderId)
        .order("sort_order"),
    ]);
    return {
      tender: { ...(tender as any), estimated_value: Number((tender as any).estimated_value) } as Tender,
      bids,
      requirements: (requirements ?? []) as any[],
    };
  });

/* =========================================================
 * Bids
 * ======================================================= */
export const listBids = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "bid.view");
    const { supabase } = context;
    const { data, error } = await supabase
      .from("bids")
      .select("*, vendor:vendors(id, name), tender:tenders(id, reference, title)")
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const ids = rows.map((r) => r.id);
    const [{ data: docs }, { data: decisions }] = await Promise.all([
      ids.length
        ? supabase.from("documents").select("bid_id, verification_status").in("bid_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("decisions").select("bid_id, decision").in("bid_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    return rows.map((r) => ({
      id: r.id as string,
      bidCode: (r.bid_code as string) ?? "—",
      tenderRef: r.tender?.reference ?? "—",
      tenderTitle: r.tender?.title ?? "—",
      tenderId: r.tender?.id ?? r.tender_id,
      bidderName: r.vendor?.name ?? "—",
      bidderId: r.vendor?.id ?? null,
      submittedAt: r.submitted_at as string,
      amount: Number(r.amount),
      documentCount: (docs ?? []).filter((d: any) => d.bid_id === r.id).length,
      complianceScore: r.compliance_score as number,
      riskScore: r.risk_score as number,
      verificationStatus: r.verification_status as string,
      status: r.status as string,
      decision: (decisions ?? []).find((d: any) => d.bid_id === r.id)?.decision ?? null,
    }));
  });

export const getBidWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string }) => input)
  .handler(async ({ data, context }) => {
    await ensure(context, "bid.view");
    const { supabase, userId } = context;
    const { data: bid, error } = await supabase
      .from("bids")
      .select("*, vendor:vendors(*), tender:tenders(*)")
      .eq("id", data.bidId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bid) return null;
    const row = bid as any;

    const [
      { data: flags },
      { data: decisions },
      { data: documents },
      { data: checks },
      { data: verifications },
      { data: recommendation },
      { data: siblings },
      { data: audit },
    ] = await Promise.all([
      supabase.from("risk_flags").select("*").eq("bid_id", row.id),
      supabase.from("decisions").select("*").eq("bid_id", row.id),
      supabase.from("documents").select("*").eq("bid_id", row.id).order("doc_type"),
      supabase.from("compliance_checks").select("*").eq("bid_id", row.id),
      supabase.from("verification_results").select("*").eq("bid_id", row.id).order("source_code"),
      supabase
        .from("ai_recommendations")
        .select("*")
        .eq("bid_id", row.id)
        .order("generated_at", { ascending: false })
        .limit(1),
      supabase
        .from("bids")
        .select("id, bid_code, submission_ip, device_fingerprint, document_hash, vendor:vendors(name)")
        .eq("tender_id", row.tender_id),
      supabase
        .from("audit_events")
        .select("*")
        .eq("entity_id", row.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const flagList = ((flags ?? []) as RiskFlag[]).sort(
      (a, z) => severityRank(a.severity) - severityRank(z.severity),
    );

    const linked = ((siblings ?? []) as any[])
      .filter(
        (s) =>
          s.id !== row.id &&
          (s.submission_ip === row.submission_ip ||
            s.device_fingerprint === row.device_fingerprint ||
            s.document_hash === row.document_hash),
      )
      .map((s) => ({
        id: s.id as string,
        bidCode: (s.bid_code as string) ?? "—",
        vendorName: s.vendor?.name ?? "Unknown bidder",
        sharedIp: s.submission_ip === row.submission_ip,
        sharedDevice: s.device_fingerprint === row.device_fingerprint,
        sharedDocument: s.document_hash === row.document_hash,
      }));

    const isOwner = row.vendor?.owner_user_id === userId;

    return {
      bid: {
        ...row,
        amount: Number(row.amount),
      },
      tender: { ...row.tender, estimated_value: Number(row.tender.estimated_value) } as Tender,
      vendor: row.vendor as Vendor,
      flags: flagList,
      documents: (documents ?? []) as any[],
      compliance: (checks ?? []) as any[],
      verifications: (verifications ?? []) as any[],
      recommendation: ((recommendation ?? []) as any[])[0] ?? null,
      decision: ((decisions ?? []) as Decision[])[0] ?? null,
      linkedBids: linked,
      auditEvents: (audit ?? []) as any[],
      isOwner,
    };
  });

/** Backwards-compatible detail reader used by the tender comparison view. */
export const getBidDetail = getBidWorkspace;

export const recordDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string; decision: string; rationale: string }) => {
    if (!["qualify", "disqualify", "hold"].includes(input.decision)) {
      throw new Error("Choose qualify, disqualify or manual review.");
    }
    const rationale = input.rationale.trim();
    if (rationale.length < 20) {
      throw new Error("Please write at least 20 characters explaining your decision.");
    }
    if (rationale.length > 2000) throw new Error("Remarks are too long.");
    return { bidId: input.bidId, decision: input.decision, rationale };
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "decision.make");
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

    await supabase
      .from("bids")
      .update({ status: data.decision === "hold" ? "MANUAL_REVIEW" : "COMPLETED" })
      .eq("id", data.bidId);

    await writeAudit(context, {
      action: `decision.${data.decision}`,
      entity_type: "bid",
      entity_id: data.bidId,
      detail: data.rationale.slice(0, 300),
      new_value: data.decision.toUpperCase(),
    });
    return { ok: true };
  });

/* =========================================================
 * Bidders / documents / verification / compliance / risk
 * ======================================================= */
export const listBidders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "bidder.view");
    const { supabase } = context;
    const { data, error } = await supabase.from("vendors").select("*").order("name");
    if (error) throw new Error(error.message);
    const { data: bids } = await supabase.from("bids").select("vendor_id, risk_score");
    return (data ?? []).map((v: any) => {
      const own = (bids ?? []).filter((b: any) => b.vendor_id === v.id);
      return {
        ...v,
        annual_turnover: v.annual_turnover ? Number(v.annual_turnover) : null,
        bidCount: own.length,
        maxRisk: own.reduce((m: number, b: any) => Math.max(m, b.risk_score), 0),
      };
    });
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "document.view");
    const { data, error } = await context.supabase
      .from("documents")
      .select("*, bid:bids(id, bid_code, vendor:vendors(name))")
      .order("uploaded_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const listVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "verification.view");
    const { supabase } = context;
    const [{ data: sources }, { data: results }] = await Promise.all([
      supabase.from("verification_sources").select("*").order("name"),
      supabase
        .from("verification_results")
        .select("*, bid:bids(id, bid_code, vendor:vendors(name))")
        .order("checked_at", { ascending: false })
        .limit(300),
    ]);
    return { sources: (sources ?? []) as any[], results: (results ?? []) as any[] };
  });

export const listCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "compliance.view");
    const { data, error } = await context.supabase
      .from("compliance_checks")
      .select("*, bid:bids(id, bid_code, vendor:vendors(name), tender:tenders(reference))")
      .order("result")
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const listRisk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "risk.view");
    const { supabase } = context;
    const { data: bids } = await supabase
      .from("bids")
      .select("id, bid_code, risk_score, status, vendor:vendors(name), tender:tenders(reference)")
      .order("risk_score", { ascending: false });
    const ids = (bids ?? []).map((b: any) => b.id);
    const { data: flags } = ids.length
      ? await supabase.from("risk_flags").select("*").in("bid_id", ids)
      : { data: [] as any[] };
    return (bids ?? []).map((b: any) => ({
      ...b,
      flags: ((flags ?? []) as RiskFlag[])
        .filter((f) => f.bid_id === b.id)
        .sort((a, z) => severityRank(a.severity) - severityRank(z.severity)),
    }));
  });

export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string }) => input)
  .handler(async ({ data, context }) => {
    await ensure(context, "verification.run");
    const { supabase } = context;
    const now = new Date().toISOString();
    const { data: rows } = await supabase
      .from("verification_results")
      .select("id, status")
      .eq("bid_id", data.bidId);
    for (const r of rows ?? []) {
      await supabase.from("verification_results").update({ checked_at: now }).eq("id", r.id);
    }
    await writeAudit(context, {
      action: "verification.run",
      entity_type: "bid",
      entity_id: data.bidId,
      detail: "Re-queried all sandbox verification sources. No live registry was contacted.",
    });
    return { ok: true, checked: (rows ?? []).length };
  });

/* =========================================================
 * Notifications
 * ======================================================= */
export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as any[];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/* =========================================================
 * Audit
 * ======================================================= */
export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "audit.view");
    const { data, error } = await context.supabase
      .from("audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

/* =========================================================
 * Configuration & reference data
 * ======================================================= */
export const listPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "role.view");
    const { supabase } = context;
    const [{ data: permissions }, { data: rolePerms }] = await Promise.all([
      supabase.from("permissions").select("*").order("category").order("code"),
      supabase.from("role_permissions").select("*"),
    ]);
    return { permissions: (permissions ?? []) as any[], rolePermissions: (rolePerms ?? []) as any[] };
  });

export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "user.view");
    const { data } = await context.supabase.from("organizations").select("*").order("name");
    return (data ?? []) as any[];
  });

export const getSystemConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "system.configure");
    const { data } = await context.supabase.from("system_config").select("*").order("category");
    return (data ?? []) as any[];
  });

export const updateSystemConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; value: string }) => {
    if (!input.key) throw new Error("Missing setting.");
    if (input.value.trim().length === 0) throw new Error("Value cannot be empty.");
    if (input.value.length > 200) throw new Error("Value is too long.");
    return { key: input.key, value: input.value.trim() };
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "system.configure");
    const { supabase } = context;
    const { data: before } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    const { error } = await supabase
      .from("system_config")
      .update({ value: data.value, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    await writeAudit(context, {
      action: "system.config_updated",
      entity_type: "system_config",
      entity_id: null,
      detail: `Setting ${data.key} changed.`,
      old_value: before?.value ?? null,
      new_value: data.value,
    });
    return { ok: true };
  });

export const listVerificationSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "system.configure");
    const { data } = await context.supabase.from("verification_sources").select("*").order("name");
    return (data ?? []) as any[];
  });

export const updateVerificationSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => {
    if (!["AVAILABLE", "DEGRADED", "UNAVAILABLE"].includes(input.status)) {
      throw new Error("Unknown status.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "system.configure");
    const { supabase } = context;
    const { data: before } = await supabase
      .from("verification_sources")
      .select("code, status")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase
      .from("verification_sources")
      .update({ status: data.status, last_checked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context, {
      action: "verification_source.updated",
      entity_type: "verification_source",
      entity_id: data.id,
      detail: `Sandbox source ${before?.code ?? ""} status changed.`,
      old_value: before?.status ?? null,
      new_value: data.status,
    });
    return { ok: true };
  });

/* =========================================================
 * Reports
 * ======================================================= */
export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: string }) => {
    if (!["compliance", "risk", "verification", "decisions"].includes(input.kind)) {
      throw new Error("Unknown report type.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "report.generate");
    const { supabase } = context;
    const { data: bids } = await supabase
      .from("bids")
      .select(
        "bid_code, status, compliance_score, risk_score, verification_status, vendor:vendors(name), tender:tenders(reference)",
      )
      .order("risk_score", { ascending: false });
    const { data: decisions } = await supabase.from("decisions").select("bid_id, decision, decided_at");

    await writeAudit(context, {
      action: "report.generated",
      entity_type: "report",
      entity_id: null,
      detail: `Generated the ${data.kind} report (DEMO / SANDBOX data).`,
      new_value: data.kind,
    });

    return {
      kind: data.kind,
      generatedAt: new Date().toISOString(),
      rows: (bids ?? []).map((b: any) => ({
        bidCode: b.bid_code ?? "—",
        tender: b.tender?.reference ?? "—",
        bidder: b.vendor?.name ?? "—",
        status: b.status,
        compliance: b.compliance_score,
        risk: b.risk_score,
        verification: b.verification_status,
      })),
      decisionCount: (decisions ?? []).length,
    };
  });

/* =========================================================
 * AI advisory — never decides
 * ======================================================= */
export const runAiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bidId: string }) => input)
  .handler(async ({ data, context }) => {
    await ensure(context, "recommendation.view");
    const { supabase } = context;
    const { data: bid } = await supabase
      .from("bids")
      .select("*, vendor:vendors(*), tender:tenders(*)")
      .eq("id", data.bidId)
      .maybeSingle();
    if (!bid) throw new Error("Bid not found.");
    const row = bid as any;
    const [{ data: flags }, { data: checks }] = await Promise.all([
      supabase.from("risk_flags").select("*").eq("bid_id", row.id),
      supabase.from("compliance_checks").select("*").eq("bid_id", row.id),
    ]);

    const evidence = {
      tender: { reference: row.tender.reference, title: row.tender.title },
      bidder: row.vendor.name,
      amount: `${row.tender.currency} ${Number(row.amount)}`,
      submitted_at: row.submitted_at,
      compliance: ((checks ?? []) as any[]).map((c) => ({
        requirement: c.requirement_title,
        expected: c.expected_value,
        detected: c.detected_value,
        result: c.result,
        confidence: c.confidence,
      })),
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
                  "You are an advisory assistant for government procurement compliance officers working on a clearly labelled DEMO/SANDBOX dataset. Summarise the supplied compliance results and risk signals, list what the officer should verify, and note the limitations of the evidence. You must NEVER state or imply a qualification outcome, never recommend qualifying, disqualifying or excluding a bidder, and never assert wrongdoing. End with the sentence: 'Advisory only — the qualification decision rests with the human reviewer.' Keep it under 200 words, plain prose with short bullet lines.",
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

    await writeAudit(context, {
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
  compliance: { requirement: string; result: string; detected: string }[];
}): string {
  const failed = evidence.compliance.filter((c) => c.result !== "PASS");
  const complianceLines = failed.length
    ? failed.map((c) => `• ${c.requirement} — ${c.result}: ${c.detected}`).join("\n")
    : "• All configured requirements matched the submitted documents.";
  const signalLines = evidence.signals.length
    ? evidence.signals.map((s) => `• ${s.title} (${s.severity}): ${s.rationale}`).join("\n")
    : "• No rule-based risk signals were raised for this submission.";
  return `Compliance observations for ${evidence.bidder}:\n${complianceLines}\n\nRisk signals:\n${signalLines}\n\nSuggested checks for the officer: confirm the extracted values against the source documents, re-run any verification source that returned pending, and seek clarification from the bidder where a document is missing.\n\nAdvisory only — the qualification decision rests with the human reviewer.`;
}

/* =========================================================
 * Bidder portal — own records only.
 * No permission gate is used here: the bidder's own vendor record is
 * resolved from the session and row-level security restricts every read.
 * ======================================================= */
export const getBidderPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: vendor } = await supabase
      .from("vendors")
      .select("*")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!vendor) {
      return { vendor: null, bids: [], documents: [], requirements: [], compliance: [], verifications: [] };
    }
    const { data: bids } = await supabase
      .from("bids")
      .select("*, tender:tenders(id, reference, title, closes_at, status)")
      .eq("vendor_id", (vendor as any).id)
      .order("submitted_at", { ascending: false });
    const bidRows = (bids ?? []) as any[];
    const ids = bidRows.map((b) => b.id);
    const tenderIds = [...new Set(bidRows.map((b) => b.tender_id))];

    const [{ data: documents }, { data: requirements }, { data: compliance }, { data: verifications }] =
      await Promise.all([
        ids.length
          ? supabase.from("documents").select("*").in("bid_id", ids).order("doc_type")
          : Promise.resolve({ data: [] as any[] }),
        tenderIds.length
          ? supabase.from("tender_requirements").select("*").in("tender_id", tenderIds).order("sort_order")
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase
              .from("compliance_checks")
              .select("bid_id, requirement_title, expected_value, detected_value, result, verification_status")
              .in("bid_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        ids.length
          ? supabase.from("verification_results").select("*").in("bid_id", ids)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    return {
      vendor: {
        ...(vendor as any),
        annual_turnover: (vendor as any).annual_turnover ? Number((vendor as any).annual_turnover) : null,
      },
      // Internal risk scoring and officer notes are intentionally excluded.
      bids: bidRows.map((b) => ({
        id: b.id as string,
        bidCode: (b.bid_code as string) ?? "—",
        amount: Number(b.amount),
        submittedAt: b.submitted_at as string,
        status: b.status as string,
        verificationStatus: b.verification_status as string,
        tenderRef: b.tender?.reference ?? "—",
        tenderTitle: b.tender?.title ?? "—",
        tenderId: b.tender?.id ?? b.tender_id,
      })),
      documents: (documents ?? []) as any[],
      requirements: (requirements ?? []) as any[],
      compliance: (compliance ?? []) as any[],
      verifications: (verifications ?? []) as any[],
    };
  });
