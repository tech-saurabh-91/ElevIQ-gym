import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler, parse } from '../lib/http.js';
import { addDays } from '../lib/util.js';
import { requirePermission } from '../middleware/auth.js';
import { can, type Permission } from '../auth/permissions.js';
import { Lead, Member } from '../models/crm.js';
import { Invoice, Payment, Expense } from '../models/billing.js';
import { CheckIn } from '../models/modules.js';
import { refreshMemberStatuses } from './crm.js';
import { monthKey, partsInTz, startOfDayTz, startOfMonthTz, zonedTime } from '../lib/time.js';
// ExcelJS is large: it is loaded only when someone actually exports, keeping cold starts fast.
import type { SheetSpec } from '../lib/excel.js';

/**
 * Every report is defined ONCE here (filters + data). The JSON endpoint, the dashboard charts and the
 * Excel export all call the same function with the same filters, so their numbers always match.
 */
const r = Router();

type Ctx = { tz: string; currency: string; locale: string; gym: string };
const ctxOf = (req: Request): Ctx => ({
  tz: req.tenant!.settings.timezone || 'UTC',
  currency: req.tenant!.settings.currency || 'USD',
  locale: req.tenant!.settings.locale || 'en',
  gym: req.tenant!.name,
});

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayStart = (tz: string, ymd: string, plus = 0) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return zonedTime(tz, y, m, d + plus);
};
const ymdInTz = (tz: string, at: Date) => {
  const p = partsInTz(at, tz);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
};
const fmtDay = (c: Ctx, ymd: string) => new Intl.DateTimeFormat(c.locale, { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${ymd}T00:00:00Z`));
const net = { $subtract: ['$amount', '$refundedAmount'] };
const pct = (a: number, b: number) => (b ? (a - b) / b : null);

/* --------------------------------- definitions --------------------------------- */

const expiringQ = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  fromDays: z.coerce.number().int().min(0).max(365).default(0),
  lapsedDays: z.coerce.number().int().min(0).max(365).default(0),
});
async function expiringData(_c: Ctx, q: z.infer<typeof expiringQ>) {
  await refreshMemberStatuses();
  const now = new Date();
  const from = q.lapsedDays ? addDays(now, -q.lapsedDays) : addDays(now, q.fromDays);
  const items = await Member.find({ status: { $in: ['active', 'expired'] }, expiresAt: { $gte: from, $lte: addDays(now, q.days) } })
    .sort('expiresAt')
    .limit(5000)
    .select('memberNo firstName lastName phone email currentPlanName expiresAt status category gender')
    .lean();
  return items;
}

const demoQ = z.object({ status: z.enum(['active', 'all']).default('active') });
const AGE_BUCKETS = [0, 18, 25, 35, 45, 55, 65, 200];
const AGE_LABELS = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
async function demographicsData(_c: Ctx, q: z.infer<typeof demoQ>) {
  await refreshMemberStatuses();
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
  return { gender, ageGroups, unknownAge, category };
}

const collQ = z.object({
  from: z.string().regex(DAY).optional(),
  to: z.string().regex(DAY).optional(),
  groupBy: z.enum(['day', 'month']).default('day'),
});
async function collectionsData(c: Ctx, raw: z.infer<typeof collQ>) {
  const now = new Date();
  const to = raw.to ?? ymdInTz(c.tz, now);
  const from = raw.from ?? ymdInTz(c.tz, startOfDayTz(c.tz, now, -29));
  const start = dayStart(c.tz, from);
  const end = dayStart(c.tz, to, 1); // exclusive: the whole "to" day counts
  const match = { $match: { paidAt: { $gte: start, $lt: end } } };
  const fmt = raw.groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const [series, byMethod, totals, byKind] = await Promise.all([
    Payment.aggregate([match, { $group: { _id: { $dateToString: { format: fmt, date: '$paidAt', timezone: c.tz } }, total: { $sum: net }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Payment.aggregate([match, { $group: { _id: '$method', total: { $sum: net }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Payment.aggregate([match, { $group: { _id: null, gross: { $sum: '$amount' }, refunds: { $sum: '$refundedAmount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([
      match,
      { $lookup: { from: 'invoices', localField: 'invoice', foreignField: '_id', as: 'inv' } },
      { $group: { _id: { $ifNull: [{ $first: '$inv.kind' }, 'other'] }, total: { $sum: net } } },
    ]),
  ]);
  // Fill gaps so charts and Excel show every day/month in range, including zeros.
  const filled: { _id: string; total: number; count: number }[] = [];
  const hit = new Map(series.map((s) => [s._id, s]));
  if (raw.groupBy === 'month') {
    for (let i = 0; i < 60; i += 1) {
      const k = monthKey(c.tz, startOfMonthTz(c.tz, start, i));
      if (k > to.slice(0, 7)) break;
      filled.push({ _id: k, total: hit.get(k)?.total ?? 0, count: hit.get(k)?.count ?? 0 });
    }
  } else {
    for (let i = 0; i < 400; i += 1) {
      const k = ymdInTz(c.tz, dayStart(c.tz, from, i));
      if (k > to) break;
      filled.push({ _id: k, total: hit.get(k)?.total ?? 0, count: hit.get(k)?.count ?? 0 });
    }
  }
  const t = totals[0] ?? { gross: 0, refunds: 0, count: 0 };
  return { from, to, groupBy: raw.groupBy, series: filled, byDay: filled, byMethod, byKind, gross: t.gross, refunds: t.refunds, net: t.gross - t.refunds, count: t.count, range: { start, end } };
}

const moveQ = z.object({ months: z.coerce.number().int().min(1).max(24).default(6) });
/** New joiners vs memberships that lapsed (and were not renewed) per month. */
async function movementData(c: Ctx, q: z.infer<typeof moveQ>) {
  await refreshMemberStatuses();
  const now = new Date();
  const first = startOfMonthTz(c.tz, now, -(q.months - 1));
  const end = startOfMonthTz(c.tz, now, 1);
  const month = (field: string) => ({ $dateToString: { format: '%Y-%m', date: field, timezone: c.tz } });
  // One round trip for every month (was 2 queries per month).
  const [agg] = await Member.aggregate([
    {
      $facet: {
        joined: [{ $match: { joinedAt: { $gte: first, $lt: end } } }, { $group: { _id: month('$joinedAt'), n: { $sum: 1 } } }],
        expired: [{ $match: { expiresAt: { $gte: first, $lt: now } } }, { $group: { _id: month('$expiresAt'), n: { $sum: 1 } } }],
      },
    },
  ]);
  const j = new Map<string, number>(agg.joined.map((x: any) => [x._id, x.n]));
  const e = new Map<string, number>(agg.expired.map((x: any) => [x._id, x.n]));
  return Array.from({ length: q.months }, (_, i) => {
    const key = monthKey(c.tz, startOfMonthTz(c.tz, now, i - (q.months - 1)));
    const joined = j.get(key) ?? 0;
    const expired = e.get(key) ?? 0;
    return { month: key, joined, expired, net: joined - expired };
  });
}

/* ------------------------------------ JSON ------------------------------------ */

const REPORTS: Record<string, { perms: Permission[]; title: string; run: (c: Ctx, query: unknown) => Promise<{ data: unknown; filters: string[]; sheets: SheetSpec[] }> }> = {
  expiring: {
    perms: ['reports.read', 'members.read'],
    title: 'Expiring memberships',
    run: async (c, query) => {
      const q = parse(expiringQ, query);
      const data = await expiringData(c, q);
      const filters = [q.lapsedDays ? `Expiring within ${q.days} days, incl. lapsed in last ${q.lapsedDays} days` : q.fromDays ? `Expiring in ${q.fromDays}-${q.days} days` : `Expiring within ${q.days} days`];
      return {
        data, filters,
        sheets: [{
          name: 'Expiring', totalsLabel: `Total: ${data.length} members`,
          columns: [
            { header: 'Member no.', key: 'memberNo', width: 14 }, { header: 'Name', key: 'name', width: 26 }, { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Email', key: 'email', width: 30 }, { header: 'Plan', key: 'currentPlanName', width: 16 }, { header: 'Category', key: 'category', width: 12 },
            { header: 'Expires', key: 'expiresAt', type: 'date', width: 14 }, { header: 'Days left', key: 'daysLeft', type: 'int', width: 11 }, { header: 'Status', key: 'status', width: 10 },
          ],
          rows: data.map((m) => ({ ...m, name: `${m.firstName} ${m.lastName}`.trim(), daysLeft: Math.ceil((new Date(m.expiresAt!).getTime() - Date.now()) / 864e5) })),
        }],
      };
    },
  },
  demographics: {
    perms: ['reports.read'],
    title: 'Members by gender, age and category',
    run: async (c, query) => {
      const q = parse(demoQ, query);
      const d = await demographicsData(c, q);
      const total = d.gender.reduce((s, x) => s + x.count, 0) || 1;
      return {
        data: d, filters: [q.status === 'active' ? 'Active members only' : 'All members'],
        sheets: [
          { name: 'Gender', heading: 'Gender', totalsLabel: 'Total', columns: [{ header: 'Gender', key: 'label', width: 18 }, { header: 'Members', key: 'count', type: 'int', total: true }, { header: 'Share', key: 'share', type: 'percent' }],
            rows: d.gender.map((g) => ({ label: g._id ?? 'unspecified', count: g.count, share: g.count / total })) },
          { name: 'Age groups', heading: 'Age groups', totalsLabel: 'Total (with date of birth)', columns: [{ header: 'Age group', key: 'label', width: 16 }, { header: 'Members', key: 'count', type: 'int', total: true }, { header: 'Female', key: 'female', type: 'int', total: true }, { header: 'Male', key: 'male', type: 'int', total: true }],
            rows: [...d.ageGroups] },
          { name: 'Category', heading: 'Pricing category', totalsLabel: 'Total', columns: [{ header: 'Category', key: 'label', width: 18 }, { header: 'Members', key: 'count', type: 'int', total: true }],
            rows: d.category.map((x) => ({ label: x._id ?? 'none', count: x.count })) },
        ],
      };
    },
  },
  collections: {
    perms: ['billing.read'],
    title: 'Collections',
    run: async (c, query) => {
      const q = parse(collQ, query);
      const d = await collectionsData(c, q);
      const payments = await Payment.find({ paidAt: { $gte: d.range.start, $lt: d.range.end } })
        .sort('paidAt').limit(20000).populate('member', 'memberNo firstName lastName').populate('invoice', 'number kind').lean();
      const { range: _r, ...data } = d;
      void _r;
      return {
        data, filters: [`${fmtDay(c, d.from)} to ${fmtDay(c, d.to)}`, `Grouped by ${d.groupBy}`],
        sheets: [
          { name: d.groupBy === 'month' ? 'By month' : 'By day', heading: d.groupBy === 'month' ? 'By month' : 'By day', totalsLabel: 'Total',
            columns: [{ header: d.groupBy === 'month' ? 'Month' : 'Date', key: 'when', type: d.groupBy === 'month' ? 'text' : 'date', width: 14 }, { header: 'Payments', key: 'count', type: 'int', total: true }, { header: 'Net collected', key: 'total', type: 'money', total: true, width: 18 }],
            rows: d.series.map((x) => ({ when: d.groupBy === 'month' ? x._id : dayStart(c.tz, x._id), count: x.count, total: x.total })) },
          { name: 'By payment mode', heading: 'By payment mode', totalsLabel: 'Total',
            columns: [{ header: 'Mode', key: 'mode', width: 18 }, { header: 'Payments', key: 'count', type: 'int', total: true }, { header: 'Net collected', key: 'total', type: 'money', total: true, width: 18 }],
            rows: d.byMethod.map((x) => ({ mode: x._id, count: x.count, total: x.total })) },
          { name: 'Payments', heading: 'All payments', totalsLabel: 'Total',
            columns: [
              { header: 'Paid at', key: 'paidAt', type: 'datetime', width: 18 }, { header: 'Receipt', key: 'receiptNo', width: 14 }, { header: 'Invoice', key: 'invoice', width: 18 },
              { header: 'Type', key: 'kind', width: 12 }, { header: 'Member', key: 'member', width: 24 }, { header: 'Mode', key: 'method', width: 14 }, { header: 'Reference', key: 'reference', width: 18 },
              { header: 'Amount', key: 'amount', type: 'money', total: true, width: 14 }, { header: 'Refunded', key: 'refundedAmount', type: 'money', total: true, width: 14 }, { header: 'Net', key: 'net', type: 'money', total: true, width: 14 },
            ],
            rows: payments.map((p: any) => ({
              ...p, invoice: p.invoice?.number ?? '', kind: p.invoice?.kind ?? 'other',
              member: p.member ? `${p.member.firstName} ${p.member.lastName} (${p.member.memberNo})` : '', net: p.amount - (p.refundedAmount ?? 0),
            })) },
        ],
      };
    },
  },
  movement: {
    perms: ['reports.read'],
    title: 'New joiners vs expired',
    run: async (c, query) => {
      const q = parse(moveQ, query);
      const data = await movementData(c, q);
      return {
        data, filters: [`Last ${q.months} months`, 'Expired = membership ended in that month and not renewed since'],
        sheets: [{ name: 'Joiners vs expired', totalsLabel: 'Total',
          columns: [{ header: 'Month', key: 'month', width: 12 }, { header: 'New joiners', key: 'joined', type: 'int', total: true }, { header: 'Expired', key: 'expired', type: 'int', total: true }, { header: 'Net', key: 'net', type: 'int', total: true }],
          rows: data }],
      };
    },
  },
};

for (const [name, def] of Object.entries(REPORTS)) {
  const guard: RequestHandler = requirePermission(...def.perms);
  r.get(`/${name}`, guard, asyncHandler(async (req, res) => {
    res.json({ success: true, data: (await def.run(ctxOf(req), req.query)).data });
  }));
  /** Excel export: same permission, same filters, same numbers as the on-screen report. */
  r.get(`/${name}/export`, guard, asyncHandler(async (req, res) => {
    const c = ctxOf(req);
    const out = await def.run(c, req.query);
    const { buildWorkbook, safeFileName } = await import('../lib/excel.js');
    const buf = await buildWorkbook({ title: def.title, gymName: c.gym, filters: out.filters, currency: c.currency, locale: c.locale, timezone: c.tz, sheets: out.sheets });
    const file = `${safeFileName(c.gym)}-${name}-${ymdInTz(c.tz, new Date())}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }));
}

