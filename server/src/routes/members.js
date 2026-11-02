import { Router } from 'express';
import { Member, Plan, Location } from '../models/Member.js';
import User from '../models/User.js';
import { Payment, Invoice } from '../models/Finance.js';
import { CheckIn } from '../models/Operations.js';
import { Booking, ClassSession } from '../models/Class.js';
import { asyncHandler, ApiError, protect, authorize } from '../middleware/auth.js';
import { createCrudRouter } from '../utils/crud.js';

const router = Router();
router.use(protect);

const crud = createCrudRouter(Member, {
  populate: [
    { path: 'plan', select: 'name code price billing features color' },
    { path: 'homeLocation', select: 'name city country' },
    { path: 'user', select: 'email phone avatar role status' },
  ],
  searchable: ['firstName', 'lastName', 'memberId', 'company'],
  defaultSort: '-createdAt',
  create: async (req) => {
    const body = req.body;
    let user = await User.findOne({ email: String(body.email || '').toLowerCase() });
    if (user) throw new ApiError(409, 'A user with this email already exists');
    user = await User.create({
      name: [body.firstName, body.lastName].filter(Boolean).join(' ') || body.email,
      email: body.email,
      password: body.password || 'gym1234',
      phone: body.phone || '',
      role: 'member',
      country: body.country,
      currency: body.currency,
    });
    const seq = (await Member.countDocuments()) + 1001;
    return Member.create({
      ...body,
      user: user._id,
      memberId: body.memberId || `GF-${String(seq).padStart(5, '0')}`,
      referralCode: `M${String(seq).slice(-4)}`,
      qrToken: `QR${Date.now().toString(36)}`,
      status: body.status || 'active',
      joinedAt: body.joinedAt || new Date(),
      expiresAt: body.expiresAt || new Date(Date.now() + 30 * 864e5),
    });
  },
  beforeDelete: async (doc) => {
    await User.deleteOne({ _id: doc.user });
  },
});

router.get('/', crud.list);
router.get('/stats', asyncHandler(async (req, res) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const [total, active, newThisMonth, expiring, byStatus] = await Promise.all([
    Member.countDocuments(),
    Member.countDocuments({ status: 'active' }),
    Member.countDocuments({ joinedAt: { $gte: start } }),
    Member.countDocuments({ status: 'active', expiresAt: { $lte: new Date(Date.now() + 14 * 864e5) } }),
    Member.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  res.json({ success: true, data: { total, active, newThisMonth, expiring, byStatus } });
}));
router.get('/:id', crud.getOne);
router.post('/', crud.createOne);
router.put('/:id', crud.updateOne);
router.delete('/:id', crud.deleteOne);

router.post(
  '/:id/renew',
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id);
    if (!member) throw new ApiError(404, 'Member not found');
    const plan = await Plan.findById(req.body.planId || member.plan);
    const days = req.body.days || plan?.durationDays || 30;
    const base = member.expiresAt && member.expiresAt > new Date() ? member.expiresAt : new Date();
    member.expiresAt = new Date(base.getTime() + days * 864e5);
    member.status = 'active';
    if (plan) member.plan = plan._id, member.planName = plan.name;
    await member.save();

    const amount = req.body.amount ?? plan?.price ?? 0;
    const payment = await Payment.create({
      member: member._id,
      payerName: `${member.firstName} ${member.lastName}`.trim(),
      amount,
      currency: req.body.currency || plan?.currency || 'USD',
      method: req.body.method || 'card',
      category: 'membership',
      description: `Membership renewal - ${plan?.name || 'plan'} (${days} days)`,
      receiptNo: `RCT-${Date.now().toString(36).toUpperCase()}`,
      createdBy: req.user._id,
    });
    res.json({ success: true, data: { member, payment } });
  })
);

router.post(
  '/:id/checkin',
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id);
    if (!member) throw new ApiError(404, 'Member not found');
    if (member.status !== 'active') throw new ApiError(403, `Membership is ${member.status}`);
    const open = await CheckIn.findOne({ member: member._id, outAt: null }).sort('-inAt');
    if (open) {
      open.outAt = new Date();
      open.durationMin = Math.round((open.outAt - open.inAt) / 60000);
      await open.save();
      member.lastVisitAt = open.outAt;
      await member.save();
      return res.json({ success: true, data: { action: 'checkout', checkIn: open } });
    }
    const checkIn = await CheckIn.create({
      member: member._id,
      method: req.body.method || 'manual',
      location: req.body.location,
      verifiedBy: req.user._id,
    });
    member.visitsThisMonth += 1;
    member.totalVisits += 1;
    member.lastVisitAt = checkIn.inAt;
    if (member.status === 'pending') member.status = 'active';
    await member.save();
    res.status(201).json({ success: true, data: { action: 'checkin', checkIn } });
  })
);

router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const [checkIns, bookings] = await Promise.all([
      CheckIn.find({ member: req.params.id }).sort('-inAt').limit(50).lean(),
      Booking.find({ member: req.params.id }).populate('session', 'title date start end status').sort('-createdAt').limit(30).lean(),
    ]);
    res.json({ success: true, data: { checkIns, bookings } });
  })
);

router.get(
  '/me/profile',
  asyncHandler(async (req, res) => {
    const member = await Member.findOne({ user: req.user._id })
      .populate('plan')
      .populate('homeLocation', 'name city');
    if (!member) throw new ApiError(404, 'No member profile linked to this account');
    const [upcoming, payments] = await Promise.all([
      Booking.find({ member: member._id, status: { $in: ['booked', 'checked-in'] } })
        .populate({ path: 'session', populate: { path: 'classType trainer', select: 'name jobTitle color category' } })
        .sort({ 'session.date': 1 })
        .limit(6)
        .lean(),
      Payment.find({ member: member._id }).sort('-paidAt').limit(8).lean(),
    ]);
    res.json({ success: true, data: { member, upcoming, payments } });
  })
);

export default router;
