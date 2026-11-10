import { Router, type Request } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { audit, roundMoney, startOfDay } from '../lib/util.js';
import { crudRouter, zBool, zDate, zId } from '../lib/crud.js';
import { requirePermission } from '../middleware/auth.js';
import { Booking, CheckIn, ClassSession, ClassType, Equipment, Maintenance, Product, Shift } from '../models/modules.js';
import { Member } from '../models/crm.js';
import { Invoice } from '../models/billing.js';
import { applyPayment, invoiceNumber } from './billing.js';

const r = Router();
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

/* ---------------------------------- classes ---------------------------------- */

r.use(
  '/class-types',
  crudRouter({
    model: ClassType,
    schema: z.object({
      name: z.string().trim().min(2).max(80),
      category: z.string().trim().max(40).default('group-fitness'),
      description: z.string().max(600).default(''),
      durationMin: z.number().int().min(5).max(480).default(45),
      defaultCapacity: z.number().int().min(1).max(1000).default(20),
      color: z.string().max(9).default(''),
      active: z.boolean().default(true),
    }),
    entity: 'ClassType',
    filters: { active: zBool },
    searchable: ['name', 'category'],
    defaultSort: 'name',
    sortable: ['name'],
    read: [requirePermission('classes.read', 'classes.manage')],
    write: [requirePermission('classes.manage')],
  })
);

r.get(
  '/sessions',
  requirePermission('classes.read', 'classes.manage'),
  asyncHandler(async (req, res) => {
    const q = parse(z.object({ from: zDate.optional(), to: zDate.optional() }), req.query);
    const from = q.from ?? startOfDay(new Date());
    const to = q.to ?? new Date(from.getTime() + 14 * 864e5);
    const items = await ClassSession.find({ date: { $gte: from, $lte: to } })
      .sort({ date: 1, start: 1 })
      .limit(500)
      .populate('classType', 'name color category')
      .populate('trainer', 'name')
      .lean();
    res.json({ success: true, data: items });
  })
);

const sessionSchema = z.object({
  classType: zId,
  title: z.string().trim().min(2).max(80),
  trainer: zId.optional(),
  room: z.string().max(40).default(''),
  date: zDate,
  start: TIME,
  end: TIME,
  capacity: z.number().int().min(1).max(1000).default(20),
  status: z.enum(['scheduled', 'cancelled', 'completed']).default('scheduled'),
});

r.post(
  '/sessions',
  requirePermission('classes.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(sessionSchema.extend({ repeatWeeks: z.number().int().min(0).max(26).default(0) }), req.body);
    if (!(await ClassType.exists({ _id: body.classType }))) throw new ApiError(400, 'Unknown class type');
    const { repeatWeeks, ...base } = body;
    const docs = Array.from({ length: repeatWeeks + 1 }, (_, i) => ({ ...base, date: new Date(base.date.getTime() + i * 7 * 864e5) }));
    const created = await ClassSession.insertMany(docs);
    await audit(req, 'create', 'ClassSession', created[0]._id, `${created.length} session(s)`);
    res.status(201).json({ success: true, data: created });
  })
);

r.put(
  '/sessions/:id',
  requirePermission('classes.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(sessionSchema.partial(), req.body);
    for (const k of Object.keys(body)) if (!(k in req.body)) delete (body as any)[k];
    const s = await ClassSession.findById(req.params.id);
    if (!s) throw new ApiError(404, 'Session not found');
    if (body.capacity !== undefined && body.capacity < s.booked) throw new ApiError(400, `${s.booked} people are already booked`);
    Object.assign(s, body);
    await s.save();
    res.json({ success: true, data: s });
  })
);

r.delete(
  '/sessions/:id',
  requirePermission('classes.manage'),
  asyncHandler(async (req, res) => {
    const s = await ClassSession.findById(req.params.id);
    if (!s) throw new ApiError(404, 'Session not found');
    await Booking.deleteMany({ session: s._id });
    await s.deleteOne();
    res.json({ success: true });
  })
);

