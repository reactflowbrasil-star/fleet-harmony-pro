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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDown, ArrowLeft, ArrowUp, MapPin, Plus, Search, Target, Trash2, XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trips_/$tripId/edit")({
  component: EditTripPage,
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

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message ?? "");
  const code = String(err?.code ?? "");
  return (
    code === "PGRST204" ||
    /schema cache/i.test(msg) ||
    /column .* does not exist/i.test(msg) ||
    /invalid input value for enum/i.test(msg) ||
    /relation .* does not exist/i.test(msg)
  );
}

function EditTripPage() {
  const { tripId } = Route.useParams();
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const fetchToken = useServerFn(getMapboxToken);
  const doGeocode = useServerFn(geocodeAddress);
  const doDirections = useServerFn(getDirections);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // ---- load existing trip + route_points ----
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip-edit", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: existingPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ["trip-edit-points", tripId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trip_route_points")
        .select("*")
        .eq("trip_id", tripId)
        .order("point_order");
      if (error) return []; // table may not exist yet
      return (data ?? []) as Array<{
        id: string; point_type: string; name: string | null;
        address: string | null; latitude: number; longitude: number;
        notes: string | null; is_required: boolean;
      }>;
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers-min-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("id, full_name, vehicle_id").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, plate, model").eq("status", "active").order("plate");
      return data ?? [];
    },
  });

  // ---- map init ----
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

  // ---- form state ----
  const [form, setForm] = useState({
    driver_id: "",
    vehicle_id: "",
    title: "",
    scheduled_start_at: "",
    scheduled_end_at: "",
    priority: "",
    client_name: "",
    service_order: "",
    cargo_type: "",
    driver_instructions: "",
    notes: "",
  });
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // hydrate form once when trip arrives
  useEffect(() => {
    if (!trip || hydrated) return;
    const toLocal = (iso: string | null | undefined) =>
      iso ? new Date(iso).toISOString().slice(0, 16) : "";
    setForm({
      driver_id: trip.driver_id ?? "",
      vehicle_id: trip.vehicle_id ?? "",
      title: trip.title ?? "",
      scheduled_start_at: toLocal(trip.scheduled_start_at ?? trip.start_at),
      scheduled_end_at: toLocal(trip.scheduled_end_at ?? trip.end_at),
      priority: trip.priority ?? "",
      client_name: trip.client_name ?? "",
      service_order: trip.service_order ?? "",
      cargo_type: trip.cargo_type ?? "",
      driver_instructions: trip.driver_instructions ?? "",
      notes: trip.notes ?? "",
    });
    setHydrated(true);
  }, [trip, hydrated]);

  // hydrate points (from route_points table, or fallback to trip origin/destination text+coords)
  useEffect(() => {
    if (!trip || pointsLoading) return;
    if (points.length > 0) return; // already hydrated by user
    if (existingPoints && existingPoints.length > 0) {
      setPoints(existingPoints.map((p) => ({
        type: p.point_type as PointType,
        name: p.name ?? "",
        address: p.address ?? undefined,
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        notes: p.notes ?? undefined,
        is_required: p.is_required,
      })));
    } else {
      // fallback: use lat/lng from trip if present
      const built: RoutePoint[] = [];
      if (trip.origin_lat != null && trip.origin_lng != null) {
        built.push({
          type: "origin",
          name: trip.origin ?? "Origem",
          lat: Number(trip.origin_lat),
          lng: Number(trip.origin_lng),
          is_required: true,
        });
      }
      if (trip.destination_lat != null && trip.destination_lng != null) {
        built.push({
          type: "destination",
          name: trip.destination ?? "Destino",
          lat: Number(trip.destination_lat),
          lng: Number(trip.destination_lng),
          is_required: true,
        });
      }
      if (built.length > 0) setPoints(built);
    }
  }, [trip, existingPoints, pointsLoading, points.length]);

  // ---- map click to pick ----
  const [pickMode, setPickMode] = useState<PickMode>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    function onClick(e: mapboxgl.MapMouseEvent) {
      if (!pickMode) return;
      addOrReplacePoint(pickMode, { lat: e.lngLat.lat, lng: e.lngLat.lng, name: `Ponto (${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)})` });
      setPickMode(null);
    }
    map.on("click", onClick);
    map.getCanvas().style.cursor = pickMode ? "crosshair" : "";
    return () => { map.off("click", onClick); };
  }, [pickMode]);

  function addOrReplacePoint(mode: NonNullable<PickMode>, base: { lat: number; lng: number; name?: string; address?: string }) {
    setPoints((prev) => {
      const next = [...prev];
      if (mode.index != null) {
        next[mode.index] = { ...next[mode.index], lat: base.lat, lng: base.lng, name: base.name ?? next[mode.index].name, address: base.address };
      } else {
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
          const destIdx = next.findIndex((p) => p.type === "destination");
          if (destIdx === -1) next.push(newPt);
          else next.splice(destIdx, 0, newPt);
        }
      }
      return next;
    });
  }

  // ---- markers ----
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

  // ---- directions ----
  const [estimate, setEstimate] = useState<{ distance_m: number | null; duration_s: number | null }>({ distance_m: null, duration_s: null });
  const [computingRoute, setComputingRoute] = useState(false);
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
          if (src) src.setData(data as any);
          else {
            m.addSource("planned-route", { type: "geojson", data: data as any });
            m.addLayer({
              id: "planned-route-line",
              type: "line",
              source: "planned-route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.8 },
            });
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

  // ---- search ----
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
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

  const origin = points.find((p) => p.type === "origin");
  const destination = points.find((p) => p.type === "destination");

  // ---- save (UPDATE) ----
  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      if (!form.driver_id) throw new Error("Selecione um motorista");
      if (!form.vehicle_id) throw new Error("Selecione um veículo");
      if (!origin) throw new Error("Defina a origem no mapa");
      if (!destination) throw new Error("Defina o destino no mapa");

      const basePayload: Record<string, any> = {
        driver_id: form.driver_id,
        vehicle_id: form.vehicle_id,
        origin: origin.name || origin.address || null,
        destination: destination.name || destination.address || null,
        start_at: form.scheduled_start_at ? new Date(form.scheduled_start_at).toISOString() : null,
        end_at: form.scheduled_end_at ? new Date(form.scheduled_end_at).toISOString() : null,
        distance_m: estimate.distance_m,
        notes: form.notes || null,
      };

      const extendedPayload: Record<string, any> = {
        ...basePayload,
        title: form.title.trim() || null,
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
      };

      // Try extended first
      let degraded = false;
      const { error: extErr } = await supabase.from("trips").update(extendedPayload).eq("id", tripId);
      if (extErr) {
        if (isMissingColumnError(extErr)) {
          const { error: baseErr } = await supabase.from("trips").update(basePayload).eq("id", tripId);
          if (baseErr) throw baseErr;
          degraded = true;
        } else {
          throw extErr;
        }
      }

      // Replace route_points (delete + insert) — best effort
      let routePointsSaved = true;
      try {
        await (supabase as any).from("trip_route_points").delete().eq("trip_id", tripId);
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
          const { error: rpErr } = await (supabase as any).from("trip_route_points").insert(rows);
          if (rpErr && !isMissingColumnError(rpErr)) throw rpErr;
          routePointsSaved = !rpErr;
        }
      } catch (e: any) {
        if (!isMissingColumnError(e)) throw e;
        routePointsSaved = false;
      }

      return { degraded, routePointsSaved };
    },
    onSuccess: ({ degraded, routePointsSaved }) => {
      if (degraded) {
        toast.warning("Viagem atualizada (modo básico). Aplique a migration 20260524100000 para habilitar todos os campos.", { duration: 6000 });
      } else if (points.length > 0 && !routePointsSaved) {
        toast.warning("Viagem atualizada, mas a tabela trip_route_points ainda não existe.", { duration: 6000 });
      } else {
        toast.success("Viagem atualizada");
      }
      navigate({ to: `/trips/${tripId}` });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  // ---- cancel trip ----
  const cancelTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").update({ status: "cancelled" }).eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Viagem cancelada");
      navigate({ to: "/trips" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cancelar"),
  });

  // ---- delete trip ----
  const deleteTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Viagem excluída");
      navigate({ to: "/trips" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
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

  const inProgress = trip?.status === "in_progress";
  const completed = trip?.status === "completed";
  const canDelete = trip?.status !== "in_progress" && trip?.status !== "completed";

  const isLoading = tripLoading || !hydrated;

  if (!tripLoading && !trip) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-sm">Viagem não encontrada.</p>
        <Link to="/trips" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />Voltar para viagens
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/trips/${tripId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Cancelar edição
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Editar viagem</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize motorista, veículo, horário ou rota. Trocar o motorista envia nova notificação ao novo responsável.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canDelete && (
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                if (confirm("Excluir esta viagem permanentemente? Esta ação não pode ser desfeita.")) {
                  deleteTrip.mutate();
                }
              }}
              disabled={deleteTrip.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />Excluir
            </Button>
          )}
          {!completed && (
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                if (confirm("Cancelar esta viagem? O motorista verá a viagem como cancelada.")) {
                  cancelTrip.mutate();
                }
              }}
              disabled={cancelTrip.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />Cancelar viagem
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading} className="h-10">
            {save.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </div>

      {(inProgress || completed) && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          {inProgress
            ? "Esta viagem está em andamento. Mudanças na rota não afetam o trajeto que o motorista já está percorrendo."
            : "Esta viagem está concluída. Edição disponível apenas para corrigir dados históricos."}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* LEFT: form */}
        <div className="space-y-4">
          <section className="surface space-y-3 p-4">
            <h2 className="font-display text-lg">Detalhes da viagem</h2>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Título</Label>
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
                  <Label>Início previsto</Label>
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
            )}
          </section>

          <section className="surface space-y-3 p-4">
            <h2 className="font-display text-lg">Buscar endereço</h2>
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
                      <button onClick={() => addOrReplacePoint({ type: "origin" }, { lat: r.lat, lng: r.lng, name: r.name, address: r.address })}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-card">Origem</button>
                      <button onClick={() => addOrReplacePoint({ type: "stop" }, { lat: r.lat, lng: r.lng, name: r.name, address: r.address })}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-card">Parada</button>
                      <button onClick={() => addOrReplacePoint({ type: "destination" }, { lat: r.lat, lng: r.lng, name: r.name, address: r.address })}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-card">Destino</button>
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
              <p className="text-xs text-primary">Clique no mapa para definir {pointTypeLabel[pickMode.type]}</p>
            )}
            {points.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ponto. Defina origem e destino acima.</p>
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
