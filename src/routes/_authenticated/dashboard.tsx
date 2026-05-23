import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Users, Route as RouteIcon, AlertTriangle, Fuel, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-4xl text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [v, d, t, tk, f, m] = await Promise.all([
        supabase.from("vehicles").select("id, status", { count: "exact" }),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("fuel_logs").select("total_value").gte("filled_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from("maintenance").select("id", { count: "exact", head: true }).gte("next_date", new Date().toISOString().slice(0, 10)),
      ]);
      const totalFuel = (f.data ?? []).reduce((s, r) => s + Number(r.total_value || 0), 0);
      const inMaint = (v.data ?? []).filter((x) => x.status === "maintenance").length;
      return {
        vehicles: v.count ?? 0,
        inMaint,
        drivers: d.count ?? 0,
        activeTrips: t.count ?? 0,
        pendingTickets: tk.count ?? 0,
        fuelMonth: totalFuel,
        maintScheduled: m.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua operação.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Truck} label="Veículos" value={data?.vehicles ?? "—"} hint={`${data?.inMaint ?? 0} em manutenção`} />
        <StatCard icon={Users} label="Motoristas ativos" value={data?.drivers ?? "—"} />
        <StatCard icon={RouteIcon} label="Viagens em andamento" value={data?.activeTrips ?? "—"} />
        <StatCard icon={Fuel} label="Combustível no mês" value={`R$ ${(data?.fuelMonth ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <StatCard icon={AlertTriangle} label="Multas pendentes" value={data?.pendingTickets ?? "—"} />
        <StatCard icon={Wrench} label="Manutenções agendadas" value={data?.maintScheduled ?? "—"} />
      </div>
    </div>
  );
}