r.get(
  '/sessions/:id/bookings',
  requirePermission('classes.read', 'classes.manage'),
  asyncHandler(async (req, res) => {
    const items = await Booking.find({ session: req.params.id, status: { $ne: 'cancelled' } })
      .sort('createdAt')
      .populate('member', 'memberNo firstName lastName phone')
      .lean();
    res.json({ success: true, data: items });
  })
);

/**
 * Book a member into a session. Seat allocation is a single atomic update, so two people
 * can never take the last seat; otherwise the member goes on the waitlist.
 */
export async function bookSession(sessionId: string, memberId: string) {
  const member = await Member.findById(memberId).lean();
  if (!member) throw new ApiError(404, 'Member not found');
  if (member.status !== 'active') throw new ApiError(403, 'Membership is not active');
  const session = await ClassSession.findById(sessionId).lean();
  if (!session || session.status !== 'scheduled') throw new ApiError(400, 'This class is not open for booking');
  if (await Booking.exists({ session: session._id, member: member._id, status: { $in: ['booked', 'waitlist', 'attended'] } })) {
    throw new ApiError(409, 'Already booked for this class');
  }
  const seat = await ClassSession.findOneAndUpdate(
    { _id: session._id, status: 'scheduled', $expr: { $lt: ['$booked', '$capacity'] } },
    { $inc: { booked: 1 } },
    { new: true }
  );
  const status = seat ? 'booked' : 'waitlist';
  if (!seat) await ClassSession.updateOne({ _id: session._id }, { $inc: { waitlist: 1 } });
  try {
    return await Booking.create({ session: session._id, member: member._id, status });
  } catch (e) {
    await ClassSession.updateOne({ _id: session._id }, { $inc: status === 'booked' ? { booked: -1 } : { waitlist: -1 } });
    throw e;
  }
}

/** Cancel a booking; the oldest waitlisted member is promoted into the freed seat. */
export async function cancelBooking(bookingId: string, onlyMember?: string) {
  const b = await Booking.findOne({ _id: bookingId, ...(onlyMember && { member: onlyMember }) });
  if (!b) throw new ApiError(404, 'Booking not found');
  if (!['booked', 'waitlist'].includes(b.status)) throw new ApiError(400, 'This booking cannot be cancelled');
  const was = b.status;
  b.status = 'cancelled';
  b.cancelledAt = new Date();
  await b.save();
  if (was === 'waitlist') {
    await ClassSession.updateOne({ _id: b.session, waitlist: { $gt: 0 } }, { $inc: { waitlist: -1 } });
    return b;
  }
  const next = await Booking.findOneAndUpdate({ session: b.session, status: 'waitlist' }, { $set: { status: 'booked' } }, { sort: { createdAt: 1 }, new: true });
  if (next) await ClassSession.updateOne({ _id: b.session, waitlist: { $gt: 0 } }, { $inc: { waitlist: -1 } });
  else await ClassSession.updateOne({ _id: b.session, booked: { $gt: 0 } }, { $inc: { booked: -1 } });
  return b;
}

r.post(
  '/sessions/:id/bookings',
  requirePermission('classes.manage', 'checkins.manage'),
  asyncHandler(async (req, res) => {
    const { memberId } = parse(z.object({ memberId: zId }), req.body);
    res.status(201).json({ success: true, data: await bookSession(String(req.params.id), memberId) });
  })
);

r.post(
  '/bookings/:id/cancel',
  requirePermission('classes.manage', 'checkins.manage'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await cancelBooking(String(req.params.id)) });
  })
);

/* --------------------------------- equipment --------------------------------- */

