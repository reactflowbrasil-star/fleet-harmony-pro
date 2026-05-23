import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Truck, Users, Route as RouteIcon, MapPin, Fuel, AlertTriangle, Wrench,
  Moon, Sun, Monitor, LogOut, Bell,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";

const pages = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Navegar" },
  { to: "/vehicles", label: "Veículos", icon: Truck, group: "Navegar" },
  { to: "/drivers", label: "Motoristas", icon: Users, group: "Navegar" },
  { to: "/trips", label: "Viagens", icon: RouteIcon, group: "Navegar" },
  { to: "/map", label: "Mapa ao vivo", icon: MapPin, group: "Navegar" },
  { to: "/fuel", label: "Abastecimentos", icon: Fuel, group: "Navegar" },
  { to: "/tickets", label: "Multas", icon: AlertTriangle, group: "Navegar" },
  { to: "/maintenance", label: "Manutenções", icon: Wrench, group: "Navegar" },
  { to: "/notifications", label: "Notificações", icon: Bell, group: "Navegar" },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { signOut } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite um comando ou pesquise…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Navegar">
          {pages.map((p) => (
            <CommandItem key={p.to} onSelect={() => run(() => navigate({ to: p.to }))}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tema">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun className="mr-2 h-4 w-4" />Claro
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon className="mr-2 h-4 w-4" />Escuro
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor className="mr-2 h-4 w-4" />Sistema
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Conta">
          <CommandItem onSelect={() => run(async () => { await signOut(); navigate({ to: "/" }); })}>
            <LogOut className="mr-2 h-4 w-4" />Sair
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
