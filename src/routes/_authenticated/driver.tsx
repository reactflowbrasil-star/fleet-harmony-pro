import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Play, Square, Fuel, MapPin, Truck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverPortal,
});

function DriverPortal() {
  const { user, companyId } = useAuth();
  const qc = useQueryClient();
  const watchIdRef = useRef<number | null>(null);

  const { data: driver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("drivers")
        .select("*, vehicle:vehicles(*)")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: activeTrip, refetch: refetchTrip } = useQuery({
    queryKey: ["my-active-trip", driver?.id],
    queryFn: async () => {
      if (!driver?.id) return null;
      const { data } = await supabase
        .from("trips")
        .select("*")
        .eq("driver_id", driver.id)
        .eq("status", "in_progress")
        .maybeSingle();
      return data;
    },
    enabled: !!driver?.id,
  });

  // GPS streaming while there's an active trip
  useEffect(() => {
    if (!activeTrip || !companyId) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }
    if (!("geolocation" in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("gps_points").insert({
          trip_id: activeTrip.id,
          company_id: companyId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ?? null,
          heading: pos.coords.heading ?? null,
          accuracy: pos.coords.accuracy ?? null,
        });
      },
      (err) => console.warn("GPS error", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeTrip, companyId]);

  async function startTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!driver || !driver.vehicle_id || !companyId) {
      toast.error("Você precisa estar vinculado a um veículo.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("trips").insert({
      company_id: companyId,
      driver_id: driver.id,
      vehicle_id: driver.vehicle_id,
      origin: String(fd.get("origin") || "").trim() || null,
      destination: String(fd.get("destination") || "").trim() || null,
      start_km: Number(fd.get("start_km")) || null,
      start_at: new Date().toISOString(),
      status: "in_progress",
    });
    if (error) return toast.error(error.message);
    toast.success("Viagem iniciada. GPS ativo.");
    refetchTrip();
  }

  async function endTrip() {
    if (!activeTrip) return;
    const endKm = prompt("Quilometragem final:");
    if (!endKm) return;
    const { error } = await supabase
      .from("trips")
      .update({ status: "completed", end_at: new Date().toISOString(), end_km: Number(endKm) })
      .eq("id", activeTrip.id);
    if (error) return toast.error(error.message);
    toast.success("Viagem finalizada.");
    refetchTrip();
  }

  if (!user) return null;
  if (driver === null) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-warning" />
        <h2 className="mt-4 font-display text-2xl">Acesso de motorista</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um cadastro de motorista. Solicite ao administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-4xl">Olá, {driver?.full_name?.split(" ")[0] ?? "motorista"}</h1>
        <p className="text-sm text-muted-foreground">Portal do motorista</p>
      </div>

      {driver?.vehicle ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Meu veículo</p>
              <h3 className="font-display text-2xl">{(driver as any).vehicle.plate}</h3>
              <p className="text-sm text-muted-foreground">
                {(driver as any).vehicle.brand} {(driver as any).vehicle.model}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm">
          Nenhum veículo vinculado ao seu cadastro.
        </div>
      )}

      {activeTrip ? (
        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6">
          <div className="flex items-center gap-2 text-primary">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
            <span className="font-semibold">Viagem em andamento</span>
          </div>
          <p className="mt-3 text-sm">
            <MapPin className="mr-1 inline h-4 w-4" />
            {activeTrip.origin || "—"} → {activeTrip.destination || "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Iniciada: {activeTrip.start_at ? new Date(activeTrip.start_at).toLocaleString("pt-BR") : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Km inicial: {activeTrip.start_km ?? "—"}</p>
          <Button onClick={endTrip} variant="destructive" className="mt-4 w-full">
            <Square className="mr-2 h-4 w-4" />Finalizar viagem
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-display text-2xl">Iniciar nova viagem</h3>
          <p className="text-sm text-muted-foreground">Permita o acesso à localização para o rastreamento automático.</p>
          <form onSubmit={startTrip} className="mt-4 space-y-3">
            <div><Label>Origem</Label><Input name="origin" placeholder="Ex.: Garagem" /></div>
            <div><Label>Destino</Label><Input name="destination" placeholder="Ex.: Cliente XYZ" /></div>
            <div><Label>Km inicial</Label><Input name="start_km" type="number" min={0} /></div>
            <Button type="submit" className="w-full" disabled={!driver?.vehicle_id}>
              <Play className="mr-2 h-4 w-4" />Iniciar viagem
            </Button>
          </form>
        </div>
      )}

      <FuelQuick driverId={driver?.id} vehicleId={driver?.vehicle_id} companyId={companyId} tripId={activeTrip?.id} onSaved={() => qc.invalidateQueries()} />
    </div>
  );
}

function FuelQuick({ driverId, vehicleId, companyId, tripId, onSaved }: { driverId?: string; vehicleId?: string | null; companyId: string | null; tripId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId || !vehicleId) { toast.error("Sem veículo vinculado."); return; }
    const fd = new FormData(e.currentTarget);
    const liters = Number(fd.get("liters"));
    const ppl = Number(fd.get("ppl"));
    const { error } = await supabase.from("fuel_logs").insert({
      company_id: companyId,
      vehicle_id: vehicleId,
      driver_id: driverId ?? null,
      trip_id: tripId ?? null,
      station: String(fd.get("station") || "").trim() || null,
      liters,
      price_per_liter: ppl,
      total_value: liters * ppl,
      current_km: Number(fd.get("current_km")) || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Abastecimento enviado para aprovação.");
    setOpen(false);
    onSaved();
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-2xl">Abastecimento</h3>
          <p className="text-sm text-muted-foreground">Registre um abastecimento rápido.</p>
        </div>
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>
          <Fuel className="mr-2 h-4 w-4" />{open ? "Cancelar" : "Novo"}
        </Button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Posto</Label><Input name="station" maxLength={100} /></div>
          <div><Label>Litros</Label><Input name="liters" type="number" step="0.01" min={0} required /></div>
          <div><Label>R$/litro</Label><Input name="ppl" type="number" step="0.001" min={0} required /></div>
          <div><Label>Km atual</Label><Input name="current_km" type="number" min={0} /></div>
          <div className="sm:col-span-2"><Button type="submit" className="w-full">Enviar</Button></div>
        </form>
      )}
    </div>
  );
}
