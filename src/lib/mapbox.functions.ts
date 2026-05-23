import { createServerFn } from "@tanstack/react-start";

export const getMapboxToken = createServerFn({ method: "GET" }).handler(async () => {
  return { token: process.env.MAPBOX_PUBLIC_TOKEN ?? "" };
});

export interface GeocodeResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Place type: e.g. "address", "poi", "neighborhood" */
  type: string | null;
  /** City/locality if available */
  city: string | null;
  /** State/region short code if available */
  region: string | null;
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((d: {
    query: string;
    proximity?: [number, number]; // [lng, lat]
    country?: string;             // default "BR"
    limit?: number;               // default 6
    session?: string;             // optional session token for billing optimization
  }) => d)
  .handler(async ({ data }) => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) return { results: [] as GeocodeResult[] };
    const q = encodeURIComponent(data.query.trim());
    if (!q) return { results: [] as GeocodeResult[] };
    const country = data.country ?? "BR";
    const limit = Math.min(Math.max(data.limit ?? 6, 1), 10);
    const proximity = data.proximity ? `&proximity=${data.proximity[0]},${data.proximity[1]}` : "";
    const session = data.session ? `&session_token=${encodeURIComponent(data.session)}` : "";
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json` +
      `?language=pt-BR&autocomplete=true&country=${country}&limit=${limit}` +
      `&types=address,poi,place,neighborhood,locality,postcode` +
      `${proximity}${session}` +
      `&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return { results: [] as GeocodeResult[] };
    const json: any = await res.json();
    const results: GeocodeResult[] = (json?.features ?? []).map((f: any) => {
      const context: any[] = f.context ?? [];
      const city = context.find((c) => /^(place|locality)\./.test(c.id ?? ""))?.text ?? null;
      const region = context.find((c) => /^region\./.test(c.id ?? ""))?.short_code?.replace(/^BR-/i, "") ?? null;
      const type = String(f.place_type?.[0] ?? "").trim() || null;
      return {
        id: f.id,
        name: f.text ?? f.place_name,
        address: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
        type,
        city,
        region,
      };
    });
    return { results };
  });

/** Direction step: a single maneuver in turn-by-turn navigation */
export interface RouteStep {
  /** Distance to the next maneuver, in meters */
  distance_m: number;
  /** Estimated duration to the next maneuver, in seconds */
  duration_s: number;
  /** Street/road name for this step */
  name: string;
  /** Spoken/written instruction in pt-BR */
  instruction: string;
  /** Maneuver type: "turn", "merge", "arrive", "depart", "roundabout", "fork", etc. */
  type: string;
  /** Modifier: "left", "right", "straight", "slight left", "sharp right", "uturn" */
  modifier: string | null;
  /** Step polyline as [lng, lat] coords */
  geometry: [number, number][];
  /** End coordinate of the step */
  maneuver_location: [number, number];
}

export const getDirections = createServerFn({ method: "POST" })
  .inputValidator((d: {
    coordinates: [number, number][];
    /** Include step-by-step instructions (heavier response, default false) */
    withSteps?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token || data.coordinates.length < 2) {
      return { geometry: null, distance_m: null, duration_s: null, steps: [] as RouteStep[] };
    }
    const coords = data.coordinates.map((c) => c.join(",")).join(";");
    const steps = data.withSteps ? "true" : "false";
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?geometries=geojson&overview=full&language=pt-BR&steps=${steps}` +
      `&voice_instructions=${steps}&banner_instructions=${steps}` +
      `&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { geometry: null, distance_m: null, duration_s: null, steps: [] as RouteStep[] };
    }
    const json: any = await res.json();
    const route = json?.routes?.[0];
    if (!route) return { geometry: null, distance_m: null, duration_s: null, steps: [] as RouteStep[] };

    const allSteps: RouteStep[] = [];
    if (data.withSteps) {
      for (const leg of route.legs ?? []) {
        for (const s of leg.steps ?? []) {
          allSteps.push({
            distance_m: Number(s.distance ?? 0),
            duration_s: Number(s.duration ?? 0),
            name: String(s.name ?? "").trim(),
            instruction: String(s.maneuver?.instruction ?? s?.banner_instructions?.[0]?.primary?.text ?? "").trim(),
            type: String(s.maneuver?.type ?? "turn"),
            modifier: s.maneuver?.modifier ?? null,
            geometry: (s.geometry?.coordinates ?? []) as [number, number][],
            maneuver_location: (s.maneuver?.location ?? [0, 0]) as [number, number],
          });
        }
      }
    }

    return {
      geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
      distance_m: route.distance as number,
      duration_s: route.duration as number,
      steps: allSteps,
    };
  });
