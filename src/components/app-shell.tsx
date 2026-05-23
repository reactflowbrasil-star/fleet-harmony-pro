import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Truck, Users, Route as RouteIcon, MapPin, LogOut, Smartphone,
  Fuel, AlertTriangle, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vehicles", label: "Veículos", icon: Truck },
  { to: "/drivers", label: "Motoristas", icon: Users },
  { to: "/trips", label: "Viagens", icon: RouteIcon },
  { to: "/map", label: "Mapa ao vivo", icon: MapPin },
  { to: "/fuel", label: "Abastecimentos", icon: Fuel },
  { to: "/tickets", label: "Multas", icon: AlertTriangle },
  { to: "/maintenance", label: "Manutenções", icon: Wrench },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <Truck className="h-4 w-4" />
          </div>
          <span className="font-display text-xl">FleetGuard</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active = path === item.to || path.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {roles.includes("driver") && (
            <Link
              to="/driver"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gold hover:bg-sidebar-accent/50"
            >
              <Smartphone className="h-4 w-4" />
              Portal motorista
            </Link>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60">{user?.email}</div>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-4 w-4" />
            </div>
            <span className="font-display text-xl">FleetGuard</span>
          </div>
          <button onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="text-sm text-muted-foreground">
            Sair
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
