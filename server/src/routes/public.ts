import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { cache, cacheKeys } from '../lib/cache.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { quote } from '../lib/pricing.js';
import { siteContentSchema } from '../lib/siteContent.js';
import { zId } from '../lib/crud.js';
import { Offer, Plan } from '../models/catalog.js';
import { Lead } from '../models/crm.js';
import { SiteRevision } from '../models/site.js';
import { User } from '../models/user.js';
import { can, type Role } from '../auth/permissions.js';
import { buildPublicPayload, getPublishedContent } from '../services/site.js';

const r = Router();

/** Public website payload. `?preview=draft` returns the unpublished draft to signed-in editors only. */
r.get(
  '/site',
  asyncHandler(async (req, res) => {
    const tid = req.tenant!._id;
    if (req.query.preview === 'draft') {
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      let ok = false;
      try {
        const p = jwt.verify(token, env().JWT_SECRET, { audience: 'tenant' }) as any;
        if (p.tid === tid) {
          const u = await User.findById(p.sub).lean();
          ok = Boolean(u && u.status === 'active' && u.tokenVersion === p.ver && can(u.role as Role, 'website.manage'));
        }
      } catch { /* not allowed */ }
      if (!ok) throw new ApiError(403, 'Preview requires a website editor sign-in');
      const draft = await SiteRevision.findOne({ status: 'draft' }).lean();
      const content = draft ? siteContentSchema.parse(draft.content) : await getPublishedContent();
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, data: { ...(await buildPublicPayload(tid, content)), preview: true } });
    }
    const key = cacheKeys.site(tid);
    let payload = await cache().get<any>(key);
    if (!payload) {
      payload = await buildPublicPayload(tid, await getPublishedContent());
      await cache().set(key, payload, 120);
    }
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ success: true, data: payload });
  })
);

/** Live price for a plan/category (+ optional promo code) - the join page uses this. */
r.get(
  '/quote',
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ planId: zId, category: z.string().max(30).default('standard'), code: z.string().max(30).optional() }), req.query);
    const plan = await Plan.findOne({ _id: q.planId, active: true, isPublic: true }).lean();
    if (!plan) throw new ApiError(404, 'Plan not found');
    const offers = await Offer.find({ active: true }).lean();
    const s = req.tenant!.settings;
    res.json({
      success: true,
      data: quote({ plan: plan as any, category: q.category, code: q.code, offers: offers as any, currency: s.currency, tax: { label: s.tax?.label, rate: s.tax?.rate ?? 0, inclusive: !!s.tax?.inclusive }, includeJoiningFee: true }),
    });
  })
);

const leadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many submissions, please try again later.' } });

const leadSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).default(''),
    email: z.string().trim().email().max(120).or(z.literal('')).default(''),
    message: z.string().trim().max(2000).default(''),
    source: z.enum(['enquiry', 'join']).default('enquiry'),
    planId: zId.optional(),
    category: z.string().max(30).optional(),
    offerId: zId.optional(),
    website: z.string().max(0).optional(), // honeypot - bots fill it, humans never see it
  })
  .refine((v) => v.phone || v.email, { message: 'Please give a phone number or email', path: ['phone'] });

/** Enquiry + "Join now" forms. These ONLY create leads - never members, never invoices. */
r.post(
  '/leads',
  leadLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(leadSchema, req.body);
    if (body.planId && !(await Plan.exists({ _id: body.planId }))) throw new ApiError(400, 'Unknown plan');
    await Lead.create({
      name: body.name, phone: body.phone, email: body.email, message: body.message, source: body.source,
      planInterest: body.planId, category: body.category ?? '', offerId: body.offerId,
    });
    res.status(201).json({ success: true, message: 'Thanks! Our team will contact you shortly.' });
  })
);

export default r;
