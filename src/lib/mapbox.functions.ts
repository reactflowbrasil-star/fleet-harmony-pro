import { createServerFn } from "@tanstack/react-start";

export const getMapboxToken = createServerFn({ method: "GET" }).handler(async () => {
  return { token: process.env.MAPBOX_PUBLIC_TOKEN ?? "" };
});

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d:{ query: string; proximity?: [number, number] }) => d)
  .handler(async ({ data }) => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) return { results: [] as GeocodeResult[] };
    const q = encodeURIComponent(data.query.trim());
    if (!q) return { results: [] as GeocodeResult[] };
    const proximity = data.proximity ? `&proximity=${data.proximity[0]},${data.proximity[1]}` : "";
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?language=pt-BR&limit=5${proximity}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return { results: [] as GeocodeResult[] };
    const json: any = await res.json();
    const results: GeocodeResult[] = (json?.features ?? []).map((f: any) => ({
      id: f.id,
      name: f.text,
      address: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
    }));
    return { results };
  });

export const getDirections = createServerFn({ method: "POST" })
  .inputValidator((d:{ coordinates: [number, number][] }) => d)
  .handler(async ({ data }) => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token || data.coordinates.length < 2) {
      return { geometry: null, distance_m: null, duration_s: null };
    }
    const coords = data.coordinates.map((c) => c.join(",")).join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&language=pt-BR&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return { geometry: null, distance_m: null, duration_s: null };
    const json: any = await res.json();
    const route = json?.routes?.[0];
    if (!route) return { geometry: null, distance_m: null, duration_s: null };
    return {
      geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
      distance_m: route.distance as number,
      duration_s: route.duration as number,
    };
  });

export interface GeocodeResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}
