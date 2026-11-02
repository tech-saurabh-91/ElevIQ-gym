import { Router } from 'express';
import { ClassType, ClassSession, Booking, PersonalSession } from '../models/Class.js';
import { Member } from '../models/Member.js';
import { asyncHandler, ApiError, protect } from '../middleware/auth.js';
import { createCrudRouter } from '../utils/crud.js';

const router = Router();

const typeCrud = createCrudRouter(ClassType, { searchable: ['name', 'category'], defaultSort: 'name' });
const sessionCrud = createCrudRouter(ClassSession, {
  populate: [
    { path: 'classType', select: 'name category color durationMin calories intensity' },
    { path: 'trainer', select: 'employeeId jobTitle rating' },
    { path: 'location', select: 'name city' },
  ],
  searchable: ['title', 'room'],
  defaultSort: 'date',
});
const bookingCrud = createCrudRouter(Booking, {
  populate: [
    { path: 'member', select: 'memberId firstName lastName photo' },
    { path: 'session', select: 'title date start end status room' },
  ],
  defaultSort: '-createdAt',
});

router.get('/types', typeCrud.list);
router.post('/types', typeCrud.createOne);
router.put('/types/:id', typeCrud.updateOne);
router.delete('/types/:id', typeCrud.deleteOne);

router.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 864e5);
    const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 30 * 864e5);
    const query = { date: { $gte: from, $lte: to } };
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.category && req.query.category !== 'all') {
      const ids = await ClassType.find({ category: req.query.category }).select('_id');
      query.classType = { $in: ids.map((i) => i._id) };
    }
    if (req.query.trainer && req.query.trainer !== 'all') query.trainer = req.query.trainer;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 60, 300);
    const [items, total] = await Promise.all([
      ClassSession.find(query)
        .populate('classType', 'name category color durationMin calories intensity')
        .populate('trainer', 'employeeId jobTitle rating')
        .populate('location', 'name city')
        .sort({ date: 1, start: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ClassSession.countDocuments(query),
    ]);
    res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
  })
);
router.get('/sessions/:id', sessionCrud.getOne);
router.post('/sessions', sessionCrud.createOne);
router.put('/sessions/:id', sessionCrud.updateOne);
router.delete('/sessions/:id', sessionCrud.deleteOne);

router.post(
  '/sessions/bulk',
  asyncHandler(async (req, res) => {
    const { template, dates = [], capacity } = req.body;
    if (!template || !dates.length) throw new ApiError(400, 'Template and at least one date are required');
    const docs = dates.map((d) => ({ ...template, date: new Date(d), capacity: capacity || template.capacity || 20 }));
    const created = await ClassSession.insertMany(docs);
    res.status(201).json({ success: true, data: created });
  })
);

router.get('/bookings', bookingCrud.list);
router.post('/bookings', bookingCrud.createOne);
router.delete('/bookings/:id', bookingCrud.deleteOne);

router.post(
  '/book',
  protect,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    const session = await ClassSession.findById(sessionId);
    if (!session) throw new ApiError(404, 'Class session not found');
    if (session.status === 'cancelled') throw new ApiError(400, 'This class was cancelled');
    const member = await Member.findOne({ user: req.user._id });
    if (!member) throw new ApiError(404, 'Member profile not found');
    if (member.status !== 'active' && req.user.role === 'member') throw new ApiError(403, 'Membership is not active');

    const existing = await Booking.findOne({ session: session._id, member: member._id });
    if (existing && existing.status !== 'cancelled') throw new ApiError(409, 'Already booked for this class');

    const seatsLeft = session.capacity - session.booked;
    const status = seatsLeft > 0 ? 'booked' : 'waitlist';
    const booking = await Booking.create({ session: session._id, member: member._id, status, source: req.body.source || 'web' });
    if (status === 'booked') {
      session.booked += 1;
      if (session.booked >= session.capacity) session.status = 'full';
    } else {
      session.waitlist += 1;
    }
    await session.save();
    res.status(201).json({ success: true, data: booking });
  })
);

router.post(
  '/bookings/:id/cancel',
  protect,
  asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new ApiError(404, 'Booking not found');
    if (['cancelled', 'no-show'].includes(booking.status)) throw new ApiError(400, 'Booking already cancelled');
    const session = await ClassSession.findById(booking.session);
    if (session) {
      if (booking.status === 'booked') {
        session.booked = Math.max(0, session.booked - 1);
        if (session.waitlist > 0) {
          const next = await Booking.findOne({ session: session._id, status: 'waitlist' }).sort('createdAt');
          if (next) {
            next.status = 'booked';
            await next.save();
            session.waitlist -= 1;
            session.booked += 1;
          }
        }
        if (session.status === 'full' && session.booked < session.capacity) session.status = 'scheduled';
      } else if (booking.status === 'waitlist') {
        session.waitlist = Math.max(0, session.waitlist - 1);
      }
      await session.save();
    }
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    await booking.save();
    res.json({ success: true, data: booking });
  })
);

router.get(
  '/my-bookings',
  protect,
  asyncHandler(async (req, res) => {
    const member = await Member.findOne({ user: req.user._id });
    if (!member) return res.json({ success: true, data: [] });
    const bookings = await Booking.find({ member: member._id })
      .populate({ path: 'session', populate: [{ path: 'classType', select: 'name color category' }, { path: 'trainer', select: 'jobTitle' }] })
      .sort('-createdAt')
      .limit(50)
      .lean();
    res.json({ success: true, data: bookings });
  })
);

const ptCrud = createCrudRouter(PersonalSession, {
  populate: [
    { path: 'member', select: 'memberId firstName lastName' },
    { path: 'trainer', select: 'employeeId jobTitle' },
  ],
  defaultSort: 'date',
});
router.get('/pt', ptCrud.list);
router.post('/pt', ptCrud.createOne);
router.put('/pt/:id', ptCrud.updateOne);
router.delete('/pt/:id', ptCrud.deleteOne);

export default router;
