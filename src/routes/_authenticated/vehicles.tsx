import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vehicles")({
  component: VehiclesPage,
});

function VehiclesPage() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("vehicles").insert({
      company_id: companyId,
      plate: String(fd.get("plate") || "").toUpperCase().trim(),
      model: String(fd.get("model") || "").trim(),
      brand: String(fd.get("brand") || "").trim(),
      year: Number(fd.get("year")) || null,
      color: String(fd.get("color") || "").trim() || null,
      fuel_type: String(fd.get("fuel_type") || "").trim() || null,
      current_km: Number(fd.get("current_km")) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Veículo cadastrado!");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Veículos</h1>
          <p className="text-sm text-muted-foreground">{vehicles?.length ?? 0} veículos cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo veículo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar veículo</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Placa</Label><Input name="plate" required maxLength={10} /></div>
                <div><Label>Ano</Label><Input name="year" type="number" min={1900} max={2100} /></div>
                <div><Label>Marca</Label><Input name="brand" required maxLength={50} /></div>
                <div><Label>Modelo</Label><Input name="model" required maxLength={50} /></div>
                <div><Label>Cor</Label><Input name="color" maxLength={30} /></div>
                <div><Label>Combustível</Label><Input name="fuel_type" placeholder="Diesel, Gasolina..." maxLength={30} /></div>
                <div className="col-span-2"><Label>Km atual</Label><Input name="current_km" type="number" min={0} defaultValue={0} /></div>
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vehicles?.map((v) => (
          <div key={v.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${v.status === "active" ? "bg-success/15 text-success" : v.status === "maintenance" ? "bg-warning/20 text-warning" : "bg-muted text-muted-foreground"}`}>
                {v.status}
              </span>
            </div>
            <h3 className="mt-3 font-display text-2xl">{v.plate}</h3>
            <p className="text-sm text-muted-foreground">{v.brand} {v.model} {v.year ? `· ${v.year}` : ""}</p>
            <p className="mt-3 text-xs text-muted-foreground">Km: {Number(v.current_km).toLocaleString("pt-BR")}</p>
          </div>
        ))}
        {vehicles && vehicles.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
