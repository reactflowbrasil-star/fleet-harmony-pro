import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  driver_id: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

/**
 * Creates (or updates the password of) an auth user for an existing driver row
 * and links them via drivers.user_id. Replaces the legacy create-driver-user
 * Edge Function (which was not auto-deployed on this stack).
 *
 * Caller must be admin or fleet_manager in the same company as the driver.
 */
export const createOrUpdateDriverAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const callerId = context.userId;

    // Fetch driver row
    const { data: driverRow, error: driverErr } = await supabaseAdmin
      .from("drivers")
      .select("id, company_id, email, user_id, full_name")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (driverErr) throw new Error(driverErr.message);
    if (!driverRow) throw new Error("Motorista não encontrado");

    // Verify caller is admin/fleet_manager in the same company
    const { data: rolesData } = await supabaseAdmin
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", callerId);
    const isPriv = (rolesData ?? []).some(
      (r: any) =>
        (r.role === "admin" || r.role === "fleet_manager") &&
        (!r.company_id || r.company_id === driverRow.company_id),
    );
    if (!isPriv) throw new Error("Sem permissão para criar acesso de motorista");

    const email = data.email.toLowerCase();
    let userId: string | null = driverRow.user_id ?? null;

    if (!userId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: driverRow.full_name, driver_id: driverRow.id, kind: "driver" },
      });
      if (createErr) {
        // User likely already exists — find by email and reset password
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!existing) throw new Error(createErr.message);
        userId = existing.id;
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: data.password,
          email_confirm: true,
        });
        if (updErr) throw new Error(updErr.message);
      } else {
        userId = created.user!.id;
      }
    } else {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
        email,
      });
      if (updErr) throw new Error(updErr.message);
    }

    // Link driver row
    const { error: linkErr } = await supabaseAdmin
      .from("drivers")
      .update({ user_id: userId, email })
      .eq("id", driverRow.id);
    if (linkErr) throw new Error(linkErr.message);

    // Ensure 'driver' role exists for this user
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("role", "driver")
      .maybeSingle();
    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "driver",
        company_id: driverRow.company_id,
      });
    }

    return { ok: true, user_id: userId };
  });
