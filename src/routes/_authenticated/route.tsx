import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
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

function AuthedLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [isDriverOnly, setIsDriverOnly] = useState(false);
  const [resolved, setResolved] = useState(false);

  // Decide once per session whether to chrome-less the driver portal.
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

  // For driver-only users on the /driver route, render a clean, full-screen
  // layout (no admin sidebar) — matches the "app do motorista" experience.
  const isDriverApp = isDriverOnly && (path === "/driver" || path.startsWith("/driver/"));

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
