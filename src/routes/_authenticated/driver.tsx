import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Play, Square, Fuel, MapPin, Truck, AlertCircle, Wifi, WifiOff,
  Gauge, Battery, Clock, Route as RouteIcon, Shield, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { countQueued, flushQueue, sendGps } from "@/lib/gps-queue";

export const Route = createFileRoute("/_authenticated/driver")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: driverRow } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const roles = (rolesData ?? []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin") || roles.includes("fleet_manager");
    if (!driverRow && !isAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: DriverPortal,
});

const LGPD_KEY = "fleetguard-gps-consent";

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

function useBattery() {
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    const nav: any = navigator;
    if (!nav.getBattery) return;
    let battery: any;
    let mounted = true;
    nav.getBattery().then((b: any) => {
      if (!mounted) return;
      battery = b;
      const update = () => setLevel(Math.round(b.level * 100));
      update();
      b.addEventListener("levelchange", update);
    });
    return () => { mounted = false; if (battery) battery.removeEventListener("levelchange", () => {}); };
  }, []);
  return level;
}

function useElapsed(start?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!start) return "00:00:00";
  const ms = Math.max(0, now - new Date(start).getTime());
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function DriverPortal() {
  const { user, companyId } = useAuth();
  const qc = useQueryClient();
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const [consent, setConsent] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LGPD_KEY) === "yes";
  });
  const [endOpen, setEndOpen] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [lastFix, setLastFix] = useState<number | null>(null);
  const [queued, setQueued] = useState(0);

  const online = useOnline();
  const battery = useBattery();

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

  const elapsed = useElapsed(activeTrip?.start_at);

  // refresh queued count periodically
  useEffect(() => {
    let mounted = true;
    const tick = async () => {
      try {
        const n = await countQueued();
        if (mounted) setQueued(n);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => { mounted = false; clearInterval(id); };
  }, [activeTrip?.id]);

  // flush queue on reconnect
  useEffect(() => {
    if (!online) return;
    flushQueue().then(({ flushed }) => {
      if (flushed > 0) toast.success(`${flushed} ponto(s) GPS sincronizado(s).`);
      countQueued().then(setQueued).catch(() => {});
    }).catch(() => {});
  }, [online]);

  // GPS streaming while trip active
  useEffect(() => {
    if (!activeTrip || !companyId) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      setCurrentSpeed(null);
      setAccuracy(null);
      setDistance(0);
      lastPosRef.current = null;
      return;
    }
    if (!("geolocation" in navigator)) {
      toast.error("Este dispositivo não suporta GPS.");
      return;
    }
    setGpsActive(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const sp = pos.coords.speed;
        setCurrentSpeed(sp ?? null);
        setAccuracy(pos.coords.accuracy ?? null);
        setLastFix(Date.now());

        if (lastPosRef.current) {
          const d = haversineMeters(lastPosRef.current, { lat, lng });
          if (d < 1000) setDistance((x) => x + d);
        }
        lastPosRef.current = { lat, lng };

        const result = await sendGps({
          trip_id: activeTrip.id,
          company_id: companyId,
          lat,
          lng,
          speed: sp ?? null,
          heading: pos.coords.heading ?? null,
          accuracy: pos.coords.accuracy ?? null,
          recorded_at: new Date().toISOString(),
        });
        if (result.queued) {
          countQueued().then(setQueued).catch(() => {});
        }
      },
      (err) => {
        console.warn("GPS error", err);
        setGpsActive(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Permissão de localização negada.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeTrip, companyId]);

  async function requestGpsPermission() {
    if (!("geolocation" in navigator)) {
      toast.error("Seu dispositivo não suporta GPS.");
      return false;
    }
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (err) => {
          toast.error(err.code === err.PERMISSION_DENIED
            ? "Permissão negada. Habilite a localização nas configurações."
            : "Não foi possível ativar o GPS.");
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }

  async function startTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!driver || !driver.vehicle_id || !companyId) {
      toast.error("Você precisa estar vinculado a um veículo.");
      return;
    }
    const ok = await requestGpsPermission();
    if (!ok) return;

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

  async function confirmEndTrip(endKm: number | null) {
    if (!activeTrip) return;
    const { error } = await supabase
      .from("trips")
      .update({
        status: "completed",
        end_at: new Date().toISOString(),
        end_km: endKm,
        distance_m: Math.round(distance) || null,
      })
      .eq("id", activeTrip.id);
    if (error) return toast.error(error.message);
    toast.success("Viagem finalizada.");
    setEndOpen(false);
    refetchTrip();
  }

  function acceptConsent() {
    localStorage.setItem(LGPD_KEY, "yes");
    setConsent(true);
  }

  if (!user) return null;
  if (driver === null) {
    return (
      <div className="mx-auto max-w-md surface p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-warning" />
        <h2 className="mt-4 font-display text-2xl">Acesso de motorista</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um cadastro de motorista. Solicite ao administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Olá, {driver?.full_name?.split(" ")[0] ?? "motorista"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Portal do motorista</p>
        </div>
        <ConnectivityBadge online={online} queued={queued} />
      </header>

      {!consent && (
        <div className="surface border-primary/40 bg-primary/[0.04] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Consentimento de localização (LGPD)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sua localização será utilizada apenas durante viagens ativas, para fins de segurança,
                controle operacional e gestão da frota. Você pode revogar o consentimento a qualquer momento
                nas configurações do navegador.
              </p>
              <Button onClick={acceptConsent} className="mt-4 h-10">
                <CheckCircle2 className="mr-2 h-4 w-4" />Aceitar e continuar
              </Button>
            </div>
          </div>
        </div>
      )}

      {driver?.vehicle ? (
        <div className="surface p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Truck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meu veículo</p>
              <h3 className="font-display text-2xl leading-none">{(driver as any).vehicle.plate}</h3>
              <p className="text-sm text-muted-foreground">
                {(driver as any).vehicle.brand} {(driver as any).vehicle.model}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="surface border-warning/40 bg-warning/[0.04] p-5 text-sm">
          Nenhum veículo vinculado ao seu cadastro.
        </div>
      )}

      {activeTrip ? (
        <ActiveTripCard
          trip={activeTrip}
          elapsed={elapsed}
          gpsActive={gpsActive}
          currentSpeed={currentSpeed}
          accuracy={accuracy}
          distance={distance}
          lastFix={lastFix}
          battery={battery}
          online={online}
          onEnd={() => setEndOpen(true)}
        />
      ) : (
        <div className="surface p-5 sm:p-6">
          <h3 className="font-display text-2xl">Iniciar nova viagem</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            O GPS será ativado automaticamente após confirmação.
          </p>
          <form onSubmit={startTrip} className="mt-4 space-y-3">
            <div><Label>Origem</Label><Input name="origin" placeholder="Ex.: Garagem" className="h-11" /></div>
            <div><Label>Destino</Label><Input name="destination" placeholder="Ex.: Cliente XYZ" className="h-11" /></div>
            <div><Label>Km inicial</Label><Input name="start_km" type="number" min={0} className="h-11" /></div>
            <Button type="submit" className="h-12 w-full text-base" disabled={!driver?.vehicle_id || !consent}>
              <Play className="mr-2 h-5 w-5" />Iniciar viagem
            </Button>
            {!consent && (
              <p className="text-center text-xs text-muted-foreground">Aceite o consentimento de localização acima para iniciar.</p>
            )}
          </form>
        </div>
      )}

      <FuelQuick
        driverId={driver?.id}
        vehicleId={driver?.vehicle_id}
        companyId={companyId}
        tripId={activeTrip?.id}
        onSaved={() => qc.invalidateQueries()}
      />

      <EndTripDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        distance={distance}
        onConfirm={confirmEndTrip}
      />
    </div>
  );
}

function ConnectivityBadge({ online, queued }: { online: boolean; queued: number }) {
  if (online && queued === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
        <Wifi className="h-3 w-3" /> Online
      </span>
    );
  }
  if (!online) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
        <WifiOff className="h-3 w-3" /> Offline · {queued} na fila
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
      <Wifi className="h-3 w-3" /> Sincronizando · {queued}
    </span>
  );
}

function ActiveTripCard({
  trip, elapsed, gpsActive, currentSpeed, accuracy, distance, lastFix, battery, online, onEnd,
}: {
  trip: any;
  elapsed: string;
  gpsActive: boolean;
  currentSpeed: number | null;
  accuracy: number | null;
  distance: number;
  lastFix: number | null;
  battery: number | null;
  online: boolean;
  onEnd: () => void;
}) {
  const kmh = currentSpeed != null ? Math.max(0, Math.round(currentSpeed * 3.6)) : null;
  const km = (distance / 1000).toFixed(2);
  const lastFixSecs = lastFix ? Math.floor((Date.now() - lastFix) / 1000) : null;
  const signalOk = gpsActive && lastFixSecs != null && lastFixSecs < 30;

  return (
    <div className="surface relative overflow-hidden border-primary/40 bg-primary/[0.04] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className={cn("absolute inset-0 rounded-full", signalOk ? "bg-success" : "bg-warning")} />
            <span className={cn("pulse-dot absolute inset-0 rounded-full", signalOk ? "text-success" : "text-warning")} />
          </span>
          <span className="font-semibold tracking-tight">Viagem em andamento</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {signalOk ? "GPS ativo" : gpsActive ? "Aguardando sinal" : "GPS inativo"}
        </span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{trip.origin || "—"} → {trip.destination || "—"}</span>
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile icon={Clock} label="Tempo" value={elapsed} />
        <Tile icon={RouteIcon} label="Distância" value={`${km} km`} />
        <Tile icon={Gauge} label="Velocidade" value={kmh != null ? `${kmh} km/h` : "—"} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Início: {trip.start_at ? new Date(trip.start_at).toLocaleTimeString("pt-BR") : "—"}</span>
        {trip.start_km != null && <span>Km inicial: {trip.start_km}</span>}
        {accuracy != null && <span>Precisão: ±{Math.round(accuracy)} m</span>}
        {battery != null && (
          <span className="inline-flex items-center gap-1">
            <Battery className="h-3 w-3" /> {battery}%
          </span>
        )}
        {!online && <span className="text-warning">Modo offline</span>}
      </div>

      <Button onClick={onEnd} variant="destructive" className="mt-5 h-12 w-full text-base">
        <Square className="mr-2 h-5 w-5" />Finalizar viagem
      </Button>

      <p className="mt-3 text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Rastreamento GPS ativo durante esta viagem.
      </p>
    </div>
  );
}

function Tile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="surface p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="font-display text-xl leading-none tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

function EndTripDialog({
  open, onOpenChange, distance, onConfirm,
}: { open: boolean; onOpenChange: (b: boolean) => void; distance: number; onConfirm: (km: number | null) => void }) {
  const computed = useMemo(() => (distance / 1000).toFixed(2), [distance]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Finalizar viagem</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const v = fd.get("end_km");
            const n = v ? Number(v) : null;
            onConfirm(n);
          }}
          className="space-y-3"
        >
          <div className="surface p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Distância calculada</p>
            <p className="font-display text-2xl tabular-nums">{computed} km</p>
          </div>
          <div>
            <Label>Km final (opcional)</Label>
            <Input name="end_km" type="number" min={0} className="h-11" placeholder="Conferir no odômetro" />
          </div>
          <Button type="submit" className="h-11 w-full">
            <CheckCircle2 className="mr-2 h-4 w-4" />Confirmar e encerrar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FuelQuick({
  driverId, vehicleId, companyId, tripId, onSaved,
}: { driverId?: string; vehicleId?: string | null; companyId: string | null; tripId?: string; onSaved: () => void }) {
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
      total_value: Math.round(liters * ppl * 100) / 100,
      current_km: Number(fd.get("current_km")) || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Abastecimento enviado para aprovação.");
    setOpen(false);
    onSaved();
  }
  return (
    <div className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl">Abastecimento</h3>
          <p className="text-sm text-muted-foreground">Registre um abastecimento rápido.</p>
        </div>
        <Button variant="outline" onClick={() => setOpen((v) => !v)} className="h-10">
          <Fuel className="mr-2 h-4 w-4" />{open ? "Cancelar" : "Novo"}
        </Button>
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Posto</Label><Input name="station" maxLength={100} className="h-11" /></div>
          <div><Label>Litros</Label><Input name="liters" type="number" step="0.01" min={0} required className="h-11" /></div>
          <div><Label>R$/litro</Label><Input name="ppl" type="number" step="0.001" min={0} required className="h-11" /></div>
          <div><Label>Km atual</Label><Input name="current_km" type="number" min={0} className="h-11" /></div>
          <div className="sm:col-span-2"><Button type="submit" className="h-11 w-full">Enviar</Button></div>
        </form>
      )}
    </div>
  );
}
