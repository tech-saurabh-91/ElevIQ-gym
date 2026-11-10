import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, pageParams, parse } from '../lib/http.js';
import { audit } from '../lib/util.js';
import { requirePermission } from '../middleware/auth.js';
import { STAFF_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, can } from '../auth/permissions.js';
import { User, safeUser } from '../models/user.js';
import { AuditLog } from '../models/billing.js';

/** Staff accounts & roles. Everyone signs in on the same page; the role decides the menus. */
const r = Router();
const manage = requirePermission('staff.manage');

r.get('/roles', manage, (_req, res) => {
  res.json({ success: true, data: STAFF_ROLES.map((role) => ({ role, label: ROLE_LABELS[role], permissions: ROLE_PERMISSIONS[role] })) });
});

r.get(
  '/',
  requirePermission('staff.manage', 'classes.manage'),
  asyncHandler(async (req, res) => {
    const users = await User.find({ role: { $in: STAFF_ROLES } }).sort('name').lean();
    // Without staff.manage (e.g. a manager picking a trainer) only names and roles are shown.
    const full = can(req.user!.role, 'staff.manage');
    res.json({ success: true, data: users.map((u) => (full ? safeUser(u) : { _id: u._id, name: u.name, role: u.role, status: u.status })) });
  })
);

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().max(30).default(''),
  role: z.enum(STAFF_ROLES),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
});

r.post(
  '/',
  manage,
  asyncHandler(async (req, res) => {
    const body = parse(createSchema, req.body);
    if (body.role === 'owner' && req.user!.role !== 'owner') throw new ApiError(403, 'Only an owner can add another owner');
    const u = await User.create(body);
    await audit(req, 'staff.create', 'User', u._id, `${u.email} as ${u.role}`);
    res.status(201).json({ success: true, data: safeUser(u) });
  })
);

r.put(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2).max(80).optional(),
        phone: z.string().max(30).optional(),
        role: z.enum(STAFF_ROLES).optional(),
        status: z.enum(['active', 'disabled']).optional(),
        password: z.string().min(8).max(200).optional(),
      }),
      req.body
    );
    const u = await User.findById(req.params.id).select('+password');
    if (!u || u.role === 'member') throw new ApiError(404, 'Staff member not found');
    const isSelf = String(u._id) === req.user!._id;
    if (isSelf && (body.role || body.status)) throw new ApiError(400, 'You cannot change your own role or status');
    if ((u.role === 'owner' || body.role === 'owner') && req.user!.role !== 'owner') throw new ApiError(403, 'Only an owner can change owner accounts');
    if (u.role === 'owner' && ((body.role && body.role !== 'owner') || body.status === 'disabled')) {
      const owners = await User.countDocuments({ role: 'owner', status: 'active' });
      if (owners <= 1) throw new ApiError(400, 'A gym must keep at least one active owner');
    }
    const sensitive = Boolean(body.role || body.status || body.password);
    Object.assign(u, body);
    if (sensitive) u.tokenVersion += 1; // force re-login with new rights
    await u.save();
    await audit(req, 'staff.update', 'User', u._id, Object.keys(body).filter((k) => k !== 'password').join(','));
    res.json({ success: true, data: safeUser(u) });
  })
);

r.delete(
  '/:id',
  manage,
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u || u.role === 'member') throw new ApiError(404, 'Staff member not found');
    if (String(u._id) === req.user!._id) throw new ApiError(400, 'You cannot delete yourself');
    if (u.role === 'owner') {
      if (req.user!.role !== 'owner') throw new ApiError(403, 'Only an owner can remove an owner');
      if ((await User.countDocuments({ role: 'owner' })) <= 1) throw new ApiError(400, 'A gym must keep at least one owner');
    }
    await u.deleteOne();
    await audit(req, 'staff.delete', 'User', u._id, u.email);
    res.json({ success: true });
  })
);

export const auditRouter = Router();
auditRouter.get(
  '/',
  requirePermission('audit.read'),
  asyncHandler(async (req, res) => {
    const { limit, skip, page } = pageParams(req.query);
    const [items, total] = await Promise.all([AuditLog.find().sort('-createdAt').skip(skip).limit(limit).lean(), AuditLog.countDocuments()]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

export default r;
