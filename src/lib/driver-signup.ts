import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side fallback for creating a driver auth account when the
 * create-driver-user Edge Function is not deployed.
 *
 * Uses an ISOLATED Supabase client (no persistence) so the admin's current
 * session is NOT replaced by the new driver session.
 *
 * Side-effects:
 * - If the project requires email confirmation, the new user must click the
 *   confirmation link before they can log in.
 * - The drivers.user_id link still has to be set afterwards (we do it from
 *   the calling code using the admin's session).
 */

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export async function clientSideCreateDriverAuth({
  driverId,
  email,
  password,
  fullName,
}: {
  driverId: string;
  email: string;
  password: string;
  fullName?: string | null;
}): Promise<{ user_id: string; needsEmailConfirmation: boolean; linkedUserId: boolean }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY não estão definidas");
  }

  // Isolated client: no localStorage persistence, doesn't touch the admin session.
  const isolated = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await isolated.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName ?? null, driver_id: driverId, kind: "driver" },
      // emailRedirectTo intentionally omitted — driver will use /auth on the same domain
    },
  });
  if (error) throw error;

  // Supabase normally returns user.id. With certain project settings
  // ("Confirm email" required AND obscure-existing-user enabled) the response
  // can have user=null. In that case the account WAS created (or already
  // existed) — we just can't link drivers.user_id from here.
  const userId = data.user?.id ?? data.session?.user?.id ?? null;
  const needsEmailConfirmation = !data.session;

  if (userId) {
    // Link drivers.user_id + ensure 'driver' role exists, using the ADMIN's
    // current session (the main supabase client).
    const { error: linkErr } = await supabase
      .from("drivers")
      .update({ user_id: userId, email })
      .eq("id", driverId);
    if (linkErr) throw linkErr;

    // Try to add the role (RLS may block this — that's OK; admin can add manually).
    await (supabase as any)
      .from("user_roles")
      .insert({ user_id: userId, role: "driver" })
      .then((r: any) => r) // swallow
      .catch(() => { /* ignore */ });
  } else {
    // No user_id returned. Still update drivers.email so the admin can re-link
    // later via the Edge Function. The signup itself succeeded (no error
    // thrown), so we treat this as a partial success.
    await supabase.from("drivers").update({ email }).eq("id", driverId);
  }

  return { user_id: userId ?? "", needsEmailConfirmation, linkedUserId: !!userId };
}
