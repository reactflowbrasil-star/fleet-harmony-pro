import axios, { type AxiosInstance } from "axios";
import { ENV } from "@/config/env";
import { getSecure, removeSecure, SECURE_KEYS } from "@/storage/secure";

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

export const api: AxiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL || ENV.SUPABASE_URL + "/rest/v1",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (cfg) => {
  const token = await getSecure(SECURE_KEYS.TOKEN);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  if (ENV.SUPABASE_ANON_KEY) cfg.headers.apikey = ENV.SUPABASE_ANON_KEY;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err?.response?.status === 401) {
      await removeSecure(SECURE_KEYS.TOKEN);
      await removeSecure(SECURE_KEYS.REFRESH);
      unauthorizedHandler?.();
    }
    return Promise.reject(err);
  },
);
