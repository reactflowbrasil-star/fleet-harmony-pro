import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  component: LiveMap,
});

interface LatestPoint {
  trip_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
  vehicle_plate?: string;
  driver_name?: string;
}

function LiveMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const fetchToken = useServerFn(getMapboxToken);
  const [tokenError, setTokenError] = useState(false);
  const [points, setPoints] = useState<LatestPoint[]>([]);

  // init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token } = await fetchToken();
      if (cancelled) return;
      if (!token) { setTokenError(true); return; }
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

  // load active trips + latest gps
  useEffect(() => {
    async function load() {
      const { data: trips } = await supabase
        .from("trips")
        .select("id, vehicle:vehicles(plate), driver:drivers(full_name)")
        .eq("status", "in_progress");
      if (!trips) return;
      const result: LatestPoint[] = [];
      for (const t of trips) {
        const { data: p } = await supabase
          .from("gps_points")
          .select("lat, lng, recorded_at")
          .eq("trip_id", t.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (p) result.push({
          trip_id: t.id,
          lat: p.lat,
          lng: p.lng,
          recorded_at: p.recorded_at,
          vehicle_plate: (t as any).vehicle?.plate,
          driver_name: (t as any).driver?.full_name,
        });
      }
      setPoints(result);
    }
    load();

    const ch = supabase
      .channel("gps-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gps_points" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    points.forEach((p) => {
      seen.add(p.trip_id);
      const lngLat: [number, number] = [p.lng, p.lat];
      const existing = markersRef.current[p.trip_id];
      if (existing) {
        existing.setLngLat(lngLat);
      } else {
        const el = document.createElement("div");
        el.className = "fleet-marker";
        el.style.cssText = "width:32px;height:32px;border-radius:50%;background:oklch(0.32 0.08 160);border:3px solid oklch(0.78 0.13 85);box-shadow:0 4px 12px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;";
        el.textContent = "🚚";
        const m = new mapboxgl.Marker(el)
          .setLngLat(lngLat)
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${p.vehicle_plate ?? ""}</strong><br/>${p.driver_name ?? ""}<br/><small>${new Date(p.recorded_at).toLocaleTimeString("pt-BR")}</small>`))
          .addTo(map);
        markersRef.current[p.trip_id] = m;
      }
    });
    // remove stale
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) { markersRef.current[id].remove(); delete markersRef.current[id]; }
    });
    if (points.length) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 500 });
    }
  }, [points]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl">Mapa ao vivo</h1>
          <p className="text-sm text-muted-foreground">{points.length} veículo{points.length === 1 ? "" : "s"} em rota</p>
        </div>
      </div>

      {tokenError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 text-sm">Token do Mapbox não configurado.</p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]" style={{ height: "70vh" }}>
          <div ref={containerRef} className="h-full w-full" />
          {points.length === 0 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card/95 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur">
              <MapPin className="mr-2 inline h-4 w-4" />
              Nenhuma viagem em andamento
            </div>
          )}
        </div>
      )}
    </div>
  );
}
