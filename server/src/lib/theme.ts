/**
 * Brand theme generator. Takes 1-3 seed colours (usually extracted from the logo)
 * and produces light + dark token sets that pass WCAG AA:
 *   - body text on background/surface      >= 4.5:1
 *   - text on primary/secondary/accent      >= 4.5:1 (white or near-black picked, colour nudged if needed)
 *   - primary used as link/text on background >= 4.5:1 (separate `link` token)
 */
type RGB = [number, number, number];
type HSL = [number, number, number];

export const HEX_RX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsl([r, g, b]: RGB): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb([h, s, l]: HSL): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const lum = (rgb: RGB) => {
  const c = rgb.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a: string, b: string) => {
  const [l1, l2] = [lum(hexToRgb(a)), lum(hexToRgb(b))].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
};

const withL = (hex: string, l: number) => { const [h, s] = rgbToHsl(hexToRgb(hex)); return rgbToHex(hslToRgb([h, s, l])); };
const lightness = (hex: string) => rgbToHsl(hexToRgb(hex))[2];
const shiftHue = (hex: string, deg: number) => { const [h, s, l] = rgbToHsl(hexToRgb(hex)); return rgbToHex(hslToRgb([h + deg, Math.max(s, 0.45), l])); };

/** Move a colour's lightness toward darker/lighter until it reaches `ratio` against `against`. */
function ensureContrast(fg: string, against: string, ratio: number): string {
  if (contrast(fg, against) >= ratio) return fg;
  const darker = lum(hexToRgb(against)) > 0.18;
  let l = lightness(fg);
  for (let i = 0; i < 100; i += 1) {
    l = darker ? l - 0.01 : l + 0.01;
    if (l <= 0 || l >= 1) break;
    const c = withL(fg, l);
    if (contrast(c, against) >= ratio) return c;
  }
  return darker ? '#000000' : '#ffffff';
}

const INK = '#0b0d12';
const PAPER = '#ffffff';

/** Pick a readable text colour for a filled background; if neither passes, adjust the fill. */
function fill(color: string): { bg: string; on: string } {
  const white = contrast(PAPER, color);
  const ink = contrast(INK, color);
  if (white >= 4.5) return { bg: color, on: PAPER };
  if (ink >= 4.5) return { bg: color, on: INK };
  // Neither passes: darken the fill until white text passes (keeps brand hue).
  return { bg: ensureContrast(color, PAPER, 4.5), on: PAPER };
}

export type ThemeTokens = {
  bg: string; surface: string; surface2: string; border: string; text: string; muted: string;
  primary: string; onPrimary: string; secondary: string; onSecondary: string; accent: string; onAccent: string; link: string;
};
export type Theme = {
  seed: { primary: string; secondary: string; accent: string };
  light: ThemeTokens;
  dark: ThemeTokens;
  checks: { name: string; ratio: number; pass: boolean }[];
};

export const normalizeHex = (h: string) => rgbToHex(hexToRgb(h));

export function buildTheme(seedIn: { primary: string; secondary?: string; accent?: string }): Theme {
  const primary = normalizeHex(seedIn.primary);
  const secondary = normalizeHex(seedIn.secondary && HEX_RX.test(seedIn.secondary) ? seedIn.secondary : shiftHue(primary, 150));
  const accent = normalizeHex(seedIn.accent && HEX_RX.test(seedIn.accent) ? seedIn.accent : shiftHue(primary, -40));
  const [ph] = rgbToHsl(hexToRgb(primary));

  const tint = (l: number, s = 0.12) => rgbToHex(hslToRgb([ph, s, l]));

  const mk = (mode: 'light' | 'dark'): ThemeTokens => {
    const bg = mode === 'light' ? tint(0.985, 0.25) : tint(0.07, 0.18);
    const surface = mode === 'light' ? PAPER : tint(0.11, 0.16);
    const surface2 = mode === 'light' ? tint(0.955, 0.22) : tint(0.15, 0.14);
    const border = mode === 'light' ? tint(0.88, 0.14) : tint(0.22, 0.12);
    const text = mode === 'light' ? tint(0.1, 0.2) : tint(0.95, 0.15);
    const muted = ensureContrast(mode === 'light' ? tint(0.42, 0.1) : tint(0.68, 0.1), surface, 4.5);
    const tune = (c: string) => (mode === 'dark' && lightness(c) < 0.35 ? withL(c, 0.55) : c);
    const p = fill(tune(primary));
    const s = fill(tune(secondary));
    const a = fill(tune(accent));
    const link = ensureContrast(tune(primary), bg, 4.5);
    return {
      bg, surface, surface2, border, text, muted,
      primary: p.bg, onPrimary: p.on, secondary: s.bg, onSecondary: s.on, accent: a.bg, onAccent: a.on, link,
    };
  };

  const light = mk('light');
  const dark = mk('dark');
  const checks = (['light', 'dark'] as const).flatMap((m) => {
    const t = m === 'light' ? light : dark;
    return [
      { name: `${m}: text on background`, ratio: contrast(t.text, t.bg) },
      { name: `${m}: muted text on surface`, ratio: contrast(t.muted, t.surface) },
      { name: `${m}: button text on primary`, ratio: contrast(t.onPrimary, t.primary) },
      { name: `${m}: text on secondary`, ratio: contrast(t.onSecondary, t.secondary) },
      { name: `${m}: text on accent`, ratio: contrast(t.onAccent, t.accent) },
      { name: `${m}: links on background`, ratio: contrast(t.link, t.bg) },
    ].map((c) => ({ ...c, pass: c.ratio >= 4.5 }));
  });
  return { seed: { primary, secondary, accent }, light, dark, checks };
}
