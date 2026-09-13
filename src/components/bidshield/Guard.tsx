import type { ReactNode } from "react";
import { useViewer } from "@/lib/useViewer";
import { AccessRestricted, LoadingRows } from "./ui";
import { PERMISSION_LABELS } from "@/lib/rbac";

/**
 * Client-side route gate. This is convenience only — every server function
 * re-checks the permission against the database before returning data.
 */
export function Guard({
  permission,
  allowBidder = false,
  bidderOnly = false,
  children,
}: {
  permission?: string;
  allowBidder?: boolean;
  bidderOnly?: boolean;
  children: ReactNode;
}) {
  const { data: viewer, isLoading } = useViewer();
  if (isLoading || !viewer) return <LoadingRows rows={4} />;
  if (bidderOnly) {
    return viewer.isBidder ? <>{children}</> : <AccessRestricted what="bidder portal" />;
  }
  if (viewer.isBidder && !allowBidder) return <AccessRestricted what="internal procurement area" />;
  if (permission && !viewer.permissions.includes(permission)) {
    return <AccessRestricted what={PERMISSION_LABELS[permission] ?? permission} />;
  }
  return <>{children}</>;
}
