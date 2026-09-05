import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DemoBanner } from "@/components/bidshield/DemoBanner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedShell,
});

function AuthedShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4">
          <Link
            to="/dashboard"
            className="font-mono text-sm font-bold uppercase tracking-[0.25em] text-primary"
          >
            BidShield<span className="text-foreground"> AI</span>
          </Link>
          <nav className="flex gap-5 text-sm text-muted-foreground">
            <Link to="/dashboard" activeProps={{ className: "text-foreground font-medium" }}>
              Tenders
            </Link>
            <Link to="/audit" activeProps={{ className: "text-foreground font-medium" }}>
              Audit trail
            </Link>
          </nav>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
