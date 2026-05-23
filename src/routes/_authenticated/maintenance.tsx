import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/maintenance")({
  component: () => (
    <div className="space-y-6">
      <div><h1 className="font-display text-4xl">Manutenções</h1></div>
      <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Wrench className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Módulo de manutenções em breve.</p>
      </div>
    </div>
  ),
});
