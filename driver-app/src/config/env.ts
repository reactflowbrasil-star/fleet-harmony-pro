import Constants from "expo-constants";

type AppExtra = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  googleMapsApiKey?: string;
};

const extra: AppExtra = (Constants.expoConfig?.extra ?? {}) as any;

function fromEnv(key: string, fallback?: string): string {
  // Expo no SDK >=50 expõe process.env.EXPO_PUBLIC_*
  return (process.env as any)[`EXPO_PUBLIC_${key}`] ?? fallback ?? "";
}

export const ENV = {
  API_BASE_URL: extra.apiBaseUrl ?? fromEnv("API_BASE_URL"),
  SUPABASE_URL: extra.supabaseUrl ?? fromEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: extra.supabaseAnonKey ?? fromEnv("SUPABASE_ANON_KEY"),
  GOOGLE_MAPS_API_KEY: extra.googleMapsApiKey ?? fromEnv("GOOGLE_MAPS_API_KEY"),
};
