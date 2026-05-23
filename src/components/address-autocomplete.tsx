import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Input } from "@/components/ui/input";
import { geocodeAddress, type GeocodeResult } from "@/lib/mapbox.functions";
import { Loader2, MapPin, Search, X } from "lucide-react";

interface AddressAutocompleteProps {
  /** Map center [lng, lat] used to bias results (proximity). */
  proximity?: [number, number] | null;
  /** Called when user clicks one of the result type buttons. */
  onPick: (kind: "origin" | "stop" | "destination", r: GeocodeResult) => void;
  /** Show buttons inline next to result or just one default "select". */
  variant?: "trip" | "single";
  /** When variant="single", called on selection. */
  onSelect?: (r: GeocodeResult) => void;
  placeholder?: string;
  /** ms to wait after last keystroke before firing search. */
  debounceMs?: number;
  /** Restrict to a country (default BR). */
  country?: string;
}

/**
 * Real-time address autocomplete using Mapbox Geocoding API.
 * - debounces user input
 * - biases by current map center (proximity)
 * - restricts to Brazil by default
 * - reuses a session token across the whole "search session" for billing
 */
export function AddressAutocomplete({
  proximity, onPick, variant = "trip", onSelect,
  placeholder = "Buscar endereço, bairro, cidade…",
  debounceMs = 300,
  country = "BR",
}: AddressAutocompleteProps) {
  const doGeocode = useServerFn(geocodeAddress);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  // session token (UUID-ish) — kept for the lifetime of the component
  const session = useMemo(() => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqIdRef.current;
    const t = setTimeout(async () => {
      try {
        const { results: r } = await doGeocode({
          data: {
            query: q,
            proximity: proximity ?? undefined,
            country,
            limit: 6,
            session,
          },
        });
        if (id !== reqIdRef.current) return; // stale
        setResults(r);
        setOpen(true);
        setHighlight(-1);
      } finally {
        if (id === reqIdRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, proximity, debounceMs, country, doGeocode, session]);

  // close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(kind: "origin" | "stop" | "destination", r: GeocodeResult) {
    onPick(kind, r);
    setQuery("");
    setResults([]);
    setOpen(false);
  }
  function selectSingle(r: GeocodeResult) {
    onSelect?.(r);
    setQuery(r.address);
    setResults([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      const r = results[highlight];
      if (r) variant === "single" ? selectSingle(r) : pick("destination", r);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="pl-9 pr-9"
        autoComplete="off"
      />
      {(query || loading) && (
        <button
          onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
          aria-label="Limpar busca"
          type="button"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      )}

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {results.map((r, i) => (
            <li
              key={r.id}
              className={`flex flex-wrap items-start justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                i === highlight ? "bg-accent" : "hover:bg-accent/60"
              }`}
              onMouseEnter={() => setHighlight(i)}
            >
              <button
                type="button"
                onClick={() => variant === "single" ? selectSingle(r) : pick("destination", r)}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.address}</div>
                </div>
              </button>
              {variant === "trip" && (
                <div className="flex shrink-0 gap-1 self-center">
                  <button type="button" onClick={() => pick("origin", r)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-card">Origem</button>
                  <button type="button" onClick={() => pick("stop", r)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-card">Parada</button>
                  <button type="button" onClick={() => pick("destination", r)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-card">Destino</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {query.length >= 3 && !loading && open && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          Nenhum resultado para "{query}".
        </div>
      )}
    </div>
  );
}
