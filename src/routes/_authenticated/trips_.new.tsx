import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken, geocodeAddress, getDirections, type GeocodeResult } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown, ArrowLeft, ArrowUp, MapPin, Plus, Search, Target, Trash2,
} from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/trips_/new")({
  component: NewTripPage,
});

type PointType = "origin" | "stop" | "pickup" | "delivery" | "fuel" | "rest" | "destination";

const pointTypeLabel: Record<PointType, string> = {
  origin: "Origem",
  stop: "Parada",
  pickup: "Coleta",
  delivery: "Entrega",
  fuel: "Abastecimento",
  rest: "Descanso",
  destination: "Destino",
};

const pointTypeColor: Record<PointType, string> = {
  origin: "#16a34a",
  destination: "#dc2626",
  stop: "#2563eb",
  pickup: "#f59e0b",
  delivery: "#8b5cf6",
  fuel: "#ec4899",
  rest: "#6366f1",
};

interface RoutePoint {
  type: PointType;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  notes?: string;
  is_required: boolean;
}

type PickMode = null | { type: PointType; index?: number };

function NewTripPage() {
  const navigate = useNavigate();
  const { companyId, user } = useAuth();
  const fetchToken = useServerFn(getMapboxToken);
  const doGeocode = useServerFn(geocodeAddress);
  const doDirections = useServerFn(getDirections);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [estimate, setEstimate] = useState<{ distance_m: number | null; duration_s: number | null }>({ distance_m: null, duration_s: null });
  const [computingRoute, setComputingRoute] = useState(false);

  const { data: drivers } = useQuery({
    queryKey: ["drivers-min"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("id, full_name, vehicle_id").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, plate, model").eq("status", "active").order("plate");
      return data ?? [];
    },
  });

  // --- map init ---
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

  // --- handle map click to pick a point ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function onClick(e: mapboxgl.MapMouseEvent) {
      if (!pickMode) return;
      addOrReplacePoint(pickMode, { lat: e.lngLat.lat, lng: e.lngLat.lng, name: `Ponto (${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)})` });
      setPickMode(null);
    }
    map.on("click", onClick);
    if (pickMode) map.getCanvas().style.cursor = "crosshair";
    else map.getCanvas().style.cursor = "";
    return () => { map.off("click", onClick); };
  }, [pickMode]);

  function addOrReplacePoint(mode: NonNullable<PickMode>, base: { lat: number; lng: number; name?: string; address?: string }) {
    setPoints((prev) => {
      const next = [...prev];
      if (mode.index != null) {
        next[mode.index] = { ...next[mode.index], lat: base.lat, lng: base.lng, name: base.name ?? next[mode.index].name, address: base.address };
      } else {
        // ensure origin first, destination last
        const newPt: RoutePoint = {
          type: mode.type,
          name: base.name ?? "",
          address: base.address,
          lat: base.lat,
          lng: base.lng,
          is_required: mode.type === "origin" || mode.type === "destination",
        };
        if (mode.type === "origin") {
          const filtered = next.filter((p) => p.type !== "origin");
          next.splice(0, next.length, newPt, ...filtered);
        } else if (mode.type === "destination") {
          const filtered = next.filter((p) => p.type !== "destination");
          filtered.push(newPt);
          next.splice(0, next.length, ...filtered);
        } else {
          // insert before destination
          const destIdx = next.findIndex((p) => p.type === "destination");
          if (destIdx === -1) next.push(newPt);
          else next.splice(destIdx, 0, newPt);
        }
      }
      return next;
    });
  }

  // --- draw markers + route polyline ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    points.forEach((p, i) => {
      const el = document.createElement("div");
      const color = pointTypeColor[p.type] ?? "#6b7280";
      el.style.cssText = `display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)`;
      el.textContent = p.type === "origin" ? "A" : p.type === "destination" ? "B" : String(i);
      const m = new mapboxgl.Marker(el)
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`<strong>${p.name || pointTypeLabel[p.type]}</strong><br/><small style="color:#6b7280">${pointTypeLabel[p.type]}</small>`))
        .addTo(map);
      markersRef.current.push(m);
    });

    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 14, duration: 600 });
    } else if (points.length > 1) {
      const b = new mapboxgl.LngLatBounds();
      points.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding: 80, maxZoom: 14, duration: 600 });
    }
  }, [points]);

  // --- compute directions when points change ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function clearRouteLayer() {
      if (!map) return;
      if (map.getLayer("planned-route-line")) map.removeLayer("planned-route-line");
      if (map.getSource("planned-route")) map.removeSource("planned-route");
    }

    if (points.length < 2) {
      clearRouteLayer();
      setEstimate({ distance_m: null, duration_s: null });
      return;
    }

    let cancelled = false;
    (async () => {
      setComputingRoute(true);
      try {
        const coords = points.map((p) => [p.lng, p.lat] as [number, number]);
        const res = await doDirections({ data: { coordinates: coords } });
        if (cancelled || !mapRef.current) return;
        const m = mapRef.current;
        setEstimate({ distance_m: res.distance_m, duration_s: res.duration_s });
        const geometry = res.geometry ?? { type: "LineString" as const, coordinates: coords };

        function apply() {
          if (!m) return;
          const data = { type: "Feature" as const, properties: {}, geometry };
          const src = m.getSource("planned-route") as mapboxgl.GeoJSONSource | undefined;
          if (src) {
            src.setData(data as any);
          } else {
            m.addSource("planned-route", { type: "geojson", data: data as any });
            m.addLayer({
              id: "planned-route-line",
              type: "line",
              source: "planned-route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.8 },
            }, undefined);
          }
        }
        if (m.isStyleLoaded()) apply();
        else m.once("load", apply);
      } finally {
        if (!cancelled) setComputingRoute(false);
      }
    })();
    return () => { cancelled = true; };
  }, [points, doDirections]);

  // --- search ---
  async function runSearch() {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const { results } = await doGeocode({ data: { query: search } });
      setResults(results);
    } finally {
      setSearching(false);
    }
  }

  // --- form state ---
  const [form, setForm] = useState({
    driver_id: "",
    vehicle_id: "",
    title: "",
    scheduled_start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    scheduled_end_at: "",
    priority: "",
    client_name: "",
    service_order: "",
    cargo_type: "",
    driver_instructions: "",
    notes: "",
  });

  // when driver changes, suggest their linked vehicle
  useEffect(() => {
    if (!form.driver_id || form.vehicle_id) return;
    const d = drivers?.find((x: any) => x.id === form.driver_id);
    if (d?.vehicle_id) setForm((f) => ({ ...f, vehicle_id: d.vehicle_id as string }));
  }, [form.driver_id, drivers]);

  const origin = points.find((p) => p.type === "origin");
  const destination = points.find((p) => p.type === "destination");

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      if (!form.driver_id) throw new Error("Selecione um motorista");
      if (!form.vehicle_id) throw new Error("Selecione um veículo");
      if (!form.title.trim()) throw new Error("Informe um título");
      if (!origin) throw new Error("Defina a origem no mapa");
      if (!destination) throw new Error("Defina o destino no mapa");

      // Always-present columns (schema base)
      const basePayload: Record<string, any> = {
        company_id: companyId,
        driver_id: form.driver_id,
        vehicle_id: form.vehicle_id,
        origin: origin.name || origin.address || null,
        destination: destination.name || destination.address || null,
        start_at: form.scheduled_start_at ? new Date(form.scheduled_start_at).toISOString() : null,
        end_at: form.scheduled_end_at ? new Date(form.scheduled_end_at).toISOString() : null,
        distance_m: estimate.distance_m,
        notes: form.notes || null,
        status: "scheduled",
      };

      // Extended columns from migration 20260524100000_planned_trips.sql
      const extendedPayload: Record<string, any> = {
        ...basePayload,
        title: form.title.trim(),
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        scheduled_start_at: basePayload.start_at,
        scheduled_end_at: basePayload.end_at,
        estimated_distance_m: estimate.distance_m,
        estimated_duration_s: estimate.duration_s,
        priority: form.priority || null,
        client_name: form.client_name || null,
        service_order: form.service_order || null,
        cargo_type: form.cargo_type || null,
        driver_instructions: form.driver_instructions || null,
        created_by: user?.id ?? null,
        status: "assigned", // available only after migration extends the enum
      };

      function isMissingColumnError(err: any): boolean {
        const msg = String(err?.message ?? "");
        const code = String(err?.code ?? "");
        return (
          code === "PGRST204" ||
          /schema cache/i.test(msg) ||
          /column .* does not exist/i.test(msg) ||
          /invalid input value for enum/i.test(msg)
        );
      }

      // Try extended first; fall back to base if migration not applied.
      let tripId: string | null = null;
      let degraded = false;
      {
        const { data, error } = await supabase
          .from("trips")
          .insert(extendedPayload)
          .select("id")
          .single();
        if (!error && data) {
          tripId = data.id;
        } else if (error && isMissingColumnError(error)) {
          const fb = await supabase.from("trips").insert(basePayload).select("id").single();
          if (fb.error) throw fb.error;
          tripId = fb.data!.id;
          degraded = true;
        } else if (error) {
          throw error;
        }
      }
      if (!tripId) throw new Error("Falha ao salvar viagem");

      // Best-effort: persist route points if the table exists.
      let routePointsSaved = false;
      if (points.length > 0) {
        const rows = points.map((p, i) => ({
          trip_id: tripId,
          company_id: companyId,
          point_order: i + 1,
          point_type: p.type,
          name: p.name || null,
          address: p.address || null,
          latitude: p.lat,
          longitude: p.lng,
          notes: p.notes || null,
          is_required: p.is_required,
        }));
        const { error: rpErr } = await supabase.from("trip_route_points" as any).insert(rows);
        if (rpErr && !isMissingColumnError(rpErr) && !/relation .* does not exist/i.test(rpErr.message)) {
          throw rpErr;
        }
        routePointsSaved = !rpErr;
      }

      return { id: tripId, degraded, routePointsSaved };
    },
    onSuccess: ({ id, degraded, routePointsSaved }) => {
      if (degraded) {
        toast.warning(
          "Viagem cadastrada com dados básicos. Aplique a migration 20260524100000_planned_trips.sql no Supabase para habilitar título, prioridade, cliente e rota multi-ponto.",
          { duration: 8000 },
        );
      } else if (points.length > 0 && !routePointsSaved) {
        toast.warning(
          "Viagem cadastrada, mas a tabela trip_route_points ainda não existe. Aplique a migration 20260524100000 para salvar as paradas.",
          { duration: 6000 },
        );
      } else {
        toast.success("Viagem cadastrada e enviada ao motorista");
      }
      navigate({ to: `/trips/${id}` });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  function movePoint(idx: number, dir: -1 | 1) {
    setPoints((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }
  function removePoint(idx: number) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }
  function updatePoint(idx: number, patch: Partial<RoutePoint>) {
    setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  const distanceKm = estimate.distance_m != null ? (estimate.distance_m / 1000).toFixed(1) : null;
  const durationMin = estimate.duration_s != null ? Math.round(estimate.duration_s / 60) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/trips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Voltar
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Nova viagem</h1>
          <p className="mt-1 text-sm text-muted-foreground">Defina rota, motorista e horário. A viagem aparece no app do motorista.</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="h-10">
          {save.isPending ? "Salvando…" : "Salvar e atribuir"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* LEFT: form */}
        <div className="space-y-4">
          <section className="surface space-y-3 p-4">
            <h2 className="font-display text-lg">Detalhes da viagem</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Entrega Cliente Centro" />
              </div>
              <div>
                <Label>Motorista *</Label>
                <select value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Selecione…</option>
                  {drivers?.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
              <div>
                <Label>Veículo *</Label>
                <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })} className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Selecione…</option>
                  {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}
                </select>
              </div>
              <div>
                <Label>Início previsto *</Label>
                <Input type="datetime-local" value={form.scheduled_start_at} onChange={(e) => setForm({ ...form, scheduled_start_at: e.target.value })} />
              </div>
              <div>
                <Label>Fim previsto</Label>
                <Input type="datetime-local" value={form.scheduled_end_at} onChange={(e) => setForm({ ...form, scheduled_end_at: e.target.value })} />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority || "normal"} onValueChange={(v) => setForm({ ...form, priority: v === "normal" ? "" : v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de carga</Label>
                <Input value={form.cargo_type} onChange={(e) => setForm({ ...form, cargo_type: e.target.value })} placeholder="Ex.: Encomenda" />
              </div>
              <div>
                <Label>Cliente</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <Label>Ordem de serviço</Label>
                <Input value={form.service_order} onChange={(e) => setForm({ ...form, service_order: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Instruções ao motorista</Label>
                <Textarea rows={2} value={form.driver_instructions} onChange={(e) => setForm({ ...form, driver_instructions: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observações internas</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="surface space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Buscar endereço</h2>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
                  placeholder="Rua, bairro, cidade…"
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={runSearch} disabled={searching}>{searching ? "Buscando…" : "Buscar"}</Button>
            </div>
            {results.length > 0 && (
              <ul className="space-y-1 text-sm">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.address}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { addOrReplacePoint({ type: "origin" }, { lat: r.lat, lng: r.lng, name: r.name, address: r.address }); }}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-card"
                      >Origem</button>
                      <button
                        onClick={() => { addOrReplacePoint({ type: "stop" }, { lat: r.lat, lng: r.lng, name: r.name, address: r.address }); }}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-card"
                      >Parada</button>
                      <button
                        onClick={() => { addOrReplacePoint({ type: "destination" }, { lat: r.lat, lng: r.lng, name: r.name, address: r.address }); }}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-card"
                      >Destino</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg">Pontos da rota</h2>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(["origin", "stop", "destination"] as PointType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPickMode({ type: t })}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition-colors ${pickMode?.type === t && pickMode.index == null ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                  >
                    <Target className="h-3 w-3" />Definir {pointTypeLabel[t]}
                  </button>
                ))}
              </div>
            </div>
            {pickMode && pickMode.index == null && (
              <p className="text-xs text-primary">Clique no mapa para definir {pointTypeLabel[pickMode.type]} ({"" + pickMode.type})</p>
            )}
            {points.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ponto. Clique em uma das opções acima ou busque um endereço.</p>
            ) : (
              <ul className="space-y-2">
                {points.map((p, i) => (
                  <li key={i} className="rounded-md border border-border bg-background p-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ background: pointTypeColor[p.type] }}
                      >
                        {p.type === "origin" ? "A" : p.type === "destination" ? "B" : i}
                      </span>
                      <div className="min-w-0 flex-1">
                        <input
                          value={p.name}
                          onChange={(e) => updatePoint(i, { name: e.target.value })}
                          placeholder="Nome do ponto"
                          className="w-full bg-transparent text-sm font-medium outline-none focus:underline"
                        />
                        <div className="text-[11px] text-muted-foreground">
                          {pointTypeLabel[p.type]} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </div>
                      </div>
                      <select
                        value={p.type}
                        onChange={(e) => updatePoint(i, { type: e.target.value as PointType })}
                        className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                      >
                        {(Object.keys(pointTypeLabel) as PointType[]).map((t) => (
                          <option key={t} value={t}>{pointTypeLabel[t]}</option>
                        ))}
                      </select>
                      <button onClick={() => movePoint(i, -1)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Subir"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button onClick={() => movePoint(i, 1)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Descer"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removePoint(i)} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setPickMode({ type: "stop" })}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              <Plus className="h-4 w-4" />Adicionar parada (clicar no mapa)
            </button>
          </section>
        </div>

        {/* RIGHT: map */}
        <div className="space-y-3">
          <div className="surface relative overflow-hidden" style={{ height: "70vh" }}>
            <div ref={containerRef} className="h-full w-full" />
            {pickMode && (
              <div className="glass-bar pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs text-foreground/80">
                <Target className="mr-1 inline h-3 w-3" />Clique no mapa para definir {pointTypeLabel[pickMode.type]}
              </div>
            )}
            {(distanceKm || durationMin) && (
              <div className="glass-bar absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 rounded-xl px-4 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span><b>{distanceKm ?? "—"}</b> km · <b>{durationMin ?? "—"}</b> min estimados</span>
                </div>
                {computingRoute && <span className="text-xs text-muted-foreground">recalculando…</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
