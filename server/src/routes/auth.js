import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Member } from '../models/Member.js';
import { Staff } from '../models/Staff.js';
import { asyncHandler, ApiError, protect } from '../middleware/auth.js';

const router = Router();

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });

const buildPayload = (user) => ({ token: signToken(user), user: user.toSafeJSON ? user.toSafeJSON() : user });

async function loadProfile(user) {
  if (user.role === 'member') {
    const member = await Member.findOne({ user: user._id }).populate('plan', 'name code price billing features');
    return { ...user, member: member || null };
  }
  if (user.role === 'trainer') {
    const staff = await Staff.findOne({ user: user._id });
    return { ...user, staff: staff || null };
  }
  return user;
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, country, currency, locale, planId, goals } = req.body;
    if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
    if (String(password).length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) throw new ApiError(409, 'An account with this email already exists');

    const user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      country: country || 'US',
      currency: currency || 'USD',
      locale: locale || 'en',
      role: 'member',
    });

    const seq = (await Member.countDocuments()) + 1001;
    const memberId = `GF-${String(seq).padStart(5, '0')}`;
    const referralCode = `${String(name).slice(0, 3).toUpperCase()}${String(seq).slice(-3)}`;

    await Member.create({
      user: user._id,
      memberId,
      firstName: String(name).split(' ')[0],
      lastName: String(name).split(' ').slice(1).join(' '),
      plan: planId || undefined,
      goals: Array.isArray(goals) ? goals : [],
      status: 'pending',
      referralCode,
      qrToken: `${memberId}-${Date.now().toString(36)}`,
      joinedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 864e5),
    });

    res.status(201).json({ success: true, ...buildPayload(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, 'Email and password are required');
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid email or password');
    if (user.status === 'suspended') throw new ApiError(403, 'Account suspended. Contact the front desk.');
    user.lastLoginAt = new Date();
    await user.save();
    const profile = await loadProfile(user.toSafeJSON());
    res.json({ success: true, token: signToken(user), user: profile });
  })
);

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const profile = await loadProfile(req.user.toObject());
    res.json({ success: true, user: profile });
  })
);

router.put(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const allowed = ['name', 'phone', 'avatar', 'locale', 'country', 'currency', 'timezone', 'preferences'];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) req.user[k] = req.body[k];
    });
    await req.user.save();
    res.json({ success: true, user: req.user.toSafeJSON() });
  })
);

router.put(
  '/password',
  protect,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new ApiError(400, 'Both passwords are required');
    if (String(newPassword).length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) throw new ApiError(401, 'Current password is incorrect');
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  })
);

export default router;
