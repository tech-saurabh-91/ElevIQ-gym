import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { cache, cacheKeys } from '../lib/cache.js';
import { ApiError } from '../lib/http.js';
import { runAsPlatform, runInTenant } from '../lib/tenantContext.js';
import { Tenant } from '../models/platform.js';
import { Types } from 'mongoose';

export type ResolvedTenant = {
  _id: string;
  slug: string;
  name: string;
  status: string;
  setupCompleted: boolean;
  settings: any;
};

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: ResolvedTenant;
    tenantObjectId?: Types.ObjectId;
  }
}

export const normalizeHost = (raw: string) =>
  raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');

const SLUG_RX = /^[a-z0-9-]{3,40}$/;

/**
 * Which gym is this request for?
 *  1. `X-Tenant` slug header (dev tools, previews) - only honoured outside production or for ROOT_DOMAIN hosts
 *  2. `X-Tenant-Host` header (the browser's hostname - the API usually lives on another domain)
 *  3. the request's own Host
 * A host matches `<slug>.<ROOT_DOMAIN>` or one of a gym's custom domains.
 */
export async function resolveTenantFromHost(host: string, slugHint?: string): Promise<ResolvedTenant | null> {
  const h = normalizeHost(host);
  const root = env().ROOT_DOMAIN.toLowerCase();
  const key = cacheKeys.host(`${h}|${slugHint ?? ''}`);
  const hit = await cache().get<ResolvedTenant | 'none'>(key);
  if (hit) return hit === 'none' ? null : hit;

  let query: Record<string, unknown> | null = null;
  if (slugHint && SLUG_RX.test(slugHint)) query = { slug: slugHint };
  else if (h && h !== root && h.endsWith(`.${root}`)) {
    const sub = h.slice(0, -(root.length + 1));
    if (SLUG_RX.test(sub) && !sub.includes('.')) query = { slug: sub };
  }
  let doc = await runAsPlatform(async () => {
    if (query) return Tenant.findOne(query).lean();
    return h ? Tenant.findOne({ domains: h }).lean() : null;
  });
  if (!doc && env().DEFAULT_TENANT_SLUG) {
    doc = await runAsPlatform(() => Tenant.findOne({ slug: env().DEFAULT_TENANT_SLUG }).lean());
  }
  const value: ResolvedTenant | null = doc
    ? {
        _id: String(doc._id),
        slug: doc.slug,
        name: doc.name,
        status: doc.status,
        setupCompleted: Boolean(doc.setupCompleted),
        settings: doc.settings,
      }
    : null;
  await cache().set(key, value ?? 'none', 60);
  return value;
}

export async function invalidateTenantCache(tenant: { slug: string; domains?: string[] }) {
  // Host keys are short-lived (60s); clear the obvious ones immediately.
  const root = env().ROOT_DOMAIN.toLowerCase();
  const hosts = [`${tenant.slug}.${root}`, ...(tenant.domains ?? [])];
  await cache().del(...hosts.flatMap((h) => [cacheKeys.host(`${h}|`), cacheKeys.host(`${h}|${tenant.slug}`)]), cacheKeys.host(`|${tenant.slug}`));
}

/** Resolves the tenant and runs the rest of the request inside its data scope. */
export function tenantScope(opts: { allowSuspended?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slugHint = (req.header('x-tenant') || '').toLowerCase() || undefined;
      const host = req.header('x-tenant-host') || req.hostname || '';
      const tenant = await resolveTenantFromHost(host, slugHint);
      if (!tenant) throw new ApiError(404, 'Gym not found for this address');
      if (tenant.status === 'suspended' && !opts.allowSuspended) throw new ApiError(403, 'This gym is currently unavailable');
      req.tenant = tenant;
      req.tenantObjectId = new Types.ObjectId(tenant._id);
      runInTenant(req.tenantObjectId, () => next());
    } catch (err) {
      next(err);
    }
  };
}
