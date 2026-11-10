import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ApiError, asyncHandler, escapeRegex, parse } from '../lib/http.js';
import { runAsPlatform, runInTenant } from '../lib/tenantContext.js';
import { attachVercelDomain } from '../lib/integrations.js';
import { defaultSiteContent } from '../lib/siteContent.js';
import { protectPlatform, signPlatformToken, signTenantToken } from '../middleware/auth.js';
import { invalidateTenantCache, normalizeHost } from '../middleware/tenant.js';
import { PlatformUser, Tenant } from '../models/platform.js';
import { User } from '../models/user.js';
import { Member } from '../models/crm.js';
import { SiteRevision } from '../models/site.js';
import { AuditLog } from '../models/billing.js';

/** Vendor super-admin console: create gyms, assign domains, support them. No tenant scope. */
const r = Router();
r.use((_req, _res, next) => runAsPlatform(() => next()));

const DUMMY = bcrypt.hashSync('dummy-password', 11);
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts' } });

r.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }), req.body);
    const u = await PlatformUser.findOne({ email }).select('+password');
    const ok = await bcrypt.compare(password, u?.password ?? DUMMY);
    if (!u || !ok) throw new ApiError(401, 'Incorrect email or password');
    u.lastLoginAt = new Date();
    await u.save();
    res.json({ success: true, token: signPlatformToken({ sub: String(u._id), ver: u.tokenVersion }), user: { name: u.name, email: u.email } });
  })
);

r.use(protectPlatform);

r.get('/me', (req, res) => res.json({ success: true, user: req.platformUser, rootDomain: env().ROOT_DOMAIN }));

r.get(
  '/tenants',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { slug: new RegExp(escapeRegex(q), 'i') }, { domains: new RegExp(escapeRegex(q), 'i') }] } : {};
    const tenants = await Tenant.find(filter).sort('-createdAt').limit(200).lean();
    const counts = await Member.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]);
    const byId = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ success: true, data: tenants.map((t) => ({ ...t, activeMembers: byId.get(String(t._id)) ?? 0 })) });
  })
);

const SLUG = z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, '3-40 lowercase letters, numbers or dashes');
const RESERVED = new Set(['www', 'api', 'admin', 'app', 'platform', 'mail', 'static', 'cdn']);

r.post(
  '/tenants',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2).max(120),
        slug: SLUG,
        ownerName: z.string().trim().min(2).max(80),
        ownerEmail: z.string().trim().toLowerCase().email(),
        ownerPassword: z.string().min(8).max(200),
        currency: z.string().length(3).toUpperCase().default('INR'),
        locale: z.string().default('en-IN'),
        timezone: z.string().default('Asia/Kolkata'),
      }),
      req.body
    );
    if (RESERVED.has(body.slug)) throw new ApiError(400, 'That address is reserved');
    if (await Tenant.exists({ slug: body.slug })) throw new ApiError(409, 'That address is already taken');
    const tenant = await Tenant.create({
      name: body.name, slug: body.slug, contactEmail: body.ownerEmail, status: 'trial',
      settings: { currency: body.currency, locale: body.locale, timezone: body.timezone, legalName: body.name },
    });
    try {
      await runInTenant(tenant._id, async () => {
        await User.create({ name: body.ownerName, email: body.ownerEmail, password: body.ownerPassword, role: 'owner' });
        await SiteRevision.create({ status: 'draft', version: 1, content: defaultSiteContent(body.name) });
      });
    } catch (e) {
      await Tenant.deleteOne({ _id: tenant._id });
      throw e;
    }
    res.status(201).json({ success: true, data: { tenant, url: `https://${tenant.slug}.${env().ROOT_DOMAIN}` } });
  })
);

