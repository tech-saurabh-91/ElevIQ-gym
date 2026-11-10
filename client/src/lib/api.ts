/**
 * API client. The API usually lives on a different domain from the gym's website, so every
 * request says which gym it is for via `X-Tenant-Host` (the browser's hostname). In local dev
 * `?gym=<slug>` (remembered in sessionStorage) or VITE_DEV_TENANT picks the gym instead.
 */
const RAW = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, '');
const BASE = RAW ? `${RAW}/api` : '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const store = {
  get(k: string, session = false) {
    try { return (session ? sessionStorage : localStorage).getItem(k); } catch { return null; }
  },
  set(k: string, v: string | null, session = false) {
    try {
      const s = session ? sessionStorage : localStorage;
      if (v === null) s.removeItem(k); else s.setItem(k, v);
    } catch { /* storage blocked */ }
  },
};

(() => {
  const g = new URLSearchParams(window.location.search).get('gym');
  if (g && /^[a-z0-9-]{3,40}$/.test(g)) store.set('gym.slug', g, true);
})();

export const tenantSlugHint = () => store.get('gym.slug', true) || (import.meta.env.DEV ? (import.meta.env.VITE_DEV_TENANT as string) || '' : '');

const TOKEN = 'gym.token';
const PTOKEN = 'gym.platformToken';
export const tokens = {
  get: () => store.get(TOKEN),
  set: (t: string | null) => store.set(TOKEN, t),
  platform: () => store.get(PTOKEN),
  setPlatform: (t: string | null) => store.set(PTOKEN, t),
};

type Opts = { method?: string; body?: unknown; platform?: boolean; signal?: AbortSignal };

async function request<T = any>(path: string, { method = 'GET', body, platform, signal }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Tenant-Host': window.location.hostname };
  const slug = tenantSlugHint();
  if (slug) headers['X-Tenant'] = slug;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = platform ? tokens.platform() : tokens.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  const text = await res.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  if (!res.ok) {
    if (res.status === 401 && token) {
      if (platform) tokens.setPlatform(null);
      else tokens.set(null);
      window.dispatchEvent(new CustomEvent(platform ? 'platform:unauthorized' : 'auth:unauthorized'));
    }
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status);
  }
  return payload as T;
}

export const api = {
  get: <T = any>(p: string, signal?: AbortSignal) => request<T>(p, { signal }),
  post: <T = any>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: body ?? {} }),
  put: <T = any>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: body ?? {} }),
  del: <T = any>(p: string) => request<T>(p, { method: 'DELETE' }),
  platform: {
    get: <T = any>(p: string) => request<T>(`/platform${p}`, { platform: true }),
    post: <T = any>(p: string, body?: unknown) => request<T>(`/platform${p}`, { method: 'POST', body: body ?? {}, platform: true }),
    put: <T = any>(p: string, body?: unknown) => request<T>(`/platform${p}`, { method: 'PUT', body: body ?? {}, platform: true }),
    del: <T = any>(p: string) => request<T>(`/platform${p}`, { method: 'DELETE', platform: true }),
  },
};

export const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== 'all') s.append(k, String(v));
  const q = s.toString();
  return q ? `?${q}` : '';
};
