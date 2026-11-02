import { Router } from 'express';
import { Member } from '../models/Member.js';
import { ClassSession, Booking } from '../models/Class.js';
import { Equipment, Maintenance } from '../models/Equipment.js';
import { Payment, Expense, Product, Invoice } from '../models/Finance.js';
import { CheckIn, ContactMessage } from '../models/Operations.js';
import { Staff } from '../models/Staff.js';
import { asyncHandler, protect, authorize } from '../middleware/auth.js';

const router = Router();
router.use(protect);

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    const [
      totalMembers, activeMembers, newMembers, expiringSoon, staffCount, activeStaff,
      revenueAgg, expenseAgg, todayVisits, insideNow, openTickets, upcomingClasses,
      pendingMessages, lowStock, outstandingAgg, byStatus,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: 'active' }),
      Member.countDocuments({ joinedAt: { $gte: monthStart } }),
      Member.countDocuments({ status: 'active', expiresAt: { $lte: new Date(Date.now() + 30 * 864e5) } }),
      Staff.countDocuments(),
      Staff.countDocuments({ status: 'active' }),
      Payment.aggregate([{ $match: { paidAt: { $gte: monthStart }, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { paidAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      CheckIn.countDocuments({ inAt: { $gte: todayStart } }),
      CheckIn.countDocuments({ outAt: null }),
      Maintenance.countDocuments({ status: { $in: ['open', 'in-progress'] } }),
      ClassSession.countDocuments({ date: { $gte: todayStart }, status: { $ne: 'cancelled' } }),
      ContactMessage.countDocuments({ status: 'new' }),
      Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockAt'] } }),
      Invoice.aggregate([{ $match: { status: { $in: ['issued', 'overdue'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Member.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const revenue = revenueAgg[0]?.total || 0;
    const expenses = expenseAgg[0]?.total || 0;

    res.json({
      success: true,
      data: {
        totalMembers, activeMembers, newMembers, expiringSoon,
        staffCount, activeStaff,
        revenue, expenses, net: revenue - expenses, paymentsCount: revenueAgg[0]?.count || 0,
        todayVisits, insideNow, openTickets, upcomingClasses, pendingMessages, lowStock,
        outstanding: outstandingAgg[0]?.total || 0,
        byStatus,
        occupancy: Math.min(100, Math.round((insideNow / 250) * 100)),
      },
    });
  })
);

router.get(
  '/revenue',
  asyncHandler(async (req, res) => {
    const months = parseInt(req.query.months, 10) || 12;
    const start = new Date();
    start.setMonth(start.getMonth() - (months - 1));
    start.setDate(1); start.setHours(0, 0, 0, 0);
    const [income, costs, byCategory] = await Promise.all([
      Payment.aggregate([
        { $match: { paidAt: { $gte: start }, status: 'paid' } },
        { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { paidAt: { $gte: start } } },
        { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { paidAt: { $gte: start }, status: 'paid' } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
    ]);
    const lookup = (arr, y, m) => arr.find((x) => x._id.y === y && x._id.m === m)?.total || 0;
    const series = [];
    const cursor = new Date(start);
    while (cursor <= new Date()) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const inc = lookup(income, y, m);
      const cost = lookup(costs, y, m);
      series.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: cursor.toLocaleString('en-US', { month: 'short' }), income: inc, cost, profit: inc - cost });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    res.json({ success: true, data: { series, byCategory } });
  })
);

router.get(
  '/members-analytics',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const cohorts = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await Member.countDocuments({ joinedAt: { $gte: d, $lt: next } });
      cohorts.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('en-US', { month: 'short' }), count });
    }
    const [byGender, byAge, byPlan, byGoal, retention, churn] = await Promise.all([
      Member.aggregate([{ $group: { _id: '$gender', count: { $sum: 1 } } }]),
      Member.aggregate([
        { $match: { dob: { $ne: null } } },
        { $project: { age: { $subtract: [now.getFullYear(), { $year: '$dob' }] } } },
        {
          $bucket: {
            groupBy: '$age',
            boundaries: [0, 18, 25, 35, 45, 55, 65, 120],
            default: 'other',
            output: { count: { $sum: 1 } },
          },
        },
      ]),
      Member.aggregate([{ $group: { _id: '$planName', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Member.aggregate([{ $unwind: '$goals' }, { $group: { _id: '$goals', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Member.countDocuments({ status: 'active' }),
      Member.countDocuments({ status: { $in: ['expired', 'cancelled'] } }),
    ]);
    res.json({ success: true, data: { cohorts, byGender, byAge, byPlan, byGoal, retention, churn } });
  })
);

router.get(
  '/classes-analytics',
  asyncHandler(async (req, res) => {
    const [popularity, occupancy, attendance, upcoming] = await Promise.all([
      ClassSession.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $lookup: { from: 'classtypes', localField: 'classType', foreignField: '_id', as: 'type' } },
        { $unwind: '$type' },
        { $group: { _id: '$type.name', color: { $first: '$type.color' }, sessions: { $sum: 1 }, booked: { $sum: '$booked' }, capacity: { $sum: '$capacity' } } },
        { $sort: { booked: -1 } },
        { $limit: 8 },
      ]),
      ClassSession.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, booked: { $sum: '$booked' }, capacity: { $sum: '$capacity' } } },
      ]),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      ClassSession.find({ date: { $gte: new Date() }, status: { $ne: 'cancelled' } })
        .populate('classType', 'name color category')
        .populate('trainer', 'jobTitle')
        .sort('date start')
        .limit(8)
        .lean(),
    ]);
    const occ = occupancy[0] || { booked: 0, capacity: 0 };
    res.json({
      success: true,
      data: {
        popularity,
        occupancyRate: occ.capacity ? Math.round((occ.booked / occ.capacity) * 100) : 0,
        attendance,
        upcoming,
      },
    });
  })
);

router.get(
  '/equipment-analytics',
  asyncHandler(async (req, res) => {
    const [byStatus, byCategory, topUsed, tickets, avgCondition] = await Promise.all([
      Equipment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Equipment.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, usage: { $sum: '$usageCount' } } }]),
      Equipment.find().sort('-usageCount').limit(6).select('name assetTag usageCount status category').lean(),
      Maintenance.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, cost: { $sum: '$cost' } } },
      ]),
      Equipment.aggregate([{ $group: { _id: null, safety: { $avg: '$safetyScore' } } }]),
    ]);
    res.json({ success: true, data: { byStatus, byCategory, topUsed, tickets, safetyScore: Math.round(avgCondition[0]?.safety || 0) } });
  })
);