r.use(
  '/equipment',
  crudRouter({
    model: Equipment,
    schema: z.object({
      assetTag: z.string().trim().min(1).max(40),
      name: z.string().trim().min(2).max(100),
      category: z.string().trim().max(40).default('cardio'),
      brand: z.string().max(60).default(''),
      zone: z.string().max(60).default(''),
      purchasedAt: zDate.optional(),
      cost: z.number().min(0).default(0),
      condition: z.enum(['excellent', 'good', 'fair', 'poor']).default('good'),
      status: z.enum(['in-use', 'maintenance', 'out-of-order', 'retired']).default('in-use'),
      nextServiceAt: zDate.optional(),
      notes: z.string().max(1000).default(''),
    }),
    entity: 'Equipment',
    filters: { status: z.string().max(20), category: z.string().max(40) },
    searchable: ['name', 'assetTag', 'brand'],
    sortable: ['name', 'nextServiceAt', 'createdAt'],
    read: [requirePermission('equipment.manage')],
    write: [requirePermission('equipment.manage')],
  })
);

r.use(
  '/maintenance',
  crudRouter({
    model: Maintenance,
    schema: z.object({
      equipment: zId,
      title: z.string().trim().min(2).max(120),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
      status: z.enum(['open', 'in-progress', 'done']).default('open'),
      cost: z.number().min(0).default(0),
      notes: z.string().max(1000).default(''),
    }),
    entity: 'Maintenance',
    filters: { status: z.string().max(20) },
    searchable: ['title'],
    populate: [{ path: 'equipment', select: 'name assetTag' }],
    read: [requirePermission('equipment.manage')],
    write: [requirePermission('equipment.manage')],
  })
);

/* --------------------------------- check-ins --------------------------------- */

async function toggleCheckIn(req: Request, member: any, method: 'qr' | 'rfid' | 'manual') {
  if (member.status !== 'active') throw new ApiError(403, `Membership is ${member.status}`);
  const open = await CheckIn.findOneAndUpdate(
    { member: member._id, outAt: null, inAt: { $gte: startOfDay(new Date()) } },
    [{ $set: { outAt: '$$NOW', durationMin: { $round: [{ $divide: [{ $subtract: ['$$NOW', '$inAt'] }, 60000] }, 0] } } }],
    { new: true }
  );
  if (open) return { action: 'checkout', checkIn: open };
  const checkIn = await CheckIn.create({ member: member._id, method, verifiedBy: req.user!._id });
  await Member.updateOne({ _id: member._id }, { $inc: { totalVisits: 1 }, $set: { lastVisitAt: checkIn.inAt } });
  return { action: 'checkin', checkIn };
}

r.post(
  '/checkins/scan',
  requirePermission('checkins.manage'),
  asyncHandler(async (req, res) => {
    const { code, method } = parse(z.object({ code: z.string().trim().min(1).max(80), method: z.enum(['qr', 'rfid', 'manual']).default('qr') }), req.body);
    const member = await Member.findOne({ $or: [{ qrToken: code }, { memberNo: code }, ...(code.length >= 4 ? [{ rfid: code }] : [])] }).lean();
    if (!member) throw new ApiError(404, 'No member matches this code');
    const out = await toggleCheckIn(req, member, method);
    res.status(201).json({ success: true, data: { ...out, member: { _id: member._id, memberNo: member.memberNo, firstName: member.firstName, lastName: member.lastName, expiresAt: member.expiresAt, photoUrl: member.photoUrl } } });
  })
);

r.get(
  '/checkins/live',
  requirePermission('checkins.manage'),
  asyncHandler(async (_req, res) => {
    const today = startOfDay(new Date());
    const [inside, todayCount, recent] = await Promise.all([
      CheckIn.countDocuments({ inAt: { $gte: today }, outAt: null }),
      CheckIn.countDocuments({ inAt: { $gte: today } }),
      CheckIn.find({ inAt: { $gte: today } }).sort('-inAt').limit(40).populate('member', 'memberNo firstName lastName photoUrl').lean(),
    ]);
    res.json({ success: true, data: { inside, todayCount, recent } });
  })
);

/* ---------------------------------- retail ---------------------------------- */

