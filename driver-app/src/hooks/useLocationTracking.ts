import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import * as Network from "expo-network";
import { flushQueue, type LocationCtx, startTracking, stopTracking } from "@/services/locationService";
import { offlineLocationQueue } from "@/storage/offlineLocationQueue";

export type LiveStats = {
  current_speed_kmh: number | null;
  accuracy_m: number | null;
  total_distance_m: number;
  last_fix_at: number | null;
  queued: number;
  online: boolean;
};

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** UI-facing live stats; the real persistence happens inside the task in locationService. */
export function useLocationTracking(active: boolean, ctx: LocationCtx | null) {
  const [stats, setStats] = useState<LiveStats>({
    current_speed_kmh: null,
    accuracy_m: null,
    total_distance_m: 0,
    last_fix_at: null,
    queued: 0,
    online: true,
  });
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastPointRef = useRef<{ lat: number; lng: number } | null>(null);

  // start/stop background task
  useEffect(() => {
    if (!active || !ctx) {
      stopTracking().catch(() => {});
      return;
    }
    startTracking(ctx).catch(() => {});
    return () => { stopTracking().catch(() => {}); };
  }, [active, ctx?.trip_id]);

  // foreground subscription for live UI numbers
  useEffect(() => {
    if (!active) {
      if (subRef.current) { subRef.current.remove(); subRef.current = null; }
      lastPointRef.current = null;
      setStats((s) => ({ ...s, current_speed_kmh: null, accuracy_m: null, total_distance_m: 0 }));
      return;
    }
    (async () => {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 4_000 },
        (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          const speed = loc.coords.speed ?? 0;
          const acc = loc.coords.accuracy ?? null;
          let added = 0;
          if (lastPointRef.current) {
            const d = haversine(lastPointRef.current, { lat, lng });
            if (d < 1000) added = d;
          }
          lastPointRef.current = { lat, lng };
          setStats((s) => ({
            ...s,
            current_speed_kmh: Math.max(0, Math.round(speed * 3.6)),
            accuracy_m: acc != null ? Math.round(acc) : null,
            total_distance_m: s.total_distance_m + added,
            last_fix_at: Date.now(),
          }));
        },
      );
      subRef.current = sub;
    })();
    return () => { if (subRef.current) { subRef.current.remove(); subRef.current = null; } };
  }, [active]);

  // periodic: queue size + connectivity + opportunistic flush
  useEffect(() => {
    let mounted = true;
    async function tick() {
      const [size, net] = await Promise.all([
        offlineLocationQueue.size(),
        Network.getNetworkStateAsync().catch(() => ({ isConnected: true, isInternetReachable: true } as any)),
      ]);
      if (!mounted) return;
      const online = !!(net?.isConnected && net?.isInternetReachable !== false);
      setStats((s) => ({ ...s, queued: size, online }));
      if (online && size > 0) {
        await flushQueue().catch(() => {});
        const after = await offlineLocationQueue.size();
        if (!mounted) return;
        setStats((s) => ({ ...s, queued: after }));
      }
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return stats;
}
