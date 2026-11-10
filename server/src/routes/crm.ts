import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, escapeRegex, pageParams, parse } from '../lib/http.js';
import { audit, formatSeq, nextSeq, randomToken } from '../lib/util.js';
import { crudRouter, zDate, zId } from '../lib/crud.js';
import { requirePermission } from '../middleware/auth.js';
import { Lead, Member, Membership } from '../models/crm.js';
import { Invoice, Payment } from '../models/billing.js';
import { CheckIn } from '../models/modules.js';
import { User } from '../models/user.js';

const r = Router();

/** Flip members whose period has ended to `expired`. Cheap (indexed) and idempotent. */
export async function refreshMemberStatuses() {
  await Member.updateMany({ status: 'active', expiresAt: { $lt: new Date() } }, { $set: { status: 'expired' } });
}

/* ----------------------------------- leads ----------------------------------- */

const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(30).default(''),
  email: z.string().trim().email().or(z.literal('')).default(''),
  message: z.string().trim().max(2000).default(''),
  source: z.enum(['enquiry', 'join', 'walk-in', 'phone', 'referral', 'other']).default('walk-in'),
  planInterest: zId.optional(),
  category: z.string().max(30).default(''),
  status: z.enum(['new', 'contacted', 'trial', 'converted', 'lost']).default('new'),
  notes: z.string().max(4000).default(''),
  followUpAt: zDate.optional(),
});

r.use(
  '/leads',
  crudRouter({
    model: Lead,
    schema: leadSchema,
    entity: 'Lead',
    filters: { status: z.enum(['new', 'contacted', 'trial', 'converted', 'lost']), source: z.string().max(20) },
    searchable: ['name', 'phone', 'email'],
    populate: [{ path: 'planInterest', select: 'name' }],
    sortable: ['createdAt', 'followUpAt', 'name'],
    read: [requirePermission('leads.read', 'leads.manage')],
    write: [requirePermission('leads.manage')],
  })
);

/* ---------------------------------- members ---------------------------------- */

const memberSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(''),
  gender: z.enum(['male', 'female', 'other', 'unspecified']).default('unspecified'),
  dob: zDate.optional().nullable(),
  phone: z.string().trim().max(30).default(''),
  email: z.string().trim().toLowerCase().email().or(z.literal('')).default(''),
  address: z.string().trim().max(400).default(''),
  category: z.string().trim().toLowerCase().max(20).default('standard'),
  photoUrl: z.string().trim().max(2000).refine((v) => v === '' || v.startsWith('https://'), 'Must be https').default(''),
  emergencyContact: z.object({ name: z.string().max(80).default(''), phone: z.string().max(30).default('') }).default({}),
  healthNotes: z.string().max(2000).default(''),
  notes: z.string().max(4000).default(''),
  rfid: z.string().trim().max(40).default(''),
});

async function createMember(data: z.infer<typeof memberSchema>, prefix: string, leadId?: string) {
  const seq = await nextSeq('member');
  return Member.create({ ...data, memberNo: formatSeq(prefix, seq), qrToken: randomToken(9), lead: leadId, status: 'inactive' });
}

r.post(
  '/leads/:id/convert',
  requirePermission('members.write'),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new ApiError(404, 'Lead not found');
    if (lead.status === 'converted' && lead.convertedMember) throw new ApiError(409, 'Lead already converted');
    const [firstName, ...rest] = lead.name.split(' ');
    const body = parse(memberSchema, { firstName, lastName: rest.join(' '), phone: lead.phone, email: lead.email, category: lead.category || 'standard', ...req.body });
    const member = await createMember(body, req.tenant!.settings.memberIdPrefix ?? 'M', String(lead._id));
    lead.status = 'converted';
    lead.convertedMember = member._id;
    await lead.save();
    await audit(req, 'lead.convert', 'Lead', lead._id, member.memberNo);
    res.status(201).json({ success: true, data: member });
  })
);