r.get(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const t = await Tenant.findById(req.params.id).lean();
    if (!t) throw new ApiError(404, 'Gym not found');
    const tid = t._id as Types.ObjectId;
    const [owners, members, activeMembers, recentAudit] = await Promise.all([
      User.find({ tenantId: tid, role: 'owner' }).select('name email status lastLoginAt').lean(),
      Member.countDocuments({ tenantId: tid }),
      Member.countDocuments({ tenantId: tid, status: 'active' }),
      AuditLog.find({ tenantId: tid }).sort('-createdAt').limit(20).lean(),
    ]);
    res.json({ success: true, data: { tenant: t, owners, members, activeMembers, recentAudit } });
  })
);

r.put(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ name: z.string().trim().min(2).max(120).optional(), status: z.enum(['active', 'suspended', 'trial']).optional(), notes: z.string().max(2000).optional(), contactEmail: z.string().email().optional() }), req.body);
    const t = await Tenant.findByIdAndUpdate(req.params.id, { $set: body }, { new: true }).lean();
    if (!t) throw new ApiError(404, 'Gym not found');
    await invalidateTenantCache(t);
    res.json({ success: true, data: t });
  })
);

const DOMAIN = z
  .string()
  .transform(normalizeHost)
  .pipe(z.string().regex(/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, 'Enter a domain like mygym.com'));

r.post(
  '/tenants/:id/domains',
  asyncHandler(async (req, res) => {
    const { domain } = parse(z.object({ domain: DOMAIN }), req.body);
    if (domain.endsWith(`.${env().ROOT_DOMAIN}`)) throw new ApiError(400, `Sub-domains of ${env().ROOT_DOMAIN} are automatic`);
    if (await Tenant.exists({ domains: domain })) throw new ApiError(409, 'That domain is already assigned to a gym');
    const t = await Tenant.findByIdAndUpdate(req.params.id, { $addToSet: { domains: domain } }, { new: true }).lean();
    if (!t) throw new ApiError(404, 'Gym not found');
    await invalidateTenantCache(t);
    const vercel = await attachVercelDomain(domain);
    res.json({ success: true, data: t, vercel, dns: { type: 'CNAME', name: domain.split('.').length > 2 ? domain.split('.')[0] : '@', value: 'cname.vercel-dns.com' } });
  })
);

r.delete(
  '/tenants/:id/domains/:domain',
  asyncHandler(async (req, res) => {
    const domain = normalizeHost(String(req.params.domain));
    const t = await Tenant.findByIdAndUpdate(req.params.id, { $pull: { domains: domain } }, { new: true }).lean();
    if (!t) throw new ApiError(404, 'Gym not found');
    await invalidateTenantCache({ slug: t.slug, domains: [domain] });
    res.json({ success: true, data: t });
  })
);

/** Support access: a short-lived owner session, recorded in the gym's audit log. */
r.post(
  '/tenants/:id/impersonate',
  asyncHandler(async (req, res) => {
    const t = await Tenant.findById(req.params.id).lean();
    if (!t) throw new ApiError(404, 'Gym not found');
    const tid = t._id as Types.ObjectId;
    const owner = await User.findOne({ tenantId: tid, role: 'owner', status: 'active' }).lean();
    if (!owner) throw new ApiError(400, 'This gym has no active owner');
    await runInTenant(tid, () =>
      AuditLog.create({ action: 'support.impersonate', actorName: `Vendor: ${req.platformUser!.email}`, impersonatedBy: req.platformUser!.email, entity: 'User', entityId: String(owner._id), ip: req.ip })
    );
    const token = signTenantToken({ sub: String(owner._id), tid: String(tid), ver: owner.tokenVersion, imp: req.platformUser!.email }, '1h');
    res.json({ success: true, data: { token, slug: t.slug, url: `https://${t.slug}.${env().ROOT_DOMAIN}` } });
  })
);

r.post(
  '/tenants/:id/reset-owner-password',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(200) }), req.body);
    const tid = new Types.ObjectId(String(req.params.id));
    const owner = await User.findOne({ tenantId: tid, email, role: 'owner' }).select('+password');
    if (!owner) throw new ApiError(404, 'Owner not found');
    owner.password = password;
    owner.tokenVersion += 1;
    await owner.save();
    res.json({ success: true });
  })
);

export default r;
