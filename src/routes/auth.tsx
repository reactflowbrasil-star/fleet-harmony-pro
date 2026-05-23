import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

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

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 lg:flex" style={{ background: "var(--gradient-emerald)" }}>
        <div className="flex items-center gap-2 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl">FleetGuard</span>
        </div>
        <div className="text-primary-foreground">
          <h2 className="font-display text-5xl italic">"Controle total da operação."</h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Gestão completa de frotas com rastreio GPS, app para motoristas e isolamento de dados por empresa.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/70">© FleetGuard · Multi-empresa · LGPD</div>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Truck className="h-5 w-5" />
              </div>
              <span className="font-display text-2xl">FleetGuard</span>
            </div>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <h1 className="font-display text-3xl">Acesse sua conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Use seu e-mail e senha.</p>
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input id="login-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div>
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <h1 className="font-display text-3xl">Crie sua empresa</h1>
              <p className="mt-1 text-sm text-muted-foreground">Você será o administrador da conta.</p>
              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="signup-name">Seu nome</Label>
                  <Input id="signup-name" name="full_name" required maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="signup-company">Nome da empresa</Label>
                  <Input id="signup-company" name="company_name" required maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input id="signup-email" name="email" type="email" required autoComplete="email" />
                </div>
                <div>
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input id="signup-password" name="password" type="password" required minLength={6} autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
