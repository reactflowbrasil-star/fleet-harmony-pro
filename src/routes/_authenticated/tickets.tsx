import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tickets")({
  component: () => (
    <div className="space-y-6">
      <div><h1 className="font-display text-4xl">Multas</h1></div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Módulo de multas em breve.</p>
      </div>
    </div>
  ),
});
