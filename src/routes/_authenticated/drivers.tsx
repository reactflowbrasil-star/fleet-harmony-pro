import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Search, Trash2, User as UserIcon, KeyRound, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/drivers")({
  component: DriversPage,
});

type DriverStatus = "active" | "inactive" | "suspended";
const statusLabel: Record<DriverStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  suspended: "Suspenso",
};
const statusClasses: Record<DriverStatus, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/15 text-destructive",
};

type Driver = {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  cnh: string | null;
  cnh_category: string | null;
  cnh_expiry: string | null;
  vehicle_id: string | null;
  user_id: string | null;
  status: DriverStatus;
  vehicle?: { plate: string; model: string } | null;
};

function DriversPage() {
  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [passwordFor, setPasswordFor] = useState<Driver | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "all">("all");

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*, vehicle:vehicles(plate, model)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Driver[];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, plate, model").eq("status", "active");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!drivers) return [];
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.full_name.toLowerCase().includes(q) ||
        (d.cpf ?? "").toLowerCase().includes(q) ||
        (d.email ?? "").toLowerCase().includes(q) ||
        (d.cnh ?? "").toLowerCase().includes(q) ||
        (d.vehicle?.plate ?? "").toLowerCase().includes(q)
      );
    });
  }, [drivers, search, statusFilter]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Motorista excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    const fd = new FormData(e.currentTarget);
    const vehicleId = String(fd.get("vehicle_id") || "");
    const email = String(fd.get("email") || "").trim() || null;
    const password = String(fd.get("password") || "").trim();
    const payload = {
      full_name: String(fd.get("full_name") || "").trim(),
      cpf: String(fd.get("cpf") || "").trim() || null,
      phone: String(fd.get("phone") || "").trim() || null,
      email,
      cnh: String(fd.get("cnh") || "").trim() || null,
      cnh_category: String(fd.get("cnh_category") || "").trim() || null,
      cnh_expiry: (fd.get("cnh_expiry") as string) || null,
      vehicle_id: vehicleId || null,
      status: (String(fd.get("status") || "active") as DriverStatus),
    };
    let driverId: string | undefined = editing?.id;
    if (editing) {
      const { error } = await supabase.from("drivers").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("drivers")
        .insert({ company_id: companyId, ...payload })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      driverId = data?.id;
    }

    // Create / update auth account for driver if email + password provided.
    // Strategy: try Edge Function first (clean server-side, idempotent). If the
    // function is not deployed (404), fall back to client-side signUp via an
    // isolated Supabase client (does NOT replace the admin session).
    let accessMsg = "";
    if (driverId && email && password) {
      if (password.length < 6) {
        toast.warning("Cadastro salvo, mas senha precisa ter no mínimo 6 caracteres — acesso não foi criado.");
      } else {
        // 1) Try Edge Function
        let edgeOk = false;
        let edgeErrMsg: string | null = null;
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke("create-driver-user", {
            body: { driver_id: driverId, email, password },
          });
          if (fnErr) throw fnErr;
          if ((fnData as any)?.ok) {
            edgeOk = true;
            accessMsg = " · acesso criado/atualizado";
          } else if ((fnData as any)?.error) {
            throw new Error((fnData as any).error);
          }
        } catch (err: any) {
          edgeErrMsg = err?.message || "Falha ao criar acesso";
        }

        // 2) Fallback: client-side signUp via isolated client
        if (!edgeOk) {
          const looksMissing = !!edgeErrMsg && /not found|404|404 page not found|FunctionsHttpError|Failed to send/i.test(edgeErrMsg);
          try {
            const { clientSideCreateDriverAuth } = await import("@/lib/driver-signup");
            const { needsEmailConfirmation } = await clientSideCreateDriverAuth({
              driverId,
              email,
              password,
              fullName: payload.full_name,
            });
            if (needsEmailConfirmation) {
              toast.warning(
                "Motorista salvo e conta criada. ⚠️ É necessário confirmar o e-mail antes de logar. Desative 'Confirm email' em Supabase → Authentication → Providers → Email para liberar imediatamente.",
                { duration: 12000 },
              );
            } else {
              toast.success("Motorista salvo · acesso criado");
              accessMsg = ""; // already toasted
            }
          } catch (signupErr: any) {
            const sMsg = signupErr?.message || "Falha no signup";
            if (/already registered|already exists|duplicate/i.test(sMsg)) {
              toast.warning(
                "Esse e-mail já tem conta. Use 'Definir nova senha' (edite o motorista) — mas isso só funciona com a Edge Function deployada.",
                { duration: 10000 },
              );
            } else if (looksMissing) {
              toast.error(
                `Não foi possível criar acesso. Deploy a Edge Function 'create-driver-user' (veja docs/setup-driver-auth.md). Erro: ${sMsg}`,
                { duration: 10000 },
              );
            } else {
              toast.error(`Falha ao criar acesso: ${sMsg}`, { duration: 8000 });
            }
          }
        }
      }
    }

    toast.success((editing ? "Motorista atualizado" : "Motorista cadastrado") + accessMsg);
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["drivers"] });
  }

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(d: Driver) { setEditing(d); setOpen(true); }

  const todayStr = new Date().toISOString().slice(0, 10);
  const soonStr = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Motoristas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {drivers?.length ?? 0} motorista{drivers?.length === 1 ? "" : "s"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="h-10 shrink-0"><Plus className="mr-2 h-4 w-4" />Novo motorista</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar motorista" : "Cadastrar motorista"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>Nome completo *</Label><Input name="full_name" required maxLength={100} defaultValue={editing?.full_name} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CPF</Label><Input name="cpf" maxLength={20} defaultValue={editing?.cpf ?? ""} /></div>
                <div><Label>Telefone</Label><Input name="phone" maxLength={20} defaultValue={editing?.phone ?? ""} /></div>
                <div className="col-span-2"><Label>E-mail (login)</Label><Input name="email" type="email" maxLength={255} defaultValue={editing?.email ?? ""} autoComplete="off" /></div>
                <div className="col-span-2">
                  <Label>{editing ? "Nova senha (opcional)" : "Senha de acesso"}</Label>
                  <Input
                    name="password"
                    type="password"
                    minLength={6}
                    maxLength={72}
                    autoComplete="new-password"
                    placeholder={editing ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {editing
                      ? "Preencha apenas se quiser definir/redefinir a senha do motorista."
                      : "Preencha para criar imediatamente o acesso do motorista ao app. Pode ser feito depois."}
                  </p>
                </div>
                <div><Label>CNH</Label><Input name="cnh" maxLength={20} defaultValue={editing?.cnh ?? ""} /></div>
                <div><Label>Categoria</Label><Input name="cnh_category" maxLength={5} placeholder="B, C, D, E" defaultValue={editing?.cnh_category ?? ""} /></div>
                <div className="col-span-2"><Label>Validade CNH</Label><Input name="cnh_expiry" type="date" defaultValue={editing?.cnh_expiry ?? ""} /></div>
                <div>
                  <Label>Status</Label>
                  <select name="status" defaultValue={editing?.status ?? "active"} className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    {(Object.keys(statusLabel) as DriverStatus[]).map((s) => (
                      <option key={s} value={s}>{statusLabel[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Veículo vinculado</Label>
                  <select name="vehicle_id" defaultValue={editing?.vehicle_id ?? ""} className="nice-select mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">— sem vínculo —</option>
                    {vehicles?.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.model}</option>)}
                  </select>
                </div>
              </div>
              <Button type="submit" className="h-11 w-full">{editing ? "Salvar alterações" : "Cadastrar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="glass-bar sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-y border-border px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, CPF, CNH, e-mail, placa…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DriverStatus | "all")}>
          <SelectTrigger className="h-10 sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(statusLabel) as DriverStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-40" />
              </div>
            </div>
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </div>
        ))}
        {!isLoading && filtered.map((d) => {
          const expired = d.cnh_expiry && d.cnh_expiry < todayStr;
          const expiringSoon = d.cnh_expiry && d.cnh_expiry >= todayStr && d.cnh_expiry <= soonStr;
          return (
            <article key={d.id} className="surface p-4 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-pop)] sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-tight">{d.full_name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{d.email || d.phone || "—"}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses[d.status]}`}>
                  {statusLabel[d.status]}
                </span>
              </div>
              <dl className="mt-4 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">CNH</dt>
                  <dd className="truncate font-medium text-foreground">{d.cnh || "—"} {d.cnh_category && <span className="text-muted-foreground">({d.cnh_category})</span>}</dd>
                </div>
                {d.cnh_expiry && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Validade</dt>
                    <dd className={`truncate font-medium ${expired ? "text-destructive" : expiringSoon ? "text-warning" : "text-foreground"}`}>
                      {new Date(d.cnh_expiry).toLocaleDateString("pt-BR")}
                      {expired && " · vencida"}
                      {expiringSoon && " · em breve"}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Veículo</dt>
                  <dd className="truncate font-medium text-foreground">{d.vehicle?.plate ? `${d.vehicle.plate} · ${d.vehicle.model}` : "—"}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                <button
                  onClick={() => setPasswordFor(d)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors",
                    d.user_id
                      ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
                      : "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15",
                  )}
                  title={d.user_id ? "Acesso já criado — clique para redefinir senha" : "Sem acesso ao app — clique para criar"}
                >
                  {d.user_id ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                  {d.user_id ? "Redefinir senha" : "Definir senha"}
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(d)} className="tap rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => { if (confirm(`Excluir ${d.full_name}?`)) remove.mutate(d.id); }} className="tap rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center sm:p-12">
            <UserIcon className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {drivers?.length ? "Nenhum motorista corresponde aos filtros." : "Nenhum motorista cadastrado."}
            </p>
          </div>
        )}
      </div>

      <PasswordDialog
        driver={passwordFor}
        onOpenChange={(o) => { if (!o) setPasswordFor(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["drivers"] })}
      />
    </div>
  );
}

/* ============================================================
 * PasswordDialog — dedicated UI for setting/resetting a driver's login
 * ========================================================== */

function PasswordDialog({
  driver, onOpenChange, onSaved,
}: {
  driver: Driver | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setEmail(driver.email ?? "");
      setPassword("");
      setConfirm("");
    }
  }, [driver?.id, driver?.email]);

  if (!driver) return null;
  const hasAccess = !!driver.user_id;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!driver) return;
    const em = email.trim().toLowerCase();
    if (!em) return toast.error("Informe o e-mail de login");
    if (password.length < 6) return toast.error("Senha precisa ter no mínimo 6 caracteres");
    if (password !== confirm) return toast.error("As senhas não conferem");

    setSaving(true);
    try {
      // Try Edge Function first
      let edgeOk = false;
      let edgeErrMsg: string | null = null;
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("create-driver-user", {
          body: { driver_id: driver.id, email: em, password },
        });
        if (fnErr) throw fnErr;
        if ((fnData as any)?.ok) edgeOk = true;
        else if ((fnData as any)?.error) throw new Error((fnData as any).error);
      } catch (err: any) {
        edgeErrMsg = err?.message || "Falha ao criar acesso";
      }

      if (edgeOk) {
        toast.success(hasAccess ? "Senha redefinida" : "Acesso criado");
        onSaved();
        onOpenChange(false);
        return;
      }

      // Fallback: client-side signUp
      const looksMissing = !!edgeErrMsg && /not found|404|FunctionsHttpError|Failed to send/i.test(edgeErrMsg);
      try {
        const { clientSideCreateDriverAuth } = await import("@/lib/driver-signup");
        const { needsEmailConfirmation } = await clientSideCreateDriverAuth({
          driverId: driver.id,
          email: em,
          password,
          fullName: driver.full_name,
        });
        if (needsEmailConfirmation) {
          toast.warning(
            "Acesso criado. ⚠️ É necessário confirmar o e-mail antes de logar. Desative 'Confirm email' em Supabase → Authentication → Providers → Email.",
            { duration: 12000 },
          );
        } else {
          toast.success("Acesso criado e pronto para login");
        }
        onSaved();
        onOpenChange(false);
      } catch (signupErr: any) {
        const sMsg = signupErr?.message || "Falha no cadastro";
        if (/already registered|already exists|duplicate/i.test(sMsg)) {
          toast.error(
            "Esse e-mail já tem conta no Supabase Auth. Para redefinir a senha de uma conta existente é necessário deployar a Edge Function 'create-driver-user'.",
            { duration: 12000 },
          );
        } else if (looksMissing) {
          toast.error(
            `Não foi possível criar acesso. Deploy a Edge Function (docs/setup-driver-auth.md). Erro: ${sMsg}`,
            { duration: 10000 },
          );
        } else {
          toast.error(`Falha: ${sMsg}`, { duration: 8000 });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {hasAccess ? "Redefinir senha de acesso" : "Definir senha de acesso"}
          </DialogTitle>
        </DialogHeader>
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{driver.full_name}</p>
            <p className={cn(
              "truncate text-[11px] font-medium",
              hasAccess ? "text-success" : "text-warning",
            )}>
              {hasAccess ? "✓ Conta ativa — alterar senha atual" : "⚠ Sem conta no app — criando novo acesso"}
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>E-mail de login *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
              className="h-11"
              placeholder="motorista@empresa.com"
            />
          </div>
          <div>
            <Label>Nova senha *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              maxLength={72}
              autoComplete="new-password"
              required
              className="h-11"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <Label>Confirmar senha *</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              maxLength={72}
              required
              className="h-11"
              placeholder="Repita a senha"
            />
          </div>
          <Button type="submit" disabled={saving} className="h-11 w-full">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : <><KeyRound className="mr-2 h-4 w-4" /> {hasAccess ? "Salvar nova senha" : "Criar acesso"}</>}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            O motorista usa este e-mail e senha em /auth para entrar no app.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
