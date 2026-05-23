import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { playAlert, showBrowserNotification, vibrate } from "@/lib/notification-sound";

export type AppNotification = {
  id: string;
  company_id: string;
  driver_id: string | null;
  trip_id: string | null;
  type: string;
  title: string;
  message: string | null;
  data: any;
  status: string;
  read_at: string | null;
  created_at: string;
};

interface Ctx {
  notifications: AppNotification[];
  unreadCount: number;
  lastIncoming: AppNotification | null;
  consumeIncoming: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  audioPrimed: boolean;
  setAudioPrimed: (v: boolean) => void;
}

const NotificationsContext = createContext<Ctx | undefined>(undefined);

const SEEN_KEY = "fleetguard-seen-notifications";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function saveSeen(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(s).slice(-100); // cap
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

export function DriverNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(loadSeen());
  const [lastIncoming, setLastIncoming] = useState<AppNotification | null>(null);
  const [audioPrimed, setAudioPrimed] = useState(false);
  const initialLoadedRef = useRef(false);

  // Find my driver row to subscribe by driver_id
  const { data: driver } = useQuery({
    queryKey: ["my-driver-min", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("drivers").select("id").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const driverId = driver?.id ?? null;

  // Load history (driver-scoped if has driver, else company-scoped via RLS)
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", driverId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      let q = (supabase as any).from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      if (driverId) q = q.eq("driver_id", driverId);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as AppNotification[];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // After initial load, mark all existing as "seen" so we only trigger sound for genuinely new ones
  useEffect(() => {
    if (!initialLoadedRef.current && notifications.length > 0) {
      notifications.forEach((n) => seenRef.current.add(n.id));
      saveSeen(seenRef.current);
      initialLoadedRef.current = true;
    } else if (notifications.length === 0 && !initialLoadedRef.current) {
      initialLoadedRef.current = true;
    }
  }, [notifications]);

  // Realtime subscription
  useEffect(() => {
    if (!driverId) return;
    const ch = supabase
      .channel(`notifications-${driverId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `driver_id=eq.${driverId}` },
        (payload) => handleIncoming(payload.new as AppNotification),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `driver_id=eq.${driverId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driverId, qc]);

  const handleIncoming = useCallback((n: AppNotification) => {
    if (!n || !n.id) return;
    if (seenRef.current.has(n.id)) return;
    seenRef.current.add(n.id);
    saveSeen(seenRef.current);

    // Skip alerting on first paint (we already marked everything seen)
    if (!initialLoadedRef.current) {
      return;
    }

    // refresh list
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["my-assigned-trips"] });
    qc.invalidateQueries({ queryKey: ["nav-badges"] });

    // surface
    setLastIncoming(n);

    // sound + vibrate (may fail silently if no user gesture yet)
    try { playAlert(); } catch { /* ignore */ }
    vibrate([200, 80, 200]);

    // browser notification (only fires when permission granted)
    showBrowserNotification(n.title, {
      body: n.message ?? undefined,
      tag: n.id,
      data: { url: n.trip_id ? `/driver` : "/notifications", trip_id: n.trip_id },
    });
  }, [qc]);

  const consumeIncoming = useCallback(() => setLastIncoming(null), []);

  const markRead = useCallback(async (id: string) => {
    try {
      await (supabase as any).rpc("fn_mark_notification_read", { _id: id });
    } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc]);

  const markAllRead = useCallback(async () => {
    try {
      await (supabase as any).rpc("fn_mark_all_notifications_read");
    } catch { /* ignore */ }
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }, [qc]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);

  const value: Ctx = {
    notifications,
    unreadCount,
    lastIncoming,
    consumeIncoming,
    markRead,
    markAllRead,
    audioPrimed,
    setAudioPrimed,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useDriverNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useDriverNotifications must be inside DriverNotificationsProvider");
  return ctx;
}
