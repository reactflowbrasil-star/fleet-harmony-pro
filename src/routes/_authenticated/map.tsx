import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, MapPin, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  component: LiveMap,
});

type Status = "moving" | "stopped" | "signal_weak" | "signal_lost" | "offline";

interface LivePoint {
  trip_id: string;
  vehicle_id?: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
  vehicle_plate?: string;
  driver_name?: string;
}

const STATUS_META: Record<Status, { label: string; color: string; ring: string }> = {
  moving:      { label: "Em movimento", color: "#16a34a", ring: "#bbf7d0" },
  stopped:     { label: "Parado",       color: "#2563eb", ring: "#bfdbfe" },
  signal_weak: { label: "Sinal fraco",  color: "#f59e0b", ring: "#fde68a" },
  signal_lost: { label: "Sem sinal",    color: "#dc2626", ring: "#fecaca" },
  offline:     { label: "Offline",      color: "#6b7280", ring: "#e5e7eb" },
};

function deriveStatus(p: LivePoint, now: number): Status {
  const ageMs = now - new Date(p.recorded_at).getTime();
  if (ageMs > 5 * 60_000) return "offline";
  if (ageMs > 60_000)     return "signal_lost";
  if (p.accuracy != null && p.accuracy > 50) return "signal_weak";
  if ((p.speed ?? 0) * 3.6 < 5) return "stopped";
  return "moving";
}

