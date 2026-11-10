import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import { applyTheme, resolveMode, setHead, type Mode } from './theme';
import { configureFormat } from './format';
import type { PublicSite } from './types';

type Ctx = {
  site: PublicSite | null;
  error: ApiError | null;
  loading: boolean;
  mode: Mode;
  toggleMode: () => void;
  reload: () => Promise<void>;
};
const SiteContext = createContext<Ctx | null>(null);

export const isPreview = () => new URLSearchParams(window.location.search).get('preview') === 'draft';

/** Loads the current gym's published site (or the draft in preview) and applies its brand. */
export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<PublicSite | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('light');

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

  useEffect(() => {
    if (!site) return;
    const b = site.site.brand;
    const m = resolveMode(b.mode);
    setMode(m);
    applyTheme(site.site.theme, m, b.font);
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
    applyTheme(site.site.theme, next, site.site.brand.font);
  }, [mode, site]);

  const value = useMemo(() => ({ site, error, loading, mode, toggleMode, reload: load }), [site, error, loading, mode, toggleMode, load]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export const useSite = () => {
  const c = useContext(SiteContext);
  if (!c) throw new Error('useSite outside SiteProvider');
  return c;
};
