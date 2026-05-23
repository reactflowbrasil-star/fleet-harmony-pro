import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle, ArrowLeft, Clock, Gauge, MapPin, Pencil, Route as RouteIcon,
  Timer, Truck, User as UserIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/trips_/$tripId")({
  component: TripDetailPage,
});

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDuration(ms: number) {
  if (ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

const pointTypeLabel: Record<string, string> = {
  origin: "Origem", stop: "Parada", pickup: "Coleta", delivery: "Entrega",
  fuel: "Abastecimento", rest: "Descanso", destination: "Destino",
};
const pointTypeColor: Record<string, string> = {
  origin: "#16a34a", destination: "#dc2626", stop: "#2563eb",
  pickup: "#f59e0b", delivery: "#8b5cf6", fuel: "#ec4899", rest: "#6366f1",
};

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const fetchToken = useServerFn(getMapboxToken);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, vehicle:vehicles(plate, model, brand), driver:drivers(full_name, phone)")
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: routePoints } = useQuery({
    queryKey: ["trip-route-points", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trip_route_points")
        .select("*")
        .eq("trip_id", tripId)
        .order("point_order");
      if (error) {
        // table may not exist yet (migration not applied); fail soft
        return [];
      }
      return (data ?? []) as Array<{
        id: string; point_order: number; point_type: string; name: string | null;
        address: string | null; latitude: number; longitude: number; notes: string | null;
        is_required: boolean; status: string; visited_at: string | null;
      }>;
    },
  });

  const { data: gpsPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ["trip-points", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gps_points")
        .select("lat, lng, speed, recorded_at")
        .eq("trip_id", tripId)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { lat: number; lng: number; speed: number | null; recorded_at: string }[];
    },
    refetchInterval: (q) => ((q.state.data as any) && trip?.status === "in_progress" ? 10_000 : false),
  });

  const metrics = useMemo(() => {
    if (!gpsPoints || gpsPoints.length === 0) {
      return {
        distanceKm: 0, maxSpeed: 0, avgSpeed: 0, duration: 0,
        kmFromOdo: (trip?.start_km != null && trip?.end_km != null) ? Math.max(0, Number(trip.end_km) - Number(trip.start_km)) : null,
        hasReal: false,
      };
    }
    let dist = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedSamples = 0;
    for (let i = 1; i < gpsPoints.length; i++) dist += haversine(gpsPoints[i - 1], gpsPoints[i]);
    for (const p of gpsPoints) {
      const v = Number(p.speed ?? 0) * 3.6;
      if (v > maxSpeed) maxSpeed = v;
      if (v > 1) { speedSum += v; speedSamples++; }
    }
    const start = trip?.start_at ? new Date(trip.start_at) : new Date(gpsPoints[0].recorded_at);
    const end = trip?.end_at ? new Date(trip.end_at) : new Date(gpsPoints[gpsPoints.length - 1].recorded_at);
    return {
      distanceKm: dist / 1000,
      maxSpeed,
      avgSpeed: speedSamples > 0 ? speedSum / speedSamples : 0,
      duration: end.getTime() - start.getTime(),
      kmFromOdo: (trip?.start_km != null && trip?.end_km != null) ? Math.max(0, Number(trip.end_km) - Number(trip.start_km)) : null,
      hasReal: true,
    };
  }, [gpsPoints, trip]);

  // init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token } = await fetchToken();
      if (cancelled || !token) return;
      mapboxgl.accessToken = token;
      if (!containerRef.current || mapRef.current) return;
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-46.6333, -23.5505],
        zoom: 10,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [fetchToken]);

  // draw layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function apply() {
      if (!map) return;
      const allBounds = new mapboxgl.LngLatBounds();

      // PLANNED route
      const plannedCoords = (routePoints ?? []).map((p) => [p.longitude, p.latitude] as [number, number]);
      if (plannedCoords.length >= 2) {
        const planned = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: plannedCoords },
        };
        const src = map.getSource("planned-route") as mapboxgl.GeoJSONSource | undefined;
        if (src) src.setData(planned as any);
        else {
          map.addSource("planned-route", { type: "geojson", data: planned as any });
          map.addLayer({
            id: "planned-route-line",
            type: "line",
            source: "planned-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#2563eb", "line-width": 4, "line-dasharray": [2, 2], "line-opacity": 0.7 },
          });
        }
      }

      // REAL route
      const realCoords = (gpsPoints ?? []).map((p) => [p.lng, p.lat] as [number, number]);
      if (realCoords.length >= 2) {
        const real = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: realCoords },
        };
        const src = map.getSource("real-route") as mapboxgl.GeoJSONSource | undefined;
        if (src) src.setData(real as any);
        else {
          map.addSource("real-route", { type: "geojson", data: real as any });
          map.addLayer({
            id: "real-route-line",
            type: "line",
            source: "real-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#16a34a", "line-width": 4, "line-opacity": 0.9 },
          });
        }
      }

      // Markers
      (map as any).__detailMarkers?.forEach((m: mapboxgl.Marker) => m.remove());
      const markers: mapboxgl.Marker[] = [];

      // planned points
      (routePoints ?? []).forEach((p, i) => {
        allBounds.extend([p.longitude, p.latitude]);
        const el = document.createElement("div");
        const color = pointTypeColor[p.point_type] ?? "#6b7280";
        const label = p.point_type === "origin" ? "A" : p.point_type === "destination" ? "B" : String(i);
        el.style.cssText = `display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
        el.textContent = label;
        const m = new mapboxgl.Marker(el).setLngLat([p.longitude, p.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`<strong>${p.name ?? pointTypeLabel[p.point_type] ?? p.point_type}</strong><br/><small style="color:#6b7280">${pointTypeLabel[p.point_type] ?? p.point_type}</small>`))
          .addTo(map);
        markers.push(m);
      });

      // real start/end (only if no planned origin/destination shown)
      if (realCoords.length > 0) {
        realCoords.forEach((c) => allBounds.extend(c));
        if (!routePoints || routePoints.length === 0) {
          const start = realCoords[0];
          const end = realCoords[realCoords.length - 1];
          const mk = (lng: number, lat: number, color: string, label: string) => {
            const el = document.createElement("div");
            el.style.cssText = `display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
            el.textContent = label;
            return new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
          };
          markers.push(mk(start[0], start[1], "#16a34a", "A"));
          markers.push(mk(end[0], end[1], "#dc2626", "B"));
        }
      }
      (map as any).__detailMarkers = markers;

      if (!allBounds.isEmpty()) {
        map.fitBounds(allBounds, { padding: 60, maxZoom: 15, duration: 600 });
      }
    }

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [routePoints, gpsPoints]);

  if (tripLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[60vh] w-full rounded-2xl" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="surface p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-3 text-sm">Viagem não encontrada.</p>
        <Link to="/trips" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />Voltar para viagens
        </Link>
      </div>
    );
  }

  const statusLabel: Record<string, { label: string; class: string }> = {
    scheduled:   { label: "Agendada",     class: "bg-muted text-muted-foreground" },
    assigned:    { label: "Atribuída",    class: "bg-primary/10 text-primary" },
    viewed:      { label: "Visualizada",  class: "bg-primary/15 text-primary" },
    in_progress: { label: "Em andamento", class: "bg-primary/15 text-primary" },
    paused:      { label: "Pausada",      class: "bg-warning/20 text-warning" },
    late:        { label: "Atrasada",     class: "bg-warning/20 text-warning" },
    incident:    { label: "Com ocorrência", class: "bg-destructive/15 text-destructive" },
    completed:   { label: "Concluída",    class: "bg-success/15 text-success" },
    cancelled:   { label: "Cancelada",    class: "bg-destructive/15 text-destructive" },
  };
  const st = statusLabel[trip.status] ?? statusLabel.scheduled;

  const estDistKm = trip.estimated_distance_m != null ? (Number(trip.estimated_distance_m) / 1000).toFixed(1) : null;
  const estDurMin = trip.estimated_duration_s != null ? Math.round(Number(trip.estimated_duration_s) / 60) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Viagens
        </Link>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${st.class}`}>{st.label}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">{trip.title || `${trip.origin || "—"} → ${trip.destination || "—"}`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Viagem #{String(trip.id).slice(0, 8)}
            {trip.scheduled_start_at && ` · prevista para ${new Date(trip.scheduled_start_at).toLocaleString("pt-BR")}`}
          </p>
        </div>
        <Button asChild className="h-10 shrink-0">
          <Link to={`/trips/${trip.id}/edit` as any}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={UserIcon} label="Motorista" value={trip.driver?.full_name ?? "—"} hint={trip.driver?.phone ?? undefined} />
        <InfoCard icon={Truck} label="Veículo" value={trip.vehicle?.plate ?? "—"} hint={[trip.vehicle?.brand, trip.vehicle?.model].filter(Boolean).join(" ") || undefined} />
        <InfoCard icon={Clock} label="Início real" value={trip.start_at ? new Date(trip.start_at).toLocaleString("pt-BR") : "—"} hint={trip.end_at ? `Fim: ${new Date(trip.end_at).toLocaleString("pt-BR")}` : undefined} />
        <InfoCard icon={Timer} label="Duração" value={metrics.duration > 0 ? formatDuration(metrics.duration) : "—"} hint={estDurMin ? `Estimado: ${estDurMin} min` : undefined} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={RouteIcon} label="Distância (GPS)" value={metrics.hasReal ? `${metrics.distanceKm.toFixed(2)} km` : "—"} hint={estDistKm ? `Estimado: ${estDistKm} km` : (metrics.kmFromOdo != null ? `Hodômetro: ${metrics.kmFromOdo} km` : undefined)} />
        <InfoCard icon={Gauge} label="Velocidade máx." value={metrics.hasReal ? `${metrics.maxSpeed.toFixed(0)} km/h` : "—"} />
        <InfoCard icon={Gauge} label="Velocidade média" value={metrics.hasReal ? `${metrics.avgSpeed.toFixed(0)} km/h` : "—"} />
        <InfoCard icon={MapPin} label="Pontos planejados / GPS" value={`${routePoints?.length ?? 0} / ${gpsPoints?.length ?? 0}`} hint={trip.status === "in_progress" ? "Atualiza a cada 10s" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        {/* Route points list */}
        <div className="surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Rota planejada</h2>
            {estDistKm && estDurMin && (
              <span className="text-xs text-muted-foreground">{estDistKm} km · {estDurMin} min</span>
            )}
          </div>
          {!routePoints || routePoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {trip.origin || trip.destination
                ? "Viagem sem pontos detalhados — apenas origem/destino em texto."
                : "Nenhum ponto cadastrado."}
            </p>
          ) : (
            <ol className="space-y-2">
              {routePoints.map((p, i) => (
                <li key={p.id} className="flex items-start gap-2 rounded-md border border-border bg-background p-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: pointTypeColor[p.point_type] ?? "#6b7280" }}>
                    {p.point_type === "origin" ? "A" : p.point_type === "destination" ? "B" : i}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name ?? pointTypeLabel[p.point_type]}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {pointTypeLabel[p.point_type] ?? p.point_type}
                      {p.is_required && " · obrigatório"}
                      {p.visited_at && ` · visitado ${new Date(p.visited_at).toLocaleTimeString("pt-BR")}`}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {trip.driver_instructions && (
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
              <div className="mb-1 font-semibold text-warning">Instruções ao motorista</div>
              <div>{trip.driver_instructions}</div>
            </div>
          )}
        </div>

        {/* Map with overlays */}
        <div className="surface relative overflow-hidden" style={{ height: "60vh" }}>
          <div ref={containerRef} className="h-full w-full" />
          <div className="glass-bar pointer-events-none absolute right-3 top-3 flex flex-col gap-1 rounded-lg px-3 py-2 text-xs">
            <div className="flex items-center gap-2"><span className="h-0.5 w-5" style={{ background: "#2563eb", borderTop: "1px dashed #2563eb" }} />Planejada</div>
            <div className="flex items-center gap-2"><span className="h-0.5 w-5" style={{ background: "#16a34a" }} />Real (GPS)</div>
          </div>
          {pointsLoading && (
            <div className="glass-bar pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm text-muted-foreground shadow-lg">
              Carregando rota…
            </div>
          )}
          {!pointsLoading && (gpsPoints?.length ?? 0) === 0 && (routePoints?.length ?? 0) === 0 && (
            <div className="glass-bar pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm text-muted-foreground shadow-lg">
              Sem rota planejada e sem GPS
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="summary-value mt-1 truncate">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