function relativeTime(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)}min`;
  return `há ${Math.round(s / 3600)}h`;
}

function LiveMap() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, { marker: mapboxgl.Marker; el: HTMLDivElement; pulse: HTMLSpanElement }>>({});
  const popupsRef = useRef<Record<string, mapboxgl.Popup>>({});
  const fetchToken = useServerFn(getMapboxToken);
  const [tokenError, setTokenError] = useState(false);
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [now, setNow] = useState(Date.now());

  // tick clock so statuses update without new data
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

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
      mapRef.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [fetchToken]);

  // load active trips + latest gps for each
  useEffect(() => {
    async function load() {
      const { data: trips } = await supabase
        .from("trips")
        .select("id, vehicle_id, vehicle:vehicles(plate), driver:drivers(full_name)")
        .eq("status", "in_progress");
      if (!trips || trips.length === 0) { setPoints([]); return; }

      // batch latest point per trip
      const results = await Promise.all(trips.map(async (t: any) => {
        const { data: p } = await supabase
          .from("gps_points")
          .select("lat, lng, speed, heading, accuracy, recorded_at")
          .eq("trip_id", t.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!p) return null;
        return {
          trip_id: t.id,
          vehicle_id: t.vehicle_id,
          lat: p.lat,
          lng: p.lng,
          speed: p.speed,
          heading: p.heading,
          accuracy: p.accuracy,
          recorded_at: p.recorded_at,
          vehicle_plate: t.vehicle?.plate,
          driver_name: t.driver?.full_name,
        } as LivePoint;
      }));
      setPoints(results.filter(Boolean) as LivePoint[]);
    }
    load();

    const ch = supabase
      .channel("gps-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gps_points" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // update markers when points or clock changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    points.forEach((p) => {
      seen.add(p.trip_id);
      const lngLat: [number, number] = [p.lng, p.lat];
      const st = deriveStatus(p, now);
      const meta = STATUS_META[st];
      const popupHtml = `
        <div style="font-family:Inter,sans-serif;min-width:200px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="display:inline-flex;height:8px;width:8px;border-radius:50%;background:${meta.color};box-shadow:0 0 0 3px ${meta.ring}"></span>
            <strong style="font-size:14px">${p.vehicle_plate ?? "—"}</strong>
            <span style="font-size:11px;color:#6b7280;margin-left:auto">${meta.label}</span>
          </div>
          <div style="font-size:12px;color:#374151">${p.driver_name ?? "—"}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:8px;font-size:12px">
            <div><span style="color:#6b7280">Velocidade</span><br/><b>${p.speed != null ? Math.round(Number(p.speed) * 3.6) + " km/h" : "—"}</b></div>
            <div><span style="color:#6b7280">Precisão</span><br/><b>${p.accuracy != null ? Math.round(Number(p.accuracy)) + " m" : "—"}</b></div>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280">
            ${relativeTime(p.recorded_at, now)} · ${new Date(p.recorded_at).toLocaleTimeString("pt-BR")}
          </div>
          <button data-trip="${p.trip_id}" style="margin-top:8px;width:100%;padding:6px 8px;border-radius:6px;background:oklch(0.32 0.08 160);color:#fff;border:0;font-size:12px;cursor:pointer">Ver detalhes da viagem</button>
        </div>`;

      const existing = markersRef.current[p.trip_id];
      if (existing) {
        existing.marker.setLngLat(lngLat);
        // update color/ring for current status
        existing.el.style.background = meta.color;
        existing.el.style.boxShadow = `0 0 0 4px ${meta.ring}, 0 4px 12px rgba(0,0,0,.3)`;
        existing.pulse.style.background = meta.color;
        existing.pulse.style.opacity = st === "moving" ? "0.6" : "0";
        // update popup html
        const pop = popupsRef.current[p.trip_id];
        if (pop) pop.setHTML(popupHtml);
      } else {
        const el = document.createElement("div");
        el.style.cssText = `
          position:relative;width:28px;height:28px;border-radius:50%;
          background:${meta.color};border:2px solid #fff;
          box-shadow:0 0 0 4px ${meta.ring}, 0 4px 12px rgba(0,0,0,.3);
          display:flex;align-items:center;justify-content:center;color:#fff;
          font-size:13px;cursor:pointer;
        `;
        el.textContent = "🚚";
        const pulse = document.createElement("span");
        pulse.style.cssText = `
          position:absolute;inset:-6px;border-radius:50%;background:${meta.color};
          opacity:${st === "moving" ? 0.6 : 0};animation:fleet-pulse 1.6s ease-out infinite;pointer-events:none;
        `;
        el.appendChild(pulse);

        const popup = new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml);
        const m = new mapboxgl.Marker(el).setLngLat(lngLat).setPopup(popup).addTo(map);
        popup.on("open", () => {
          // wire up "Ver detalhes" button after popup is in DOM
          setTimeout(() => {
            const btn = document.querySelector(`button[data-trip="${p.trip_id}"]`);
            btn?.addEventListener("click", () => navigate({ to: `/trips/${p.trip_id}` }));
          }, 0);
        });
        markersRef.current[p.trip_id] = { marker: m, el, pulse };
        popupsRef.current[p.trip_id] = popup;
      }
    });

    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
        delete popupsRef.current[id];
      }
    });

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 14, duration: 800 });
    } else if (points.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
    }
  }, [points, now, navigate]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { moving: 0, stopped: 0, signal_weak: 0, signal_lost: 0, offline: 0 };
    points.forEach((p) => { c[deriveStatus(p, now)]++; });
    return c;
  }, [points, now]);

  return (
    <div className="space-y-4">
      <style>{`@keyframes fleet-pulse { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(2.4); opacity: 0 } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Mapa ao vivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {points.length} veículo{points.length === 1 ? "" : "s"} em rota
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color }} />
              <span className="font-medium">{STATUS_META[s].label}</span>
              <span className="text-muted-foreground">· {counts[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {tokenError ? (
        <div className="surface p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 text-sm">Token do Mapbox não configurado.</p>
        </div>
      ) : (
        <div className="surface relative overflow-hidden" style={{ height: "72vh" }}>
          <div ref={containerRef} className="h-full w-full" />
          {points.length === 0 && (
            <div className="glass-bar pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground shadow-lg">
              <MapPin className="h-4 w-4" /> Nenhuma viagem em andamento
            </div>
          )}
          <div className="glass-bar pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground/70">
            <Truck className="h-3 w-3" /> Atualização automática
          </div>
        </div>
      )}
    </div>
  );
}
