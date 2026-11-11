import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokens } from './api';
import { clearLoadCache } from '@/components/ui';
import type { Permission, SessionUser } from './types';

type Session = { user: SessionUser; permissions: Permission[]; tenant: { name: string; slug: string; setupCompleted: boolean }; impersonatedBy?: string | null };
type Ctx = {
  session: Session | null;
  loading: boolean;
  can: (...p: Permission[]) => boolean;
  login: (email: string, password: string) => Promise<Session>;
  logout: () => void;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<Ctx | null>(null);

// Support access from the vendor console arrives as #support=<token> (never sent to servers).
(() => {
  const m = window.location.hash.match(/support=([\w.-]+)/);
  if (m) {
    tokens.set(m[1]);
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
})();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(tokens.get()));

  const refresh = useCallback(async () => {
    if (!tokens.get()) { setSession(null); setLoading(false); return; }
    try {
      const res = await api.get<Session & { success: boolean }>('/auth/me');
      setSession({ user: res.user, permissions: res.permissions, tenant: res.tenant, impersonatedBy: res.impersonatedBy });
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const off = () => setSession(null);
    window.addEventListener('auth:unauthorized', off);
    return () => window.removeEventListener('auth:unauthorized', off);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<Session & { token: string }>('/auth/login', { email, password });
    tokens.set(res.token);
    clearLoadCache();
    const s = { user: res.user, permissions: res.permissions, tenant: res.tenant };
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(() => {
    tokens.set(null);
    clearLoadCache();
    setSession(null);
  }, []);

  const can = useCallback((...p: Permission[]) => Boolean(session && p.some((x) => session.permissions.includes(x))), [session]);

  const value = useMemo(() => ({ session, loading, can, login, logout, refresh }), [session, loading, can, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};

export const homeFor = (s: Session) => (s.user.role === 'member' ? '/portal' : s.user.role === 'owner' && !s.tenant.setupCompleted ? '/admin/setup' : '/admin');
