import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, MapPin, Truck, Users, Gauge, Shield } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Truck className="h-5 w-5" />
            </div>
            <span className="font-display text-2xl">FleetGuard</span>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-50" style={{ background: "var(--gradient-emerald)" }} />
        <div className="absolute inset-0 -z-10 bg-background/85" />
        <div className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Plataforma SaaS de gestão de frotas
          </span>
          <h1 className="mt-6 font-display text-6xl leading-[1.05] text-foreground md:text-7xl">
            Sua frota,<br />
            <span className="italic text-primary">sob controle absoluto.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Rastreamento GPS em tempo real, controle de motoristas, abastecimentos, multas e manutenções —
            tudo em uma plataforma elegante e segura.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-90"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Ver recursos
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: MapPin, t: "Rastreio GPS em tempo real", d: "Acompanhe seus veículos no mapa com atualização automática durante as viagens." },
            { icon: Truck, t: "Gestão de veículos", d: "Cadastre, vincule motoristas e controle status, documentos e quilometragem." },
            { icon: Users, t: "App do motorista", d: "Portal mobile para iniciar/finalizar viagens, registrar abastecimentos e ocorrências." },
            { icon: Gauge, t: "Indicadores e relatórios", d: "Dashboard com consumo, custos, alertas de manutenção e documentos vencendo." },
            { icon: Shield, t: "Multi-empresa seguro", d: "Isolamento total de dados por empresa, em conformidade com a LGPD." },
            { icon: ArrowRight, t: "Pronto para escalar", d: "De 5 a milhares de veículos, sem dor de cabeça na infraestrutura." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} FleetGuard. Gestão de frotas profissional.
      </footer>
    </div>
  );
}
