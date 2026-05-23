import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDriverNotifications, type AppNotification } from "@/hooks/use-driver-notifications";
import { Button } from "@/components/ui/button";
import {
  Bell, BellOff, BellRing, Check, Route as RouteIcon, Volume2, AlertTriangle,
  Fuel, Wrench, CheckCircle2,
} from "lucide-react";
import {
  playAlert, primeAudio, requestNotificationPermission, showBrowserNotification,
} from "@/lib/notification-sound";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const typeMeta: Record<string, { icon: any; color: string; label: string }> = {
  new_trip:        { icon: RouteIcon,    color: "text-primary",    label: "Nova viagem" },
  trip_updated:    { icon: RouteIcon,    color: "text-primary",    label: "Viagem atualizada" },
  trip_cancelled:  { icon: RouteIcon,    color: "text-destructive", label: "Viagem cancelada" },
  route_changed:   { icon: RouteIcon,    color: "text-warning",    label: "Rota alterada" },
  document_alert:  { icon: AlertTriangle, color: "text-warning",   label: "Documento" },
  fuel_approved:   { icon: Fuel,         color: "text-success",    label: "Abastecimento aprovado" },
  fuel_rejected:   { icon: Fuel,         color: "text-destructive", label: "Abastecimento rejeitado" },
  maintenance_due: { icon: Wrench,       color: "text-warning",    label: "Manutenção" },
  ticket_added:    { icon: AlertTriangle, color: "text-destructive", label: "Multa" },
  general_alert:   { icon: Bell,         color: "text-foreground",  label: "Alerta" },
};

function relativeTime(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.round(s / 60)}min`;
  if (s < 86400) return `há ${Math.round(s / 3600)}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function NotificationsPage() {
  const { notifications, unreadCount, markRead, markAllRead } = useDriverNotifications();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function askPermission() {
    primeAudio();
    const p = await requestNotificationPermission();
    setPermission(p);
    if (p === "granted") {
      playAlert();
      showBrowserNotification("Notificações ativadas", { body: "Você receberá alertas de novas viagens." });
      toast.success("Notificações ativadas");
    } else if (p === "denied") {
      toast.error("Você bloqueou as notificações. Habilite nas configurações do navegador.");
    }
  }

  function testSound() {
    primeAudio();
    playAlert();
  }

  const grouped = useMemo(() => {
    const today: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const t = startToday.getTime();
    notifications.forEach((n) => {
      if (new Date(n.created_at).getTime() >= t) today.push(n);
      else earlier.push(n);
    });
    return { today, earlier };
  }, [notifications]);

  function openNotification(n: AppNotification) {
    void markRead(n.id);
    if (n.trip_id) navigate({ to: "/driver" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Notificações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount === 0 ? "Tudo em dia." : `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={testSound}>
            <Volume2 className="mr-2 h-4 w-4" />Testar som
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" onClick={() => { void markAllRead(); }}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Marcar todas como lidas
            </Button>
          )}
        </div>
      </header>

      {permission !== "granted" && permission !== "unsupported" && (
        <div className="surface flex flex-wrap items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <BellRing className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Receber alertas mesmo com a aba em segundo plano</p>
            <p className="text-xs text-muted-foreground">
              Permita notificações para ouvir o alerta sonoro e ver avisos do sistema quando uma nova viagem chegar.
            </p>
          </div>
          <Button size="sm" onClick={askPermission}>
            <Bell className="mr-2 h-4 w-4" />Permitir notificações
          </Button>
        </div>
      )}

      {permission === "unsupported" && (
        <div className="surface flex items-center gap-3 border-warning/30 bg-warning/5 p-4 text-sm">
          <BellOff className="h-5 w-5 text-warning" />
          <span>Seu navegador não suporta notificações do sistema. O alerta interno continua funcionando.</span>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="surface border-dashed p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
        </div>
      ) : (
        <>
          {grouped.today.length > 0 && (
            <Section title="Hoje">
              {grouped.today.map((n) => (
                <NotificationItem key={n.id} n={n} now={now} onOpen={openNotification} onMarkRead={markRead} />
              ))}
            </Section>
          )}
          {grouped.earlier.length > 0 && (
            <Section title="Anteriores">
              {grouped.earlier.map((n) => (
                <NotificationItem key={n.id} n={n} now={now} onOpen={openNotification} onMarkRead={markRead} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-eyebrow">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function NotificationItem({
  n, now, onOpen, onMarkRead,
}: {
  n: AppNotification;
  now: number;
  onOpen: (n: AppNotification) => void;
  onMarkRead: (id: string) => Promise<void>;
}) {
  const meta = typeMeta[n.type] ?? typeMeta.general_alert;
  const Icon = meta.icon;
  const unread = !n.read_at;
  const data = (n.data ?? {}) as { origin?: string; destination?: string; scheduled_start_at?: string };

  return (
    <div
      className={`surface group relative flex items-start gap-3 p-4 transition-colors ${unread ? "border-primary/30 bg-primary/[0.03]" : ""}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card border border-border ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <button onClick={() => onOpen(n)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{n.title}</p>
          {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        {n.message && <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.message}</p>}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{meta.label}</span>
          <span>·</span>
          <span>{relativeTime(n.created_at, now)}</span>
          {data.origin && data.destination && (
            <>
              <span>·</span>
              <span className="truncate">{data.origin} → {data.destination}</span>
            </>
          )}
        </div>
      </button>
      {unread && (
        <button
          onClick={() => void onMarkRead(n.id)}
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          title="Marcar como lida"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
