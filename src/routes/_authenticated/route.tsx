import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
  },
  component: AuthedLayout,
});

const DRIVER_PATHS = ["/driver"];

function AuthedLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [isDriverOnly, setIsDriverOnly] = useState(false);
  const [resolved, setResolved] = useState(false);

  // Resolve once per mount: do we have admin/manager role?
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) setResolved(true); return; }
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!mounted) return;
      const roles = (rolesData ?? []).map((r: any) => r.role as string);
      const adminish = roles.includes("admin") || roles.includes("fleet_manager");
      setIsDriverOnly(!adminish);
      setResolved(true);
    })();
    return () => { mounted = false; };
  }, []);

  // Auto-redirect: if the user is a driver-only and lands on an admin route
  // (e.g., from a bookmark or because RoutingAfterLogin sent them wrong),
  // send them to /driver. Respect the user's selected kind from auth.tsx.
  useEffect(() => {
    if (!resolved) return;
    if (!isDriverOnly) return;
    if (DRIVER_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return;
    // Driver landed on an admin path — bounce to /driver.
    navigate({ to: "/driver", replace: true });
  }, [resolved, isDriverOnly, path, navigate]);

  const isDriverApp = isDriverOnly && DRIVER_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isDriverApp) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
