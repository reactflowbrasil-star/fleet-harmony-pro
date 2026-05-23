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
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: TicketsPage,
});

type TicketStatus = "pending" | "paid" | "appealed" | "cancelled";

const statusLabel: Record<TicketStatus, string> = {
  pending: "Pendente",
  paid: "Paga",
  appealed: "Recorrida",
  cancelled: "Cancelada",
};

const statusClasses: Record<TicketStatus, string> = {
  pending: "bg-warning/20 text-warning",
  paid: "bg-success/15 text-success",
  appealed: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

function TicketsPage() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, vehicle:vehicles(plate, model), driver:drivers(full_name)")
        .order("infraction_date", { ascending: false });
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
    if (!tickets) return [];
    const q = search.trim().toLowerCase();
    return tickets.filter((t: any) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.vehicle?.plate?.toLowerCase().includes(q) ||
        t.driver?.full_name?.toLowerCase().includes(q) ||
        t.infraction_type?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q)
      );
    });
  }, [tickets, search, statusFilter]);

  const totals = useMemo(() => {
    const pending = filtered.filter((t: any) => t.status === "pending");
    const sum = pending.reduce((s: number, t: any) => s + Number(t.value || 0), 0);
    const pts = pending.reduce((s: number, t: any) => s + Number(t.points || 0), 0);
    return { pendingValue: sum, pendingPoints: pts, pendingCount: pending.length };
  }, [filtered]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TicketStatus }) => {
      const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Multa excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const vehicleId = String(fd.get("vehicle_id") || "");
    if (!vehicleId) return toast.error("Selecione um veículo");

    const { error } = await supabase.from("tickets").insert({
      company_id: companyId,
      vehicle_id: vehicleId,
      driver_id: String(fd.get("driver_id") || "") || null,
      infraction_date: String(fd.get("infraction_date") || new Date().toISOString().slice(0, 10)),
      infraction_type: String(fd.get("infraction_type") || "").trim() || null,
      location: String(fd.get("location") || "").trim() || null,
      value: Number(fd.get("value")) || 0,
      points: Number(fd.get("points")) || null,
      due_date: String(fd.get("due_date") || "") || null,
      notes: String(fd.get("notes") || "").trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Multa registrada");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Multas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tickets?.length ?? 0} registro{tickets?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-10 shrink-0"><Plus className="mr-2 h-4 w-4" />Nova multa</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Registrar multa</DialogTitle></DialogHeader>
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
                <div><Label>Data infração *</Label><Input name="infraction_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></div>
                <div><Label>Vencimento</Label><Input name="due_date" type="date" /></div>
                <div className="col-span-2"><Label>Tipo de infração</Label><Input name="infraction_type" maxLength={100} placeholder="Ex.: Excesso de velocidade" /></div>
                <div className="col-span-2"><Label>Local</Label><Input name="location" maxLength={200} /></div>
                <div><Label>Valor (R$)</Label><Input name="value" type="number" step="0.01" min={0} required /></div>
                <div><Label>Pontos</Label><Input name="points" type="number" min={0} max={20} /></div>
                <div className="col-span-2"><Label>Observações</Label><Textarea name="notes" rows={2} /></div>
              </div>
              <Button type="submit" className="h-11 w-full">Registrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <SummaryCard label="Pendentes" value={totals.pendingCount.toString()} />
        <SummaryCard label="Em aberto" value={`R$ ${totals.pendingValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`} />
        <SummaryCard label="Pontos pendentes" value={totals.pendingPoints.toString()} />
      </div>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por placa, motorista, infração…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | "all")}>
          <SelectTrigger className="h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="paid">Pagas</SelectItem>
            <SelectItem value="appealed">Recorridas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4"><Skeleton className="h-24 w-full" /></div>
        ))}
        {!isLoading && filtered.map((t: any) => {
          const overdueDate = t.due_date && new Date(t.due_date) < new Date() && t.status === "pending";
          return (
            <article key={t.id} className="surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{t.vehicle?.plate ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.infraction_date).toLocaleDateString("pt-BR")}{t.driver?.full_name ? ` · ${t.driver.full_name}` : ""}</p>
                </div>
                <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as TicketStatus })}>
                  <SelectTrigger className={`h-7 w-auto shrink-0 gap-1 rounded-full border-0 px-2.5 py-0 text-[11px] font-semibold ${statusClasses[t.status as TicketStatus]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabel) as TicketStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {t.infraction_type && (
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                  {t.infraction_type}
                  {t.location && <span className="block text-xs">{t.location}</span>}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-semibold tabular-nums">R$ {Number(t.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pontos</p>
                  <p className="font-medium tabular-nums">{t.points ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Vencimento</p>
                  <p className={`font-medium ${overdueDate ? "text-destructive" : ""}`}>{t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end border-t border-border/60 pt-2">
                <button
                  onClick={() => { if (confirm("Excluir esta multa?")) remove.mutate(t.id); }}
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
            <AlertTriangle className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">{tickets?.length ? "Nenhuma multa corresponde aos filtros." : "Nenhuma multa registrada."}</p>
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
              <th className="px-4 py-3 font-semibold">Infração</th>
              <th className="px-4 py-3 text-right font-semibold">Valor</th>
              <th className="px-4 py-3 font-semibold">Pts</th>
              <th className="px-4 py-3 font-semibold">Vencimento</th>
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
            {!isLoading && filtered.map((t: any) => (
              <tr key={t.id} className="border-t border-border transition-colors hover:bg-muted/20">
                <td className="px-4 py-3">{new Date(t.infraction_date).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 font-medium">{t.vehicle?.plate ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.driver?.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="max-w-[260px] truncate">{t.infraction_type ?? "—"}</div>
                  {t.location && <div className="truncate text-xs">{t.location}</div>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right tabular-nums">R$ {Number(t.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 tabular-nums">{t.points ?? "—"}</td>
                <td className={`px-4 py-3 text-xs ${t.due_date && new Date(t.due_date) < new Date() && t.status === "pending" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v as TicketStatus })}>
                    <SelectTrigger className={`h-7 w-auto gap-1 rounded-full border-0 px-2.5 py-0 text-[11px] font-semibold ${statusClasses[t.status as TicketStatus]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(statusLabel) as TicketStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { if (confirm("Excluir esta multa?")) remove.mutate(t.id); }}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-12 text-center text-muted-foreground">
                  <AlertTriangle className="mx-auto mb-3 h-10 w-10" />
                  {tickets?.length ? "Nenhuma multa corresponde aos filtros." : "Nenhuma multa registrada."}
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
