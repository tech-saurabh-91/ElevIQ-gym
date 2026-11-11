/**
 * Calendar maths in the GYM's time zone (not the server's). Reports, dashboard and Excel exports
 * all use these helpers, so "this month" or "today" means the same thing everywhere.
 */
export type LocalParts = { y: number; m: number; d: number; h: number; mi: number; s: number };

export function partsInTz(date: Date, tz: string): LocalParts {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
const offsetAt = (instant: number, tz: string) => {
  const p = partsInTz(new Date(instant), tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(instant / 1000) * 1000;
};

/** The UTC instant of a local wall-clock time in `tz` (month is 1-based; overflow is normalised). */
export function zonedTime(tz: string, y: number, m: number, d = 1, h = 0, mi = 0): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetAt(guess, tz);
  return new Date(guess - offsetAt(first, tz));
}

export const startOfDayTz = (tz: string, at = new Date(), addDays = 0) => {
  const p = partsInTz(at, tz);
  return zonedTime(tz, p.y, p.m, p.d + addDays);
};

export const startOfMonthTz = (tz: string, at = new Date(), addMonths = 0) => {
  const p = partsInTz(at, tz);
  return zonedTime(tz, p.y, p.m + addMonths, 1);
};

/** "2026-11" style key + short label for the month containing `at` in `tz`. */
export const monthKey = (tz: string, at: Date) => {
  const p = partsInTz(at, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}`;
};

/**
 * Excel stores dates without a zone. Shift an instant so Excel shows the gym's local wall time
 * (ExcelJS writes Dates as UTC).
 */
export const excelLocal = (date: Date | string | null | undefined, tz: string) => {
  if (!date) return null;
  const p = partsInTz(new Date(date), tz);
  return new Date(Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s));
};
