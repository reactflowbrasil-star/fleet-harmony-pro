// Supabase Edge Function: create-driver-user
// Creates an auth.users account for an existing public.drivers row and links them.
//
// POST /functions/v1/create-driver-user
// Headers: Authorization: Bearer <caller JWT>
// Body: { driver_id: string, email: string, password: string }
//
// Caller must be authenticated and either admin or fleet_manager in the
// same company as the target driver.
//
// Deploy:
//   supabase functions deploy create-driver-user --no-verify-jwt=false
//
// Required project secrets (auto-set by Supabase):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// CORS enabled for browser calls.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Missing Authorization header" });

  let payload: { driver_id?: string; email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const { driver_id, email, password } = payload;
  if (!driver_id || !email || !password) {
    return json(400, { error: "driver_id, email and password are required" });
  }
  if (password.length < 6) return json(400, { error: "Senha precisa ter no mínimo 6 caracteres" });

  // 1) Authenticate caller via their JWT
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) return json(401, { error: "Sessão inválida" });
  const callerId = callerData.user.id;

  // 2) Verify caller is admin or fleet_manager in the SAME company as the driver
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: driverRow, error: driverErr } = await admin
    .from("drivers")
    .select("id, company_id, email, user_id, full_name")
    .eq("id", driver_id)
    .maybeSingle();
  if (driverErr) return json(500, { error: driverErr.message });
  if (!driverRow) return json(404, { error: "Motorista não encontrado" });

  const { data: rolesData } = await admin
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", callerId);
  const callerRoles = (rolesData ?? []) as Array<{ role: string; company_id?: string | null }>;
  const isPriv = callerRoles.some(
    (r) => (r.role === "admin" || r.role === "fleet_manager") &&
           (!r.company_id || r.company_id === driverRow.company_id),
  );
  if (!isPriv) return json(403, { error: "Sem permissão para criar acesso de motorista" });

  // 3) Create or update auth user
  let userId: string | null = driverRow.user_id ?? null;

  if (!userId) {
    // Try create with auto-confirmed email
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: driverRow.full_name, driver_id, kind: "driver" },
    });
    if (createErr) {
      // If user already exists, try to look up by email and just update the password
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) return json(400, { error: createErr.message });
      userId = existing.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (updErr) return json(400, { error: updErr.message });
    } else {
      userId = created.user!.id;
    }
  } else {
    // Already linked → just rotate password
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password, email });
    if (updErr) return json(400, { error: updErr.message });
  }

  // 4) Make sure driver row has user_id + email
  const { error: linkErr } = await admin
    .from("drivers")
    .update({ user_id: userId, email })
    .eq("id", driver_id);
  if (linkErr) return json(500, { error: linkErr.message });

  // 5) Ensure user_role 'driver' exists (so route guards work)
  const { data: existingRole } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "driver")
    .maybeSingle();
  if (!existingRole) {
    await admin.from("user_roles").insert({
      user_id: userId,
      role: "driver",
      company_id: driverRow.company_id,
    });
  }

  return json(200, { ok: true, user_id: userId });
});
