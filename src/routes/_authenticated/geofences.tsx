import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import mapboxgl from "mapbox-gl";
import { useServerFn } from "@tanstack/react-start";
import { getMapboxToken } from "@/lib/mapbox.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, Trash2, Pencil, MapPin, LogIn, LogOut, AlertCircle, Crosshair, Shield,
} from "lucide-react";
import { toast } from "sonner";
import { circlePolygon } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/geofences")({
  component: GeofencesPage,
});

type Geofence = {
  id: string;
  name: string;
  description: string | null;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  active: boolean;
  created_at: string;
};

function GeofencesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Geofence | null>(null);
  const [search, setSearch] = useState("");

  const { data: geofences, isLoading } = useQuery({
    queryKey: ["geofences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("geofences")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Geofence[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["geofence-events"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("geofence_events")
        .select("*, geofence:geofences(name), vehicle:vehicles(plate), driver:drivers(full_name)")
        .order("occurred_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  // subscribe to live events
  useEffect(() => {
    const ch = supabase
      .channel("geofence-events-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "geofence_events" }, () => {
        qc.invalidateQueries({ queryKey: ["geofence-events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => {
    if (!geofences) return [];
    const q = search.trim().toLowerCase();
    if (!q) return geofences;
    return geofences.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      (g.description ?? "").toLowerCase().includes(q),
    );
  }, [geofences, search]);

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("geofences").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["geofences"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("geofences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["geofences"] });
      toast.success("Geocerca excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(g: Geofence) { setEditing(g); setOpen(true); }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Geocercas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {geofences?.length ?? 0} área{geofences?.length === 1 ? "" : "s"} monitorada{geofences?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 shrink-0">
          <Plus className="mr-2 h-4 w-4" />Nova geocerca
        </Button>
      </header>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface p-4"><Skeleton className="h-32 w-full" /></div>
        ))}
        {!isLoading && filtered.map((g) => (
          <article key={g.id} className="surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold leading-tight">{g.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.center_lat.toFixed(4)}, {g.center_lng.toFixed(4)}
                  </p>
                </div>
              </div>
              <Switch
                checked={g.active}
                onCheckedChange={(v) => toggle.mutate({ id: g.id, active: v })}
                aria-label="Ativar/desativar"
              />
            </div>
            {g.description && (
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
              <span className="text-muted-foreground">Raio: <span className="font-semibold text-foreground tabular-nums">{Math.round(g.radius_m)} m</span></span>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(g)} className="tap rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => { if (confirm(`Excluir geocerca "${g.name}"?`)) remove.mutate(g.id); }} className="tap rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full surface border-dashed p-10 text-center sm:p-12">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {geofences?.length ? "Nenhuma geocerca corresponde à busca." : "Nenhuma geocerca cadastrada."}
            </p>
            {!geofences?.length && (
              <Button onClick={openCreate} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />Criar primeira geocerca
              </Button>
            )}
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Eventos recentes
        </h2>
        <div className="surface p-0">
          {!events?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem eventos registrados.</p>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e: any) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className={
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg " +
                    (e.event_type === "enter" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")
                  }>
                    {e.event_type === "enter" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium">{e.vehicle?.plate ?? "—"}</span>
                      <span className="text-muted-foreground"> {e.event_type === "enter" ? "entrou em" : "saiu de"} </span>
                      <span className="font-medium">{e.geofence?.name ?? "—"}</span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {e.driver?.full_name ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <GeofenceDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["geofences"] })}
      />
    </div>
  );
}

function GeofenceDialog({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Geofence | null; onSaved: () => void }) {
  const { companyId } = useAuth();
  const fetchToken = useServerFn(getMapboxToken);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const centerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [tokenError, setTokenError] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(500);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setRadius(editing?.radius_m ?? 500);
    setCenter(editing ? { lat: editing.center_lat, lng: editing.center_lng } : null);
  }, [open, editing]);

  // init map
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let map: mapboxgl.Map | null = null;
    (async () => {
      const { token } = await fetchToken();
      if (cancelled) return;
      if (!token) { setTokenError(true); return; }
      mapboxgl.accessToken = token;
      if (!mapContainerRef.current) return;

      const initial = editing
        ? [editing.center_lng, editing.center_lat] as [number, number]
        : [-46.6333, -23.5505] as [number, number];

      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: initial,
        zoom: editing ? 14 : 11,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (ev) => setCenter({ lat: ev.lngLat.lat, lng: ev.lngLat.lng }));
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      if (centerMarkerRef.current) { centerMarkerRef.current.remove(); centerMarkerRef.current = null; }
      map?.remove();
      mapRef.current = null;
    };
  }, [open, editing, fetchToken]);

  // update center marker + circle layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;

    function applyLayer() {
      if (!map) return;
      const data = circlePolygon(center as { lat: number; lng: number }, radius);
      const src = map.getSource("geofence-preview") as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(data as any);
      else {
        map.addSource("geofence-preview", { type: "geojson", data: data as any });
        map.addLayer({
          id: "geofence-preview-fill",
          type: "fill",
          source: "geofence-preview",
          paint: { "fill-color": "oklch(0.32 0.08 160)", "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: "geofence-preview-line",
          type: "line",
          source: "geofence-preview",
          paint: { "line-color": "oklch(0.32 0.08 160)", "line-width": 2 },
        });
      }
    }

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLngLat([center.lng, center.lat]);
    } else {
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:50%;background:oklch(0.78 0.13 85);border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3)";
      centerMarkerRef.current = new mapboxgl.Marker(el).setLngLat([center.lng, center.lat]).addTo(map);
    }

    if (map.isStyleLoaded()) applyLayer();
    else map.once("load", applyLayer);
  }, [center, radius]);

  async function useMyLocation() {
    if (!("geolocation" in navigator)) return toast.error("GPS não disponível");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(c);
        mapRef.current?.flyTo({ center: [c.lng, c.lat], zoom: 14 });
      },
      () => toast.error("Não foi possível obter localização"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    if (!center) return toast.error("Clique no mapa para definir o centro");
    if (!name.trim()) return toast.error("Informe um nome");

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        center_lat: center.lat,
        center_lng: center.lng,
        radius_m: radius,
      };
      const { error } = editing
        ? await (supabase as any).from("geofences").update(payload).eq("id", editing.id)
        : await (supabase as any).from("geofences").insert({ company_id: companyId, ...payload, active: true });
      if (error) throw error;
      toast.success(editing ? "Geocerca atualizada" : "Geocerca criada");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar geocerca" : "Nova geocerca"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="order-2 space-y-3 md:order-1">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className="h-10" placeholder="Ex.: Centro de distribuição" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} />
            </div>
            <div>
              <Label>
                Raio: <span className="font-semibold text-foreground tabular-nums">{radius} m</span>
              </Label>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold">
                <Crosshair className="h-3.5 w-3.5" /> Centro
              </p>
              <p className="mt-1 text-muted-foreground tabular-nums">
                {center ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : "Clique no mapa para definir →"}
              </p>
              <button type="button" onClick={useMyLocation} className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
                <MapPin className="h-3.5 w-3.5" /> Usar minha localização
              </button>
            </div>
            <Button type="submit" disabled={saving} className="h-11 w-full">
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar geocerca"}
            </Button>
          </div>
          <div className="relative order-1 h-[240px] overflow-hidden rounded-lg border border-border sm:h-[280px] md:order-2 md:h-full md:min-h-[360px]">
            {tokenError ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <AlertCircle className="mr-2 h-4 w-4" />Mapa indisponível
              </div>
            ) : (
              <>
                <div ref={mapContainerRef} className="h-full w-full" />
                {!center && (
                  <div className="glass-bar pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-medium text-foreground/80 shadow">
                    Clique no mapa para definir o centro
                  </div>
                )}
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
