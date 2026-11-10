import crypto from 'node:crypto';
import type { Request } from 'express';
import { AuditLog, Counter } from '../models/billing.js';

/** Atomic per-tenant sequence. Never collides, even after deletes or concurrent requests. */
export async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  return doc!.seq;
}

export const formatSeq = (prefix: string, n: number, width = 5) => `${prefix}${String(n).padStart(width, '0')}`;

export const randomToken = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');

export async function audit(req: Request, action: string, entity?: string, entityId?: unknown, summary?: string) {
  try {
    await AuditLog.create({
      actor: req.user?._id,
      actorName: req.user?.name,
      impersonatedBy: req.user?.impersonatedBy,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      summary,
      ip: req.ip,
    });
  } catch (e) {
    console.warn('[audit] failed', (e as Error).message);
  }
}

/** Minor-unit precision for a currency (JPY 0, most others 2). */
export const currencyDigits = (currency: string) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};

export const roundMoney = (n: number, currency: string) => {
  const f = 10 ** currencyDigits(currency);
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 864e5);
export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
