import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useServerFn } from "@tanstack/react-start";
import { getDirections, getMapboxToken, type RouteStep } from "@/lib/mapbox.functions";
import { ArrowUp, Navigation, Volume2, VolumeX } from "lucide-react";

interface GuidedTripMapProps {
  /** Planned route waypoints (origin, stops, destination) in order. */
  waypoints: Array<{ lat: number; lng: number; name?: string; type?: string }>;
  /** Current GPS position. Update this frequently (every few seconds). */
  position: { lat: number; lng: number; heading?: number | null; speed?: number | null } | null;
  height?: number | string;
}

/** Distance (m) between two lat/lng points via Haversine. */
function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDist(m: number) {
  if (m < 50) return "Agora";
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

const MODIFIER_ROTATION: Record<string, number> = {
  straight: 0,
  "slight right": 30,
  right: 90,
  "sharp right": 135,
  uturn: 180,
  "sharp left": -135,
  left: -90,
  "slight left": -30,
};

function ManeuverArrow({ modifier, type }: { modifier?: string | null; type?: string }) {
  const rot = MODIFIER_ROTATION[modifier ?? "straight"] ?? 0;
  if (type === "arrive") {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/20 text-success">
        <Navigation className="h-6 w-6" />
      </div>
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
      <ArrowUp className="h-7 w-7" style={{ transform: `rotate(${rot}deg)` }} />
    </div>
  );
}

/** Pick the step whose maneuver is closest ahead of the current position. */
function pickCurrentStep(steps: RouteStep[], pos: { lat: number; lng: number }) {
  if (steps.length === 0) return { idx: -1, distanceToManeuver: 0 };
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const m = s.maneuver_location;
    const d = distM(pos, { lat: m[1], lng: m[0] });
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, distanceToManeuver: bestDist };
}

