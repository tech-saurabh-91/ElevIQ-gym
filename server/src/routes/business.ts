import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { audit } from '../lib/util.js';
import { crudRouter, zBool, zDate, zId } from '../lib/crud.js';
import { runAsPlatform } from '../lib/tenantContext.js';
import { requirePermission } from '../middleware/auth.js';
import { invalidateTenantCache } from '../middleware/tenant.js';
import { Offer, Plan } from '../models/catalog.js';
import { Tenant } from '../models/platform.js';
import { invalidateSite } from '../services/site.js';

const r = Router();

/* ----------------------------- business settings ----------------------------- */

const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).default(''),
  currency: z.string().trim().length(3).toUpperCase(),
  locale: z.string().trim().min(2).max(20),
  timezone: z.string().trim().min(2).max(60),
  tax: z.object({
    label: z.string().trim().max(20).default('Tax'),
    rate: z.number().min(0).max(100),
    inclusive: z.boolean(),
    registrationNo: z.string().trim().max(40).default(''),
  }),
  hours: z.array(z.object({ day: z.number().int().min(0).max(6), open: TIME, close: TIME, closed: z.boolean() })).length(7),
  invoicePrefix: z.string().trim().regex(/^[A-Z0-9-]{1,8}$/i).default('INV'),
  memberIdPrefix: z.string().trim().regex(/^[A-Z0-9-]{0,6}$/i).default('M'),
  categories: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,20}$/)).min(1).max(10),
});

r.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const t = await runAsPlatform(() => Tenant.findById(req.tenant!._id).lean());
    res.json({ success: true, data: { name: t!.name, setupCompleted: t!.setupCompleted, ...(t!.settings as any) } });
  })
);

r.put(
  '/settings',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(settingsSchema, req.body);
    try {
      new Intl.NumberFormat(body.locale, { style: 'currency', currency: body.currency });
      new Intl.DateTimeFormat('en', { timeZone: body.timezone });
    } catch {
      throw new ApiError(400, 'Unknown currency, locale or timezone');
    }
    const { name, ...settings } = body;
    const t = await runAsPlatform(() =>
      Tenant.findByIdAndUpdate(req.tenant!._id, { $set: { name, settings } }, { new: true, runValidators: true }).lean()
    );
    await invalidateTenantCache(t as any);
    await invalidateSite(req.tenant!._id);
    await audit(req, 'settings.update', 'Tenant', req.tenant!._id);
    res.json({ success: true, data: { name: t!.name, ...(t!.settings as any) } });
  })
);

r.post(
  '/settings/setup-complete',
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const t = await runAsPlatform(() => Tenant.findByIdAndUpdate(req.tenant!._id, { $set: { setupCompleted: true, status: 'active' } }, { new: true }).lean());
    await invalidateTenantCache(t as any);
    await audit(req, 'setup.complete', 'Tenant', req.tenant!._id);
    res.json({ success: true });
  })
);

/* ---------------------------------- plans ---------------------------------- */

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(600).default(''),
  features: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  durationDays: z.number().int().min(1).max(3660),
  billingLabel: z.string().trim().max(30).default('month'),
  prices: z.array(z.object({ category: z.string().trim().toLowerCase().max(20), amount: z.number().min(0).max(10_000_000) })).min(1).max(10),
  joiningFee: z.number().min(0).default(0),
  isPublic: z.boolean().default(true),
  active: z.boolean().default(true),
  highlight: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

r.use(
  '/plans',
  crudRouter({
    model: Plan,
    schema: planSchema,
    entity: 'Plan',
    filters: { active: zBool, isPublic: zBool },
    searchable: ['name'],
    defaultSort: 'sortOrder name',
    sortable: ['name', 'sortOrder', 'createdAt'],
    read: [requirePermission('plans.read', 'plans.manage', 'website.manage')],
    write: [requirePermission('plans.manage')],
    onChange: (req) => invalidateSite(req.tenant!._id),
  })
);

/* ---------------------------------- offers ---------------------------------- */

const offerSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).default(''),
  discountType: z.enum(['percent', 'flat']),
  value: z.number().positive().max(10_000_000),
  planIds: z.array(zId).max(50).default([]),
  categories: z.array(z.string().trim().toLowerCase().max(20)).max(10).default([]),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{0,20}$/, 'Letters, numbers, - and _ only').default(''),
  autoApply: z.boolean().default(true),
  startsAt: zDate,
  endsAt: zDate,
  display: z
    .object({ bar: z.boolean().default(false), popup: z.boolean().default(false), banner: z.boolean().default(false), badge: z.boolean().default(true) })
    .default({}),
  badgeText: z.string().trim().max(30).default(''),
  imageUrl: z.string().trim().max(2000).refine((v) => v === '' || v.startsWith('https://'), 'Must be https').default(''),
  active: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  maxRedemptions: z.number().int().min(0).default(0),
});

r.use(
  '/offers',
  crudRouter({
    model: Offer,
    schema: offerSchema,
    entity: 'Offer',
    filters: { active: zBool },
    searchable: ['title', 'code'],
    defaultSort: '-startsAt',
    sortable: ['startsAt', 'endsAt', 'createdAt', 'priority'],
    read: [requirePermission('offers.manage', 'payments.record', 'billing.read')],
    write: [requirePermission('offers.manage')],
    check: (o) =>
      new Date(o.endsAt) <= new Date(o.startsAt)
        ? 'End date must be after the start date'
        : o.discountType === 'percent' && o.value > 100
          ? 'A percentage discount cannot exceed 100'
          : null,
    onChange: (req) => invalidateSite(req.tenant!._id),
  })
);

export default r;
