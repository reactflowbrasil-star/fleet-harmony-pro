import { supabase } from "@/integrations/supabase/client";

export type GpsPayload = {
  trip_id: string;
  company_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
};

const DB_NAME = "fleetguard-gps";
const STORE = "queue";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueGps(p: GpsPayload): Promise<void> {
  await withStore("readwrite", (s) => s.add(p));
}

export async function countQueued(): Promise<number> {
  return withStore("readonly", (s) => s.count());
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const all = await withStore<Array<GpsPayload & { id: number }>>("readonly", (s) => s.getAll() as any);
  if (!all.length) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;
  for (const item of all) {
    const { id, ...payload } = item;
    const { error } = await supabase.from("gps_points").insert(payload);
    if (error) {
      failed++;
      continue;
    }
    flushed++;
    await withStore("readwrite", (s) => s.delete(id));
  }
  return { flushed, failed };
}

export async function sendGps(p: GpsPayload): Promise<{ queued: boolean }> {
  if (!navigator.onLine) {
    await enqueueGps(p);
    return { queued: true };
  }
  const { error } = await supabase.from("gps_points").insert(p);
  if (error) {
    await enqueueGps(p);
    return { queued: true };
  }
  return { queued: false };
}
