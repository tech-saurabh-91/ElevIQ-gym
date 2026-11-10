import { Router, type Request } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, escapeRegex, pageParams, parse } from '../lib/http.js';
import { addDays, audit, formatSeq, nextSeq, roundMoney, startOfDay } from '../lib/util.js';
import { crudRouter, zDate, zId } from '../lib/crud.js';
import { quote } from '../lib/pricing.js';
import { requirePermission } from '../middleware/auth.js';
import { Offer, Plan } from '../models/catalog.js';
import { Member, Membership } from '../models/crm.js';
import { Expense, Invoice, Payment } from '../models/billing.js';
import { invalidateSite } from '../services/site.js';

const r = Router();
const METHODS = ['cash', 'card', 'upi', 'bank-transfer', 'wallet', 'other'] as const;

const taxOf = (req: Request) => {
  const t = req.tenant!.settings.tax ?? {};
  return { label: t.label ?? 'Tax', rate: Number(t.rate ?? 0), inclusive: Boolean(t.inclusive) };
};

export async function invoiceNumber(req: Request) {
  const year = new Date().getFullYear();
  const seq = await nextSeq(`invoice-${year}`);
  return `${req.tenant!.settings.invoicePrefix ?? 'INV'}-${year}-${String(seq).padStart(5, '0')}`;
}
export async function receiptNumber() {
  return formatSeq('RCP-', await nextSeq('receipt'), 6);
}

/** Atomically add a payment against an invoice (optimistic concurrency on `paid`). */
export async function applyPayment(req: Request, invoiceId: unknown, p: { amount: number; method: string; reference?: string; paidAt?: Date }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const inv = await Invoice.findById(invoiceId);
    if (!inv) throw new ApiError(404, 'Invoice not found');
    if (inv.status === 'void') throw new ApiError(400, 'Invoice is void');
    const amount = roundMoney(p.amount, inv.currency);
    const outstanding = roundMoney(inv.total - inv.paid, inv.currency);
    if (amount <= 0) throw new ApiError(400, 'Amount must be greater than zero');
    if (amount > outstanding) throw new ApiError(400, `Amount exceeds the outstanding balance (${outstanding})`);
    const paid = roundMoney(inv.paid + amount, inv.currency);
    const status = paid >= inv.total ? 'paid' : 'partial';
    const updated = await Invoice.updateOne({ _id: inv._id, paid: inv.paid }, { $set: { paid, status } });
    if (updated.modifiedCount !== 1) continue; // someone paid concurrently - retry with fresh numbers
    const payment = await Payment.create({
      receiptNo: await receiptNumber(),
      invoice: inv._id,
      member: inv.member,
      amount,
      currency: inv.currency,
      method: p.method,
      reference: p.reference ?? '',
      paidAt: p.paidAt ?? new Date(),
      recordedBy: req.user!._id,
    });
    return { invoice: await Invoice.findById(inv._id).lean(), payment };
  }
  throw new ApiError(409, 'The invoice changed while saving. Please try again.');
}

/* ------------------------------- quotes & sales ------------------------------- */

const sellSchema = z.object({
  memberId: zId,
  planId: zId,
  category: z.string().trim().toLowerCase().max(20).optional(),
  code: z.string().trim().max(30).optional(),
  startsAt: zDate.optional(),
  payment: z.object({ amount: z.number().positive(), method: z.enum(METHODS), reference: z.string().max(80).optional() }).optional(),
});

async function buildQuote(req: Request, body: z.infer<typeof sellSchema>) {
  const [member, plan, offers] = await Promise.all([
    Member.findById(body.memberId),
    Plan.findOne({ _id: body.planId, active: true }).lean(),
    Offer.find({ active: true }).lean(),
  ]);
  if (!member) throw new ApiError(404, 'Member not found');
  if (!plan) throw new ApiError(404, 'Plan not found or inactive');
  const firstTime = !(await Membership.exists({ member: member._id }));
  const q = quote({
    plan: plan as any,
    category: body.category ?? member.category ?? 'standard',
    offers: offers as any,
    code: body.code,
    tax: taxOf(req),
    currency: req.tenant!.settings.currency,
    includeJoiningFee: firstTime,
  });
  // New period starts today, or right after the current one if still running (renewal stacking).
  const now = new Date();
  const runningUntil = member.status === 'active' && member.expiresAt && member.expiresAt > now ? member.expiresAt : null;
  const startsAt = body.startsAt ?? runningUntil ?? startOfDay(now);
  const endsAt = addDays(startsAt, plan.durationDays);
  return { member, plan, q, startsAt, endsAt };
}

