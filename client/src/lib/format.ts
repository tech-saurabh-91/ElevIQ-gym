let LOCALE = 'en-IN';
let CURRENCY = 'INR';
let TZ = 'UTC';

/** Set from the gym's settings once they load. Nothing is hard-coded per gym. */
export function configureFormat(o: { locale?: string; currency?: string; timezone?: string }) {
  if (o.locale) LOCALE = o.locale;
  if (o.currency) CURRENCY = o.currency;
  if (o.timezone) TZ = o.timezone;
}

export const money = (n: number | null | undefined, currency = CURRENCY) => {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n ?? 0);
  } catch {
    return `${currency} ${(n ?? 0).toFixed(2)}`;
  }
};

export const num = (n: number | null | undefined) => new Intl.NumberFormat(LOCALE).format(n ?? 0);

export const date = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!d) return '—';
  try { return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...opts }).format(new Date(d)); } catch { return new Date(d).toDateString(); }
};
export const dateTime = (d: string | Date | null | undefined) => date(d, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const DAY_NAMES = (short = false) =>
  [0, 1, 2, 3, 4, 5, 6].map((i) => new Intl.DateTimeFormat(LOCALE, { weekday: short ? 'short' : 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i))));

export const time = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1, h, m)));
};

export const daysUntil = (d: string | Date) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5);

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const toCSV = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};

export const download = (filename: string, text: string, type = 'text/csv') => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const uid = () => Math.random().toString(36).slice(2, 10);
