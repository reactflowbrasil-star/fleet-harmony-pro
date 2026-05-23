import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GpsPoint } from "@/services/driverApi";

const KEY = "frotap.gps_queue.v1";

async function read(): Promise<GpsPoint[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as GpsPoint[]) : [];
}
async function write(items: GpsPoint[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export const offlineLocationQueue = {
  async enqueue(p: GpsPoint) {
    const items = await read();
    items.push(p);
    if (items.length > 5000) items.splice(0, items.length - 5000);
    await write(items);
  },
  async size(): Promise<number> {
    return (await read()).length;
  },
  async drain(): Promise<GpsPoint[]> {
    const items = await read();
    await write([]);
    return items;
  },
  async putBack(items: GpsPoint[]) {
    if (!items.length) return;
    const existing = await read();
    await write([...items, ...existing]);
  },
  async clear() {
    await AsyncStorage.removeItem(KEY);
  },
};