r.post(
  '/quote',
  requirePermission('payments.record', 'billing.read'),
  asyncHandler(async (req, res) => {
    const body = parse(sellSchema.omit({ payment: true }), req.body);
    const { q, startsAt, endsAt } = await buildQuote(req, body);
    res.json({ success: true, data: { ...q, startsAt, endsAt } });
  })
);

/** Sell / renew a membership: invoice (with auto-applied offer + tax) and optional payment. */
r.post(
  '/memberships',
  requirePermission('payments.record'),
  asyncHandler(async (req, res) => {
    const body = parse(sellSchema, req.body);
    const { member, plan, q, startsAt, endsAt } = await buildQuote(req, body);
    if (body.code && q.codeRejected) throw new ApiError(400, 'That promo code is not valid for this plan');
    if (body.payment && roundMoney(body.payment.amount, q.currency) > q.total) {
      throw new ApiError(400, `Payment cannot be more than the invoice total (${q.total})`);
    }

    if (q.offer) {
      const ok = await Offer.updateOne(
        { _id: q.offer.id, $or: [{ maxRedemptions: 0 }, { $expr: { $lt: ['$redemptions', '$maxRedemptions'] } }] },
        { $inc: { redemptions: 1 } }
      );
      if (ok.modifiedCount !== 1) throw new ApiError(409, 'This offer has just run out. Please quote again.');
    }

    const lines = [{ description: `${plan.name} (${q.category}) - ${plan.durationDays} days`, qty: 1, unitPrice: q.base, amount: q.base }];
    if (q.joiningFee) lines.push({ description: 'Joining fee', qty: 1, unitPrice: q.joiningFee, amount: q.joiningFee });

    const invoice = await Invoice.create({
      number: await invoiceNumber(req),
      member: member._id,
      billTo: { name: `${member.firstName} ${member.lastName}`.trim(), email: member.email, phone: member.phone },
      lines,
      subtotal: q.subtotal,
      discount: q.discount,
      offer: q.offer ? { id: q.offer.id, title: q.offer.title, code: q.offer.code } : undefined,
      taxLabel: q.taxLabel,
      taxRate: q.taxRate,
      taxInclusive: q.taxInclusive,
      tax: q.tax,
      total: q.total,
      currency: q.currency,
      status: q.total === 0 ? 'paid' : 'unpaid',
      kind: 'membership',
      createdBy: req.user!._id,
    });
    const membership = await Membership.create({
      member: member._id, plan: plan._id, planName: plan.name, category: q.category, startsAt, endsAt, invoice: invoice._id,
    });
    member.currentPlan = plan._id;
    member.currentPlanName = plan.name;
    if (!member.startsAt || member.status !== 'active') member.startsAt = startsAt;
    member.expiresAt = endsAt;
    member.status = 'active';
    member.category = q.category;
    await member.save();

    let payment = null;
    if (body.payment) payment = (await applyPayment(req, invoice._id, body.payment)).payment;
    if (q.offer) await invalidateSite(req.tenant!._id);
    await audit(req, 'membership.sell', 'Invoice', invoice._id, `${invoice.number} ${member.memberNo} ${q.total}`);
    res.status(201).json({ success: true, data: { invoice: await Invoice.findById(invoice._id).lean(), membership, payment } });
  })
);

/* --------------------------------- invoices --------------------------------- */

r.get(
  '/invoices',
  requirePermission('billing.read', 'payments.record'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const q = parse(
      z.object({ status: z.enum(['unpaid', 'partial', 'paid', 'void', 'all']).optional(), member: zId.optional(), q: z.string().max(60).optional(), from: zDate.optional(), to: zDate.optional() }),
      req.query
    );
    const query: Record<string, any> = {};
    if (q.status && q.status !== 'all') query.status = q.status;
    if (q.member) query.member = q.member;
    if (q.q) query.$or = [{ number: new RegExp(escapeRegex(q.q), 'i') }, { 'billTo.name': new RegExp(escapeRegex(q.q), 'i') }];
    if (q.from || q.to) query.issuedAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    const [items, total] = await Promise.all([
      Invoice.find(query).sort('-issuedAt').skip(skip).limit(limit).populate('member', 'memberNo firstName lastName').lean(),
      Invoice.countDocuments(query),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

r.get(
  '/invoices/:id',
  requirePermission('billing.read', 'payments.record'),
  asyncHandler(async (req, res) => {
    const inv = await Invoice.findById(req.params.id).populate('member', 'memberNo firstName lastName phone email').lean();
    if (!inv) throw new ApiError(404, 'Invoice not found');
    const payments = await Payment.find({ invoice: inv._id }).sort('paidAt').lean();
    res.json({ success: true, data: { invoice: inv, payments } });
  })
);

r.post(
  '/invoices/:id/payments',
  requirePermission('payments.record'),
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ amount: z.number().positive(), method: z.enum(METHODS), reference: z.string().max(80).optional(), paidAt: zDate.optional() }), req.body);
    const out = await applyPayment(req, req.params.id, body);
    await audit(req, 'payment.record', 'Payment', out.payment._id, `${out.payment.receiptNo} ${out.payment.amount}`);
    res.status(201).json({ success: true, data: out });
  })
);

