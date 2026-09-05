import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditEvents } from "@/lib/bidshield.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — BidShield AI" },
      {
        name: "description",
        content:
          "Append-only record of every review action, AI advisory request and qualification decision.",
      },
      { property: "og:title", content: "Audit trail — BidShield AI" },
      {
        property: "og:description",
        content: "Append-only record of reviews, AI assists and decisions.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const fetchAudit = useServerFn(listAuditEvents);
  const q = useQuery({ queryKey: ["audit"], queryFn: () => fetchAudit() });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Oversight
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Audit trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entries can be added but never edited or deleted.
        </p>
      </div>

      {q.isLoading && <Skeleton className="h-64 w-full" />}

      {!q.isLoading && (q.data ?? []).length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No activity recorded yet. Request an AI summary or record a decision on a bid and it will
          appear here.
        </p>
      )}

      <ol className="space-y-2">
        {(q.data ?? []).map((e) => (
          <li key={e.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-primary">
                {e.action}
              </span>
              <span className="text-sm font-medium">{e.actor_label}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString("en-GB")}
              </span>
            </div>
            {e.detail && <p className="mt-2 text-sm text-muted-foreground">{e.detail}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