router.get(
  '/staff-analytics',
  asyncHandler(async (req, res) => {
    const [byDept, top, shifts] = await Promise.all([
      Staff.aggregate([{ $group: { _id: '$department', count: { $sum: 1 }, payroll: { $sum: '$salary' } } }]),
      Staff.find({ status: 'active' }).sort('-performanceScore').limit(6).select('employeeId jobTitle performanceScore rating kpis').populate('user', 'name avatar').lean(),
      Staff.aggregate([{ $group: { _id: '$shift', count: { $sum: 1 } } }]),
    ]);
    res.json({ success: true, data: { byDept, top, shifts } });
  })
);

router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const [members, payments, checkins, bookings, tickets] = await Promise.all([
      Member.find().sort('-createdAt').limit(5).select('memberId firstName lastName status createdAt').lean(),
      Payment.find().sort('-paidAt').limit(5).select('receiptNo payerName amount currency status paidAt').lean(),
      CheckIn.find().sort('-inAt').limit(5).populate('member', 'memberId firstName lastName').lean(),
      Booking.find().sort('-createdAt').limit(5).populate('member', 'firstName lastName').populate('session', 'title date start').lean(),
      Maintenance.find().sort('-createdAt').limit(5).select('title status priority createdAt').lean(),
    ]);
    const activity = [
      ...members.map((m) => ({ type: 'member', text: `New member ${m.firstName} ${m.lastName} (${m.memberId})`, at: m.createdAt })),
      ...payments.map((p) => ({ type: 'payment', text: `${p.receiptNo} - ${p.payerName} paid ${p.amount} ${p.currency}`, at: p.paidAt })),
      ...checkins.map((c) => ({ type: 'checkin', text: `${c.member?.firstName || 'Member'} ${c.member?.lastName || ''} checked in`, at: c.inAt })),
      ...bookings.map((b) => ({ type: 'booking', text: `${b.member?.firstName || 'Member'} booked ${b.session?.title || 'class'}`, at: b.createdAt })),
      ...tickets.map((t) => ({ type: 'maintenance', text: `Ticket "${t.title}" marked ${t.status}`, at: t.createdAt })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 18);
    res.json({ success: true, data: activity });
  })
);

export default router;
