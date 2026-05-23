import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { Route as RouteIcon, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type FuelPoint = { date: string; value: number };
export type TripPoint = { date: string; count: number };

interface Props {
  fuelSeries?: FuelPoint[];
  tripsSeries?: TripPoint[];
}

/**
 * Renders the two dashboard charts (Combustível + Viagens) using Recharts.
 * Split into its own module so the heavy recharts bundle is lazy-loaded.
 */
export default function DashboardCharts({ fuelSeries, tripsSeries }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg sm:text-xl">Combustível</h3>
            <p className="text-xs text-muted-foreground">Gastos aprovados · últimos 30 dias</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="h-48 sm:h-56">
          {fuelSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fuelSeries} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={Math.ceil((fuelSeries.length || 1) / 6)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} width={42} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-pop)",
                  }}
                  formatter={(v: any) => [
                    `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                    "Gasto",
                  ]}
                />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="url(#fuelGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      </div>

      <div className="surface p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg sm:text-xl">Viagens</h3>
            <p className="text-xs text-muted-foreground">Quantidade por dia · últimos 14 dias</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RouteIcon className="h-4 w-4" />
          </div>
        </div>
        <div className="h-48 sm:h-56">
          {tripsSeries ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tripsSeries} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={1} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} width={28} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-pop)",
                  }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
      </div>
    </div>
  );
}
