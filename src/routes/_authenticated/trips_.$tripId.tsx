import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle, ArrowLeft, Clock, Gauge, MapPin, Route as RouteIcon,
  Timer, Truck, User as UserIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

function TripDetailPage() {
  const { tripId } = Route.useParams();
  const fetchToken = useServerFn(getMapboxToken);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const tokenRef = useRef<string | null>(null);

  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, vehicle:vehicles(plate, model, brand), driver:drivers(full_name, phone)")
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: points, isLoading: pointsLoading } = useQuery({
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
    refetchInterval: (q) => ((q.state.data as any)?.length && trip?.status === "in_progress" ? 10_000 : false),
  });

  // metrics
  const metrics = useMemo(() => {
    if (!points || points.length === 0) return null;
    let dist = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedSamples = 0;
    for (let i = 1; i < points.length; i++) dist += haversine(points[i - 1], points[i]);
    for (const p of points) {
      const v = Number(p.speed ?? 0) * 3.6;
      if (v > maxSpeed) maxSpeed = v;
      if (v > 1) { speedSum += v; speedSamples++; }
    }
    const start = trip?.start_at ? new Date(trip.start_at) : new Date(points[0].recorded_at);
    const end = trip?.end_at ? new Date(trip.end_at) : new Date(points[points.length - 1].recorded_at);
    return {
      distanceKm: dist / 1000,
      maxSpeed,
      avgSpeed: speedSamples > 0 ? speedSum / speedSamples : 0,
      duration: end.getTime() - start.getTime(),
      start, end,
      kmFromOdo: (trip?.start_km != null && trip?.end_km != null) ? Math.max(0, Number(trip.end_km) - Number(trip.start_km)) : null,
    };
  }, [points, trip]);

  // init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token } = await fetchToken();
      if (cancelled) return;
      if (!token) return;
      tokenRef.current = token;
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

  // draw route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !points || points.length === 0) return;

    const coordinates = points.map((p) => [p.lng, p.lat] as [number, number]);

    function applyLayer() {
      if (!map) return;
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates },
      };
      const src = map.getSource("trip-route") as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data as any);
      } else {
        map.addSource("trip-route", { type: "geojson", data: data as any });
        map.addLayer({
          id: "trip-route-line",
          type: "line",
          source: "trip-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#16a34a", "line-width": 4, "line-opacity": 0.85 },
        });
      }
      // start/end markers
      const start = coordinates[0];
      const end = coordinates[coordinates.length - 1];
      // Remove any existing markers we added by id-trick: we re-render each effect; cleanup via custom store
      (map as any).__tripMarkers?.forEach((m: mapboxgl.Marker) => m.remove());
      const mk = (lng: number, lat: number, color: string, label: string) => {
        const el = document.createElement("div");
        el.style.cssText = `display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
        el.textContent = label;
        return new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
      };
      (map as any).__tripMarkers = [
        mk(start[0], start[1], "#16a34a", "A"),
        mk(end[0], end[1], "#dc2626", "B"),
      ];

      const bounds = coordinates.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    }

    if (map.isStyleLoaded()) applyLayer();
    else map.once("load", applyLayer);
  }, [points]);

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
    in_progress: { label: "Em andamento", class: "bg-primary/15 text-primary" },
    completed:   { label: "Concluída",    class: "bg-success/15 text-success" },
    cancelled:   { label: "Cancelada",    class: "bg-destructive/15 text-destructive" },
  };
  const st = statusLabel[trip.status] ?? statusLabel.scheduled;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Viagens
        </Link>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${st.class}`}>{st.label}</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{trip.origin || "—"} → {trip.destination || "—"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Viagem #{String(trip.id).slice(0, 8)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={UserIcon} label="Motorista" value={trip.driver?.full_name ?? "—"} hint={trip.driver?.phone ?? undefined} />
        <InfoCard icon={Truck} label="Veículo" value={trip.vehicle?.plate ?? "—"} hint={[trip.vehicle?.brand, trip.vehicle?.model].filter(Boolean).join(" ") || undefined} />
        <InfoCard icon={Clock} label="Início" value={trip.start_at ? new Date(trip.start_at).toLocaleString("pt-BR") : "—"} hint={trip.end_at ? `Fim: ${new Date(trip.end_at).toLocaleString("pt-BR")}` : undefined} />
        <InfoCard icon={Timer} label="Duração" value={metrics ? formatDuration(metrics.duration) : "—"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={RouteIcon} label="Distância (GPS)" value={metrics ? `${metrics.distanceKm.toFixed(2)} km` : "—"} hint={metrics?.kmFromOdo != null ? `Hodômetro: ${metrics.kmFromOdo.toLocaleString("pt-BR")} km` : undefined} />
        <InfoCard icon={Gauge} label="Velocidade máx." value={metrics ? `${metrics.maxSpeed.toFixed(0)} km/h` : "—"} />
        <InfoCard icon={Gauge} label="Velocidade média" value={metrics ? `${metrics.avgSpeed.toFixed(0)} km/h` : "—"} />
        <InfoCard icon={MapPin} label="Pontos GPS" value={`${points?.length ?? 0}`} hint={trip.status === "in_progress" ? "Atualiza a cada 10s" : undefined} />
      </div>

      <div className="surface relative overflow-hidden" style={{ height: "60vh" }}>
        <div ref={containerRef} className="h-full w-full" />
        {pointsLoading && (
          <div className="glass-bar pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm text-muted-foreground shadow-lg">
            Carregando rota…
          </div>
        )}
        {!pointsLoading && points && points.length === 0 && (
          <div className="glass-bar pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-sm text-muted-foreground shadow-lg">
            Sem pontos GPS para esta viagem
          </div>
        )}
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
