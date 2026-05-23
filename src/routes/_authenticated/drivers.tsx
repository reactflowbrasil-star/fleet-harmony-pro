import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/drivers")({
  component: DriversPage,
});

function DriversPage() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: drivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*, vehicle:vehicles(plate, model)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, plate, model").eq("status", "active");
      return data ?? [];
    },
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const vehicleId = String(fd.get("vehicle_id") || "");
    const { error } = await supabase.from("drivers").insert({
      company_id: companyId,
      full_name: String(fd.get("full_name") || "").trim(),
      cpf: String(fd.get("cpf") || "").trim() || null,
      phone: String(fd.get("phone") || "").trim() || null,
      email: String(fd.get("email") || "").trim() || null,
      cnh: String(fd.get("cnh") || "").trim() || null,
      cnh_category: String(fd.get("cnh_category") || "").trim() || null,
      cnh_expiry: (fd.get("cnh_expiry") as string) || null,
      vehicle_id: vehicleId || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Motorista cadastrado!");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["drivers"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Motoristas</h1>
          <p className="text-sm text-muted-foreground">{drivers?.length ?? 0} motoristas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Novo motorista</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar motorista</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>Nome completo</Label><Input name="full_name" required maxLength={100} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF</Label><Input name="cpf" maxLength={20} /></div>
                <div><Label>Telefone</Label><Input name="phone" maxLength={20} /></div>
                <div className="col-span-2"><Label>E-mail</Label><Input name="email" type="email" maxLength={255} /></div>
                <div><Label>CNH</Label><Input name="cnh" maxLength={20} /></div>
                <div><Label>Categoria</Label><Input name="cnh_category" maxLength={5} placeholder="B, C, D, E" /></div>
                <div className="col-span-2"><Label>Validade CNH</Label><Input name="cnh_expiry" type="date" /></div>
                <div className="col-span-2">
                  <Label>Veículo vinculado</Label>
                  <select name="vehicle_id" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">— sem vínculo —</option>
                    {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers?.map((d) => (
          <div key={d.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{d.full_name}</h3>
                <p className="text-xs text-muted-foreground">{d.email || d.phone || "—"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p>CNH: {d.cnh || "—"} {d.cnh_category && `(${d.cnh_category})`}</p>
              {d.cnh_expiry && <p>Validade: {new Date(d.cnh_expiry).toLocaleDateString("pt-BR")}</p>}
              <p>Veículo: {(d as any).vehicle?.plate ? `${(d as any).vehicle.plate} · ${(d as any).vehicle.model}` : "—"}</p>
            </div>
          </div>
        ))}
        {drivers && drivers.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <UserIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum motorista cadastrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
