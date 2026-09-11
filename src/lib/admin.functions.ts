/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit, ForbiddenError } from "./bidshield.functions";

const ROLES = ["super_admin", "procurement_admin", "government_officer", "bidder", "auditor"];
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"];
const PREFIX: Record<string, string> = {
  super_admin: "ADM",
  procurement_admin: "PADM",
  government_officer: "GOV-OFF",
  bidder: "BID",
  auditor: "AUD",
};

async function ensure(context: any, permission: string) {
  const { data, error } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _perm: permission,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new ForbiddenError(permission);
}

/** Procurement admins may not touch super admin accounts. */
async function guardTarget(context: any, targetId: string) {
  const { data: mine } = await context.supabase.rpc("has_permission", {
    _user_id: context.userId,
    _perm: "role.manage",
  });
  if (mine) return;
  const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", targetId);
  if ((roles ?? []).some((r: any) => r.role === "super_admin")) {
    throw new Error("You cannot modify a Super Admin account.");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "user.view");
    const { supabase } = context;
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, organization:organizations(code, name)")
        .order("user_code"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const users = (profiles ?? []).map((p: any) => ({
      id: p.id as string,
      userCode: (p.user_code as string) ?? "—",
      fullName: (p.full_name as string) ?? "—",
      email: (p.email as string) ?? "—",
      phone: (p.phone as string) ?? "",
      department: (p.department as string) ?? "",
      organization: p.organization?.name ?? p.organisation ?? "—",
      organizationCode: p.organization?.code ?? "",
      role: (roles ?? []).find((r: any) => r.user_id === p.id)?.role ?? null,
      status: (p.status as string) ?? "ACTIVE",
      createdAt: p.created_at as string,
      lastLoginAt: (p.last_login_at as string) ?? null,
      loginCount: (p.login_count as number) ?? 0,
      mustChangePassword: Boolean(p.must_change_password),
    }));
    return {
      users,
      stats: {
        total: users.length,
        active: users.filter((u) => u.status === "ACTIVE").length,
        disabled: users.filter((u) => u.status !== "ACTIVE").length,
        officers: users.filter((u) => u.role === "government_officer").length,
        bidders: users.filter((u) => u.role === "bidder").length,
        auditors: users.filter((u) => u.role === "auditor").length,
      },
    };
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }) => {
    await ensure(context, "user.view");
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, organization:organizations(code, name)")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) return null;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.userId);
    const roleList = (roles ?? []).map((r: any) => r.role as string);
    const { data: perms } = roleList.length
      ? await supabase.from("role_permissions").select("permission_code, scope").in("role", roleList)
      : { data: [] as any[] };
    const { data: activity } = await supabase
      .from("audit_events")
      .select("*")
      .eq("actor_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    const p: any = profile;
    return {
      id: p.id as string,
      userCode: (p.user_code as string) ?? "—",
      fullName: (p.full_name as string) ?? "—",
      email: (p.email as string) ?? "—",
      phone: (p.phone as string) ?? "",
      department: (p.department as string) ?? "",
      organization: p.organization?.name ?? p.organisation ?? "—",
      organizationCode: p.organization?.code ?? "",
      status: (p.status as string) ?? "ACTIVE",
      createdAt: p.created_at as string,
      lastLoginAt: (p.last_login_at as string) ?? null,
      loginCount: (p.login_count as number) ?? 0,
      mustChangePassword: Boolean(p.must_change_password),
      roles: roleList,
      permissions: [...new Set((perms ?? []).map((x: any) => x.permission_code as string))].sort(),
      activity: (activity ?? []) as any[],
    };
  });

