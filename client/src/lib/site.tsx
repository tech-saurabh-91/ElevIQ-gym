import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { ADMIN_THEME, applyTheme, resolveMode, setHead, type Mode } from './theme';
import { configureFormat } from './format';
import type { PublicSite } from './types';

/** 'site' = the gym's logo-derived brand theme; 'admin' = the fixed standard admin scheme. */
export type ThemeScope = 'site' | 'admin';

type Ctx = {
  site: PublicSite | null;
  error: ApiError | null;
  loading: boolean;
  mode: Mode;
  toggleMode: () => void;
  reload: () => Promise<void>;
  setScope: (s: ThemeScope) => void;
};
const SiteContext = createContext<Ctx | null>(null);

export const isPreview = () => new URLSearchParams(window.location.search).get('preview') === 'draft';

/** Loads the current gym's published site (or the draft in preview) and applies the right theme. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<PublicSite | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('light');
  const [scope, setScope] = useState<ThemeScope>('site');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: PublicSite }>(`/public/site${isPreview() ? '?preview=draft' : ''}`);
      setSite(res.data);
      setError(null);
      configureFormat(res.data.settings);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Apply the theme for the current scope (brand vs standard admin) and mode.
  useEffect(() => {
    if (!site) return;
    const b = site.site.brand;
    const m = resolveMode(scope === 'admin' ? 'auto' : b.mode);
    setMode(m);
    if (scope === 'admin') applyTheme(ADMIN_THEME, m, 'modern');
    else applyTheme(site.site.theme, m, b.font);
  }, [site, scope]);

  useEffect(() => {
    if (!site) return;
    const b = site.site.brand;
    setHead({
      title: site.site.seo.title || `${b.name}${b.tagline ? ` - ${b.tagline}` : ''}`,
      description: site.site.seo.description || b.tagline,
      favicon: b.faviconUrl || b.logoUrl || undefined,
    });
    document.documentElement.lang = (site.settings.locale || 'en').split('-')[0];
  }, [site]);

  const toggleMode = useCallback(() => {
    if (!site) return;
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('gym.mode', next); } catch { /* ignore */ }
    setMode(next);
    if (scope === 'admin') applyTheme(ADMIN_THEME, next, 'modern');
    else applyTheme(site.site.theme, next, site.site.brand.font);
  }, [mode, site, scope]);

  const value = useMemo(() => ({ site, error, loading, mode, toggleMode, reload: load, setScope }), [site, error, loading, mode, toggleMode, load]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => {
  const c = useContext(SiteContext);
  if (!c) throw new Error('useSite outside SiteProvider');
  return c;
};

/** Switch the whole document to the standard admin theme while the calling component is mounted. */
export function useAdminTheme() {
  const { setScope } = useSite();
  useEffect(() => {
    setScope('admin');
    return () => setScope('site');
  }, [setScope]);
}
