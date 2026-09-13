import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  ClipboardList,
  Cpu,
  FileText,
  Files,
  FolderOpen,
  Gauge,
  History,
  Landmark,
  LogOut,
  PieChart,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  BadgeCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useViewer } from "@/lib/useViewer";
import { OPERATIONS_NAV, ADMIN_NAV, BIDDER_NAV, BOTTOM_NAV, roleLabel, type NavItem } from "@/lib/rbac";
import { listNotifications, markNotificationRead } from "@/lib/bidshield.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "./ui";

const ICONS: Record<string, typeof Gauge> = {
  gauge: Gauge,
  folder: FolderOpen,
  files: Files,
  building: Building2,
  file: FileText,
  badge: BadgeCheck,
  clipboard: ClipboardList,
  alert: AlertTriangle,
  chart: PieChart,
  history: History,
  cpu: Cpu,
  users: Users,
  shield: ShieldCheck,
  landmark: Landmark,
  settings: Settings,
  plug: Plug,
  sparkles: Sparkles,
  user: User,
};

function NavLink({ item }: { item: NavItem }) {
  const Icon = ICONS[item.icon] ?? FileText;
  return (
    <Link
      to={item.to as never}
      className="flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeProps={{
        className:
          "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary",
      }}
      activeOptions={{ exact: false }}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: viewer } = useViewer();
  const [search, setSearch] = useState("");

  const notificationsFn = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsFn(),
    staleTime: 30_000,
  });
  const unread = notifications.filter((n: { read_at: string | null }) => !n.read_at).length;
  const readMutation = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const allowed = (item: NavItem) =>
    item.permission === null || Boolean(viewer?.permissions.includes(item.permission));
  const operations = viewer?.isBidder ? BIDDER_NAV : OPERATIONS_NAV.filter(allowed);
  const administration = viewer?.isBidder ? [] : ADMIN_NAV.filter(allowed);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    navigate({ to: "/bids", search: { q } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* -------------------------------------------------- sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="border-b border-sidebar-border px-4 py-3">
            <Link to="/dashboard" className="block">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
                BidShield<span className="text-foreground"> AI</span>
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                AI-Powered Bid Compliance Intelligence
              </p>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {viewer?.isBidder ? "Bidder Portal" : "Operations"}
            </p>
            <div className="space-y-0.5">
              {operations.map((item) => (
                <NavLink key={item.to} item={item} />
              ))}
            </div>

            {administration.length > 0 && (
              <>
                <p className="mt-5 px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Administration
                </p>
                <div className="space-y-0.5">
                  {administration.map((item) => (
                    <NavLink key={item.to} item={item} />
                  ))}
                </div>
              </>
            )}
          </nav>

          <div className="border-t border-sidebar-border px-2 py-2">
            <div className="space-y-0.5">
              {BOTTOM_NAV.map((item) => (
                <NavLink key={item.to} item={item} />
              ))}
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* ---------------------------------------------------- main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-card">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {viewer?.organisation ?? "Government Procurement Operations"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  SIH26100 — Integrated Bid Compliance Verification Platform for GeM Procurement
                </p>
              </div>

              <span className="rounded-sm border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                Demo / Sandbox
              </span>

              <form onSubmit={runSearch} className="ml-auto hidden items-center gap-2 md:flex" role="search">
                <label htmlFor="global-search" className="sr-only">
                  Search bids, bidders and tenders
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="global-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bids, bidders, tenders"
                    className="h-8 w-64 pl-8 text-sm"
                  />
                </div>
              </form>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    {unread > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                        {unread}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <p className="border-b border-border px-3 py-2 text-sm font-semibold">Notifications</p>
                  {notifications.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No notifications yet.
                    </p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto">
                      {notifications.map((n: any) => (
                        <li key={n.id} className="border-b border-border last:border-0">
                          <button
                            type="button"
                            onClick={() => !n.read_at && readMutation.mutate(n.id)}
                            className={cn(
                              "w-full px-3 py-2 text-left hover:bg-muted",
                              !n.read_at && "bg-accent/40",
                            )}
                          >
                            <p className="text-sm font-medium text-foreground">{n.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatDate(n.created_at)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-sm border border-border px-2 py-1 text-left hover:bg-muted"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
                      {(viewer?.fullName ?? "U").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden sm:block">
                      <span className="block text-xs font-semibold leading-tight text-foreground">
                        {viewer?.fullName ?? "Loading…"}
                      </span>
                      <span className="block text-[11px] leading-tight text-muted-foreground">
                        {roleLabel(viewer?.role)}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <span className="block text-sm">{viewer?.fullName}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {viewer?.userCode} · {roleLabel(viewer?.role)}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* compact nav for tablet widths */}
            <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-1.5 lg:hidden">
              {[...operations, ...administration].map((item) => (
                <Link
                  key={item.to}
                  to={item.to as never}
                  className="whitespace-nowrap rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  activeProps={{
                    className: "whitespace-nowrap rounded-sm px-2 py-1 text-xs font-medium bg-accent text-accent-foreground",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>

          <main className="flex-1 px-4 py-5 xl:px-6">{children}</main>

          <footer className="border-t border-border bg-card px-4 py-2.5 text-[11px] text-muted-foreground">
            BidShield AI — demonstration environment with fictional data. Verification sources are simulated
            sandbox responses and must not be treated as live government verification. AI analyses. Rules
            verify. Evidence explains. Officer decides.
          </footer>
        </div>
      </div>
    </div>
  );
}
