import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Trash2, Wrench, CalendarClock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/maintenance")({
  component: MaintenancePage,
});

type MaintenanceType = "preventive" | "corrective";
const typeLabel: Record<MaintenanceType, string> = {
  preventive: "Preventiva",
  corrective: "Corretiva",
};
const typeClasses: Record<MaintenanceType, string> = {
  preventive: "bg-primary/15 text-primary",
  corrective: "bg-warning/20 text-warning",
};

function MaintenancePage() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MaintenanceType | "all">("all");

  const { data: list, isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance")
        .select("*, vehicle:vehicles(plate, model, current_km)")
        .order("service_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, plate, model, current_km").order("plate");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    return list.filter((m: any) => {
      if (typeFilter !== "all" && m.maintenance_type !== typeFilter) return false;
      if (!q) return true;
      return (
        m.vehicle?.plate?.toLowerCase().includes(q) ||
        m.workshop?.toLowerCase().includes(q) ||
        m.services?.toLowerCase().includes(q) ||
        m.parts?.toLowerCase().includes(q)
      );
    });
  }, [list, search, typeFilter]);

  const totals = useMemo(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthCost = (list ?? [])
      .filter((m: any) => new Date(m.service_date) >= monthStart)
      .reduce((s: number, m: any) => s + Number(m.value || 0), 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const upcoming = (list ?? []).filter((m: any) => {
      if (!m.next_date) return false;
      const nd = new Date(m.next_date);
      return nd >= today && nd <= in30;
    }).length;
    const overdue = (list ?? []).filter((m: any) => {
      if (!m.next_date) return false;
      return new Date(m.next_date) < today;
    }).length;
    return { monthCost, upcoming, overdue };
  }, [list]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      toast.success("Manutenção excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const vehicleId = String(fd.get("vehicle_id") || "");
    if (!vehicleId) return toast.error("Selecione um veículo");

    const { error } = await supabase.from("maintenance").insert({
      company_id: companyId,
      vehicle_id: vehicleId,
      maintenance_type: (String(fd.get("maintenance_type") || "preventive") as MaintenanceType),
      service_date: String(fd.get("service_date") || new Date().toISOString().slice(0, 10)),
      workshop: String(fd.get("workshop") || "").trim() || null,
      services: String(fd.get("services") || "").trim() || null,
      parts: String(fd.get("parts") || "").trim() || null,
      value: Number(fd.get("value")) || null,
      current_km: Number(fd.get("current_km")) || null,
      next_date: String(fd.get("next_date") || "") || null,
      next_km: Number(fd.get("next_km")) || null,
      notes: String(fd.get("notes") || "").trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Manutenção registrada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["maintenance"] });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Manutenções</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list?.length ?? 0} registro{list?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 shrink-0"><Plus className="mr-2 h-4 w-4" />Nova manutenção</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar manutenção</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Veículo *</Label>
                  <select name="vehicle_id" required className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Selecione…</option>
                    {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Tipo *</Label>
                  <select name="maintenance_type" required defaultValue="preventive" className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="preventive">Preventiva</option>
                    <option value="corrective">Corretiva</option>
                  </select>
                </div>
                <div><Label>Data *</Label><Input name="service_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                <div className="col-span-2"><Label>Oficina</Label><Input name="workshop" maxLength={100} /></div>
                <div className="col-span-2"><Label>Serviços executados</Label><Textarea name="services" rows={2} placeholder="Ex.: Troca de óleo e filtros" /></div>
                <div className="col-span-2"><Label>Peças trocadas</Label><Textarea name="parts" rows={2} /></div>
                <div><Label>Valor (R$)</Label><Input name="value" type="number" step="0.01" min={0} /></div>
                <div><Label>Km atual</Label><Input name="current_km" type="number" min={0} /></div>
                <div><Label>Próxima data</Label><Input name="next_date" type="date" /></div>
                <div><Label>Próximo km</Label><Input name="next_km" type="number" min={0} /></div>
                <div className="col-span-2"><Label>Observações</Label><Textarea name="notes" rows={2} /></div>
              </div>
              <Button type="submit" className="h-11 w-full">Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SummaryCard label="Custo no mês" value={`R$ ${totals.monthCost.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
        <SummaryCard label="Próximas 30d" value={totals.upcoming.toString()} />
        <SummaryCard label="Atrasadas" value={totals.overdue.toString()} tone={totals.overdue > 0 ? "destructive" : "default"} />
      </div>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por placa, oficina, serviço…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MaintenanceType | "all")}>
          <SelectTrigger className="h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="preventive">Preventivas</SelectItem>
            <SelectItem value="corrective">Corretivas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4"><Skeleton className="h-20 w-full" /></div>
        ))}
        {!isLoading && filtered.map((m: any) => {
          const overdue = m.next_date && new Date(m.next_date) < new Date();
          return (
            <article key={m.id} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{m.vehicle?.plate ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(m.service_date).toLocaleDateString("pt-BR")}{m.workshop ? ` · ${m.workshop}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeClasses[m.maintenance_type as MaintenanceType]}`}>
                  {typeLabel[m.maintenance_type as MaintenanceType]}
                </span>
              </div>
              {m.services && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{m.services}</p>}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-semibold tabular-nums">{m.value != null ? `R$ ${Number(m.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</p>
                  </div>
                  {m.next_date && (
                    <div>
                      <p className="text-muted-foreground">Próxima</p>
                      <p className={`inline-flex items-center gap-1 font-medium ${overdue ? "text-destructive" : "text-foreground"}`}>
                        <CalendarClock className="h-3 w-3" />
                        {new Date(m.next_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { if (confirm("Excluir esta manutenção?")) remove.mutate(m.id); }}
                  className="tap rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="surface border-dashed p-10 text-center text-muted-foreground">
            <Wrench className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">{list?.length ? "Nenhuma manutenção corresponde aos filtros." : "Nenhuma manutenção registrada."}</p>
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
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Serviços</th>
              <th className="px-4 py-3 font-semibold">Oficina</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Próxima</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-t border-border">
                <td colSpan={8} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td>
              </tr>
            ))}
            {!isLoading && filtered.map((m: any) => {
              const overdue = m.next_date && new Date(m.next_date) < new Date();
              return (
                <tr key={m.id} className="border-t border-border transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(m.service_date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 font-medium">{m.vehicle?.plate ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${typeClasses[m.maintenance_type as MaintenanceType]}`}>
                      {typeLabel[m.maintenance_type as MaintenanceType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="max-w-[280px] truncate">{m.services ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.workshop ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">{m.value != null ? `R$ ${Number(m.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
                  <td className="px-4 py-3">
                    {m.next_date ? (
                      <span className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        <CalendarClock className="h-3 w-3" />
                        {new Date(m.next_date).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm("Excluir esta manutenção?")) remove.mutate(m.id); }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-muted-foreground">
                  <Wrench className="mx-auto mb-3 h-10 w-10" />
                  {list?.length ? "Nenhuma manutenção corresponde aos filtros." : "Nenhuma manutenção registrada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "destructive" }) {
  return (
    <div className="surface p-3 sm:p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`summary-value mt-1 break-words ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
