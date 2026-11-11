import type { Theme, ThemeTokens } from './types';

const hexToTriplet = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const FONTS: Record<string, { body: string; display: string; url: string }> = {
  modern: { body: 'Inter', display: 'Inter', url: 'family=Inter:wght@400;500;600;700;800' },
  classic: { body: 'Inter', display: 'Playfair Display', url: 'family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800' },
  bold: { body: 'Inter', display: 'Oswald', url: 'family=Inter:wght@400;500;600;700&family=Oswald:wght@500;600;700' },
  rounded: { body: 'Nunito', display: 'Nunito', url: 'family=Nunito:wght@400;600;700;800;900' },
};

export type Mode = 'light' | 'dark';

/**
 * One standard colour scheme for every gym's admin panel (and the vendor console).
 * It never changes with the logo. All text/background pairs pass WCAG AA (4.5:1).
 */
export const ADMIN_THEME: Theme = {
  seed: { primary: '#4338ca', secondary: '#0f766e', accent: '#b45309' },
  light: {
    bg: '#f5f6f8', surface: '#ffffff', surface2: '#eef0f4', border: '#dde1e8', text: '#111827', muted: '#4b5563',
    primary: '#4338ca', onPrimary: '#ffffff', secondary: '#0f766e', onSecondary: '#ffffff', accent: '#b45309', onAccent: '#ffffff', link: '#4338ca',
  },
  dark: {
    bg: '#0b0f17', surface: '#111827', surface2: '#1c2433', border: '#2b3445', text: '#f3f4f6', muted: '#a3abb8',
    primary: '#818cf8', onPrimary: '#0b0f17', secondary: '#2dd4bf', onSecondary: '#0b0f17', accent: '#fbbf24', onAccent: '#0b0f17', link: '#a5b4fc',
  },
  checks: [],
};

export function resolveMode(pref: 'light' | 'dark' | 'auto'): Mode {
  let user: string | null = null;
  try { user = localStorage.getItem('gym.mode'); } catch { /* ignore */ }
  if (user === 'light' || user === 'dark') return user;
  if (pref !== 'auto') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Write the theme into CSS variables on <html>. Tailwind colours read these. */
export function applyTheme(theme: Theme, mode: Mode, font = 'modern', target: HTMLElement = document.documentElement) {
  const t: ThemeTokens = mode === 'dark' ? theme.dark : theme.light;
  for (const [k, v] of Object.entries(t)) target.style.setProperty(`--c-${k}`, hexToTriplet(v));
  target.dataset.theme = mode;
  target.style.colorScheme = mode;
  const f = FONTS[font] ?? FONTS.modern;
  target.style.setProperty('--font-body', `'${f.body}'`);
  target.style.setProperty('--font-display', `'${f.display}'`);
  target.style.setProperty('--radius', font === 'rounded' ? '1.25rem' : font === 'bold' ? '0.375rem' : '0.75rem');
  if (target === document.documentElement) {
    let link = document.getElementById('brand-font') as HTMLLinkElement | null;
    const href = `https://fonts.googleapis.com/css2?${f.url}&display=swap`;
    if (!link) {
      link = Object.assign(document.createElement('link'), { id: 'brand-font', rel: 'stylesheet' });
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) { meta = Object.assign(document.createElement('meta'), { name: 'theme-color' }); document.head.appendChild(meta); }
    meta.content = t.bg;
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
  }
}

export function setHead({ title, description, favicon }: { title?: string; description?: string; favicon?: string }) {
  if (title) document.title = title;
  if (description !== undefined) {
    let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!m) { m = Object.assign(document.createElement('meta'), { name: 'description' }); document.head.appendChild(m); }
    m.content = description;
  }
  if (favicon) {
    let l = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!l) { l = Object.assign(document.createElement('link'), { rel: 'icon' }); document.head.appendChild(l); }
    l.href = favicon;
  }
}

/* ------------------------- colour extraction from a logo ------------------------- */

type RGB = [number, number, number];
const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const hsl = ([r, g, b]: RGB) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
};
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * Reads the logo's pixels and returns brand seed colours: the most prominent saturated colour
 * as primary, then the next clearly different hues as secondary/accent. Near-white, near-black
 * and transparent pixels are ignored. The server turns these seeds into an AA-checked theme.
 */
export async function extractPalette(src: string): Promise<{ primary: string; secondary?: string; accent?: string; swatches: string[] }> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not read the image'));
    img.src = src;
  });
  const size = 96;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    throw new Error('This image host blocks colour reading. Upload the file instead of linking it.');
  }

  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const neutral = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 160) continue;
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
    const { s, l } = hsl(rgb);
    const key = ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4);
    const target = s < 0.18 || l < 0.08 || l > 0.94 ? neutral : buckets;
    const b = target.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n += 1; b.r += rgb[0]; b.g += rgb[1]; b.b += rgb[2];
    target.set(key, b);
  }
  const avg = (b: { n: number; r: number; g: number; b: number }): RGB => [b.r / b.n, b.g / b.n, b.b / b.n];
  const ranked = [...buckets.values()]
    .map((b) => { const c = avg(b); const { s } = hsl(c); return { c, score: b.n * (0.4 + s) }; })
    .sort((a, b) => b.score - a.score);

  const picked: RGB[] = [];
  for (const { c } of ranked) {
    if (picked.every((p) => hueDist(hsl(p).h, hsl(c).h) > 28)) picked.push(c);
    if (picked.length === 3) break;
  }
  if (!picked.length) {
    // Monochrome logo: use its darkest prominent neutral as primary.
    const n = [...neutral.values()].sort((a, b) => b.n - a.n).map(avg).sort((a, b) => hsl(a).l - hsl(b).l)[0];
    return { primary: n ? toHex(n) : '#111827', swatches: n ? [toHex(n)] : [] };
  }
  const hex = picked.map(toHex);
  return { primary: hex[0], secondary: hex[1], accent: hex[2], swatches: hex };
}
