import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight, MapPin, Truck, Users, Gauge, Shield, Check, Fuel, AlertTriangle, Wrench,
  Smartphone, Sparkles, BarChart3, Bell, Lock, Zap, ChevronDown, Play, TrendingUp,
  Clock, Receipt, FileCheck, Star, ArrowUpRight,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { Reveal } from "@/components/reveal";
import { useCounter, useReveal } from "@/hooks/use-reveal";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Nav />
      <Hero />
      <LogoMarquee />
      <Stats />
      <Features />
      <DashboardPreview />
      <HowItWorks />
      <DriverApp />
      <Testimonials />
      <Pricing />
      <Faq />
      <CtaFinal />
      <Footer />
    </div>
  );
}

/* ============ NAV ============ */
function Nav() {
  return (
    <header className="glass-bar sticky top-0 z-50 border-b border-border/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gold-foreground shadow-[0_8px_24px_-8px_oklch(0.78_0.13_85_/_0.5)]"
            style={{ background: "var(--gradient-gold)" }}
          >
            <Truck className="h-4 w-4" />
          </div>
          <span className="font-display text-xl leading-none">FleetGuard</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Recursos</a>
          <a href="#preview" className="hover:text-foreground">Plataforma</a>
          <a href="#pricing" className="hover:text-foreground">Planos</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
            Entrar
          </Link>
          <Link
            to="/auth"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:shadow-[var(--shadow-elegant)] sm:px-4"
          >
            Começar grátis
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============ HERO ============ */
function Hero() {
  return (
    <section id="top" className="bg-aurora relative overflow-hidden">
      <div className="bg-grid absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:pb-32 lg:pt-24">
        <div className="lg:col-span-6">
          <Reveal variant="up">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-foreground/80">
              <span className="relative h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-success" />
                <span className="pulse-dot absolute inset-0 rounded-full text-success" />
              </span>
              Plataforma SaaS · LGPD-ready · Multi-empresa
            </span>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <h1 className="mt-6 font-display text-[clamp(2.5rem,6vw+0.5rem,4.75rem)] leading-[1.02] tracking-tight">
              Sua frota,<br />
              <span className="italic text-gradient">sob controle absoluto.</span>
            </h1>
          </Reveal>
          <Reveal variant="up" delay={240}>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Rastreamento GPS ao vivo, controle de motoristas, abastecimentos, multas e manutenções —
              em uma plataforma rápida, elegante e pensada para mobile.
            </p>
          </Reveal>
          <Reveal variant="up" delay={360}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:-translate-y-0.5"
              >
                <span className="relative z-10">Começar grátis · 14 dias</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                <span className="absolute inset-0 z-0 shimmer opacity-40" />
              </Link>
              <a
                href="#preview"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent"
              >
                <Play className="h-4 w-4 text-primary" /> Ver a plataforma
              </a>
            </div>
          </Reveal>
          <Reveal variant="fade" delay={520}>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Sem cartão de crédito</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Setup em 5 minutos</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Cancele quando quiser</span>
            </div>
          </Reveal>
        </div>

        <div className="relative lg:col-span-6">
          <Reveal variant="scale" delay={200} duration={900}>
            <HeroMockup />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  const series = Array.from({ length: 20 }).map((_, i) => ({
    x: i,
    v: 22 + Math.sin(i / 2.4) * 8 + (i % 5),
  }));

  return (
    <div className="relative">
      <div
        className="absolute -inset-6 rounded-[2rem] opacity-30 blur-2xl"
        style={{ background: "var(--gradient-emerald)" }}
        aria-hidden
      />
      <div className="surface-elevated relative overflow-hidden rounded-2xl">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <span className="ml-3 truncate font-mono text-[11px] text-muted-foreground">app.fleetguard.com/dashboard</span>
        </div>

        <div className="grid gap-3 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Veículos" value="142" tone="primary" />
            <MiniStat label="Em rota" value="38" tone="gold" />
            <MiniStat label="Alertas" value="3" tone="warning" />
          </div>

          <div className="surface relative overflow-hidden p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Combustível · 30d</p>
                <p className="font-display text-lg leading-none">R$ 18.420</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                <TrendingUp className="h-3 w-3" /> -12%
              </span>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2} fill="url(#heroGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Frota em rota</p>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-success" />
                  <span className="pulse-dot absolute inset-0 rounded-full text-success" />
                </span>
                ao vivo
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { plate: "RBV-2A45", driver: "Carlos Silva", km: "42 km", status: "Em rota" },
                { plate: "QFG-9B82", driver: "Marina Costa", km: "18 km", status: "Em rota" },
                { plate: "LMP-3X11", driver: "João Almeida", km: "—", status: "Parado" },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Truck className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-none">{r.plate}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{r.driver}</p>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{r.km}</span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                    r.status === "Em rota" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                  )}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FloatingBadge top="-top-3" right="-right-3" delay={400}>
        <Bell className="h-3.5 w-3.5 text-warning" /> CNH vence em 7 dias
      </FloatingBadge>
      <FloatingBadge bottom="-bottom-3" left="-left-3" delay={700}>
        <Sparkles className="h-3.5 w-3.5 text-gold" /> Economia de R$ 4.2k/mês
      </FloatingBadge>
    </div>
  );
}

function FloatingBadge({
  children, top, bottom, left, right, delay = 0,
}: { children: React.ReactNode; top?: string; bottom?: string; left?: string; right?: string; delay?: number }) {
  return (
    <div
      className={cn(
        "float-slow surface absolute hidden items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-pop)] sm:inline-flex",
        top, bottom, left, right,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "primary" | "gold" | "warning" }) {
  const toneClass = tone === "primary" ? "text-primary" : tone === "gold" ? "text-gold" : "text-warning";
  return (
    <div className="surface p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-display text-2xl leading-none", toneClass)}>{value}</p>
    </div>
  );
}

/* ============ LOGO MARQUEE ============ */
function LogoMarquee() {
  const items = ["TransLog", "MovFrota", "RotaPlus", "EcoMobil", "FleetX", "RodaBR", "Carbo Express", "BR-Cargo"];
  return (
    <section className="border-y border-border bg-card/40 py-6">
      <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Operações que confiam no FleetGuard
      </p>
      <div className="marquee">
        <div className="marquee-track">
          {[...items, ...items].map((name, i) => (
            <div key={i} className="flex items-center gap-2 px-2 font-display text-2xl text-muted-foreground/70 transition-colors hover:text-foreground">
              <Truck className="h-4 w-4 opacity-60" />
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ STATS ============ */
function Stats() {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const items = [
    { value: 8400, suffix: "+", label: "Veículos gerenciados" },
    { value: 23, suffix: "%", label: "Redução média de custo" },
    { value: 99.97, suffix: "%", label: "Uptime de plataforma", decimals: 2 },
    { value: 3.2, suffix: "M", label: "Km rastreados/mês", decimals: 1 },
  ];
  return (
    <section ref={ref} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {items.map((it, i) => (
          <StatTile key={i} {...it} start={revealed} delay={i * 120} />
        ))}
      </div>
    </section>
  );
}
function StatTile({
  value, suffix, label, start, delay, decimals = 0,
}: { value: number; suffix?: string; label: string; start: boolean; delay: number; decimals?: number }) {
  const factor = Math.pow(10, decimals);
  const counted = useCounter(Math.round(value * factor), { start, duration: 1600 + delay });
  const display = (counted / factor).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <Reveal variant="up" delay={delay} className="surface p-5 text-center sm:p-6">
      <p className="font-display text-[clamp(2rem,4vw+0.5rem,3.5rem)] leading-none tracking-tight text-gradient">
        {display}{suffix}
      </p>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    </Reveal>
  );
}

/* ============ FEATURES ============ */
function Features() {
  const features = [
    { icon: MapPin, title: "Rastreio GPS ao vivo", desc: "Veja sua frota em movimento no mapa, com histórico, geofencing e relatório de paradas.", tag: "Real-time" },
    { icon: Truck, title: "Gestão de veículos", desc: "Documentos, quilometragem, vínculo com motoristas e ciclo de vida completo.", tag: "Cadastro" },
    { icon: Users, title: "App do motorista", desc: "Portal mobile para iniciar viagens, registrar abastecimentos e ocorrências.", tag: "Mobile" },
    { icon: Fuel, title: "Aprovação de abastecimento", desc: "Fluxo de aprovação, controle de R$/litro, posto e consumo por veículo.", tag: "Combustível" },
    { icon: AlertTriangle, title: "Multas centralizadas", desc: "Lance, recorra e pague. Acompanhe pontos por motorista e vencimentos.", tag: "Compliance" },
    { icon: Wrench, title: "Manutenção preditiva", desc: "Agendamento por km/data, histórico de oficinas e alertas automáticos.", tag: "Operação" },
    { icon: BarChart3, title: "Dashboards executivos", desc: "Custo por km, consumo, ocupação, ROI por veículo — atualizados em tempo real.", tag: "BI" },
    { icon: Shield, title: "Multi-empresa & LGPD", desc: "Isolamento total entre empresas, RLS no banco, conformidade ponta a ponta.", tag: "Segurança" },
    { icon: Zap, title: "Setup em minutos", desc: "Importe sua planilha, conecte seus motoristas e comece em menos de 1 hora.", tag: "Onboarding" },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Recursos</p>
          <h2 className="mt-3 font-display text-[clamp(2rem,3.5vw+0.5rem,3rem)] tracking-tight">
            Tudo o que sua frota precisa,<br /><span className="italic text-gradient">em um só lugar.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Da operação no caminhão à decisão no escritório — cobertura completa, sem planilhas paralelas.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title} variant="up" delay={(i % 3) * 100}>
            <article className="surface group relative h-full overflow-hidden p-5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-pop)] sm:p-6">
              <div
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-60"
                style={{ background: "var(--gradient-emerald)" }}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {f.tag}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl leading-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ DASHBOARD PREVIEW ============ */
function DashboardPreview() {
  const consumption = [
    { d: "Seg", val: 320 }, { d: "Ter", val: 410 }, { d: "Qua", val: 380 }, { d: "Qui", val: 460 },
    { d: "Sex", val: 520 }, { d: "Sáb", val: 290 }, { d: "Dom", val: 180 },
  ];
  const radial = [{ name: "ocupação", value: 78, fill: "var(--primary)" }];

  return (
    <section id="preview" className="relative overflow-hidden border-y border-border bg-gradient-to-b from-card/40 to-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Plataforma</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,3.5vw+0.5rem,3rem)] tracking-tight">
              Dados claros,<br /><span className="italic text-gradient">decisões rápidas.</span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Indicadores executivos que respondem à pergunta certa antes de você precisar perguntar.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <Reveal variant="up" className="lg:col-span-2">
            <div className="surface p-5 sm:p-6">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Consumo semanal</p>
                  <p className="mt-1 font-display text-3xl leading-none">R$ 2.560<span className="ml-2 text-sm font-normal text-success">+8% vs semana anterior</span></p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Aprovados
                </span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={consumption} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, boxShadow: "var(--shadow-pop)" }}
                      formatter={(v: any) => [`R$ ${v}`, "Gasto"]}
                    />
                    <Bar dataKey="val" radius={[8, 8, 0, 0]} fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Reveal>

          <Reveal variant="up" delay={120}>
            <div className="surface flex h-full flex-col p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ocupação da frota</p>
              <div className="relative my-2 flex flex-1 items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} data={radial}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--muted)" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-display text-4xl leading-none text-gradient">78%</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">em operação</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <div><p className="font-display text-lg">142</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frota</p></div>
                <div><p className="font-display text-lg text-success">112</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ativos</p></div>
                <div><p className="font-display text-lg text-warning">7</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Manut.</p></div>
              </div>
            </div>
          </Reveal>

          <Reveal variant="up" delay={200} className="lg:col-span-3">
            <div className="surface grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
              {[
                { icon: Clock, t: "Tempo médio em rota", v: "4h 12min", d: "-18 min vs mês anterior" },
                { icon: Receipt, t: "Custo por km", v: "R$ 0,84", d: "Meta: R$ 0,90" },
                { icon: FileCheck, t: "CNHs em dia", v: "96%", d: "5 vencendo em 30d" },
              ].map((k, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <k.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{k.t}</p>
                    <p className="font-display text-2xl leading-none">{k.v}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{k.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============ HOW IT WORKS ============ */
function HowItWorks() {
  const steps = [
    { n: "01", t: "Crie sua conta", d: "Cadastro em 2 minutos, sem cartão de crédito." },
    { n: "02", t: "Importe sua frota", d: "Cadastre veículos e motoristas — ou suba uma planilha." },
    { n: "03", t: "Comece a operar", d: "Motoristas no app, gestão no painel, decisões com dados." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Como funciona</p>
          <h2 className="mt-3 font-display text-[clamp(2rem,3.5vw+0.5rem,3rem)] tracking-tight">
            Do zero ao primeiro insight<br /><span className="italic text-gradient">em menos de 1 hora.</span>
          </h2>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} variant="up" delay={i * 140}>
            <div className="surface relative h-full overflow-hidden p-6">
              <span className="absolute -right-2 -top-4 font-display text-[5rem] leading-none text-primary/10 select-none">{s.n}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <span className="text-sm font-bold">{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-xl">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ DRIVER APP ============ */
function DriverApp() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-gradient-to-b from-background via-card/30 to-background py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Portal motorista</p>
            <h2 className="mt-3 font-display text-[clamp(1.875rem,3.5vw+0.5rem,3rem)] tracking-tight">
              Um app pensado para quem está <span className="italic text-gradient">na estrada.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Toque grande, fluxos curtos, funciona offline. O motorista cuida da operação; você recebe os dados.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Iniciar e finalizar viagens com 1 toque",
                "Registrar abastecimento com foto do cupom",
                "Alertas de CNH, IPVA e manutenção",
                "Funciona offline — sincroniza quando volta o sinal",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="h-3 w-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="relative flex justify-center lg:col-span-6">
          <Reveal variant="scale" delay={200} duration={900}>
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-[3rem] opacity-30 blur-2xl"
                style={{ background: "var(--gradient-gold)" }}
                aria-hidden
              />
              <div className="relative h-[520px] w-[260px] rounded-[2.5rem] border-[10px] border-foreground/90 bg-foreground/90 p-2 shadow-[0_30px_60px_-20px_oklch(0_0_0/0.3)]">
                <div className="relative h-full w-full overflow-hidden rounded-[1.6rem] bg-background">
                  <div className="absolute inset-x-0 top-0 z-10 mx-auto h-6 w-28 rounded-b-2xl bg-foreground/90" />
                  <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between p-4 pt-8">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Boa tarde</p>
                        <p className="font-display text-lg leading-none">Carlos S.</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/15 text-gold text-xs font-semibold">CS</div>
                    </div>
                    <div className="mx-4 surface p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Viagem atual</p>
                      <p className="mt-1 font-display text-2xl leading-none">SP → Campinas</p>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 text-success"><span className="relative inline-flex h-1.5 w-1.5"><span className="absolute inset-0 rounded-full bg-success" /><span className="pulse-dot absolute inset-0 rounded-full text-success" /></span> em rota</span>
                        <span className="tabular-nums text-muted-foreground">42 km · 38 min</span>
                      </div>
                    </div>
                    <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
                      <button className="surface flex flex-col items-center gap-1 p-3 text-xs">
                        <Fuel className="h-5 w-5 text-primary" /> Abastecer
                      </button>
                      <button className="surface flex flex-col items-center gap-1 p-3 text-xs">
                        <AlertTriangle className="h-5 w-5 text-warning" /> Ocorrência
                      </button>
                    </div>
                    <div className="mx-4 mt-auto mb-6 rounded-xl bg-primary p-3 text-center text-primary-foreground">
                      <p className="text-xs opacity-80">Próxima parada</p>
                      <p className="font-display text-base leading-tight">Posto Trevo · 18km</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============ TESTIMONIALS ============ */
function Testimonials() {
  const items = [
    { name: "Marcos Pereira", role: "Diretor de Operações · TransLog", text: "Cortamos 18% do custo de combustível em 3 meses. O ROI veio antes do trimestre fechar." },
    { name: "Renata Lopes", role: "Gestora de Frota · MovFrota", text: "Os motoristas adotaram o app no primeiro dia. Adeus, planilhas de Excel." },
    { name: "Carlos Oliveira", role: "CEO · BR-Cargo", text: "O nível de dashboards e a velocidade do produto colocam a FleetGuard num patamar diferente." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Quem usa, recomenda</p>
          <h2 className="mt-3 font-display text-[clamp(2rem,3.5vw+0.5rem,3rem)] tracking-tight">
            <span className="italic text-gradient">Histórias reais</span> de quem decidiu mudar.
          </h2>
        </Reveal>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((t, i) => (
          <Reveal key={t.name} variant="up" delay={i * 120}>
            <article className="surface flex h-full flex-col p-6">
              <div className="flex gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                  {t.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{t.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ PRICING ============ */
function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "R$ 49",
      per: "/veículo/mês",
      desc: "Para frotas começando a profissionalizar a gestão.",
      cta: "Começar grátis",
      features: ["Até 10 veículos", "Rastreio GPS", "App do motorista", "Multas e manutenções", "Suporte por e-mail"],
    },
    {
      name: "Pro",
      price: "R$ 39",
      per: "/veículo/mês",
      desc: "Para operações que precisam de BI e automações.",
      cta: "Falar com vendas",
      featured: true,
      features: ["Veículos ilimitados", "Tudo do Starter", "Dashboards executivos", "Aprovações multinível", "Integrações (API + webhooks)", "Suporte prioritário 24/7"],
    },
    {
      name: "Enterprise",
      price: "Sob consulta",
      per: "",
      desc: "Para grandes operações com requisitos próprios.",
      cta: "Agendar demo",
      features: ["Tudo do Pro", "SSO / SAML", "SLA dedicado", "Hospedagem dedicada", "Onboarding com CSM", "Roadmap conjunto"],
    },
  ];
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Planos</p>
          <h2 className="mt-3 font-display text-[clamp(2rem,3.5vw+0.5rem,3rem)] tracking-tight">
            Preço transparente, <span className="italic text-gradient">sem surpresas.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground">Comece grátis por 14 dias. Cancele quando quiser, sem multa.</p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.name} variant="up" delay={i * 100}>
            <article
              className={cn(
                "surface relative flex h-full flex-col p-6 transition-all hover:-translate-y-1 sm:p-7",
                p.featured && "border-primary/50 shadow-[var(--shadow-elegant)] lg:scale-[1.03]",
              )}
            >
              {p.featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-foreground shadow">
                  <Sparkles className="h-3 w-3" /> Mais escolhido
                </span>
              )}
              <h3 className="font-display text-2xl">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl leading-none">{p.price}</span>
                {p.per && <span className="text-sm text-muted-foreground">{p.per}</span>}
              </div>
              <Link
                to="/auth"
                className={cn(
                  "mt-5 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all",
                  p.featured
                    ? "bg-primary text-primary-foreground hover:shadow-[var(--shadow-elegant)]"
                    : "border border-border bg-background hover:bg-accent",
                )}
              >
                {p.cta} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <ul className="mt-6 space-y-2.5 border-t border-border pt-5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", p.featured ? "text-gold" : "text-success")} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============ FAQ ============ */
function Faq() {
  const faqs = [
    { q: "Como funciona o teste grátis?", a: "Você cadastra sua empresa e tem 14 dias com todos os recursos do plano Pro. Sem cartão de crédito, sem amarras. Após o período, escolhe o plano que combina com sua operação." },
    { q: "Preciso instalar hardware nos veículos?", a: "Não obrigatoriamente. O app do motorista usa o GPS do celular. Para frotas mais críticas, somos compatíveis com rastreadores OBD e telemetria via API." },
    { q: "É seguro para minha empresa?", a: "Sim. Multi-empresa com isolamento total no banco (RLS), criptografia em trânsito e em repouso, conformidade com LGPD e logs de auditoria." },
    { q: "Consigo importar a planilha que já tenho?", a: "Sim. Suportamos importação de veículos, motoristas e histórico via CSV. Nossa equipe ajuda na primeira migração." },
    { q: "Existe app iOS e Android?", a: "Sim, o portal do motorista funciona como Progressive Web App — instala via navegador, funciona offline e atualiza automaticamente." },
    { q: "E se eu precisar cancelar?", a: "Sem fidelidade. Você cancela com 1 clique e mantém o acesso até o fim do período já pago. Seus dados podem ser exportados a qualquer momento." },
  ];
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <div className="text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Perguntas frequentes</p>
          <h2 className="mt-3 font-display text-[clamp(2rem,3.5vw+0.5rem,3rem)] tracking-tight">
            Ainda em dúvida? <span className="italic text-gradient">A gente responde.</span>
          </h2>
        </Reveal>
      </div>
      <Reveal variant="up" delay={120}>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="surface my-2 overflow-hidden border-none px-5 transition-colors data-[state=open]:border-primary/30">
              <AccordionTrigger className="py-4 text-left font-medium hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}

/* ============ CTA FINAL ============ */
function CtaFinal() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
      <Reveal variant="scale">
        <div
          className="relative overflow-hidden rounded-3xl p-10 text-center text-primary-foreground shadow-[var(--shadow-elegant)] sm:p-16"
          style={{ background: "var(--gradient-emerald)" }}
        >
          <div className="bg-grid absolute inset-0 opacity-10" />
          <div className="relative">
            <Sparkles className="mx-auto h-7 w-7 text-gold" />
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw+0.5rem,3.5rem)] leading-[1.05]">
              Pronto para tomar o controle da sua frota?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base opacity-90">
              14 dias grátis, sem cartão de crédito. Em menos de 1 hora você está operando.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-gold-foreground shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Começar grátis agora
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#pricing"
                className="rounded-xl border border-primary-foreground/30 bg-primary-foreground/5 px-6 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-primary-foreground/10"
              >
                Ver planos
              </a>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs opacity-80">
              <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> LGPD-ready</span>
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> 99.97% uptime</span>
              <span className="inline-flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> iOS + Android</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  return (
    <footer className="border-t border-border bg-card/30 py-12">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gold-foreground"
              style={{ background: "var(--gradient-gold)" }}
            >
              <Truck className="h-4 w-4" />
            </div>
            <span className="font-display text-xl">FleetGuard</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Gestão de frotas profissional para empresas que valorizam dados e operação enxuta.
          </p>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Produto</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><a href="#features" className="hover:text-foreground text-muted-foreground">Recursos</a></li>
            <li><a href="#preview" className="hover:text-foreground text-muted-foreground">Plataforma</a></li>
            <li><a href="#pricing" className="hover:text-foreground text-muted-foreground">Planos</a></li>
            <li><Link to="/auth" className="hover:text-foreground text-muted-foreground">Entrar</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Empresa</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><span className="text-muted-foreground">Sobre</span></li>
            <li><span className="text-muted-foreground">Blog</span></li>
            <li><span className="text-muted-foreground">Carreiras</span></li>
            <li><span className="text-muted-foreground">Contato</span></li>
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Legal</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><span className="text-muted-foreground">Termos de uso</span></li>
            <li><span className="text-muted-foreground">Privacidade</span></li>
            <li><span className="text-muted-foreground">LGPD</span></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-border px-4 pt-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} FleetGuard. Todos os direitos reservados.</p>
        <p className="inline-flex items-center gap-2">
          <span className="relative inline-flex h-2 w-2"><span className="absolute inset-0 rounded-full bg-success" /><span className="pulse-dot absolute inset-0 rounded-full text-success" /></span>
          Todos os sistemas operacionais
        </p>
      </div>
    </footer>
  );
}

// silence eslint for unused dynamic icons
void [ChevronDown];
