import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
});

function TripsPage() {
  const { data: trips } = useQuery({
    queryKey: ["trips-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, vehicle:vehicles(plate, model), driver:drivers(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Viagens</h1>
        <p className="text-sm text-muted-foreground">Histórico de rotas da frota</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Motorista</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Origem → Destino</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {trips?.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-3">{(t as any).driver?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{(t as any).vehicle?.plate ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.origin || "—"} → {t.destination || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.start_at ? new Date(t.start_at).toLocaleString("pt-BR") : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${t.status === "in_progress" ? "bg-primary/15 text-primary" : t.status === "completed" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {trips && trips.length === 0 && (
              <tr><td colSpan={5} className="p-12 text-center text-muted-foreground"><RouteIcon className="mx-auto mb-3 h-10 w-10" />Nenhuma viagem registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
