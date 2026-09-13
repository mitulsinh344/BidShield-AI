/**
 * Shared, client-safe RBAC vocabulary.
 * The authoritative permission mapping lives in the database
 * (permissions / role_permissions) and is enforced by server functions and RLS.
 * This file only supplies labels and navigation metadata for the interface.
 */

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  procurement_admin: "Procurement Admin",
  government_officer: "Government Officer",
  bidder: "Bidder",
  auditor: "Auditor",
  admin: "Administrator (legacy)",
  reviewer: "Reviewer (legacy)",
  viewer: "Viewer (legacy)",
};

export const ASSIGNABLE_ROLES = [
  "super_admin",
  "procurement_admin",
  "government_officer",
  "bidder",
  "auditor",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_ID_PREFIX: Record<string, string> = {
  super_admin: "ADM",
  procurement_admin: "PADM",
  government_officer: "GOV-OFF",
  bidder: "BID",
  auditor: "AUD",
};

export function roleLabel(role: string | null | undefined) {
  if (!role) return "No role assigned";
  return ROLE_LABELS[role] ?? role;
}

export type NavItem = {
  to: string;
  label: string;
  permission: string | null;
  icon: string;
};

export const OPERATIONS_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", permission: "dashboard.view", icon: "gauge" },
  { to: "/tenders", label: "Tenders", permission: "tender.view", icon: "folder" },
  { to: "/bids", label: "Bids", permission: "bid.view", icon: "files" },
  { to: "/bidders", label: "Bidders", permission: "bidder.view", icon: "building" },
  { to: "/documents", label: "Documents", permission: "document.view", icon: "file" },
  { to: "/verification", label: "Verification Center", permission: "verification.view", icon: "badge" },
  { to: "/compliance", label: "Compliance", permission: "compliance.view", icon: "clipboard" },
  { to: "/risk", label: "Risk Analysis", permission: "risk.view", icon: "alert" },
  { to: "/reports", label: "Reports", permission: "report.view", icon: "chart" },
  { to: "/audit", label: "Audit Trail", permission: "audit.view", icon: "history" },
  { to: "/ai-reliability", label: "AI Reliability Center", permission: "recommendation.view", icon: "cpu" },
];

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin/users", label: "Users", permission: "user.view", icon: "users" },
  { to: "/admin/roles", label: "Roles & Permissions", permission: "role.view", icon: "shield" },
  { to: "/admin/organizations", label: "Organizations", permission: "user.view", icon: "landmark" },
  { to: "/admin/system", label: "System Configuration", permission: "system.configure", icon: "settings" },
  { to: "/admin/verification-sources", label: "Verification Sources", permission: "system.configure", icon: "plug" },
  { to: "/admin/ai", label: "AI Configuration", permission: "system.configure", icon: "sparkles" },
];

/** Bidders only ever see their own records; these routes are ownership-scoped. */
export const BIDDER_NAV: NavItem[] = [
  { to: "/bidder", label: "My Portal", permission: null, icon: "gauge" },
  { to: "/bidder/bids", label: "My Bids", permission: null, icon: "files" },
  { to: "/bidder/documents", label: "My Documents", permission: null, icon: "file" },
  { to: "/bidder/requirements", label: "Requirements", permission: null, icon: "clipboard" },
];

export const BOTTOM_NAV: NavItem[] = [
  { to: "/settings", label: "Settings", permission: null, icon: "settings" },
  { to: "/profile", label: "Profile", permission: null, icon: "user" },
];

/** Human-readable page title for a permission requirement failure. */
export const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "view the dashboard",
  "tender.view": "view tenders",
  "bid.view": "view bids",
  "bidder.view": "view bidders",
  "document.view": "view documents",
  "verification.view": "view verification results",
  "compliance.view": "view compliance results",
  "risk.view": "view risk analysis",
  "recommendation.view": "view AI recommendations",
  "decision.make": "record a procurement decision",
  "report.view": "view reports",
  "audit.view": "view audit logs",
  "user.view": "view user accounts",
  "role.view": "view roles and permissions",
  "system.configure": "change system configuration",
};