r.post(
  '/invoices/:id/void',
  requirePermission('billing.manage'),
  asyncHandler(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(200) }), req.body);
    const inv = await Invoice.findOneAndUpdate({ _id: req.params.id, paid: 0, status: { $ne: 'void' } }, { $set: { status: 'void', voidReason: reason } }, { new: true });
    if (!inv) throw new ApiError(400, 'Only unpaid invoices can be voided. Refund payments first.');
    await Membership.updateMany({ invoice: inv._id }, { $set: { status: 'cancelled' } });
    await audit(req, 'invoice.void', 'Invoice', inv._id, reason);
    res.json({ success: true, data: inv });
  })
);

/* --------------------------------- payments --------------------------------- */

r.get(
  '/payments',
  requirePermission('billing.read'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const q = parse(z.object({ method: z.enum(METHODS).optional(), from: zDate.optional(), to: zDate.optional() }), req.query);
    const query: Record<string, any> = {};
    if (q.method) query.method = q.method;
    if (q.from || q.to) query.paidAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    const [items, total] = await Promise.all([
      Payment.find(query).sort('-paidAt').skip(skip).limit(limit).populate('member', 'memberNo firstName lastName').populate('invoice', 'number').lean(),
      Payment.countDocuments(query),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

r.post(
  '/payments/:id/refund',
  requirePermission('billing.manage'),
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ amount: z.number().positive(), reason: z.string().trim().min(3).max(200) }), req.body);
    const p = await Payment.findById(req.params.id);
    if (!p) throw new ApiError(404, 'Payment not found');
    const refundable = roundMoney(p.amount - p.refundedAmount, p.currency);
    const amount = roundMoney(body.amount, p.currency);
    if (amount > refundable) throw new ApiError(400, `You can refund at most ${refundable}`);
    const ok = await Payment.updateOne({ _id: p._id, refundedAmount: p.refundedAmount }, {
      $set: { refundedAmount: roundMoney(p.refundedAmount + amount, p.currency), refundReason: body.reason, ...(amount === refundable && { status: 'refunded' }) },
    });
    if (ok.modifiedCount !== 1) throw new ApiError(409, 'Payment changed while saving. Try again.');
    if (p.invoice) {
      const inv = await Invoice.findById(p.invoice);
      if (inv) {
        inv.paid = Math.max(0, roundMoney(inv.paid - amount, inv.currency));
        inv.status = inv.paid <= 0 ? 'unpaid' : inv.paid >= inv.total ? 'paid' : 'partial';
        await inv.save();
      }
    }
    await audit(req, 'payment.refund', 'Payment', p._id, `${amount} ${body.reason}`);
    res.json({ success: true });
  })
);

/* --------------------------------- expenses --------------------------------- */

r.use(
  '/expenses',
  crudRouter({
    model: Expense,
    schema: z.object({
      title: z.string().trim().min(2).max(120),
      category: z.enum(['rent', 'utilities', 'payroll', 'equipment', 'marketing', 'supplies', 'maintenance', 'other']).default('other'),
      amount: z.number().min(0),
      vendor: z.string().max(120).default(''),
      paidAt: zDate.default(() => new Date()),
      notes: z.string().max(1000).default(''),
    }),
    entity: 'Expense',
    filters: { category: z.string().max(20) },
    searchable: ['title', 'vendor'],
    defaultSort: '-paidAt',
    sortable: ['paidAt', 'amount'],
    read: [requirePermission('billing.read', 'expenses.manage')],
    write: [requirePermission('expenses.manage')],
  })
);

export default r;