r.get(
  '/members',
  requirePermission('members.read'),
  asyncHandler(async (req, res) => {
    await refreshMemberStatuses();
    const { page, limit, skip } = pageParams(req.query);
    const q = parse(
      z.object({
        q: z.string().max(80).optional(),
        status: z.enum(['active', 'expired', 'frozen', 'cancelled', 'inactive', 'all']).optional(),
        category: z.string().max(20).optional(),
        gender: z.string().max(20).optional(),
        sort: z.enum(['createdAt', '-createdAt', 'expiresAt', '-expiresAt', 'firstName', '-firstName']).default('-createdAt'),
      }),
      req.query
    );
    const query: Record<string, unknown> = {};
    if (q.status && q.status !== 'all') query.status = q.status;
    if (q.category && q.category !== 'all') query.category = q.category;
    if (q.gender && q.gender !== 'all') query.gender = q.gender;
    if (q.q?.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim()), 'i');
      query.$or = [{ firstName: rx }, { lastName: rx }, { memberNo: rx }, { phone: rx }, { email: rx }];
    }
    const [items, total] = await Promise.all([
      Member.find(query).sort(q.sort).skip(skip).limit(limit).select('-qrToken -healthNotes').lean(),
      Member.countDocuments(query),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);

r.post(
  '/members',
  requirePermission('members.write'),
  asyncHandler(async (req, res) => {
    const body = parse(memberSchema, req.body);
    const m = await createMember(body, req.tenant!.settings.memberIdPrefix ?? 'M');
    await audit(req, 'create', 'Member', m._id, m.memberNo);
    res.status(201).json({ success: true, data: m });
  })
);

r.get(
  '/members/:id',
  requirePermission('members.read'),
  asyncHandler(async (req, res) => {
    const member = await Member.findById(req.params.id).lean();
    if (!member) throw new ApiError(404, 'Member not found');
    const [memberships, invoices, payments, checkIns, login] = await Promise.all([
      Membership.find({ member: member._id }).sort('-startsAt').limit(50).lean(),
      Invoice.find({ member: member._id }).sort('-issuedAt').limit(50).lean(),
      Payment.find({ member: member._id }).sort('-paidAt').limit(50).lean(),
      CheckIn.find({ member: member._id }).sort('-inAt').limit(30).lean(),
      User.findOne({ member: member._id }).select('email status').lean(),
    ]);
    res.json({ success: true, data: { member, memberships, invoices, payments, checkIns, portalLogin: login } });
  })
);

r.put(
  '/members/:id',
  requirePermission('members.write'),
  asyncHandler(async (req, res) => {
    const body = parse(memberSchema.partial().extend({ status: z.enum(['frozen', 'cancelled', 'active', 'expired', 'inactive']).optional() }), req.body);
    for (const k of Object.keys(body)) if (!(k in req.body)) delete (body as any)[k];
    const doc = await Member.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
    if (!doc) throw new ApiError(404, 'Member not found');
    await audit(req, 'update', 'Member', doc._id);
    res.json({ success: true, data: doc });
  })
);

r.delete(
  '/members/:id',
  requirePermission('members.delete'),
  asyncHandler(async (req, res) => {
    const m = await Member.findById(req.params.id);
    if (!m) throw new ApiError(404, 'Member not found');
    if (await Invoice.exists({ member: m._id })) throw new ApiError(409, 'This member has billing history. Mark them as cancelled instead.');
    await Promise.all([m.deleteOne(), User.deleteMany({ member: m._id }), Membership.deleteMany({ member: m._id })]);
    await audit(req, 'delete', 'Member', m._id, m.memberNo);
    res.json({ success: true });
  })
);

/** Give a member a login for the member portal (same login page as staff). */
r.post(
  '/members/:id/portal-login',
  requirePermission('members.write'),
  asyncHandler(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(200) }), req.body);
    const m = await Member.findById(req.params.id);
    if (!m) throw new ApiError(404, 'Member not found');
    const existing = await User.findOne({ member: m._id });
    if (existing) {
      existing.email = email;
      existing.password = password;
      existing.tokenVersion += 1;
      await existing.save();
    } else {
      await User.create({ name: `${m.firstName} ${m.lastName}`.trim(), email, password, role: 'member', member: m._id });
    }
    await audit(req, 'member.portal-login', 'Member', m._id);
    res.json({ success: true });
  })
);

export default r;
