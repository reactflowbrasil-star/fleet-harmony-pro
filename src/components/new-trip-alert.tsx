import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Clock, MapPin, Route as RouteIcon } from "lucide-react";
import { useDriverNotifications } from "@/hooks/use-driver-notifications";

export function NewTripAlert() {
  const { lastIncoming, consumeIncoming, markRead } = useDriverNotifications();
  const navigate = useNavigate();
  const open = !!lastIncoming && lastIncoming.type === "new_trip";

  // Auto-dismiss after 25s
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => consumeIncoming(), 25_000);
    return () => clearTimeout(id);
  }, [open, consumeIncoming]);

  if (!open || !lastIncoming) return null;

  const data = (lastIncoming.data ?? {}) as {
    origin?: string;
    destination?: string;
    scheduled_start_at?: string;
    trip_id?: string;
  };
  const start = data.scheduled_start_at
    ? new Date(data.scheduled_start_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null;

  function openTrip() {
    void markRead(lastIncoming!.id);
    consumeIncoming();
    navigate({ to: "/driver" });
  }
  function dismiss() {
    void markRead(lastIncoming!.id);
    consumeIncoming();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] gap-0 p-0 sm:max-w-md">
        <div className="relative overflow-hidden rounded-t-2xl p-4 sm:p-5" style={{ background: "var(--gradient-emerald)" }}>
          <div className="flex items-center gap-3 text-primary-foreground">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Bell className="h-5 w-5" />
              <span className="absolute inset-0 rounded-full ring-2 ring-white/40 animate-ping" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-primary-foreground">
                Nova viagem atribuída
              </DialogTitle>
              <p className="text-xs text-primary-foreground/80">
                Você recebeu uma nova rota agora
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          {lastIncoming.message && (
            <p className="font-display text-xl leading-tight sm:text-2xl">{lastIncoming.message}</p>
          )}

          <div className="space-y-1.5 text-sm">
            {data.origin && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <div className="min-w-0">
                  <div className="text-eyebrow">Origem</div>
                  <div className="truncate">{data.origin}</div>
                </div>
              </div>
            )}
            {data.destination && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <div className="text-eyebrow">Destino</div>
                  <div className="truncate">{data.destination}</div>
                </div>
              </div>
            )}
            {start && (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-eyebrow">Início previsto</div>
                  <div>{start}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
            <Button onClick={dismiss} variant="outline" className="h-11 sm:flex-1">
              Agora não
            </Button>
            <Button onClick={openTrip} className="h-11 sm:flex-1">
              <RouteIcon className="mr-2 h-4 w-4" />Ver detalhes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
