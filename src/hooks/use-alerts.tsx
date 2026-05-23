import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AlertSeverity = "destructive" | "warning" | "info";
export type AlertKind =
  | "gps_lost"
  | "gps_offline"
  | "geofence_enter"
  | "geofence_exit"
  | "speed_excess"
  | "cnh_expiring"
  | "cnh_expired"
  | "maintenance_overdue";

export interface Alert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  occurredAt: string;
  href?: string;
}

const SPEED_LIMIT_KMH = 80;

export function useAlerts() {
  return useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
      const in30s = in30.toISOString().slice(0, 10);
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [trips, positions, geoEvents, drivers, maint, speeders] = await Promise.all([
        supabase
          .from("trips")
          .select("id, vehicle:vehicles(plate), driver:drivers(full_name)")
          .eq("status", "in_progress"),
        (supabase as any)
          .from("current_vehicle_positions")
          .select("vehicle_id, trip_id, last_update")
          .gte("last_update", lastDay),
        (supabase as any)
          .from("geofence_events")
          .select("id, event_type, occurred_at, geofence:geofences(name), vehicle:vehicles(plate)")
          .gte("occurred_at", lastHour)
          .order("occurred_at", { ascending: false })
          .limit(30),
        supabase
          .from("drivers")
          .select("id, full_name, cnh_expiry")
          .not("cnh_expiry", "is", null)
          .lte("cnh_expiry", in30s),
        supabase
          .from("maintenance")
          .select("id, next_date, vehicle:vehicles(plate)")
          .not("next_date", "is", null)
          .lt("next_date", today),
        supabase
          .from("gps_points")
          .select("id, speed, recorded_at, trip:trips(vehicle:vehicles(plate), driver:drivers(full_name))")
          .gte("recorded_at", lastHour)
          .gt("speed", SPEED_LIMIT_KMH / 3.6)
          .order("recorded_at", { ascending: false })
          .limit(20),
      ]);

      const alerts: Alert[] = [];

      // GPS lost (in_progress trip with no fresh position)
      const positionsByTrip = new Map<string, string>();
      (positions.data ?? []).forEach((p: any) => positionsByTrip.set(p.trip_id, p.last_update));
      (trips.data ?? []).forEach((t: any) => {
        const last = positionsByTrip.get(t.id);
        if (!last) {
          alerts.push({
            id: `gps-none-${t.id}`,
            kind: "gps_offline",
            severity: "destructive",
            title: `${t.vehicle?.plate ?? "Veículo"} sem GPS`,
            detail: `Viagem ativa de ${t.driver?.full_name ?? "—"} sem nenhum ponto registrado`,
            occurredAt: now.toISOString(),
            href: `/trips/${t.id}`,
          });
          return;
        }
        const ageMin = (now.getTime() - new Date(last).getTime()) / 60_000;
        if (ageMin > 5) {
          alerts.push({
            id: `gps-offline-${t.id}`,
            kind: "gps_offline",
            severity: "destructive",
            title: `${t.vehicle?.plate ?? "Veículo"} offline há ${Math.round(ageMin)}min`,
            detail: t.driver?.full_name,
            occurredAt: last,
            href: `/trips/${t.id}`,
          });
        } else if (ageMin > 1) {
          alerts.push({
            id: `gps-lost-${t.id}`,
            kind: "gps_lost",
            severity: "warning",
            title: `${t.vehicle?.plate ?? "Veículo"} sem sinal recente`,
            detail: `Última atualização há ${Math.round(ageMin)}min`,
            occurredAt: last,
            href: `/trips/${t.id}`,
          });
        }
      });

      // Geofence events (recent)
      (geoEvents.data ?? []).forEach((e: any) => {
        alerts.push({
          id: `geo-${e.id}`,
          kind: e.event_type === "enter" ? "geofence_enter" : "geofence_exit",
          severity: "info",
          title: `${e.vehicle?.plate ?? "Veículo"} ${e.event_type === "enter" ? "entrou em" : "saiu de"} ${e.geofence?.name ?? "geocerca"}`,
          occurredAt: e.occurred_at,
          href: "/geofences",
        });
      });

      // Speed excess
      (speeders.data ?? []).forEach((s: any) => {
        alerts.push({
          id: `speed-${s.id}`,
          kind: "speed_excess",
          severity: "warning",
          title: `Excesso de velocidade: ${Math.round(Number(s.speed) * 3.6)} km/h`,
          detail: `${s.trip?.vehicle?.plate ?? "—"} · ${s.trip?.driver?.full_name ?? "—"}`,
          occurredAt: s.recorded_at,
        });
      });

      // CNH
      (drivers.data ?? []).forEach((d: any) => {
        const expired = d.cnh_expiry < today;
        alerts.push({
          id: `cnh-${d.id}`,
          kind: expired ? "cnh_expired" : "cnh_expiring",
          severity: expired ? "destructive" : "warning",
          title: `CNH ${expired ? "vencida" : "vencendo"}: ${d.full_name}`,
          detail: `Validade: ${new Date(d.cnh_expiry).toLocaleDateString("pt-BR")}`,
          occurredAt: d.cnh_expiry,
          href: "/drivers",
        });
      });

      // Maintenance overdue
      (maint.data ?? []).forEach((m: any) => {
        alerts.push({
          id: `maint-${m.id}`,
          kind: "maintenance_overdue",
          severity: "destructive",
          title: `Manutenção atrasada: ${m.vehicle?.plate ?? "—"}`,
          detail: `Prevista para ${new Date(m.next_date).toLocaleDateString("pt-BR")}`,
          occurredAt: m.next_date,
          href: "/maintenance",
        });
      });

      return alerts.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    },
    refetchInterval: 60_000,
  });
}
