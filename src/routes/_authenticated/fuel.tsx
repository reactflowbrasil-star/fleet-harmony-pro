import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Fuel, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fuel")({
  component: FuelPage,
});

type FuelStatus = "pending" | "approved" | "rejected";
const statusLabel: Record<FuelStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};
const statusClasses: Record<FuelStatus, string> = {
  pending: "bg-warning/20 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

function FuelPage() {
  const { companyId, roles } = useAuth();
  const qc = useQueryClient();
  const canApprove = roles.includes("admin") || roles.includes("fleet_manager");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FuelStatus | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["fuel-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fuel_logs")
        .select("*, vehicle:vehicles(plate, model), driver:drivers(full_name)")
        .order("filled_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, plate, model").order("plate");
      return data ?? [];
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers-min"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.vehicle?.plate?.toLowerCase().includes(q) ||
        r.driver?.full_name?.toLowerCase().includes(q) ||
        r.station?.toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter]);

  const totals = useMemo(() => {
    const approved = (data ?? []).filter((r: any) => r.status === "approved");
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthApproved = approved.filter((r: any) => new Date(r.filled_at) >= monthStart);
    const monthValue = monthApproved.reduce((s: number, r: any) => s + Number(r.total_value || 0), 0);
    const monthLiters = monthApproved.reduce((s: number, r: any) => s + Number(r.liters || 0), 0);
    const pending = (data ?? []).filter((r: any) => r.status === "pending").length;
    return { monthValue, monthLiters, pending };
  }, [data]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FuelStatus }) => {
      const { error } = await supabase.from("fuel_logs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["fuel-logs"] });
      toast.success(vars.status === "approved" ? "Aprovado" : vars.status === "rejected" ? "Rejeitado" : "Atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fuel_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-logs"] });
      toast.success("Registro excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const vehicleId = String(fd.get("vehicle_id") || "");
    if (!vehicleId) return toast.error("Selecione um veículo");
    const liters = Number(fd.get("liters"));
    const ppl = Number(fd.get("ppl"));

    const { error } = await supabase.from("fuel_logs").insert({
      company_id: companyId,
      vehicle_id: vehicleId,
      driver_id: String(fd.get("driver_id") || "") || null,
      station: String(fd.get("station") || "").trim() || null,
      filled_at: String(fd.get("filled_at") || new Date().toISOString()),
      liters,
      price_per_liter: ppl,
      total_value: Math.round(liters * ppl * 100) / 100,
      current_km: Number(fd.get("current_km")) || null,
      fuel_type: String(fd.get("fuel_type") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
      status: canApprove ? "approved" : "pending",
    });
    if (error) return toast.error(error.message);
    toast.success(canApprove ? "Abastecimento registrado" : "Enviado para aprovação");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["fuel-logs"] });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Abastecimentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.length ?? 0} registro{data?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 shrink-0"><Plus className="mr-2 h-4 w-4" />Novo abastecimento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar abastecimento</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Veículo *</Label>
                  <select name="vehicle_id" required className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Selecione…</option>
                    {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label>Motorista</Label>
                  <select name="driver_id" className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">— não informado —</option>
                    {drivers?.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
                <div><Label>Data *</Label><Input name="filled_at" type="datetime-local" required defaultValue={new Date().toISOString().slice(0, 16)} /></div>
                <div><Label>Posto</Label><Input name="station" maxLength={100} /></div>
                <div><Label>Litros *</Label><Input name="liters" type="number" step="0.01" min={0} required /></div>
                <div><Label>R$/litro *</Label><Input name="ppl" type="number" step="0.001" min={0} required /></div>
                <div><Label>Km atual</Label><Input name="current_km" type="number" min={0} /></div>
                <div><Label>Combustível</Label><Input name="fuel_type" placeholder="Diesel, Gasolina…" maxLength={30} /></div>
                <div className="col-span-2"><Label>Observações</Label><Input name="notes" maxLength={200} /></div>
              </div>
              <Button type="submit" className="h-11 w-full">Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SummaryCard label="Gasto no mês" value={`R$ ${totals.monthValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
        <SummaryCard label="Litros no mês" value={`${totals.monthLiters.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`} />
        <SummaryCard label="Pendentes" value={totals.pending.toString()} tone={totals.pending > 0 ? "warning" : "default"} />
      </div>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por placa, motorista, posto…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FuelStatus | "all")}>
          <SelectTrigger className="h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4"><Skeleton className="h-20 w-full" /></div>
        ))}
        {!isLoading && filtered.map((r: any) => (
          <article key={r.id} className="surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{r.vehicle?.plate ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(r.filled_at).toLocaleDateString("pt-BR")}
                  {r.station ? ` · ${r.station}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[r.status as FuelStatus]}`}>
                {statusLabel[r.status as FuelStatus]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px]">
              <div>
                <p className="text-muted-foreground">Litros</p>
                <p className="font-medium tabular-nums">{Number(r.liters).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">R$/L</p>
                <p className="font-medium tabular-nums">{Number(r.price_per_liter).toFixed(3)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold tabular-nums">R$ {Number(r.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            {r.driver?.full_name && (
              <p className="mt-2 truncate text-xs text-muted-foreground">Motorista: <span className="text-foreground">{r.driver.full_name}</span></p>
            )}
            {canApprove && (
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-border/60 pt-3">
                {r.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus.mutate({ id: r.id, status: "approved" })} className="tap rounded-md text-success transition-colors hover:bg-success/10" aria-label="Aprovar"><Check className="h-4 w-4" /></button>
                    <button onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })} className="tap rounded-md text-destructive transition-colors hover:bg-destructive/10" aria-label="Rejeitar"><X className="h-4 w-4" /></button>
                  </>
                )}
                <button onClick={() => { if (confirm("Excluir este registro?")) remove.mutate(r.id); }} className="tap rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
              </div>
            )}
          </article>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="surface border-dashed p-10 text-center text-muted-foreground">
            <Fuel className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">{data?.length ? "Nenhum registro corresponde aos filtros." : "Sem abastecimentos."}</p>
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="surface hidden overflow-hidden p-0 md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Data</th>
              <th className="px-4 py-3 font-semibold">Veículo</th>
              <th className="px-4 py-3 font-semibold">Motorista</th>
              <th className="px-4 py-3 font-semibold">Posto</th>
              <th className="px-4 py-3 text-right font-semibold">Litros</th>
              <th className="px-4 py-3 text-right font-semibold">R$/L</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td colSpan={9} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td>
              </tr>
            ))}
            {!isLoading && filtered.map((r: any) => (
              <tr key={r.id} className="border-t border-border transition-colors hover:bg-muted/20">
                <td className="px-4 py-3 whitespace-nowrap">{new Date(r.filled_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 font-medium">{r.vehicle?.plate ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.driver?.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.station ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{Number(r.liters).toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">R$ {Number(r.price_per_liter).toFixed(3)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">R$ {Number(r.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[r.status as FuelStatus]}`}>
                    {statusLabel[r.status as FuelStatus]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canApprove && r.status === "pending" && (
                      <>
                        <button onClick={() => updateStatus.mutate({ id: r.id, status: "approved" })} className="rounded-md p-1.5 text-success transition-colors hover:bg-success/10" title="Aprovar"><Check className="h-4 w-4" /></button>
                        <button onClick={() => updateStatus.mutate({ id: r.id, status: "rejected" })} className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10" title="Rejeitar"><X className="h-4 w-4" /></button>
                      </>
                    )}
                    {canApprove && (
                      <button onClick={() => { if (confirm("Excluir este registro?")) remove.mutate(r.id); }} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-12 text-center text-muted-foreground">
                  <Fuel className="mx-auto mb-3 h-10 w-10" />
                  {data?.length ? "Nenhum registro corresponde aos filtros." : "Sem abastecimentos."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="surface p-3 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`summary-value mt-1 break-words ${tone === "warning" ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
