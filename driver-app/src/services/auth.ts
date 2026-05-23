import { ENV } from "@/config/env";

export type AuthResult = {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
};

export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${ENV.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ENV.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error_description || j.msg || "Falha no login");
  }
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${ENV.SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ENV.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.msg || "Não foi possível enviar o e-mail de recuperação");
  }
}

export async function signOut(token: string): Promise<void> {
  await fetch(`${ENV.SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ENV.SUPABASE_ANON_KEY,
    },
  });
}
