import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { offlineLocationQueue } from "@/storage/offlineLocationQueue";
import { pushGpsPoints, type GpsPoint } from "./driverApi";

export const LOCATION_TASK = "frotap-location-task";
const CTX_KEY = "frotap.location_ctx.v1";

export type LocationCtx = {
  trip_id: string;
  company_id: string;
};

export async function setLocationCtx(ctx: LocationCtx) {
  await AsyncStorage.setItem(CTX_KEY, JSON.stringify(ctx));
}
export async function clearLocationCtx() {
  await AsyncStorage.removeItem(CTX_KEY);
}
export async function getLocationCtx(): Promise<LocationCtx | null> {
  const raw = await AsyncStorage.getItem(CTX_KEY);
  return raw ? (JSON.parse(raw) as LocationCtx) : null;
}

export async function requestPermissions(): Promise<{ foreground: boolean; background: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  let bg = { granted: false } as { granted: boolean };
  if (fg.granted) {
    bg = await Location.requestBackgroundPermissionsAsync();
  }
  return { foreground: fg.granted, background: !!bg.granted };
}

export async function startTracking(ctx: LocationCtx) {
  await setLocationCtx(ctx);

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5_000,
    distanceInterval: 10,
    deferredUpdatesInterval: 5_000,
    foregroundService: {
      notificationTitle: "Frotap Driver",
      notificationBody: "Rastreamento GPS ativo durante a viagem.",
      notificationColor: "#1a3d2e",
    },
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });
}

export async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await clearLocationCtx();
}

async function buildPoint(loc: Location.LocationObject, ctx: LocationCtx): Promise<GpsPoint> {
  let battery_level: number | null = null;
  try {
    const lvl = await Battery.getBatteryLevelAsync();
    battery_level = Math.round(lvl * 100);
  } catch { /* ignore */ }
  return {
    trip_id: ctx.trip_id,
    company_id: ctx.company_id,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    speed: loc.coords.speed ?? null,
    heading: loc.coords.heading ?? null,
    accuracy: loc.coords.accuracy ?? null,
    altitude: loc.coords.altitude ?? null,
    battery_level,
    recorded_at: new Date(loc.timestamp).toISOString(),
  };
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const items = await offlineLocationQueue.drain();
  if (!items.length) return { flushed: 0, failed: 0 };
  try {
    await pushGpsPoints(items);
    return { flushed: items.length, failed: 0 };
  } catch {
    await offlineLocationQueue.putBack(items);
    return { flushed: 0, failed: items.length };
  }
}

// Task handler runs even when JS context is in background.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const { locations } = (data as { locations: Location.LocationObject[] }) ?? { locations: [] };
  const ctx = await getLocationCtx();
  if (!ctx || !locations?.length) return;

  const points = await Promise.all(locations.map((l) => buildPoint(l, ctx)));

  try {
    await pushGpsPoints(points);
    // also try to drain backlog opportunistically
    await flushQueue();
  } catch {
    for (const p of points) await offlineLocationQueue.enqueue(p);
  }
});
