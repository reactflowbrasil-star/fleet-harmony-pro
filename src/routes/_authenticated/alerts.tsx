import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAlerts, type Alert, type AlertSeverity, type AlertKind } from "@/hooks/use-alerts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, WifiOff, Signal, LogIn, LogOut, Gauge, IdCard, Wrench, BellOff, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsPage,
});

const kindIcon: Record<AlertKind, any> = {
  gps_offline: WifiOff,
  gps_lost: Signal,
  geofence_enter: LogIn,
  geofence_exit: LogOut,
  speed_excess: Gauge,
  cnh_expiring: IdCard,
  cnh_expired: IdCard,
  maintenance_overdue: Wrench,
};

const severityClasses: Record<AlertSeverity, string> = {
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  info: "bg-primary/10 text-primary border-primary/30",
};

const severityLabel: Record<AlertSeverity, string> = {
  destructive: "Crítico",
  warning: "Atenção",
  info: "Informação",
};

const FILTERS: { value: "all" | AlertSeverity; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "destructive", label: "Críticos" },
  { value: "warning", label: "Atenção" },
  { value: "info", label: "Informação" },
];

function AlertsPage() {
  const { data: alerts, isLoading } = useAlerts();
  const [filter, setFilter] = useState<"all" | AlertSeverity>("all");

  const filtered = useMemo(() => {
    if (!alerts) return [];
    return filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);
  }, [alerts, filter]);

  const counts = useMemo(() => {
    const c: Record<AlertSeverity | "all", number> = { all: 0, destructive: 0, warning: 0, info: 0 };
    (alerts ?? []).forEach((a) => { c.all++; c[a.severity]++; });
    return c;
  }, [alerts]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Alertas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {alerts?.length ?? 0} alerta{alerts?.length === 1 ? "" : "s"} ativo{alerts?.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
              filter === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-accent",
            )}
          >
            {f.label}
            <span className={cn("tabular-nums", filter === f.value ? "opacity-80" : "text-muted-foreground")}>
              {counts[f.value]}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface p-4"><Skeleton className="h-16 w-full" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface border-dashed p-12 text-center">
          <BellOff className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Sem alertas {filter !== "all" ? "neste filtro" : "no momento"}. Tudo certo!</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => <AlertRow key={a.id} alert={a} />)}
        </ul>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const Icon = kindIcon[alert.kind] ?? AlertTriangle;
  const content = (
    <article className="surface group flex items-start gap-3 p-3 transition-colors hover:border-primary/30 active:border-primary/30 sm:items-center sm:p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", severityClasses[alert.severity])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight sm:truncate">{alert.title}</p>
        {alert.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{alert.detail}</p>}
        <p className="mt-1 text-[10px] text-muted-foreground sm:hidden">
          {new Date(alert.occurredAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <span className={cn(
          "inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold",
          severityClasses[alert.severity],
        )}>
          {severityLabel[alert.severity]}
        </span>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Date(alert.occurredAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {alert.href && <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
    </article>
  );
  if (alert.href) return <li><Link to={alert.href}>{content}</Link></li>;
  return <li>{content}</li>;
}
