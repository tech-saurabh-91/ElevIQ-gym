import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, parse } from '../lib/http.js';
import { addDays, startOfDay } from '../lib/util.js';
import { zDate } from '../lib/crud.js';
import { requirePermission } from '../middleware/auth.js';
import { can } from '../auth/permissions.js';
import { Lead, Member } from '../models/crm.js';
import { Invoice, Payment, Expense } from '../models/billing.js';
import { CheckIn } from '../models/modules.js';
import { refreshMemberStatuses } from './crm.js';

const r = Router();

/** Dashboard KPIs. Financial numbers are only included for roles that may see them. */
r.get(
  '/dashboard',
  requirePermission('dashboard.view'),
  asyncHandler(async (req, res) => {
    await refreshMemberStatuses();
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [active, expiring7, expiredRecent, newLeads, checkinsToday, inside, byStatus, newMembers] = await Promise.all([
      Member.countDocuments({ status: 'active' }),
      Member.countDocuments({ status: 'active', expiresAt: { $gte: now, $lte: addDays(now, 7) } }),
      Member.countDocuments({ status: 'expired', expiresAt: { $gte: addDays(now, -30) } }),
      Lead.countDocuments({ status: 'new' }),
      CheckIn.countDocuments({ inAt: { $gte: today } }),
      CheckIn.countDocuments({ inAt: { $gte: today }, outAt: null }),
      Member.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Member.countDocuments({ joinedAt: { $gte: monthStart } }),
    ]);
    const data: Record<string, unknown> = { active, expiring7, expiredRecent, newLeads, checkinsToday, inside, byStatus, newMembers };

    if (can(req.user!.role, 'billing.read')) {
      const [today$, month$, outstanding, expenses] = await Promise.all([
        Payment.aggregate([{ $match: { paidAt: { $gte: today } } }, { $group: { _id: null, t: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } }]),
        Payment.aggregate([{ $match: { paidAt: { $gte: monthStart } } }, { $group: { _id: null, t: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } }]),
        Invoice.aggregate([{ $match: { status: { $in: ['unpaid', 'partial'] } } }, { $group: { _id: null, t: { $sum: { $subtract: ['$total', '$paid'] } }, n: { $sum: 1 } } }]),
        Expense.aggregate([{ $match: { paidAt: { $gte: monthStart } } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
      ]);
      Object.assign(data, {
        collectedToday: today$[0]?.t ?? 0,
        collectedMonth: month$[0]?.t ?? 0,
        outstanding: outstanding[0]?.t ?? 0,
        outstandingCount: outstanding[0]?.n ?? 0,
        expensesMonth: expenses[0]?.t ?? 0,
      });
    }
    res.json({ success: true, data });
  })
);

/** Memberships expiring in the next N days (and optionally those that lapsed recently). */
r.get(
  '/expiring',
  requirePermission('reports.read', 'members.read'),
  asyncHandler(async (req, res) => {
    await refreshMemberStatuses();
    const q = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30), lapsedDays: z.coerce.number().int().min(0).max(365).default(0) }), req.query);
    const now = new Date();
    const from = q.lapsedDays ? addDays(now, -q.lapsedDays) : now;
    const items = await Member.find({ status: { $in: ['active', 'expired'] }, expiresAt: { $gte: from, $lte: addDays(now, q.days) } })
      .sort('expiresAt')
      .limit(1000)
      .select('memberNo firstName lastName phone email currentPlanName expiresAt status category gender')
      .lean();
    res.json({ success: true, data: items });
  })
);

const AGE_BUCKETS = [0, 18, 25, 35, 45, 55, 65, 200];
const AGE_LABELS = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

/** Gender, age-group and category breakdowns. */
r.get(
  '/demographics',
  requirePermission('reports.read'),
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ status: z.enum(['active', 'all']).default('active') }), req.query);
    const match = q.status === 'active' ? { status: 'active' } : {};
    const now = new Date();
    const [gender, age, category, unknownAge] = await Promise.all([
      Member.aggregate([{ $match: match }, { $group: { _id: '$gender', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Member.aggregate([
        { $match: { ...match, dob: { $type: 'date' } } },
        { $project: { age: { $dateDiff: { startDate: '$dob', endDate: now, unit: 'year' } }, gender: 1 } },
        { $bucket: { groupBy: '$age', boundaries: AGE_BUCKETS, default: 'other', output: { count: { $sum: 1 }, male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } }, female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } } } } },
      ]),
      Member.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Member.countDocuments({ ...match, $or: [{ dob: null }, { dob: { $exists: false } }] }),
    ]);
    const ageGroups = AGE_LABELS.map((label, i) => {
      const hit = age.find((a) => a._id === AGE_BUCKETS[i]);
      return { label, count: hit?.count ?? 0, male: hit?.male ?? 0, female: hit?.female ?? 0 };
    });
    res.json({ success: true, data: { gender, ageGroups, unknownAge, category } });
  })
);

/** Collections between two dates, by day / method / kind, in the gym's timezone. */
r.get(
  '/collections',
  requirePermission('billing.read'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const q = parse(z.object({ from: zDate.default(addDays(startOfDay(now), -29)), to: zDate.default(now) }), req.query);
    const to = new Date(q.to);
    if (to.getHours() === 0 && to.getMinutes() === 0) to.setHours(23, 59, 59, 999);
    const tz = req.tenant!.settings.timezone || 'UTC';
    const match = { $match: { paidAt: { $gte: q.from, $lte: to } } };
    const net = { $subtract: ['$amount', '$refundedAmount'] };
    const [byDay, byMethod, totals, byKind] = await Promise.all([
      Payment.aggregate([match, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: tz } }, total: { $sum: net }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Payment.aggregate([match, { $group: { _id: '$method', total: { $sum: net }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Payment.aggregate([match, { $group: { _id: null, gross: { $sum: '$amount' }, refunds: { $sum: '$refundedAmount' }, count: { $sum: 1 } } }]),
      Payment.aggregate([
        match,
        { $lookup: { from: 'invoices', localField: 'invoice', foreignField: '_id', as: 'inv' } },
        { $group: { _id: { $ifNull: [{ $first: '$inv.kind' }, 'other'] }, total: { $sum: net } } },
      ]),
    ]);
    const t = totals[0] ?? { gross: 0, refunds: 0, count: 0 };
    res.json({ success: true, data: { from: q.from, to, byDay, byMethod, byKind, gross: t.gross, refunds: t.refunds, net: t.gross - t.refunds, count: t.count } });
  })
);

export default r;
