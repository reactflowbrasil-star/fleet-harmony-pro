import { createFileRoute } from "@tanstack/react-router";
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
  ExternalLink, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { countQueued, flushQueue, sendGps } from "@/lib/gps-queue";
import { isInsideCircle } from "@/lib/geo";
import { useWakeLock } from "@/hooks/use-pwa";
import { DeliveryConfirmDialog } from "@/components/delivery-confirm-dialog";
import { GuidedTripMap } from "@/components/guided-trip-map";

export const Route = createFileRoute("/_authenticated/driver")({
  // No redirect: any authenticated user can land on /driver.
  // - If they have a linked drivers row → DriverPortal shows the full app.
  // - If not → DriverPortal renders a friendly "Acesso de motorista" empty state
  //   asking the admin to link the account. This avoids bouncing the driver
  //   back to /dashboard where they'd see RLS errors and the admin shell.
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
    let handler: (() => void) | null = null;
    let mounted = true;
    nav.getBattery().then((b: any) => {
      if (!mounted) return;
      battery = b;
      handler = () => setLevel(Math.round(b.level * 100));
      handler();
      b.addEventListener("levelchange", handler);
    });
    return () => {
      mounted = false;
      if (battery && handler) battery.removeEventListener("levelchange", handler);
    };
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

type ActiveGeofence = {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
};

function DriverPortal() {
  const { user, companyId } = useAuth();
  const qc = useQueryClient();
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const insideRef = useRef<Set<string>>(new Set());

  const [consent, setConsent] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LGPD_KEY) === "yes";
  });
  const [endOpen, setEndOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [lastFix, setLastFix] = useState<number | null>(null);
  const [queued, setQueued] = useState(0);
  const [livePos, setLivePos] = useState<{ lat: number; lng: number; heading: number | null; speed: number | null } | null>(null);

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

  const { data: geofences } = useQuery({
    queryKey: ["active-geofences", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await (supabase as any)
        .from("geofences")
        .select("id, name, center_lat, center_lng, radius_m")
        .eq("company_id", companyId)
        .eq("active", true);
      return (data ?? []) as ActiveGeofence[];
    },
    enabled: !!companyId,
    refetchInterval: 60_000,
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

  const { data: activeRoutePoints } = useQuery({
    queryKey: ["active-route-points", activeTrip?.id],
    queryFn: async () => {
      if (!activeTrip?.id) return [] as Array<{ lat: number; lng: number; name: string; type: string }>;
      const { data, error } = await (supabase as any)
        .from("trip_route_points")
        .select("latitude, longitude, name, point_type, point_order")
        .eq("trip_id", activeTrip.id)
        .order("point_order");
      if (error || !data) {
        // fallback to trip origin/destination lat/lng if route_points table is absent
        const built: Array<{ lat: number; lng: number; name: string; type: string }> = [];
        if ((activeTrip as any).origin_lat != null && (activeTrip as any).origin_lng != null) {
          built.push({
            lat: Number((activeTrip as any).origin_lat),
            lng: Number((activeTrip as any).origin_lng),
            name: (activeTrip as any).origin ?? "Origem",
            type: "origin",
          });
        }
        if ((activeTrip as any).destination_lat != null && (activeTrip as any).destination_lng != null) {
          built.push({
            lat: Number((activeTrip as any).destination_lat),
            lng: Number((activeTrip as any).destination_lng),
            name: (activeTrip as any).destination ?? "Destino",
            type: "destination",
          });
        }
        return built;
      }
      return (data as any[]).map((p) => ({
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        name: p.name ?? p.point_type,
        type: p.point_type,
      }));
    },
    enabled: !!activeTrip?.id,
  });

  const { data: assignedTrips, refetch: refetchAssigned } = useQuery({
    queryKey: ["my-assigned-trips", driver?.id],
    queryFn: async () => {
      if (!driver?.id) return [];
      const { data } = await supabase
        .from("trips")
        .select("*, vehicle:vehicles(plate, model, brand)")
        .eq("driver_id", driver.id)
        .in("status", ["scheduled", "assigned", "viewed", "paused"] as any)
        .order("scheduled_start_at", { ascending: true, nullsFirst: false });
      return (data ?? []) as any[];
    },
    enabled: !!driver?.id,
    refetchInterval: 30_000,
  });

  // realtime: refetch when admin assigns/edits my trips
  useEffect(() => {
    if (!driver?.id) return;
    const ch = supabase
      .channel(`driver-trips-${driver.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `driver_id=eq.${driver.id}` }, () => {
        refetchAssigned();
        refetchTrip();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driver?.id, refetchAssigned, refetchTrip]);

  const [openTripId, setOpenTripId] = useState<string | null>(null);
  const openTrip = useMemo(() => (assignedTrips ?? []).find((t) => t.id === openTripId) ?? null, [assignedTrips, openTripId]);

  const elapsed = useElapsed(activeTrip?.start_at);
  // Keep screen awake while there's an active trip so the browser doesn't suspend GPS.
  useWakeLock(!!activeTrip);

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
      setLivePos(null);
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
        setLivePos({ lat, lng, heading: pos.coords.heading ?? null, speed: sp ?? null });

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

        // Geofence detection
        for (const g of (geofences ?? [])) {
          const inside = isInsideCircle(
            { lat, lng },
            { lat: g.center_lat, lng: g.center_lng },
            Number(g.radius_m),
          );
          const wasInside = insideRef.current.has(g.id);
          if (inside && !wasInside) {
            insideRef.current.add(g.id);
            (supabase as any).from("geofence_events").insert({
              company_id: companyId,
              geofence_id: g.id,
              vehicle_id: activeTrip.vehicle_id,
              driver_id: activeTrip.driver_id,
              trip_id: activeTrip.id,
              event_type: "enter",
              lat, lng,
            }).then(({ error }: { error: any }) => {
              if (!error) toast.success(`Entrada: ${g.name}`);
            }).catch(() => { /* silent — RLS/missing migration */ });
          } else if (!inside && wasInside) {
            insideRef.current.delete(g.id);
            (supabase as any).from("geofence_events").insert({
              company_id: companyId,
              geofence_id: g.id,
              vehicle_id: activeTrip.vehicle_id,
              driver_id: activeTrip.driver_id,
              trip_id: activeTrip.id,
              event_type: "exit",
              lat, lng,
            }).then(({ error }: { error: any }) => {
              if (!error) toast.message(`Saída: ${g.name}`);
            }).catch(() => { /* silent */ });
          }
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

  async function startAssignedTrip(trip: any) {
    if (!consent) { toast.error("Aceite o consentimento de localização para iniciar."); return; }
    if (!companyId) return;
    const ok = await requestGpsPermission();
    if (!ok) return;
    const startKmStr = window.prompt("Quilometragem inicial do veículo (opcional):", "");
    const startKm = startKmStr ? Number(startKmStr) : null;
    const { error } = await supabase
      .from("trips")
      .update({
        status: "in_progress",
        start_at: new Date().toISOString(),
        start_km: startKm,
      })
      .eq("id", trip.id);
    if (error) return toast.error(error.message);
    toast.success("Viagem iniciada. GPS ativo.");
    setOpenTripId(null);
    refetchTrip();
    refetchAssigned();
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
          livePos={livePos}
          waypoints={activeRoutePoints ?? []}
          onEnd={() => setEndOpen(true)}
        />
      ) : openTrip ? (
        <AssignedTripDetail
          trip={openTrip}
          consent={consent}
          onBack={() => setOpenTripId(null)}
          onStart={() => startAssignedTrip(openTrip)}
        />
      ) : (
        <>
          {(assignedTrips ?? []).length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="font-display text-xl">Próximas viagens</h2>
                <span className="text-[11px] text-muted-foreground">{assignedTrips!.length} atribuída{assignedTrips!.length === 1 ? "" : "s"}</span>
              </div>
              {assignedTrips!.map((t) => (
                <AssignedTripCard key={t.id} trip={t} onOpen={() => setOpenTripId(t.id)} />
              ))}
            </section>
          )}

          <div className="surface p-5 sm:p-6">
            <h3 className="font-display text-2xl">
              {(assignedTrips ?? []).length > 0 ? "Iniciar viagem ad-hoc" : "Iniciar nova viagem"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {(assignedTrips ?? []).length > 0
                ? "Use apenas para viagens não cadastradas pelo gestor."
                : "O GPS será ativado automaticamente após confirmação."}
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
        </>
      )}

      {activeTrip && driver?.id && companyId && (
        <button
          onClick={() => setDeliveryOpen(true)}
          className="surface flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-success/40 active:border-success/40 sm:p-5"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-none">Confirmar entrega</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Foto da mercadoria + assinatura do destinatário
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
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

      {activeTrip && driver?.id && companyId && (
        <DeliveryConfirmDialog
          open={deliveryOpen}
          onOpenChange={setDeliveryOpen}
          companyId={companyId}
          tripId={activeTrip.id}
          driverId={driver.id}
          defaultPosition={lastPosRef.current}
          onConfirmed={() => qc.invalidateQueries({ queryKey: ["my-active-trip"] })}
        />
      )}
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
  livePos, waypoints,
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
  livePos: { lat: number; lng: number; heading: number | null; speed: number | null } | null;
  waypoints: Array<{ lat: number; lng: number; name?: string; type?: string }>;
}) {
  const kmh = currentSpeed != null ? Math.max(0, Math.round(currentSpeed * 3.6)) : null;
  const km = (distance / 1000).toFixed(2);
  const lastFixSecs = lastFix ? Math.floor((Date.now() - lastFix) / 1000) : null;
  const signalOk = gpsActive && lastFixSecs != null && lastFixSecs < 30;

  // Build navigation waypoints: prepend current GPS as the "from", end at the planned destination
  const navWaypoints = (() => {
    if (waypoints.length === 0) return [];
    // Use current position as start so directions reflect "from where I am now"
    if (livePos) {
      const dest = waypoints[waypoints.length - 1];
      const stops = waypoints.slice(0, -1).filter((w) => w.type !== "origin");
      return [
        { lat: livePos.lat, lng: livePos.lng, name: "Minha posição", type: "origin" as const },
        ...stops,
        dest,
      ];
    }
    return waypoints;
  })();

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

      {/* Live guided map with turn-by-turn instructions */}
      {navWaypoints.length >= 2 && (
        <div className="mt-4">
          <GuidedTripMap waypoints={navWaypoints} position={livePos} height={320} />
        </div>
      )}

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

function AssignedTripCard({ trip, onOpen }: { trip: any; onOpen: () => void }) {
  const statusBadge: Record<string, string> = {
    assigned: "bg-primary/15 text-primary",
    viewed: "bg-primary/10 text-primary",
    scheduled: "bg-muted text-muted-foreground",
    paused: "bg-warning/20 text-warning",
  };
  const statusLabel: Record<string, string> = {
    assigned: "Atribuída", viewed: "Visualizada", scheduled: "Agendada", paused: "Pausada",
  };
  return (
    <button onClick={onOpen} className="surface w-full p-4 text-left transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{trip.title || `${trip.origin || "—"} → ${trip.destination || "—"}`}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {trip.vehicle?.plate ?? "—"} · {trip.vehicle?.brand ?? ""} {trip.vehicle?.model ?? ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[trip.status] ?? "bg-muted text-muted-foreground"}`}>
          {statusLabel[trip.status] ?? trip.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-muted-foreground">Início previsto</p>
          <p className="font-medium">{trip.scheduled_start_at ? new Date(trip.scheduled_start_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Distância est.</p>
          <p className="font-medium">{trip.estimated_distance_m ? `${(Number(trip.estimated_distance_m) / 1000).toFixed(1)} km` : "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Duração est.</p>
          <p className="font-medium">{trip.estimated_duration_s ? `${Math.round(Number(trip.estimated_duration_s) / 60)} min` : "—"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end text-xs text-primary">
        Ver detalhes <ChevronRight className="ml-0.5 h-3 w-3" />
      </div>
    </button>
  );
}

function AssignedTripDetail({ trip, consent, onBack, onStart }: { trip: any; consent: boolean; onBack: () => void; onStart: () => void }) {
  const { data: routePoints } = useQuery({
    queryKey: ["trip-points-driver", trip.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("trip_route_points").select("*").eq("trip_id", trip.id).order("point_order");
      if (error) return [];
      return data as any[];
    },
  });

  useEffect(() => {
    (async () => { try { await (supabase as any).rpc("fn_mark_trip_viewed", { _trip_id: trip.id }); } catch {} })();
  }, [trip.id]);

  const origin = routePoints?.find((p) => p.point_type === "origin");
  const destination = routePoints?.find((p) => p.point_type === "destination");
  const stops = (routePoints ?? []).filter((p) => p.point_type !== "origin" && p.point_type !== "destination");
  const navLat = destination?.latitude ?? trip.destination_lat;
  const navLng = destination?.longitude ?? trip.destination_lng;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-4 w-4 rotate-180" />Voltar
      </button>
      <header>
        <h2 className="font-display text-2xl">{trip.title || "Viagem"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {trip.scheduled_start_at ? `Previsão: ${new Date(trip.scheduled_start_at).toLocaleString("pt-BR")}` : "Sem horário previsto"}
        </p>
      </header>

      <section className="surface p-4">
        <h3 className="mb-2 font-display text-lg">Rota</h3>
        <div className="space-y-2 text-sm">
          {origin && (
            <div className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-success" />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Origem</div>
                <div className="truncate font-medium">{origin.name ?? trip.origin}</div>
                <div className="text-[11px] text-muted-foreground">{Number(origin.latitude).toFixed(5)}, {Number(origin.longitude).toFixed(5)}</div>
              </div>
            </div>
          )}
          {stops.map((p, i) => (
            <div key={p.id} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Parada {i + 1}</div>
                <div className="truncate font-medium">{p.name ?? p.point_type}</div>
                <div className="text-[11px] text-muted-foreground">{Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}</div>
              </div>
            </div>
          ))}
          {destination && (
            <div className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-destructive" />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Destino</div>
                <div className="truncate font-medium">{destination.name ?? trip.destination}</div>
                <div className="text-[11px] text-muted-foreground">{Number(destination.latitude).toFixed(5)}, {Number(destination.longitude).toFixed(5)}</div>
              </div>
            </div>
          )}
          {!origin && !destination && (
            <p className="text-sm text-muted-foreground">{trip.origin || "—"} → {trip.destination || "—"}</p>
          )}
        </div>
        {trip.driver_instructions && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
            <div className="mb-1 font-semibold text-warning">Instruções</div>
            <div>{trip.driver_instructions}</div>
          </div>
        )}
      </section>

      {navLat && navLng && (
        <div className="flex flex-wrap gap-2">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}&travelmode=driving`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            <ExternalLink className="h-4 w-4" />Google Maps
          </a>
          <a href={`https://waze.com/ul?ll=${navLat},${navLng}&navigate=yes`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            <ExternalLink className="h-4 w-4" />Waze
          </a>
          <a href={`http://maps.apple.com/?daddr=${navLat},${navLng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
            <ExternalLink className="h-4 w-4" />Apple Maps
          </a>
        </div>
      )}

      <Button onClick={onStart} disabled={!consent} className="h-12 w-full text-base">
        <Play className="mr-2 h-5 w-5" />Iniciar viagem
      </Button>
      {!consent && (
        <p className="text-center text-xs text-muted-foreground">Aceite o consentimento de localização acima para iniciar.</p>
      )}
    </div>
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
