import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    const token = (() => {
      try {
        return localStorage.getItem('gf.token');
      } catch {
        return null;
      }
    })();
    if (!token) {
      setLoading(false);
      return undefined;
    }
    refresh().finally(() => setLoading(false));
    const onUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('gf:unauthorized', onUnauthorized);
    return () => window.removeEventListener('gf:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      setUser,
      isAdmin: user?.role === 'admin',
      isTrainer: user?.role === 'trainer',
      isMember: user?.role === 'member',
      isAuthenticated: Boolean(user),
    }),
    [user, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