export const suggestUserCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string }) => {
    if (!ROLES.includes(input.role)) throw new Error("Unknown role.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "user.create");
    const prefix = PREFIX[data.role];
    const { data: rows } = await context.supabase
      .from("profiles")
      .select("user_code")
      .like("user_code", `${prefix}-%`);
    let max = 0;
    for (const r of rows ?? []) {
      const n = Number(String(r.user_code).replace(`${prefix}-`, ""));
      if (Number.isFinite(n) && n > max) max = n;
    }
    return { userCode: `${prefix}-${String(max + 1).padStart(3, "0")}` };
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userCode: string;
      fullName: string;
      email: string;
      phone: string;
      organizationCode: string;
      department: string;
      role: string;
      temporaryPassword: string;
      status: string;
      forcePasswordChange: boolean;
    }) => {
      const email = input.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
      if (input.fullName.trim().length < 3) throw new Error("Enter the person's full name.");
      if (!/^[A-Z]+(-[A-Z]+)*-\d{3,}$/.test(input.userCode.trim()))
        throw new Error("User ID must look like GOV-OFF-001.");
      if (!ROLES.includes(input.role)) throw new Error("Choose a valid role.");
      if (!STATUSES.includes(input.status)) throw new Error("Choose a valid account status.");
      if (input.temporaryPassword.length < 10)
        throw new Error("The temporary password must be at least 10 characters.");
      if (!input.organizationCode) throw new Error("Choose an organization.");
      return {
        ...input,
        email,
        userCode: input.userCode.trim().toUpperCase(),
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        department: input.department.trim(),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await ensure(context, "user.create");
    if (data.role === "super_admin") await ensure(context, "role.manage");
    const { supabase } = context;

    const { data: dupe } = await supabase
      .from("profiles")
      .select("id")
      .or(`user_code.eq.${data.userCode},email.eq.${data.email}`)
      .maybeSingle();
    if (dupe) throw new Error("A user with this User ID or email already exists.");

    const { data: org } = await supabase
      .from("organizations")
      .select("id, code, name")
      .eq("code", data.organizationCode)
      .maybeSingle();
    if (!org) throw new Error("Unknown organization.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, organisation: org.code, created_by_admin: true },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");
    const newId = created.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: newId,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        department: data.department,
        organisation: org.name,
        org_id: org.id,
        user_code: data.userCode,
        status: data.status,
        must_change_password: data.forcePasswordChange,
        login_count: 0,
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });

    await writeAudit(context, {
      action: "user.created",
      entity_type: "user",
      entity_id: newId,
      detail: `Created ${data.fullName} (${data.userCode}) in ${org.name}.`,
      new_value: data.role,
    });
    return { ok: true, id: newId };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      fullName: string;
      phone: string;
      department: string;
      organizationCode: string;
    }) => {
      if (input.fullName.trim().length < 3) throw new Error("Enter the person's full name.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await ensure(context, "user.update");
    await guardTarget(context, data.userId);
    const { supabase } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("code", data.organizationCode)
      .maybeSingle();
    const { data: before } = await supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", data.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        department: data.department.trim(),
        ...(org ? { org_id: org.id, organisation: org.name } : {}),
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await writeAudit(context, {
      action: "user.updated",
      entity_type: "user",
      entity_id: data.userId,
      detail: `Updated profile details for ${data.fullName}.`,
      old_value: `${before?.full_name ?? ""} / ${before?.department ?? ""}`,
      new_value: `${data.fullName} / ${data.department}`,
    });
    return { ok: true };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; status: string }) => {
    if (!STATUSES.includes(input.status)) throw new Error("Unknown account status.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "user.disable");
    await guardTarget(context, data.userId);
    if (data.userId === context.userId) throw new Error("You cannot change your own account status.");
    const { supabase } = context;
    const { data: before } = await supabase
      .from("profiles")
      .select("status, full_name")
      .eq("id", data.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    // A non-active account is also banned at the identity provider, so it cannot sign in.
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.status === "ACTIVE" ? "none" : "876000h",
    });

    await writeAudit(context, {
      action: data.status === "ACTIVE" ? "user.enabled" : "user.disabled",
      entity_type: "user",
      entity_id: data.userId,
      detail: `Account status for ${before?.full_name ?? "user"} changed.`,
      old_value: before?.status ?? null,
      new_value: data.status,
    });
    return { ok: true };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: string }) => {
    if (!ROLES.includes(input.role)) throw new Error("Unknown role.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "role.manage");
    if (data.userId === context.userId) throw new Error("You cannot change your own role.");
    const { supabase } = context;
    const { data: before } = await supabase.from("user_roles").select("role").eq("user_id", data.userId);
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, user_code")
      .eq("id", data.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);

    await writeAudit(context, {
      action: "ROLE_CHANGED",
      entity_type: "user",
      entity_id: data.userId,
      detail: `Role changed for ${profile?.full_name ?? "user"} (${profile?.user_code ?? "—"}).`,
      old_value: (before ?? []).map((r: any) => r.role).join(", ") || "none",
      new_value: data.role,
    });
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; temporaryPassword: string; forceChange: boolean }) => {
    if (input.temporaryPassword.length < 10)
      throw new Error("The temporary password must be at least 10 characters.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensure(context, "user.reset_password");
    await guardTarget(context, data.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, user_code")
      .eq("id", data.userId)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.temporaryPassword,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: data.forceChange })
      .eq("id", data.userId);

    // The password itself is never stored or echoed back — only the fact of the reset.
    await writeAudit(context, {
      action: "user.password_reset",
      entity_type: "user",
      entity_id: data.userId,
      detail: `Temporary password issued for ${profile?.full_name ?? "user"} (${profile?.user_code ?? "—"}).`,
      new_value: data.forceChange ? "force_change=true" : "force_change=false",
    });
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensure(context, "user.view");
    const { supabase } = context;
    const [{ data: profiles }, { data: roles }, { data: events }] = await Promise.all([
      supabase.from("profiles").select("id, status"),
      supabase.from("user_roles").select("role"),
      supabase
        .from("audit_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    const distribution: Record<string, number> = {};
    for (const r of roles ?? []) distribution[r.role] = (distribution[r.role] ?? 0) + 1;
    const security = (events ?? []).filter((e: any) =>
      ["ROLE_CHANGED", "user.disabled", "user.password_reset", "user.created", "auth.login"].includes(
        e.action,
      ),
    );
    return {
      totalUsers: (profiles ?? []).length,
      activeUsers: (profiles ?? []).filter((p: any) => p.status === "ACTIVE").length,
      distribution,
      recentActions: (events ?? []) as any[],
      securityEvents: security as any[],
    };
  });
