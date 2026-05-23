import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vehicles")({
  component: VehiclesPage,
});

type VehicleStatus = "active" | "inactive" | "maintenance" | "sold";
const statusLabel: Record<VehicleStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  maintenance: "Manutenção",
  sold: "Vendido",
};
const statusClasses: Record<VehicleStatus, string> = {
  active: "bg-success/15 text-success",
  maintenance: "bg-warning/20 text-warning",
  inactive: "bg-muted text-muted-foreground",
  sold: "bg-muted text-muted-foreground",
};

type Vehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  fuel_type: string | null;
  current_km: number;
  status: VehicleStatus;
};

function VehiclesPage() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | "all">("all");

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.plate.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, statusFilter]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veículo excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      plate: String(fd.get("plate") || "").toUpperCase().trim(),
      model: String(fd.get("model") || "").trim(),
      brand: String(fd.get("brand") || "").trim(),
      year: Number(fd.get("year")) || null,
      color: String(fd.get("color") || "").trim() || null,
      fuel_type: String(fd.get("fuel_type") || "").trim() || null,
      current_km: Number(fd.get("current_km")) || 0,
      status: (String(fd.get("status") || "active") as VehicleStatus),
    };
    let error: any;
    if (editing) {
      ({ error } = await supabase.from("vehicles").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("vehicles").insert({ company_id: companyId, ...payload }));
    }
    if (error) return toast.error(error.message);
    toast.success(editing ? "Veículo atualizado" : "Veículo cadastrado");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  }

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(v: Vehicle) {
    setEditing(v);
    setOpen(true);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Veículos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vehicles?.length ?? 0} veículo{vehicles?.length === 1 ? "" : "s"} cadastrado{vehicles?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="h-10 shrink-0"><Plus className="mr-2 h-4 w-4" />Novo veículo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar veículo" : "Cadastrar veículo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Placa *</Label><Input name="plate" required maxLength={10} defaultValue={editing?.plate} /></div>
                <div><Label>Ano</Label><Input name="year" type="number" min={1900} max={2100} defaultValue={editing?.year ?? ""} /></div>
                <div><Label>Marca *</Label><Input name="brand" required maxLength={50} defaultValue={editing?.brand} /></div>
                <div><Label>Modelo *</Label><Input name="model" required maxLength={50} defaultValue={editing?.model} /></div>
                <div><Label>Cor</Label><Input name="color" maxLength={30} defaultValue={editing?.color ?? ""} /></div>
                <div><Label>Combustível</Label><Input name="fuel_type" placeholder="Diesel, Gasolina…" maxLength={30} defaultValue={editing?.fuel_type ?? ""} /></div>
                <div><Label>Km atual</Label><Input name="current_km" type="number" min={0} defaultValue={editing?.current_km ?? 0} /></div>
                <div>
                  <Label>Status</Label>
                  <select name="status" defaultValue={editing?.status ?? "active"} className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {(Object.keys(statusLabel) as VehicleStatus[]).map((s) => (
                      <option key={s} value={s}>{statusLabel[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full">{editing ? "Salvar alterações" : "Cadastrar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por placa, marca, modelo…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VehicleStatus | "all")}>
          <SelectTrigger className="h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabel) as VehicleStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface p-4 sm:p-5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-40" />
            <Skeleton className="mt-3 h-3 w-24" />
          </div>
        ))}
        {!isLoading && filtered.map((v) => (
          <article key={v.id} className="surface p-4 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-pop)] sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[v.status]}`}>
                {statusLabel[v.status]}
              </span>
            </div>
            <h3 className="mt-3 font-display text-2xl leading-none tracking-tight">{v.plate}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{v.brand} {v.model} {v.year ? `· ${v.year}` : ""}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Km: <span className="font-medium text-foreground">{Number(v.current_km).toLocaleString("pt-BR")}</span></span>
              {v.fuel_type && <span>· {v.fuel_type}</span>}
            </div>
            <div className="mt-4 flex items-center justify-end gap-1 border-t border-border/60 pt-3">
              <button
                onClick={() => openEdit(v)}
                className="tap rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => { if (confirm(`Excluir veículo ${v.plate}?`)) remove.mutate(v.id); }}
                className="tap rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center sm:p-12">
            <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {vehicles?.length ? "Nenhum veículo corresponde aos filtros." : "Nenhum veículo cadastrado ainda."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
