import { api } from "./api";
import { ENV } from "@/config/env";

const PREFER_REPRESENTATION = { Prefer: "return=representation" };

async function pgGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = `${ENV.SUPABASE_URL}/rest/v1${path}`;
  const r = await api.get<T>(url, { params });
  return r.data;
}

async function pgPost<T>(path: string, body: any): Promise<T> {
  const url = `${ENV.SUPABASE_URL}/rest/v1${path}`;
  const r = await api.post<T>(url, body, { headers: PREFER_REPRESENTATION });
  return r.data;
}

async function pgPatch<T>(path: string, body: any): Promise<T> {
  const url = `${ENV.SUPABASE_URL}/rest/v1${path}`;
  const r = await api.patch<T>(url, body, { headers: PREFER_REPRESENTATION });
  return r.data;
}

export type Driver = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cnh: string | null;
  cnh_expiry: string | null;
  vehicle_id: string | null;
  company_id: string;
};

export type Vehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
};

export type Trip = {
  id: string;
  company_id: string;
  driver_id: string;
  vehicle_id: string;
  origin: string | null;
  destination: string | null;
  start_at: string | null;
  end_at: string | null;
  start_km: number | null;
  end_km: number | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
};

export async function fetchMe(userId: string): Promise<Driver | null> {
  const list = await pgGet<Driver[]>("/drivers", { user_id: `eq.${userId}`, select: "*" });
  return list[0] ?? null;
}

export async function fetchMyVehicle(vehicleId: string): Promise<Vehicle | null> {
  const list = await pgGet<Vehicle[]>("/vehicles", { id: `eq.${vehicleId}`, select: "*" });
  return list[0] ?? null;
}

export async function fetchAssignedTrips(driverId: string): Promise<Trip[]> {
  return pgGet<Trip[]>("/trips", {
    driver_id: `eq.${driverId}`,
    status: "in.(scheduled,in_progress)",
    order: "start_at.asc.nullslast",
    select: "*",
  });
}

export async function fetchActiveTrip(driverId: string): Promise<Trip | null> {
  const list = await pgGet<Trip[]>("/trips", {
    driver_id: `eq.${driverId}`,
    status: "eq.in_progress",
    select: "*",
  });
  return list[0] ?? null;
}

export async function startTrip(input: {
  company_id: string; driver_id: string; vehicle_id: string;
  origin: string | null; destination: string | null; start_km: number | null;
}): Promise<Trip> {
  const created = await pgPost<Trip[]>("/trips", {
    ...input,
    start_at: new Date().toISOString(),
    status: "in_progress",
  });
  return created[0];
}

export async function finishTrip(tripId: string, end_km: number | null, distance_m: number | null): Promise<void> {
  await pgPatch<Trip[]>(`/trips?id=eq.${tripId}`, {
    status: "completed",
    end_at: new Date().toISOString(),
    end_km,
    distance_m,
  });
}

export type GpsPoint = {
  trip_id: string;
  company_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  altitude?: number | null;
  battery_level?: number | null;
  recorded_at: string;
};

export async function pushGpsPoints(points: GpsPoint[]): Promise<void> {
  if (!points.length) return;
  await pgPost("/gps_points", points);
}

export type FuelLog = {
  company_id: string;
  vehicle_id: string;
  driver_id: string | null;
  trip_id: string | null;
  station: string | null;
  liters: number;
  price_per_liter: number;
  total_value: number;
  current_km: number | null;
  notes?: string | null;
};

export async function createFuelLog(input: FuelLog): Promise<void> {
  await pgPost("/fuel_logs", input);
}

export type Occurrence = {
  company_id: string;
  trip_id: string | null;
  driver_id: string;
  vehicle_id: string;
  occurrence_type: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
};

export async function createOccurrence(input: Occurrence): Promise<void> {
  await pgPost("/trip_occurrences", input);
}
