import * as SecureStore from "expo-secure-store";

export const SECURE_KEYS = {
  TOKEN: "frotap.token",
  REFRESH: "frotap.refresh",
  USER: "frotap.user",
} as const;

export async function setSecure(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}
export async function getSecure(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}
export async function removeSecure(key: string) {
  await SecureStore.deleteItemAsync(key);
}