/* --------------------------------- dashboard KPIs --------------------------------- */

/** KPI cards with period-over-period trends. Money is only included for roles that may see it. */
r.get(
  '/dashboard',
  requirePermission('dashboard.view'),
  asyncHandler(async (req, res) => {
    await refreshMemberStatuses();
    const { tz } = ctxOf(req);
    const now = new Date();
    const today = startOfDayTz(tz, now);
    const monthStart = startOfMonthTz(tz, now);
    const prevMonthStart = startOfMonthTz(tz, now, -1);
    const prevMonthSameTime = new Date(Math.min(prevMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()));
    const weekStart = startOfDayTz(tz, now, -6);
    const prevWeekStart = startOfDayTz(tz, now, -13);

    const [active, expiring7, expiredRecent, newLeads, checkinsToday, inside, byStatus, newMembers, newMembersPrev, leadsMonth, leadsPrev, visitsWeek, visitsPrevWeek] = await Promise.all([
      Member.countDocuments({ status: 'active' }),
      Member.countDocuments({ status: 'active', expiresAt: { $gte: now, $lte: addDays(now, 7) } }),
      Member.countDocuments({ status: 'expired', expiresAt: { $gte: addDays(now, -30) } }),
      Lead.countDocuments({ status: 'new' }),
      CheckIn.countDocuments({ inAt: { $gte: today } }),
      CheckIn.countDocuments({ inAt: { $gte: today }, outAt: null }),
      Member.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Member.countDocuments({ joinedAt: { $gte: monthStart } }),
      Member.countDocuments({ joinedAt: { $gte: prevMonthStart, $lt: prevMonthSameTime } }),
      Lead.countDocuments({ createdAt: { $gte: monthStart } }),
      Lead.countDocuments({ createdAt: { $gte: prevMonthStart, $lt: prevMonthSameTime } }),
      CheckIn.countDocuments({ inAt: { $gte: weekStart } }),
      CheckIn.countDocuments({ inAt: { $gte: prevWeekStart, $lt: weekStart } }),
    ]);
    const data: Record<string, unknown> = {
      active, expiring7, expiredRecent, newLeads, checkinsToday, inside, byStatus, newMembers,
      trends: {
        newMembers: { value: newMembers, prev: newMembersPrev, change: pct(newMembers, newMembersPrev), period: 'vs same days last month' },
        leads: { value: leadsMonth, prev: leadsPrev, change: pct(leadsMonth, leadsPrev), period: 'vs same days last month' },
        visits: { value: visitsWeek, prev: visitsPrevWeek, change: pct(visitsWeek, visitsPrevWeek), period: 'last 7 days vs previous 7' },
      },
      monthStart: ymdInTz(tz, monthStart),
      today: ymdInTz(tz, now),
    };

    if (can(req.user!.role, 'billing.read')) {
      const sum = (from: Date, to: Date) => Payment.aggregate([{ $match: { paidAt: { $gte: from, $lt: to } } }, { $group: { _id: null, t: { $sum: net } } }]).then((x) => x[0]?.t ?? 0);
      const [collectedToday, collectedMonth, collectedPrev, outstanding, expenses] = await Promise.all([
        sum(today, addDays(now, 1)),
        sum(monthStart, addDays(now, 1)),
        sum(prevMonthStart, prevMonthSameTime),
        Invoice.aggregate([{ $match: { status: { $in: ['unpaid', 'partial'] } } }, { $group: { _id: null, t: { $sum: { $subtract: ['$total', '$paid'] } }, n: { $sum: 1 } } }]),
        Expense.aggregate([{ $match: { paidAt: { $gte: monthStart } } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
      ]);
      Object.assign(data, {
        collectedToday, collectedMonth,
        outstanding: outstanding[0]?.t ?? 0,
        outstandingCount: outstanding[0]?.n ?? 0,
        expensesMonth: expenses[0]?.t ?? 0,
      });
      (data.trends as Record<string, unknown>).collected = { value: collectedMonth, prev: collectedPrev, change: pct(collectedMonth, collectedPrev), period: 'vs same days last month' };
    }
    res.json({ success: true, data });
  })
);

export default r;
