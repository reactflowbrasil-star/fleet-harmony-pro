import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Truck, Users, Route as RouteIcon, MapPin, LogOut, Smartphone,
  Fuel, AlertTriangle, Wrench, Menu, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: any; mobileTab?: boolean };

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobileTab: true },
  { to: "/vehicles", label: "Veículos", icon: Truck, mobileTab: true },
  { to: "/drivers", label: "Motoristas", icon: Users },
  { to: "/trips", label: "Viagens", icon: RouteIcon, mobileTab: true },
  { to: "/map", label: "Mapa ao vivo", icon: MapPin, mobileTab: true },
  { to: "/fuel", label: "Abastecimentos", icon: Fuel },
  { to: "/tickets", label: "Multas", icon: AlertTriangle },
  { to: "/maintenance", label: "Manutenções", icon: Wrench },
];

function isActive(path: string, to: string) {
  return path === to || path.startsWith(to + "/");
}

function userInitials(email: string | null | undefined) {
  if (!email) return "U";
  const [local] = email.split("@");
  return (local.slice(0, 2) || "U").toUpperCase();
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold text-gold-foreground shadow-sm">
          <Truck className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-xl">FleetGuard</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/55">Gestão de Frotas</p>
        </div>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
          Operação
        </p>
        <div className="space-y-0.5">
          {nav.map((item) => {
            const active = isActive(path, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-gold" aria-hidden />
                )}
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-gold" : "")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {roles.includes("driver") && (
          <>
            <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              Motorista
            </p>
            <Link
              to="/driver"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gold transition-colors hover:bg-sidebar-accent/50"
            >
              <Smartphone className="h-[18px] w-[18px]" />
              Portal motorista
            </Link>
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xs font-semibold text-gold">
            {userInitials(user?.email)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.email ?? "—"}</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/55">
              {roles[0] ?? "usuário"}
            </p>
          </div>
        </div>
        <button
          onClick={async () => { onNavigate?.(); await signOut(); navigate({ to: "/" }); }}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );
}

function MobileTabBar({ onMore }: { onMore: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tabs = nav.filter((n) => n.mobileTab);

  return (
    <nav
      className="glass-bar safe-pb fixed inset-x-0 bottom-0 z-40 grid border-t border-border md:hidden"
      style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
    >
      {tabs.map((item) => {
        const active = isActive(path, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className={cn("h-5 w-5", active ? "stroke-[2.4]" : "")} />
            <span className="truncate px-1">{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>Mais</span>
      </button>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 md:flex">
        <NavContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-bar safe-pt sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border px-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="tap rounded-lg text-foreground hover:bg-accent" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-r-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <NavContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </div>
            <span className="font-display text-lg leading-none">FleetGuard</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 px-4 pb-24 pt-4 sm:px-5 sm:pt-5 md:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <MobileTabBar onMore={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}
