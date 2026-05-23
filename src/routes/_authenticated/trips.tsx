import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Route as RouteIcon, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
});

type TripStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
const statusLabel: Record<TripStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};
const statusClasses: Record<TripStatus, string> = {
  scheduled: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

function TripsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, vehicle:vehicles(plate, model), driver:drivers(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!trips) return [];
    const q = search.trim().toLowerCase();
    return trips.filter((t: any) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (t.driver?.full_name ?? "").toLowerCase().includes(q) ||
        (t.vehicle?.plate ?? "").toLowerCase().includes(q) ||
        (t.origin ?? "").toLowerCase().includes(q) ||
        (t.destination ?? "").toLowerCase().includes(q)
      );
    });
  }, [trips, search, statusFilter]);

  const totals = useMemo(() => {
    const completed = (trips ?? []).filter((t: any) => t.status === "completed");
    const totalKm = completed.reduce((s: number, t: any) => {
      if (t.start_km != null && t.end_km != null) return s + Math.max(0, Number(t.end_km) - Number(t.start_km));
      return s;
    }, 0);
    return {
      inProgress: (trips ?? []).filter((t: any) => t.status === "in_progress").length,
      completed: completed.length,
      totalKm,
    };
  }, [trips]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Viagens</h1>
          <p className="mt-1 text-sm text-muted-foreground">Histórico de rotas da frota</p>
        </div>
        <Button asChild className="h-10 shrink-0">
          <Link to="/trips/new"><Plus className="mr-2 h-4 w-4" />Nova viagem</Link>
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SummaryCard label="Em andamento" value={totals.inProgress.toString()} />
        <SummaryCard label="Concluídas" value={totals.completed.toString()} />
        <SummaryCard label="Km percorridos" value={totals.totalKm.toLocaleString("pt-BR")} />
      </div>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por motorista, placa, origem, destino…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TripStatus | "all")}>
          <SelectTrigger className="h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabel) as TripStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4"><Skeleton className="h-20 w-full" /></div>
        ))}
        {!isLoading && filtered.map((t: any) => {
          const km = (t.start_km != null && t.end_km != null) ? Math.max(0, Number(t.end_km) - Number(t.start_km)) : null;
          return (
            <article
              key={t.id}
              onClick={() => navigate({ to: `/trips/${t.id}` })}
              className="surface cursor-pointer p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.driver?.full_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.vehicle?.plate ?? "—"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[t.status as TripStatus]}`}>
                  {statusLabel[t.status as TripStatus]}
                </span>
              </div>
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">{t.origin || "—"}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span className="text-muted-foreground">{t.destination || "—"}</span>
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Início</p>
                  <p className="font-medium">{t.start_at ? new Date(t.start_at).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fim</p>
                  <p className="font-medium">{t.end_at ? new Date(t.end_at).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Km</p>
                  <p className="font-medium">{km != null ? km.toLocaleString("pt-BR") : "—"}</p>
                </div>
              </div>
            </article>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="surface border-dashed p-10 text-center text-muted-foreground">
            <RouteIcon className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">{trips?.length ? "Nenhuma viagem corresponde aos filtros." : "Nenhuma viagem registrada."}</p>
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="surface hidden overflow-hidden p-0 md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Motorista</th>
              <th className="px-4 py-3 font-semibold">Veículo</th>
              <th className="px-4 py-3 font-semibold">Origem → Destino</th>
              <th className="px-4 py-3 font-semibold">Início</th>
              <th className="px-4 py-3 font-semibold">Fim</th>
              <th className="px-4 py-3 text-right font-semibold">Km</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td colSpan={7} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td>
              </tr>
            ))}
            {!isLoading && filtered.map((t: any) => {
              const km = (t.start_km != null && t.end_km != null) ? Math.max(0, Number(t.end_km) - Number(t.start_km)) : null;
              return (
                <tr
                  key={t.id}
                  onClick={() => navigate({ to: `/trips/${t.id}` })}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-muted/20"
                >
                  <td className="px-4 py-3 font-medium">{t.driver?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{t.vehicle?.plate ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.origin || "—"} → {t.destination || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{t.start_at ? new Date(t.start_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{t.end_at ? new Date(t.end_at).toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{km != null ? km.toLocaleString("pt-BR") : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[t.status as TripStatus]}`}>
                      {statusLabel[t.status as TripStatus]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                  <RouteIcon className="mx-auto mb-3 h-10 w-10" />
                  {trips?.length ? "Nenhuma viagem corresponde aos filtros." : "Nenhuma viagem registrada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-3 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="summary-value mt-1 break-words">{value}</p>
    </div>
  );
}