/** Speak text via Web Speech API (best-effort, silent if unsupported). */
function speak(text: string, lang = "pt-BR") {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.05;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export function GuidedTripMap({ waypoints, position, height = 320 }: GuidedTripMapProps) {
  const fetchToken = useServerFn(getMapboxToken);
  const doDirections = useServerFn(getDirections);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);

  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("fg-nav-muted") === "1";
  });
  const lastSpokenStepRef = useRef<number>(-1);
  const lastSpokenWarnRef = useRef<number>(-1);

  // ---- init map ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { token } = await fetchToken();
      if (cancelled || !token) return;
      mapboxgl.accessToken = token;
      if (!containerRef.current || mapRef.current) return;
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/navigation-day-v1",
        center: position ? [position.lng, position.lat] : [-46.6333, -23.5505],
        zoom: position ? 16 : 12,
        pitch: 45,
        bearing: 0,
        attributionControl: false,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [fetchToken]);

  // ---- draw planned route + waypoint markers when waypoints change ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || waypoints.length < 2) return;
    let cancelled = false;
    (async () => {
      const coords = waypoints.map((w) => [w.lng, w.lat] as [number, number]);
      const res = await doDirections({ data: { coordinates: coords, withSteps: true } });
      if (cancelled || !mapRef.current) return;
      const m = mapRef.current;
      setSteps(res.steps);

      const geometry = res.geometry ?? { type: "LineString" as const, coordinates: coords };

      function apply() {
        if (!m) return;
        const data = { type: "Feature" as const, properties: {}, geometry };
        const src = m.getSource("guided-route") as mapboxgl.GeoJSONSource | undefined;
        if (src) src.setData(data as any);
        else {
          m.addSource("guided-route", { type: "geojson", data: data as any });
          // Casing underlay for nicer visual
          m.addLayer({
            id: "guided-route-casing",
            type: "line",
            source: "guided-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#1e3a8a", "line-width": 10, "line-opacity": 0.4 },
          });
          m.addLayer({
            id: "guided-route-line",
            type: "line",
            source: "guided-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#2563eb", "line-width": 6, "line-opacity": 1 },
          });
        }

        // waypoint markers
        stopMarkersRef.current.forEach((mk) => mk.remove());
        stopMarkersRef.current = [];
        waypoints.forEach((w, i) => {
          const isStart = i === 0;
          const isEnd = i === waypoints.length - 1;
          const color = isStart ? "#16a34a" : isEnd ? "#dc2626" : "#f59e0b";
          const label = isStart ? "A" : isEnd ? "B" : String(i);
          const el = document.createElement("div");
          el.style.cssText = `display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
          el.textContent = label;
          stopMarkersRef.current.push(new mapboxgl.Marker(el).setLngLat([w.lng, w.lat]).addTo(m));
        });
      }
      if (m.isStyleLoaded()) apply();
      else m.once("load", apply);
    })();
    return () => { cancelled = true; };
  }, [waypoints, doDirections]);

  // ---- live "me" marker + camera follow + heading rotation ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    if (!meMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText = `
        position:relative;width:30px;height:30px;border-radius:50%;
        background:#2563eb;border:3px solid #fff;
        box-shadow:0 4px 12px rgba(37,99,235,.55), 0 0 0 6px rgba(37,99,235,.18);
      `;
      const arrow = document.createElement("div");
      arrow.style.cssText = `
        position:absolute;left:50%;top:-18px;width:0;height:0;
        border-left:8px solid transparent;border-right:8px solid transparent;
        border-bottom:14px solid #2563eb;transform:translateX(-50%);
        filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));
      `;
      arrow.dataset.arrow = "1";
      el.appendChild(arrow);
      meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([position.lng, position.lat]).addTo(map);
    } else {
      meMarkerRef.current.setLngLat([position.lng, position.lat]);
    }

    // rotate arrow with heading
    const heading = position.heading;
    if (heading != null && Number.isFinite(heading)) {
      const arrowEl = meMarkerRef.current.getElement().querySelector("[data-arrow]") as HTMLDivElement | null;
      if (arrowEl) arrowEl.style.transform = `translateX(-50%) rotate(${heading}deg)`;
    }

    // smooth camera follow
    if (map.isStyleLoaded()) {
      map.easeTo({
        center: [position.lng, position.lat],
        bearing: heading ?? map.getBearing(),
        duration: 800,
        zoom: Math.max(map.getZoom(), 16),
      });
    }
  }, [position]);

  // ---- compute current instruction ----
  const current = useMemo(() => {
    if (!position || steps.length === 0) return null;
    const { idx, distanceToManeuver } = pickCurrentStep(steps, position);
    const step = steps[idx];
    if (!step) return null;
    return { step, idx, distanceToManeuver, next: steps[idx + 1] ?? null };
  }, [position, steps]);

  // ---- voice TTS triggers ----
  useEffect(() => {
    if (muted || !current) return;
    const { step, idx, distanceToManeuver } = current;

    // first time hitting this step → speak the instruction once
    if (lastSpokenStepRef.current !== idx && step.instruction) {
      lastSpokenStepRef.current = idx;
      lastSpokenWarnRef.current = -1;
      speak(step.instruction);
      return;
    }
    // approaching warning: at ~200m of next maneuver, give a heads-up
    if (
      distanceToManeuver < 200 &&
      distanceToManeuver > 80 &&
      lastSpokenWarnRef.current !== idx
    ) {
      lastSpokenWarnRef.current = idx;
      speak(`Em ${formatDist(distanceToManeuver)}, ${step.instruction}`);
    }
  }, [current, muted]);

  function toggleMute() {
    setMuted((v) => {
      const nv = !v;
      try { localStorage.setItem("fg-nav-muted", nv ? "1" : "0"); } catch { /* ignore */ }
      if (nv) try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      return nv;
    });
  }

  return (
    <div className="surface relative overflow-hidden" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />

      {/* Top instruction banner */}
      {current && current.step.instruction && (
        <div className="glass-bar absolute left-3 right-3 top-3 flex items-center gap-3 rounded-xl px-3 py-2.5 shadow-lg">
          <ManeuverArrow modifier={current.step.modifier} type={current.step.type} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {current.distanceToManeuver > 0 ? `em ${formatDist(current.distanceToManeuver)}` : "agora"}
            </div>
            <div className="truncate text-sm font-semibold leading-snug">{current.step.instruction}</div>
            {current.next && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Depois: {current.next.instruction}
              </div>
            )}
          </div>
          <button
            onClick={toggleMute}
            className="rounded-full p-2 text-muted-foreground hover:bg-accent"
            aria-label={muted ? "Ativar voz" : "Silenciar voz"}
            type="button"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Bottom bar: speed */}
      {position && (
        <div className="glass-bar absolute bottom-3 left-3 rounded-xl px-3 py-1.5 text-xs text-foreground/80">
          {position.speed != null
            ? <span><b>{Math.round((position.speed ?? 0) * 3.6)}</b> km/h</span>
            : <span>GPS ativo</span>}
        </div>
      )}
    </div>
  );
}
