import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle, MapPin, Truck, Search, Crosshair, Layers, Pause, Play, X,
  Gauge, Signal, Clock, ChevronLeft, ChevronRight, ArrowUpRight, Maximize2,
  Activity,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/map")({
  component: LiveMap,
});

/* ============================================================
 * Types
 * ========================================================== */

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
  vehicle_model?: string;
  driver_name?: string;
  driver_phone?: string;
}

const STATUS_META: Record<Status, { label: string; color: string; ring: string }> = {
  moving:      { label: "Em movimento", color: "#16a34a", ring: "#bbf7d0" },
  stopped:     { label: "Parado",       color: "#2563eb", ring: "#bfdbfe" },
  signal_weak: { label: "Sinal fraco",  color: "#f59e0b", ring: "#fde68a" },
  signal_lost: { label: "Sem sinal",    color: "#dc2626", ring: "#fecaca" },
  offline:     { label: "Offline",      color: "#6b7280", ring: "#e5e7eb" },
};

const MAP_STYLES: Record<string, { id: string; label: string }> = {
  light:     { id: "mapbox://styles/mapbox/light-v11",     label: "Claro" },
  streets:   { id: "mapbox://styles/mapbox/streets-v12",   label: "Ruas" },
  satellite: { id: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satélite" },
  dark:      { id: "mapbox://styles/mapbox/dark-v11",      label: "Escuro" },
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

/** Tween a marker from its current lngLat to a new one over `durationMs`. */
function animateMarkerTo(marker: mapboxgl.Marker, to: [number, number], durationMs = 900) {
  const from = marker.getLngLat();
  const start = [from.lng, from.lat] as [number, number];
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

  function step(now: number) {
    const p = Math.min(1, (now - t0) / durationMs);
    const e = ease(p);
    const lng = start[0] + (to[0] - start[0]) * e;
    const lat = start[1] + (to[1] - start[1]) * e;
    marker.setLngLat([lng, lat]);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ============================================================
 * Marker DOM (with heading rotation, status color, plate, pulse)
 * ========================================================== */

function buildMarkerEl(p: LivePoint, status: Status): {
  root: HTMLDivElement;
  arrow: HTMLDivElement;
  pulse: HTMLSpanElement;
  badge: HTMLDivElement;
  body: HTMLDivElement;
} {
  const meta = STATUS_META[status];
  const root = document.createElement("div");
  root.className = "fleet-marker";
  root.style.cssText = `
    position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;
    cursor:pointer;font-family:Inter,sans-serif;will-change:transform;
  `;

  const badge = document.createElement("div");
  badge.className = "fleet-plate";
  badge.style.cssText = `
    background:#fff;color:#111;font-weight:700;font-size:10px;letter-spacing:.4px;
    padding:3px 7px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.08);
    border:1px solid rgba(0,0,0,.05);white-space:nowrap;line-height:1.1;
    display:flex;align-items:center;gap:4px;
  `;
  badge.textContent = p.vehicle_plate ?? "—";
  if (p.speed != null && (p.speed ?? 0) * 3.6 >= 1) {
    const sp = document.createElement("span");
    sp.style.cssText = "color:#6b7280;font-weight:600;";
    sp.textContent = `· ${Math.round((p.speed ?? 0) * 3.6)} km/h`;
    badge.appendChild(sp);
  }

  const body = document.createElement("div");
  body.className = "fleet-body";
  body.style.cssText = `
    position:relative;width:32px;height:32px;border-radius:50%;
    background:${meta.color};border:3px solid #fff;
    box-shadow:0 0 0 3px ${meta.ring},0 6px 14px rgba(0,0,0,.22);
    display:flex;align-items:center;justify-content:center;color:#fff;
    font-size:14px;transition:transform .2s ease, box-shadow .2s ease;
  `;

  const arrow = document.createElement("div");
  arrow.style.cssText = `
    position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;
    pointer-events:none;transition:transform .8s cubic-bezier(.22,1,.36,1);
    transform-origin:50% 50%;
  `;
  arrow.innerHTML = `
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l3 5h-2v6h-2V8H9l3-5z" fill="#fff" opacity=".95"/>
    </svg>
  `;

  const truck = document.createElement("div");
  truck.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;";
  truck.textContent = "🚚";

  const pulse = document.createElement("span");
  pulse.style.cssText = `
    position:absolute;inset:-8px;border-radius:50%;background:${meta.color};
    opacity:${status === "moving" ? 0.55 : 0};animation:fleet-pulse 1.8s ease-out infinite;
    pointer-events:none;
  `;

  body.append(pulse, truck, arrow);
  root.append(body, badge);

  return { root, arrow, pulse, badge, body };
}

/* ============================================================
 * LiveMap component
 * ========================================================== */

interface MarkerEntry {
  marker: mapboxgl.Marker;
  el: ReturnType<typeof buildMarkerEl>;
  popup: mapboxgl.Popup;
  lastLngLat: [number, number];
  trailIds: { source: string; layer: string };
  trail: [number, number][];
}

function LiveMap() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, MarkerEntry>>({});
  const fetchToken = useServerFn(getMapboxToken);

  const [tokenError, setTokenError] = useState(false);
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [now, setNow] = useState(Date.now());
  const [styleKey, setStyleKey] = useState<keyof typeof MAP_STYLES>("light");

  // sidebar / filters
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(false);

  /* ---------- ticking clock so statuses + "last seen" refresh ---------- */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  /* ---------- map init ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token } = await fetchToken();
      if (cancelled) return;
      if (!token) { setTokenError(true); return; }
      mapboxgl.accessToken = token;
      if (!containerRef.current || mapRef.current) return;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLES[styleKey].id,
        center: [-46.6333, -23.5505],
        zoom: 10,
        attributionControl: false,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchToken]);

  /* ---------- switch style ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(MAP_STYLES[styleKey].id);
    // After style swap, sources/layers we added (trails) are wiped — they'll be
    // re-added on next render of points.
    map.once("styledata", () => {
      Object.values(markersRef.current).forEach((m) => { m.trailIds = { source: `trail-src-${m.marker.getElement().id || Math.random()}`, layer: `trail-layer-${m.marker.getElement().id || Math.random()}` }; });
    });
  }, [styleKey]);

  /* ---------- load trips + latest gps ----------
   * Tries 2 queries via the optimized current_vehicle_positions table (1 query)
   * Falls back to the N+1 pattern if the table doesn't exist yet (migration
   * 20260524000000_realtime_tracking.sql not applied).
   */
  useEffect(() => {
    async function loadFast(): Promise<boolean> {
      // 1 SQL query for trips, 1 for positions — no N+1.
      const { data: trips, error: tErr } = await supabase
        .from("trips")
        .select("id, vehicle_id, vehicle:vehicles(plate, model), driver:drivers(full_name, phone)")
        .in("status", ["in_progress", "assigned", "viewed", "scheduled", "paused"] as any);
      if (tErr || !trips) return false;
      if (trips.length === 0) { setPoints([]); return true; }

      const tripIds = trips.map((t: any) => t.id);
      const { data: positions, error: pErr } = await (supabase as any)
        .from("current_vehicle_positions")
        .select("trip_id, lat, lng, speed, heading, accuracy, last_update")
        .in("trip_id", tripIds);
      if (pErr) return false; // table missing → fall back

      const byTrip = new Map<string, any>();
      (positions ?? []).forEach((p: any) => byTrip.set(p.trip_id, p));

      const results: LivePoint[] = [];
      for (const t of trips as any[]) {
        const p = byTrip.get(t.id);
        if (!p) continue;
        results.push({
          trip_id: t.id,
          vehicle_id: t.vehicle_id,
          lat: p.lat,
          lng: p.lng,
          speed: p.speed,
          heading: p.heading,
          accuracy: p.accuracy,
          recorded_at: p.last_update,
          vehicle_plate: t.vehicle?.plate,
          vehicle_model: t.vehicle?.model,
          driver_name: t.driver?.full_name,
          driver_phone: t.driver?.phone,
        });
      }
      setPoints(results);
      return true;
    }

    async function loadFallback() {
      // Legacy path (N+1) for when current_vehicle_positions doesn't exist yet.
      const { data: trips } = await supabase
        .from("trips")
        .select("id, vehicle_id, vehicle:vehicles(plate, model), driver:drivers(full_name, phone)")
        .in("status", ["in_progress", "assigned", "viewed", "scheduled", "paused"] as any);
      if (!trips || trips.length === 0) { setPoints([]); return; }

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
          vehicle_model: t.vehicle?.model,
          driver_name: t.driver?.full_name,
          driver_phone: t.driver?.phone,
        } as LivePoint;
      }));
      setPoints(results.filter(Boolean) as LivePoint[]);
    }

    async function load() {
      const ok = await loadFast();
      if (!ok) await loadFallback();
    }
    load();

    // Real-time: prefer current_vehicle_positions UPDATE events (one per
    // vehicle, fired by the DB trigger) over raw gps_points INSERTs.
    // Falls back to gps_points if the optimized table isn't subscribed.
    function applyRow(row: any) {
      if (!row?.trip_id) return;
      setPoints((prev) => {
        const idx = prev.findIndex((p) => p.trip_id === row.trip_id);
        if (idx === -1) {
          load(); // unknown trip — full reload to fetch plate/driver
          return prev;
        }
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          lat: row.lat,
          lng: row.lng,
          speed: row.speed,
          heading: row.heading,
          accuracy: row.accuracy,
          recorded_at: row.last_update ?? row.recorded_at,
        };
        return next;
      });
    }

    const ch = supabase
      .channel("gps-live-map")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "current_vehicle_positions" }, (p) => applyRow(p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "current_vehicle_positions" }, (p) => applyRow(p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gps_points" }, (p) => applyRow(p.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trips" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ---------- enriched points (with status) ---------- */
  const enriched = useMemo(
    () => points.map((p) => ({ ...p, status: deriveStatus(p, now) })),
    [points, now],
  );

  /* ---------- filtered for sidebar ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.vehicle_plate ?? "").toLowerCase().includes(q) ||
        (p.driver_name ?? "").toLowerCase().includes(q) ||
        (p.vehicle_model ?? "").toLowerCase().includes(q)
      );
    });
  }, [enriched, search, statusFilter]);

  /* ---------- update markers (animated, with trail and heading) ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    enriched.forEach((p) => {
      seen.add(p.trip_id);
      const next: [number, number] = [p.lng, p.lat];
      const meta = STATUS_META[p.status];
      const existing = markersRef.current[p.trip_id];

      if (existing) {
        // Animate movement
        animateMarkerTo(existing.marker, next, 900);
        // Update status visuals
        existing.el.body.style.background = meta.color;
        existing.el.body.style.boxShadow = `0 0 0 4px ${meta.ring},0 6px 16px rgba(0,0,0,.28)`;
        existing.el.pulse.style.background = meta.color;
        existing.el.pulse.style.opacity = p.status === "moving" ? "0.55" : "0";
        // Update plate/speed badge
        const speedKmh = p.speed != null ? Math.round((p.speed ?? 0) * 3.6) : null;
        existing.el.badge.innerHTML = "";
        existing.el.badge.appendChild(document.createTextNode(p.vehicle_plate ?? "—"));
        if (speedKmh != null && speedKmh >= 1) {
          const sp = document.createElement("span");
          sp.style.cssText = "color:#6b7280;font-weight:600;margin-left:4px;";
          sp.textContent = `· ${speedKmh} km/h`;
          existing.el.badge.appendChild(sp);
        }
        // Rotate arrow to heading
        if (p.heading != null) {
          existing.el.arrow.style.transform = `rotate(${p.heading}deg)`;
        }
        // Update popup html
        existing.popup.setHTML(renderPopupHtml(p, p.status, now));
        // Append to trail (keep last 60 points, drop if duplicate)
        const lastTrail = existing.trail.at(-1);
        if (!lastTrail || lastTrail[0] !== next[0] || lastTrail[1] !== next[1]) {
          existing.trail.push(next);
          if (existing.trail.length > 60) existing.trail.splice(0, existing.trail.length - 60);
          updateTrail(map, existing);
        }
        existing.lastLngLat = next;
      } else {
        // Create new marker
        const el = buildMarkerEl(p, p.status);
        if (p.heading != null) el.arrow.style.transform = `rotate(${p.heading}deg)`;
        const popup = new mapboxgl.Popup({ offset: 38, closeButton: true, maxWidth: "260px" })
          .setHTML(renderPopupHtml(p, p.status, now));
        const marker = new mapboxgl.Marker({ element: el.root, anchor: "bottom" })
          .setLngLat(next)
          .setPopup(popup)
          .addTo(map);

        // wire popup "Ver detalhes" → trip detail
        popup.on("open", () => {
          setTimeout(() => {
            const btn = document.querySelector(`button[data-trip="${p.trip_id}"]`);
            btn?.addEventListener("click", () => navigate({ to: `/trips/${p.trip_id}` }));
          }, 0);
        });

        // Click on marker → select in sidebar
        el.root.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setSelectedTripId(p.trip_id);
        });

        const entry: MarkerEntry = {
          marker,
          el,
          popup,
          lastLngLat: next,
          trailIds: {
            source: `trail-src-${p.trip_id}`,
            layer: `trail-layer-${p.trip_id}`,
          },
          trail: [next],
        };
        markersRef.current[p.trip_id] = entry;
        // Load the last N gps points for an initial trail
        seedTrail(p.trip_id, entry, map);
      }
    });

    // Remove markers that are no longer present
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        const m = markersRef.current[id];
        m.marker.remove();
        if (map.getLayer(m.trailIds.layer)) map.removeLayer(m.trailIds.layer);
        if (map.getSource(m.trailIds.source)) map.removeSource(m.trailIds.source);
        delete markersRef.current[id];
      }
    });

    // Auto-fit only on first load or when nothing selected
    if (enriched.length && !selectedTripId) {
      const bounds = new mapboxgl.LngLatBounds();
      enriched.forEach((p) => bounds.extend([p.lng, p.lat]));
      // Only fit when no marker is currently focused
      if (enriched.length === 1) {
        map.easeTo({ center: [enriched[0].lng, enriched[0].lat], zoom: Math.max(map.getZoom(), 13), duration: 800 });
      } else {
        try { map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 }); } catch { /* ignore */ }
      }
    }
  }, [enriched, navigate, now, selectedTripId]);

  /* ---------- follow selected vehicle ---------- */
  useEffect(() => {
    const map = mapRef.current;
    // Toggle is-selected class on all markers to reveal/hide plate badge + scale up the body.
    Object.entries(markersRef.current).forEach(([id, entry]) => {
      const root = entry.marker.getElement();
      if (id === selectedTripId) root.classList.add("is-selected");
      else root.classList.remove("is-selected");
    });
    if (!map || !selectedTripId) return;
    const entry = markersRef.current[selectedTripId];
    const point = enriched.find((p) => p.trip_id === selectedTripId);
    if (!entry || !point) return;
    if (autoFollow) {
      map.easeTo({ center: [point.lng, point.lat], duration: 800, zoom: Math.max(map.getZoom(), 14) });
    }
  }, [selectedTripId, enriched, autoFollow]);

  function focusVehicle(tripId: string) {
    const map = mapRef.current;
    const entry = markersRef.current[tripId];
    const point = enriched.find((p) => p.trip_id === tripId);
    if (!map || !entry || !point) return;
    setSelectedTripId(tripId);
    map.flyTo({ center: [point.lng, point.lat], zoom: 15, duration: 900, essential: true });
    entry.popup.addTo(map);
  }

  function clearSelection() {
    setSelectedTripId(null);
    setAutoFollow(false);
    Object.values(markersRef.current).forEach((m) => m.popup.remove());
  }

  /** Fit camera to all currently visible vehicles. */
  function fitAll() {
    const map = mapRef.current;
    if (!map) return;
    const pts = filtered.length > 0 ? filtered : enriched;
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: 14, duration: 700 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: { top: 80, right: 80, bottom: 120, left: 80 }, maxZoom: 14, duration: 700 });
  }

  /* ---------- counts for legend ---------- */
  const counts = useMemo(() => {
    const c: Record<Status, number> = { moving: 0, stopped: 0, signal_weak: 0, signal_lost: 0, offline: 0 };
    enriched.forEach((p) => { c[p.status]++; });
    return c;
  }, [enriched]);

  const selectedPoint = selectedTripId
    ? enriched.find((p) => p.trip_id === selectedTripId) ?? null
    : null;

  /* ---------- render ---------- */
  return (
    <div className="space-y-4">
      <style>{`
        @keyframes fleet-pulse {
          0% { transform: scale(1); opacity: .5 }
          100% { transform: scale(2.6); opacity: 0 }
        }
        /* Plate badge only visible on hover or when marker is selected */
        .fleet-marker .fleet-plate {
          opacity: 0;
          transform: translateY(-2px) scale(0.94);
          transition: opacity .15s ease, transform .15s ease;
          pointer-events: none;
          order: -1;
        }
        .fleet-marker:hover .fleet-plate,
        .fleet-marker.is-selected .fleet-plate {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .fleet-marker:hover .fleet-body,
        .fleet-marker.is-selected .fleet-body {
          transform: scale(1.08);
        }
      `}</style>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Mapa ao vivo</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            Posições em tempo real
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-success" />
                <span className="absolute inset-0 rounded-full bg-success/60 animate-ping" />
              </span>
              ao vivo
            </span>
          </p>
        </div>
      </header>

      {/* Hero stats strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Total ativos"
          value={enriched.length}
          icon={Truck}
          accent="primary"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <StatTile
            key={s}
            label={STATUS_META[s].label}
            value={counts[s]}
            color={STATUS_META[s].color}
            ring={STATUS_META[s].ring}
            active={statusFilter === s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
          />
        ))}
      </div>

      {tokenError ? (
        <div className="surface flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">Token do Mapbox não configurado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina <code className="rounded bg-muted px-1.5 py-0.5 text-xs">MAPBOX_PUBLIC_TOKEN</code> em <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code> e reinicie o servidor.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          {/* Map */}
          <div
            className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.06)]"
            style={{ height: "min(78vh,780px)" }}
          >
            <div ref={containerRef} className="h-full w-full" />

            {/* Empty overlay */}
            {enriched.length === 0 && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-[0_8px_24px_-6px_rgba(0,0,0,.25)] ring-1 ring-border">
                  <Activity className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="glass-bar rounded-full px-4 py-2 text-sm text-foreground/80 shadow-lg">
                  <MapPin className="mr-1.5 inline h-4 w-4" />
                  Nenhum veículo em viagem agora
                </div>
              </div>
            )}

            {/* Top-left: style picker (compact dropdown) */}
            <div className="absolute left-3 top-3 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="glass-bar inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium text-foreground/90 shadow-md hover:bg-card"
                    aria-label="Estilo do mapa"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {MAP_STYLES[styleKey].label}
                    <ChevronDownSmall />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Estilo</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={styleKey} onValueChange={(v) => setStyleKey(v as keyof typeof MAP_STYLES)}>
                    {(Object.keys(MAP_STYLES) as (keyof typeof MAP_STYLES)[]).map((k) => (
                      <DropdownMenuRadioItem key={k} value={k}>{MAP_STYLES[k].label}</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Top-right: action stack — fit all + sidebar toggle (mobile) */}
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
              <button
                onClick={fitAll}
                disabled={enriched.length === 0}
                className="glass-bar inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground/90 shadow-md transition-colors hover:bg-card disabled:opacity-40"
                aria-label="Recentralizar todos os veículos"
                title="Recentralizar todos"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="glass-bar inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground/90 shadow-md transition-colors hover:bg-card lg:hidden"
                aria-label={sidebarOpen ? "Ocultar lista" : "Mostrar lista"}
                title={sidebarOpen ? "Ocultar lista" : "Mostrar lista"}
              >
                {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Bottom-left: compact legend (only the statuses that have a count > 0) */}
            {enriched.length > 0 && (
              <div className="glass-bar absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] shadow-md">
                {(Object.keys(STATUS_META) as Status[])
                  .filter((s) => counts[s] > 0)
                  .map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 px-1.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                      <span className="font-medium text-foreground/85">{STATUS_META[s].label}</span>
                      <span className="text-muted-foreground tabular-nums">· {counts[s]}</span>
                    </span>
                  ))}
              </div>
            )}

            {/* Selected vehicle floating card */}
            {selectedPoint && (
              <div className="absolute bottom-3 left-3 right-3 z-10 sm:right-auto sm:max-w-sm">
                <SelectedCard
                  point={selectedPoint}
                  status={selectedPoint.status}
                  now={now}
                  autoFollow={autoFollow}
                  onToggleFollow={() => setAutoFollow((v) => !v)}
                  onClose={clearSelection}
                  onDetails={() => navigate({ to: `/trips/${selectedPoint.trip_id}` })}
                />
              </div>
            )}

          </div>

          {/* Sidebar */}
          <aside className={cn(
            "surface flex flex-col overflow-hidden p-0",
            !sidebarOpen && "hidden lg:flex",
          )} style={{ maxHeight: "min(72vh,720px)" }}>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa, motorista…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {(Object.keys(STATUS_META) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {filtered.length} / {enriched.length}
                </span>
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nada encontrado.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((p) => (
                    <li key={p.trip_id}>
                      <button
                        onClick={() => focusVehicle(p.trip_id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent active:bg-accent",
                          selectedTripId === p.trip_id && "bg-primary/5",
                        )}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: STATUS_META[p.status].color, boxShadow: `0 0 0 3px ${STATUS_META[p.status].ring}` }}
                        >
                          <Truck className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{p.vehicle_plate ?? "—"}</span>
                            {p.speed != null && (p.speed ?? 0) * 3.6 >= 1 && (
                              <span className="shrink-0 text-[10px] font-medium text-muted-foreground tabular-nums">
                                {Math.round((p.speed ?? 0) * 3.6)} km/h
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">{p.driver_name ?? "—"}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{relativeTime(p.recorded_at, now)}</p>
                        </div>
                        {selectedTripId === p.trip_id && <Crosshair className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Helpers
 * ========================================================== */

function renderPopupHtml(p: LivePoint, status: Status, now: number) {
  const meta = STATUS_META[status];
  const speed = p.speed != null ? Math.round((p.speed ?? 0) * 3.6) : null;
  return `
    <div style="font-family:Inter,sans-serif;min-width:200px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="display:inline-flex;height:8px;width:8px;border-radius:50%;background:${meta.color};box-shadow:0 0 0 3px ${meta.ring}"></span>
        <strong style="font-size:14px">${p.vehicle_plate ?? "—"}</strong>
        <span style="font-size:11px;color:#6b7280;margin-left:auto">${meta.label}</span>
      </div>
      <div style="font-size:12px;color:#374151;margin-bottom:6px">
        ${p.driver_name ?? "—"}
        ${p.driver_phone ? `<a href="tel:${p.driver_phone}" style="margin-left:6px;color:#16a34a;text-decoration:none;font-weight:600">📞 ${p.driver_phone}</a>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px">
        <div><span style="color:#6b7280">Velocidade</span><br/><b>${speed != null ? speed + " km/h" : "—"}</b></div>
        <div><span style="color:#6b7280">Precisão</span><br/><b>${p.accuracy != null ? Math.round(Number(p.accuracy)) + " m" : "—"}</b></div>
        <div><span style="color:#6b7280">Direção</span><br/><b>${p.heading != null ? Math.round(p.heading) + "°" : "—"}</b></div>
        <div><span style="color:#6b7280">Última</span><br/><b>${relativeTime(p.recorded_at, now)}</b></div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280">
        ${new Date(p.recorded_at).toLocaleTimeString("pt-BR")}
      </div>
      <button data-trip="${p.trip_id}" style="margin-top:8px;width:100%;padding:8px 10px;border-radius:6px;background:oklch(0.32 0.08 160);color:#fff;border:0;font-size:12px;cursor:pointer;font-weight:600">
        Ver detalhes da viagem
      </button>
    </div>`;
}

/** Render or update the trail polyline for a single vehicle. */
function updateTrail(map: mapboxgl.Map, entry: MarkerEntry) {
  if (entry.trail.length < 2) return;
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: entry.trail },
  };
  const src = map.getSource(entry.trailIds.source) as mapboxgl.GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
  } else {
    map.addSource(entry.trailIds.source, { type: "geojson", data });
    map.addLayer({
      id: entry.trailIds.layer,
      type: "line",
      source: entry.trailIds.source,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#16a34a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 16, 5],
        "line-opacity": 0.55,
        "line-blur": 0.2,
      },
    });
  }
}

/** Load up to 60 recent gps points from the DB so the trail isn't empty on first paint. */
async function seedTrail(tripId: string, entry: MarkerEntry, map: mapboxgl.Map) {
  const { data } = await supabase
    .from("gps_points")
    .select("lat,lng,recorded_at")
    .eq("trip_id", tripId)
    .order("recorded_at", { ascending: false })
    .limit(60);
  if (!data?.length) return;
  const points = data.reverse().map((p) => [p.lng, p.lat] as [number, number]);
  entry.trail = points;
  updateTrail(map, entry);
}

/* ============================================================
 * Floating selected-vehicle card
 * ========================================================== */

function SelectedCard({
  point, status, now, autoFollow, onToggleFollow, onClose, onDetails,
}: {
  point: LivePoint;
  status: Status;
  now: number;
  autoFollow: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  onDetails: () => void;
}) {
  const meta = STATUS_META[status];
  const speed = point.speed != null ? Math.round((point.speed ?? 0) * 3.6) : null;
  return (
    <div className="surface relative overflow-hidden p-4 shadow-[var(--shadow-pop)]">
      <button
        onClick={onClose}
        className="tap absolute right-2 top-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: meta.color, boxShadow: `0 0 0 4px ${meta.ring}` }}
        >
          <Truck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-xl leading-none">{point.vehicle_plate ?? "—"}</p>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: meta.ring, color: meta.color }}>
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {point.driver_name ?? "—"}{point.vehicle_model ? ` · ${point.vehicle_model}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center text-[11px]">
        <Stat icon={Gauge} label="Vel." value={speed != null ? `${speed} km/h` : "—"} />
        <Stat icon={Signal} label="Precisão" value={point.accuracy != null ? `±${Math.round(point.accuracy)}m` : "—"} />
        <Stat icon={Clock} label="Atualizado" value={relativeTime(point.recorded_at, now)} />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onToggleFollow}
          className={cn(
            "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs font-medium",
            autoFollow ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
          )}
        >
          {autoFollow ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {autoFollow ? "Seguindo" : "Seguir veículo"}
        </button>
        <button
          onClick={onDetails}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-foreground text-xs font-medium text-background hover:opacity-90"
        >
          Detalhes <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** Hero stat tile for the top strip. */
function StatTile({
  label, value, icon: Icon, color, ring, accent, active, onClick,
}: {
  label: string;
  value: number;
  icon?: any;
  color?: string;
  ring?: string;
  accent?: "primary";
  active?: boolean;
  onClick?: () => void;
}) {
  const isPrimary = accent === "primary";
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border bg-card px-3 py-2.5 text-left transition-all",
        active
          ? "border-primary/40 bg-primary/[0.04] shadow-[0_4px_14px_-6px_rgba(22,163,74,.25)]"
          : "border-border hover:border-foreground/15 hover:bg-accent/40",
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-inner"
        style={{
          background: isPrimary ? "var(--color-primary)" : color ?? "var(--color-muted-foreground)",
          boxShadow: ring ? `inset 0 0 0 2px ${ring}` : undefined,
        }}
      >
        {Icon ? <Icon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-white/85" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="font-display text-2xl leading-none tracking-tight tabular-nums">{value}</p>
      </div>
    </button>
  );
}

function ChevronDownSmall() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-current opacity-60">
      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// silence unused
void [Layers];
