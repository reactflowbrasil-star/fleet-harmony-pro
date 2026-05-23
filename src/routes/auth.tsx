import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, Loader2, Building2, UserRound, ArrowRight, ShieldCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

type AccountKind = "company" | "driver";
const ROLE_KEY = "frotap-auth-kind";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(100),
  company_name: z.string().trim().min(2, "Informe o nome da empresa").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

/** After login, route to /driver if the user only has the driver role; otherwise /dashboard.
 *  Driver-only users ALWAYS go to /driver regardless of chosen kind to avoid
 *  bouncing them into the admin shell where their RLS-scoped data is empty. */
async function routeAfterLogin(userId: string, chosenKind: AccountKind, navigate: ReturnType<typeof useNavigate>) {
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (rolesData ?? []).map((r: any) => r.role as string);
  const isAdminish = roles.includes("admin") || roles.includes("fleet_manager");

  // Driver-only user → always /driver (the chosen "Empresa" selection is
  // ignored because that user wouldn't be able to use the admin panel).
  if (!isAdminish) {
    navigate({ to: "/driver" });
    return;
  }

  // Admin/manager — respect their explicit choice.
  if (chosenKind === "driver") {
    navigate({ to: "/driver" });
  } else {
    navigate({ to: "/dashboard" });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<AccountKind>(() => {
    if (typeof window === "undefined") return "company";
    return (localStorage.getItem(ROLE_KEY) as AccountKind) || "company";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(ROLE_KEY, kind);
  }, [kind]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.user) return toast.error("Falha no login");
    toast.success("Bem-vindo de volta!");
    await routeAfterLogin(data.user.id, kind, navigate);
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      full_name: fd.get("full_name"),
      company_name: fd.get("company_name"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.full_name, company_name: parsed.data.company_name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
  }

  const isCompany = kind === "company";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Side panel */}
      <aside
        className="hidden flex-col justify-between p-12 lg:flex"
        style={{ background: isCompany ? "var(--gradient-emerald)" : "linear-gradient(135deg,#1a3d2e,#0f1a14)" }}
      >
        <Link to="/" className="flex items-center gap-2 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl">Frotap</span>
        </Link>

        <div className="text-primary-foreground">
          {isCompany ? (
            <>
              <h2 className="font-display text-3xl italic leading-snug sm:text-4xl xl:text-5xl xl:leading-[1.05]">"Controle total<br />da operação."</h2>
              <p className="mt-5 max-w-md text-primary-foreground/85">
                Painel completo com rastreio GPS em tempo real, dashboards executivos, geofencing,
                gestão de motoristas, abastecimentos, multas e manutenções.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-primary-foreground/80">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" /> Multi-empresa com isolamento por LGPD</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" /> Realtime + alertas + geocercas</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" /> Suporte 24/7 no plano Pro</li>
              </ul>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl italic leading-snug sm:text-4xl xl:text-5xl xl:leading-[1.05]">"Do volante<br />à gestão."</h2>
              <p className="mt-5 max-w-md text-primary-foreground/85">
                Toques grandes, fluxo curto, funciona offline. Inicie a viagem, registre abastecimento
                e ocorrências — a gestão recebe tudo em tempo real.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-primary-foreground/80">
                <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-gold" /> Funciona em qualquer celular</li>
                <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-gold" /> GPS ativo só durante a viagem</li>
                <li className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-gold" /> Sincroniza quando volta o sinal</li>
              </ul>
            </>
          )}
        </div>

        <div className="text-xs text-primary-foreground/70">© Frotap · Multi-empresa · LGPD-ready</div>
      </aside>

      {/* Form column */}
      <main className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          {/* mobile brand */}
          <div className="mb-6 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Truck className="h-5 w-5" />
              </div>
              <span className="font-display text-2xl">Frotap</span>
            </Link>
          </div>

          {/* Role chooser */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Quem está acessando?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <RoleChoice
                active={isCompany}
                onClick={() => setKind("company")}
                icon={Building2}
                title="Empresa"
                subtitle="Painel administrativo"
              />
              <RoleChoice
                active={!isCompany}
                onClick={() => setKind("driver")}
                icon={UserRound}
                title="Motorista"
                subtitle="App de viagens"
              />
            </div>
          </div>

          {/* Forms */}
          <div className="mt-7">
            {isCompany ? (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <h1 className="font-display text-3xl">Painel administrativo</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Acesse o painel da sua empresa.</p>
                  <LoginForm loading={loading} onSubmit={handleLogin} ctaLabel="Entrar no painel" />
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <h1 className="font-display text-3xl">Crie sua empresa</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Você será o administrador da conta.</p>
                  <form onSubmit={handleSignup} className="mt-6 space-y-4">
                    <div>
                      <Label htmlFor="signup-name">Seu nome</Label>
                      <Input id="signup-name" name="full_name" required maxLength={100} className="h-11" />
                    </div>
                    <div>
                      <Label htmlFor="signup-company">Nome da empresa</Label>
                      <Input id="signup-company" name="company_name" required maxLength={100} className="h-11" />
                    </div>
                    <div>
                      <Label htmlFor="signup-email">E-mail</Label>
                      <Input id="signup-email" name="email" type="email" required autoComplete="email" className="h-11" />
                    </div>
                    <div>
                      <Label htmlFor="signup-password">Senha</Label>
                      <Input id="signup-password" name="password" type="password" required minLength={6} autoComplete="new-password" className="h-11" />
                    </div>
                    <Button type="submit" className="h-11 w-full" disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Criar conta <ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <div>
                <h1 className="font-display text-3xl">Portal do motorista</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use o e-mail cadastrado pelo gestor da sua empresa.
                </p>
                <LoginForm loading={loading} onSubmit={handleLogin} ctaLabel="Entrar no app" />
                <div className="surface mt-5 border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
                  Ainda não tem acesso? Solicite ao administrador da sua empresa para cadastrar você como motorista
                  e vincular ao seu veículo.
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Ao continuar você concorda com os termos de uso e política de privacidade (LGPD).
          </p>
        </div>
      </main>
    </div>
  );
}

function RoleChoice({
  active, onClick, icon: Icon, title, subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
        active
          ? "border-primary bg-primary/[0.06] shadow-[var(--shadow-card)]"
          : "border-border bg-card hover:border-primary/30 hover:bg-accent",
      )}
    >
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {active && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" aria-hidden />
      )}
    </button>
  );
}

function LoginForm({
  loading, onSubmit, ctaLabel,
}: {
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  ctaLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="login-email">E-mail</Label>
        <Input id="login-email" name="email" type="email" required autoComplete="email" className="h-11" />
      </div>
      <div>
        <Label htmlFor="login-password">Senha</Label>
        <Input id="login-password" name="password" type="password" required autoComplete="current-password" className="h-11" />
      </div>
      <Button type="submit" className="h-11 w-full" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{ctaLabel} <ArrowRight className="ml-2 h-4 w-4" /></>}
      </Button>
    </form>
  );
}
