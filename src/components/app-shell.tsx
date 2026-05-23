import { useMemo, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Truck, Users, Route as RouteIcon, MapPin, LogOut, Smartphone,
  Fuel, AlertTriangle, Wrench, Menu, Bell, Search, Sun, Moon, Monitor,
  ChevronRight, Settings, User, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { CommandMenu } from "@/components/command-menu";

type NavItem = { to: string; label: string; icon: any; badge?: number };
type NavSection = { title: string; items: NavItem[] };

const titleMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/vehicles": "Veículos",
  "/drivers": "Motoristas",
  "/trips": "Viagens",
  "/map": "Mapa ao vivo",
  "/fuel": "Abastecimentos",
  "/tickets": "Multas",
  "/maintenance": "Manutenções",
  "/geofences": "Geocercas",
  "/alerts": "Alertas",
  "/driver": "Portal motorista",
};

function useBadges() {
  return useQuery({
    queryKey: ["nav-badges"],
    queryFn: async () => {
      const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const [tk, fl, mt, gf] = await Promise.all([
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("fuel_logs").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("maintenance").select("id", { count: "exact", head: true }).lt("next_date", new Date().toISOString().slice(0, 10)),
        (supabase as any).from("geofence_events").select("id", { count: "exact", head: true }).gte("occurred_at", lastHour),
      ]);
      return {
        tickets: tk.count ?? 0,
        fuel: fl.count ?? 0,
        maintenance: mt.count ?? 0,
        geofence: gf.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}

function buildSections(badges: { tickets: number; fuel: number; maintenance: number; geofence: number } | undefined): NavSection[] {
  return [
    {
      title: "Operação",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/map", label: "Mapa ao vivo", icon: MapPin },
        { to: "/trips", label: "Viagens", icon: RouteIcon },
        { to: "/alerts", label: "Alertas", icon: Bell },
      ],
    },
    {
      title: "Cadastros",
      items: [
        { to: "/vehicles", label: "Veículos", icon: Truck },
        { to: "/drivers", label: "Motoristas", icon: Users },
        { to: "/geofences", label: "Geocercas", icon: Shield, badge: badges?.geofence },
      ],
    },
    {
      title: "Controles",
      items: [
        { to: "/fuel", label: "Abastecimentos", icon: Fuel, badge: badges?.fuel },
        { to: "/tickets", label: "Multas", icon: AlertTriangle, badge: badges?.tickets },
        { to: "/maintenance", label: "Manutenções", icon: Wrench, badge: badges?.maintenance },
      ],
    },
  ];
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: badges } = useBadges();
  const sections = buildSections(badges);
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gold-foreground shadow-[0_8px_24px_-8px_oklch(0.78_0.13_85_/_0.5)]"
          style={{ background: "var(--gradient-gold)" }}
        >
          <Truck className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-xl">FleetGuard</div>
          <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">Fleet OS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {sections.map((s) => (
          <div key={s.title} className="mb-5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
              {s.title}
            </div>
            <div className="space-y-0.5">
              {s.items.map((item) => {
                const active = path === item.to || path.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-gold" />
                    )}
                    <item.icon className={cn("h-4 w-4 transition-transform", active && "text-gold")} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!!item.badge && item.badge > 0 && (
                      <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {roles.includes("driver") && (
          <div className="mb-5">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
              Motorista
            </div>
            <Link
              to="/driver"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gold hover:bg-sidebar-accent/50"
            >
              <Smartphone className="h-4 w-4" />
              Portal motorista
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent/50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-sidebar-foreground">
                  {user?.email?.split("@")[0] ?? "Usuário"}
                </div>
                <div className="truncate text-[11px] text-sidebar-foreground/55">
                  {roles[0] ?? "Membro"}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings className="mr-2 h-4 w-4" />Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => { onNavigate?.(); await signOut(); navigate({ to: "/" }); }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Tema"
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: badges } = useBadges();
  const navigate = useNavigate();
  const pageTitle = useMemo(() => {
    const match = Object.entries(titleMap).find(([k]) => path === k || path.startsWith(k + "/"));
    return match?.[1] ?? "FleetGuard";
  }, [path]);
  const notifTotal = (badges?.tickets ?? 0) + (badges?.fuel ?? 0) + (badges?.maintenance ?? 0);

  return (
    <header className="glass-bar sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border px-3 md:h-16 md:px-6">
      <button
        onClick={onMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
        <h1 className="truncate font-display text-xl text-foreground">{pageTitle}</h1>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 md:flex-initial">
        <button
          onClick={() => {
            const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true });
            document.dispatchEvent(evt);
          }}
          className="hidden h-9 min-w-[220px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent md:inline-flex"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Buscar ou comandar…</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Notificações"
            >
              <Bell className="h-4 w-4" />
              {notifTotal > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {notifTotal > 99 ? "99+" : notifTotal}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate({ to: "/tickets" })}>
                <AlertTriangle className="mr-2 h-4 w-4 text-warning" />
                <div className="flex-1">
                  <div className="text-sm">{badges?.tickets ?? 0} multas pendentes</div>
                  <div className="text-xs text-muted-foreground">Aguardando pagamento</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/fuel" })}>
                <Fuel className="mr-2 h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="text-sm">{badges?.fuel ?? 0} abastecimentos pendentes</div>
                  <div className="text-xs text-muted-foreground">Aguardando aprovação</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/maintenance" })}>
                <Wrench className="mr-2 h-4 w-4 text-destructive" />
                <div className="flex-1">
                  <div className="text-sm">{badges?.maintenance ?? 0} manutenções atrasadas</div>
                  <div className="text-xs text-muted-foreground">Datas vencidas</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <CommandMenu />

      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:flex">
        <NavContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <NavContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