r.use(
  '/products',
  crudRouter({
    model: Product,
    schema: z.object({
      sku: z.string().trim().min(1).max(40),
      name: z.string().trim().min(2).max(100),
      category: z.string().max(40).default('supplements'),
      price: z.number().min(0),
      cost: z.number().min(0).default(0),
      stock: z.number().int().min(0).default(0),
      active: z.boolean().default(true),
    }),
    entity: 'Product',
    filters: { active: zBool, category: z.string().max(40) },
    searchable: ['name', 'sku', 'category'],
    sortable: ['name', 'stock', 'price', 'createdAt'],
    defaultSort: 'name',
    read: [requirePermission('retail.manage')],
    write: [requirePermission('retail.manage')],
  })
);

/** POS sale: stock is reserved atomically per line and rolled back if anything fails. */
r.post(
  '/sales',
  requirePermission('retail.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        items: z.array(z.object({ productId: zId, qty: z.number().int().min(1).max(1000) })).min(1).max(50),
        memberId: zId.optional(),
        customer: z.string().max(80).default('Walk-in'),
        method: z.enum(['cash', 'card', 'upi', 'bank-transfer', 'wallet', 'other']).default('cash'),
      }),
      req.body
    );
    const currency = req.tenant!.settings.currency;
    const tax = req.tenant!.settings.tax ?? { rate: 0, inclusive: false, label: 'Tax' };
    const reserved: { id: unknown; qty: number }[] = [];
    try {
      const lines = [];
      for (const it of body.items) {
        const p = await Product.findOneAndUpdate({ _id: it.productId, active: true, stock: { $gte: it.qty } }, { $inc: { stock: -it.qty } }, { new: true }).lean();
        if (!p) {
          const exists = await Product.findById(it.productId).select('name stock').lean();
          throw new ApiError(400, exists ? `Only ${exists.stock} of ${exists.name} left` : 'Product not found');
        }
        reserved.push({ id: p._id, qty: it.qty });
        lines.push({ description: `${p.name} (${p.sku})`, qty: it.qty, unitPrice: p.price, amount: roundMoney(p.price * it.qty, currency) });
      }
      const subtotal = roundMoney(lines.reduce((s, l) => s + l.amount, 0), currency);
      const taxAmt = tax.inclusive ? roundMoney(subtotal - subtotal / (1 + tax.rate / 100), currency) : roundMoney((subtotal * tax.rate) / 100, currency);
      const total = tax.inclusive ? subtotal : roundMoney(subtotal + taxAmt, currency);
      const member = body.memberId ? await Member.findById(body.memberId).lean() : null;
      const inv = await Invoice.create({
        number: await invoiceNumber(req), member: member?._id, kind: 'retail',
        billTo: { name: member ? `${member.firstName} ${member.lastName}`.trim() : body.customer },
        lines, subtotal, discount: 0, taxLabel: tax.label, taxRate: tax.rate, taxInclusive: tax.inclusive, tax: taxAmt, total, currency, createdBy: req.user!._id,
      });
      const out = total > 0 ? await applyPayment(req, inv._id, { amount: total, method: body.method }) : { invoice: inv, payment: null };
      await audit(req, 'retail.sale', 'Invoice', inv._id, `${inv.number} ${total}`);
      res.status(201).json({ success: true, data: out });
    } catch (e) {
      await Promise.all(reserved.map((x) => Product.updateOne({ _id: x.id }, { $inc: { stock: x.qty } })));
      throw e;
    }
  })
);

/* ---------------------------------- shifts ---------------------------------- */

r.use(
  '/shifts',
  crudRouter({
    model: Shift,
    schema: z.object({ staff: zId, date: zDate, start: TIME, end: TIME, role: z.string().max(40).default(''), notes: z.string().max(400).default('') }),
    entity: 'Shift',
    filters: { staff: zId },
    populate: [{ path: 'staff', select: 'name role' }],
    defaultSort: 'date',
    sortable: ['date'],
    read: [requirePermission('staff.manage', 'classes.manage')],
    write: [requirePermission('staff.manage')],
  })
);

export default r;
