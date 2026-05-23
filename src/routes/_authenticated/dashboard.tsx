import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck, Users, Route as RouteIcon, AlertTriangle, Fuel, Wrench, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// recharts is ~120 kB. Lazy-load it so the dashboard's initial paint is faster.
const DashboardCharts = lazy(() => import("@/components/dashboard-charts"));

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Tone = "default" | "warning" | "destructive" | "success";

const toneText: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
};

const toneIcon: Record<Tone, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  success: "bg-success/15 text-success",
};

function StatCard({
  icon: Icon, label, value, hint, loading, tone = "default",
}: { icon: any; label: string; value: string | number; hint?: string; loading?: boolean; tone?: Tone }) {
  return (
    <div className="group surface relative overflow-hidden p-4 transition-all hover:shadow-[var(--shadow-pop)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-9 w-24" />
          ) : (
            <p className={cn("stat-value mt-1.5 break-words", toneText[tone])}>{value}</p>
          )}
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneIcon[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const monthStartIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in30Iso = in30.toISOString().slice(0, 10);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [v, d, t, tk, f, m] = await Promise.all([
        supabase.from("vehicles").select("id, status"),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("tickets").select("value").eq("status", "pending"),
        supabase.from("fuel_logs").select("total_value, liters").eq("status", "approved").gte("filled_at", monthStartIso),
        supabase.from("maintenance").select("id", { count: "exact", head: true }).gte("next_date", today).lte("next_date", in30Iso),
      ]);
      const totalFuel = (f.data ?? []).reduce((s, r: any) => s + Number(r.total_value || 0), 0);
      const totalLiters = (f.data ?? []).reduce((s, r: any) => s + Number(r.liters || 0), 0);
      const pendingTicketValue = (tk.data ?? []).reduce((s, r: any) => s + Number(r.value || 0), 0);
      const vehicles = (v.data ?? []);
      return {
        vehicles: vehicles.length,
        active: vehicles.filter((x: any) => x.status === "active").length,
        inMaint: vehicles.filter((x: any) => x.status === "maintenance").length,
        drivers: d.count ?? 0,
        activeTrips: t.count ?? 0,
        pendingTickets: tk.data?.length ?? 0,
        pendingTicketValue,
        fuelMonth: totalFuel,
        litersMonth: totalLiters,
        maintScheduled: m.count ?? 0,
      };
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const in30s = in30.toISOString().slice(0, 10);
      const [cnh, maint] = await Promise.all([
        supabase.from("drivers")
          .select("id, full_name, cnh_expiry")
          .not("cnh_expiry", "is", null)
          .lte("cnh_expiry", in30s)
          .order("cnh_expiry"),
        supabase.from("maintenance")
          .select("id, next_date, vehicle:vehicles(plate)")
          .not("next_date", "is", null)
          .lte("next_date", in30s)
          .order("next_date"),
      ]);
      return {
        cnh: cnh.data ?? [],
        maint: maint.data ?? [],
        today,
      };
    },
  });

  const { data: fuelSeries } = useQuery({
    queryKey: ["dashboard-fuel-series"],
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 29);
      const { data } = await supabase
        .from("fuel_logs")
        .select("filled_at, total_value")
        .eq("status", "approved")
        .gte("filled_at", from.toISOString())
        .order("filled_at");
      const buckets: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date(from); d.setDate(from.getDate() + i);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      (data ?? []).forEach((r: any) => {
        const key = String(r.filled_at).slice(0, 10);
        if (key in buckets) buckets[key] += Number(r.total_value || 0);
      });
      return Object.entries(buckets).map(([date, value]) => ({
        date: date.slice(5).split("-").reverse().join("/"),
        value: Number(value.toFixed(2)),
      }));
    },
  });

  const { data: tripsSeries } = useQuery({
    queryKey: ["dashboard-trips-series"],
    queryFn: async () => {
      const from = new Date(); from.setDate(from.getDate() - 13);
      const { data } = await supabase
        .from("trips")
        .select("created_at")
        .gte("created_at", from.toISOString())
        .order("created_at");
      const buckets: Record<string, number> = {};
      for (let i = 0; i < 14; i++) {
        const d = new Date(from); d.setDate(from.getDate() + i);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      (data ?? []).forEach((r: any) => {
        const key = String(r.created_at).slice(0, 10);
        if (key in buckets) buckets[key]++;
      });
      return Object.entries(buckets).map(([date, count]) => ({
        date: date.slice(5).split("-").reverse().join("/"),
        count,
      }));
    },
  });

  const alertItems: { label: string; href: string; tone: "warning" | "destructive" }[] = [];
  (alerts?.cnh ?? []).forEach((d: any) => {
    const expired = d.cnh_expiry < (alerts?.today ?? "");
    alertItems.push({
      label: `CNH de ${d.full_name} ${expired ? "vencida" : "vence em"} ${new Date(d.cnh_expiry).toLocaleDateString("pt-BR")}`,
      href: "/drivers",
      tone: expired ? "destructive" : "warning",
    });
  });
  (alerts?.maint ?? []).forEach((m: any) => {
    const overdue = m.next_date < (alerts?.today ?? "");
    alertItems.push({
      label: `Manutenção ${m.vehicle?.plate ?? ""} ${overdue ? "atrasada desde" : "agendada para"} ${new Date(m.next_date).toLocaleDateString("pt-BR")}`,
      href: "/maintenance",
      tone: overdue ? "destructive" : "warning",
    });
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da sua operação.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard icon={Truck} label="Veículos" value={stats?.vehicles ?? 0} hint={`${stats?.active ?? 0} ativos · ${stats?.inMaint ?? 0} em manutenção`} loading={statsLoading} />
        <StatCard icon={Users} label="Motoristas" value={stats?.drivers ?? 0} hint="ativos" loading={statsLoading} />
        <StatCard icon={RouteIcon} label="Viagens" value={stats?.activeTrips ?? 0} hint="em andamento" loading={statsLoading} />
        <StatCard icon={Fuel} label="Combustível" value={`R$ ${(stats?.fuelMonth ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} hint={`${(stats?.litersMonth ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} L · mês`} loading={statsLoading} />
        <StatCard icon={AlertTriangle} label="Multas" value={stats?.pendingTickets ?? 0} hint={`R$ ${(stats?.pendingTicketValue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} loading={statsLoading} tone={(stats?.pendingTickets ?? 0) > 0 ? "warning" : "default"} />
        <StatCard icon={Wrench} label="Manutenções" value={stats?.maintScheduled ?? 0} hint="próximos 30 dias" loading={statsLoading} />
      </div>

      {alertItems.length > 0 && (
        <section className="surface relative overflow-hidden border-warning/30 bg-warning/[0.04] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-warning">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight">Alertas · {alertItems.length}</h2>
          </div>
          <ul className="space-y-1.5">
            {alertItems.slice(0, 6).map((a, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-warning/10">
                <span className={a.tone === "destructive" ? "text-destructive" : "text-foreground"}>{a.label}</span>
                <Link to={a.href} className="shrink-0 text-xs font-medium text-primary hover:underline">Ver →</Link>
              </li>
            ))}
            {alertItems.length > 6 && (
              <li className="px-2 pt-1 text-xs text-muted-foreground">+ {alertItems.length - 6} alertas</li>
            )}
          </ul>
        </section>
      )}

      <Suspense fallback={
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface p-4 sm:p-5"><Skeleton className="h-48 w-full sm:h-56" /></div>
          <div className="surface p-4 sm:p-5"><Skeleton className="h-48 w-full sm:h-56" /></div>
        </div>
      }>
        <DashboardCharts fuelSeries={fuelSeries} tripsSeries={tripsSeries} />
      </Suspense>

      <section>
        <h2 className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Atalhos
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <QuickLink to="/vehicles" icon={Truck} label="Veículos" />
          <QuickLink to="/drivers" icon={Users} label="Motoristas" />
          <QuickLink to="/map" icon={RouteIcon} label="Mapa ao vivo" />
          <QuickLink to="/fuel" icon={Fuel} label="Abastecimentos" />
        </div>
      </section>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="group surface flex items-center justify-between p-3.5 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-pop)] sm:p-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
