import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "@/services/api";
import { loginWithPassword, signOut as remoteSignOut } from "@/services/auth";
import { getSecure, removeSecure, setSecure, SECURE_KEYS } from "@/storage/secure";

type User = { id: string; email: string };

type AuthCtx = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await getSecure(SECURE_KEYS.TOKEN);
        const u = await getSecure(SECURE_KEYS.USER);
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    const t = await getSecure(SECURE_KEYS.TOKEN);
    if (t) {
      try { await remoteSignOut(t); } catch { /* ignore network */ }
    }
    await Promise.all([
      removeSecure(SECURE_KEYS.TOKEN),
      removeSecure(SECURE_KEYS.REFRESH),
      removeSecure(SECURE_KEYS.USER),
    ]);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await loginWithPassword(email, password);
    await Promise.all([
      setSecure(SECURE_KEYS.TOKEN, r.access_token),
      setSecure(SECURE_KEYS.REFRESH, r.refresh_token),
      setSecure(SECURE_KEYS.USER, JSON.stringify(r.user)),
    ]);
    setToken(r.access_token);
    setUser(r.user);
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, token, isAuthenticated: !!token, isLoading, login, logout,
  }), [user, token, isLoading, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
