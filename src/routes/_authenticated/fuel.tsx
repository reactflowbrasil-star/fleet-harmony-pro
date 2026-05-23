import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Fuel } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fuel")({
  component: FuelPage,
});

function FuelPage() {
  const { data } = useQuery({
    queryKey: ["fuel-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_logs")
        .select("*, vehicle:vehicles(plate), driver:drivers(full_name)")
        .order("filled_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-4xl">Abastecimentos</h1></div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Veículo</th><th className="px-4 py-3">Motorista</th><th className="px-4 py-3">Litros</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">{new Date(r.filled_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3">{(r as any).vehicle?.plate}</td>
                <td className="px-4 py-3">{(r as any).driver?.full_name ?? "—"}</td>
                <td className="px-4 py-3">{Number(r.liters).toFixed(2)} L</td>
                <td className="px-4 py-3">R$ {Number(r.total_value).toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${r.status === "approved" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning"}`}>{r.status}</span></td>
              </tr>
            ))}
            {data && data.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground"><Fuel className="mx-auto mb-3 h-10 w-10" />Sem abastecimentos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
