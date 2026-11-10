import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { audit } from '../lib/util.js';
import { User, safeUser } from '../models/user.js';
import { protect, signTenantToken } from '../middleware/auth.js';
import { permissionsFor, ROLE_LABELS, type Role } from '../auth/permissions.js';

const r = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${req.tenant?._id}|${String(req.body?.email || '').toLowerCase()}`,
  message: { success: false, message: 'Too many sign-in attempts. Please wait 15 minutes.' },
});

// Constant-time-ish: compare against a dummy hash when the user does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 11);

const session = (u: any, req: any) => ({
  user: { ...safeUser(u), roleLabel: ROLE_LABELS[u.role as Role] },
  permissions: permissionsFor(u.role as Role),
  tenant: { name: req.tenant.name, slug: req.tenant.slug, setupCompleted: req.tenant.setupCompleted },
});

/** One login page for owner, staff and members. Role decides what they see. */
r.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }), req.body);
    const user = await User.findOne({ email }).select('+password');
    const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !ok) throw new ApiError(401, 'Incorrect email or password');
    if (user.status !== 'active') throw new ApiError(403, 'This account is disabled. Contact the gym owner.');
    user.lastLoginAt = new Date();
    await user.save();
    req.user = { _id: String(user._id), name: user.name, email: user.email, role: user.role as Role };
    await audit(req, 'login', 'User', user._id);
    res.json({ success: true, token: signTenantToken({ sub: String(user._id), tid: req.tenant!._id, ver: user.tokenVersion }), ...session(user, req) });
  })
);

r.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.user!._id).lean();
    res.json({ success: true, ...session(u, req), impersonatedBy: req.user!.impersonatedBy ?? null });
  })
);

r.put(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ name: z.string().trim().min(2).max(80).optional(), phone: z.string().max(30).optional() }), req.body);
    const u = await User.findByIdAndUpdate(req.user!._id, { $set: body }, { new: true }).lean();
    res.json({ success: true, user: safeUser(u) });
  })
);

r.put(
  '/password',
  protect,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parse(
      z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, 'Use at least 8 characters').max(200) }),
      req.body
    );
    const user = await User.findById(req.user!._id).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw new ApiError(400, 'Current password is incorrect');
    user.password = newPassword;
    user.tokenVersion += 1; // signs out every other device
    await user.save();
    await audit(req, 'password.change', 'User', user._id);
    res.json({ success: true, token: signTenantToken({ sub: String(user._id), tid: req.tenant!._id, ver: user.tokenVersion }) });
  })
);

r.post(
  '/logout-all',
  protect,
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user!._id }, { $inc: { tokenVersion: 1 } });
    res.json({ success: true });
  })
);

export default r;
