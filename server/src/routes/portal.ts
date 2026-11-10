import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { startOfDay } from '../lib/util.js';
import { zId } from '../lib/crud.js';
import { requireRole } from '../middleware/auth.js';
import { Member, Membership } from '../models/crm.js';
import { Invoice } from '../models/billing.js';
import { Booking, ClassSession } from '../models/modules.js';
import { bookSession, cancelBooking } from './modules.js';

/** Member self-service. A member can only ever see their own records. */
const r = Router();
r.use(requireRole('member'));

const myMemberId = (req: any) => {
  if (!req.user.member) throw new ApiError(403, 'No member profile linked to this login');
  return req.user.member as string;
};

r.get(
  '/me',
  asyncHandler(async (req, res) => {
    const id = myMemberId(req);
    const [member, memberships, invoices, bookings] = await Promise.all([
      Member.findById(id).select('-healthNotes -notes -rfid').lean(),
      Membership.find({ member: id }).sort('-startsAt').limit(20).lean(),
      Invoice.find({ member: id, status: { $ne: 'void' } }).sort('-issuedAt').limit(30).lean(),
      Booking.find({ member: id, status: { $in: ['booked', 'waitlist'] } }).populate('session', 'title date start end room').lean(),
    ]);
    if (!member) throw new ApiError(404, 'Member not found');
    res.json({ success: true, data: { member, memberships, invoices, bookings } });
  })
);

r.get(
  '/classes',
  asyncHandler(async (_req, res) => {
    const from = startOfDay(new Date());
    const items = await ClassSession.find({ date: { $gte: from, $lte: new Date(from.getTime() + 14 * 864e5) }, status: 'scheduled' })
      .sort({ date: 1, start: 1 })
      .limit(200)
      .populate('classType', 'name color category')
      .populate('trainer', 'name')
      .lean();
    res.json({ success: true, data: items });
  })
);

r.post(
  '/bookings',
  asyncHandler(async (req, res) => {
    const { sessionId } = parse(z.object({ sessionId: zId }), req.body);
    res.status(201).json({ success: true, data: await bookSession(sessionId, myMemberId(req)) });
  })
);

r.post(
  '/bookings/:id/cancel',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await cancelBooking(String(req.params.id), myMemberId(req)) });
  })
);

export default r;
