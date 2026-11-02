import { Router } from 'express';
import { CheckIn, Locker, Announcement, ContactMessage, GalleryItem, Review, Notification, Campaign } from '../models/Operations.js';
import { Member, Plan, Location } from '../models/Member.js';
import { ClassSession, Booking } from '../models/Class.js';
import { Equipment, Maintenance } from '../models/Equipment.js';
import { Payment, Expense, Product, Invoice, Sale } from '../models/Finance.js';
import { Staff } from '../models/Staff.js';
import { asyncHandler, ApiError, protect, authorize } from '../middleware/auth.js';
import { createCrudRouter } from '../utils/crud.js';

const router = Router();

/* ------------------------------- PUBLIC ------------------------------- */

router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    const plans = await Plan.find({ active: true, isPublic: true }).sort('price').lean();
    res.json({ success: true, data: plans });
  })
);
router.get('/locations', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Location.find({ status: { $ne: 'closed' } }).sort('name').lean() });
}));
router.get('/gallery', asyncHandler(async (req, res) => {
  const q = { active: true };
  if (req.query.category && req.query.category !== 'all') q.category = req.query.category;
  res.json({ success: true, data: await GalleryItem.find(q).sort('order createdAt').limit(60).lean() });
}));
router.get('/reviews', asyncHandler(async (req, res) => {
  const q = { status: 'approved' };
  if (req.query.featured === 'true') q.featured = true;
  res.json({ success: true, data: await Review.find(q).sort('-createdAt').limit(30).lean() });
}));
router.get('/announcements', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Announcement.find({ active: true }).sort('-pinned -publishedAt').limit(20).lean() });
}));

router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) throw new ApiError(400, 'Name, email and message are required');
    const doc = await ContactMessage.create({ ...req.body, source: 'website' });
    res.status(201).json({ success: true, data: doc, message: 'Thanks! Our team will get back to you within 24 hours.' });
  })
);

router.post(
  '/reviews',
  asyncHandler(async (req, res) => {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) throw new ApiError(400, 'Name, rating and comment are required');
    const doc = await Review.create({ ...req.body, status: 'approved' });
    res.status(201).json({ success: true, data: doc });
  })
);

router.get(
  '/site-stats',
  asyncHandler(async (req, res) => {
    const [members, classes, locations, trainers, sessionsThisWeek] = await Promise.all([
      Member.countDocuments({ status: 'active' }),
      ClassSession.countDocuments({ status: { $ne: 'cancelled' } }),
      Location.countDocuments({ status: 'active' }),
      Staff.countDocuments({ status: 'active' }),
      ClassSession.countDocuments({ date: { $gte: new Date(Date.now() - 7 * 864e5) } }),
    ]);
    res.json({ success: true, data: { members, classes, locations, trainers, sessionsThisWeek } });
  })
);

/* ------------------------------ PROTECTED ------------------------------ */

const adminOnly = authorize('admin');
const staffOrAdmin = authorize('admin', 'trainer');

const checkinCrud = createCrudRouter(CheckIn, {
  populate: [{ path: 'member', select: 'memberId firstName lastName status photo' }, { path: 'location', select: 'name' }],
  defaultSort: '-inAt',
});
router.get('/checkins', protect, checkinCrud.list);
router.post('/checkins', protect, checkinCrud.createOne);

router.get(
  '/checkins/live',
  protect,
  asyncHandler(async (req, res) => {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const [inside, todayCount, recent] = await Promise.all([
      CheckIn.countDocuments({ outAt: null }),
      CheckIn.countDocuments({ inAt: { $gte: dayStart } }),
      CheckIn.find({ inAt: { $gte: dayStart } })
        .populate('member', 'memberId firstName lastName photo')
        .sort('-inAt')
        .limit(25)
        .lean(),
    ]);
    res.json({ success: true, data: { inside, todayCount, recent } });
  })
);

router.post(
  '/checkins/scan',
  protect,
  asyncHandler(async (req, res) => {
    const { code, method = 'qr' } = req.body;
    if (!code) throw new ApiError(400, 'Scan code required');
    const member = await Member.findOne({ $or: [{ qrToken: code }, { memberId: code }, { rfid: code }] });
    if (!member) throw new ApiError(404, 'No member matches this code');
    if (member.status !== 'active') throw new ApiError(403, `Membership ${member.status}`);
    const open = await CheckIn.findOne({ member: member._id, outAt: null });
    if (open) {
      open.outAt = new Date();
      open.durationMin = Math.round((open.outAt - open.inAt) / 60000);
      await open.save();
      return res.json({ success: true, data: { action: 'checkout', member, checkIn: open } });
    }
    const checkIn = await CheckIn.create({ member: member._id, method, verifiedBy: req.user._id });
    member.visitsThisMonth += 1;
    member.totalVisits += 1;
    member.lastVisitAt = checkIn.inAt;
    await member.save();
    res.status(201).json({ success: true, data: { action: 'checkin', member, checkIn } });
  })
);

const lockerCrud = createCrudRouter(Locker, { populate: [{ path: 'member', select: 'memberId firstName lastName' }], defaultSort: 'number' });
router.get('/lockers', protect, lockerCrud.list);
router.post('/lockers', protect, lockerCrud.createOne);
router.put('/lockers/:id', protect, lockerCrud.updateOne);
router.delete('/lockers/:id', protect, lockerCrud.deleteOne);

const announcementCrud = createCrudRouter(Announcement, { searchable: ['title', 'body'], defaultSort: '-publishedAt' });
router.get('/announcements/all', protect, announcementCrud.list);
router.post('/announcements', protect, announcementCrud.createOne);
router.put('/announcements/:id', protect, announcementCrud.updateOne);
router.delete('/announcements/:id', protect, adminOnly, announcementCrud.deleteOne);

const contactCrud = createCrudRouter(ContactMessage, { searchable: ['name', 'email', 'subject'], defaultSort: '-createdAt' });
router.get('/contacts', protect, adminOnly, contactCrud.list);
router.put('/contacts/:id', protect, adminOnly, contactCrud.updateOne);
router.delete('/contacts/:id', protect, adminOnly, contactCrud.deleteOne);

const galleryCrud = createCrudRouter(GalleryItem, { searchable: ['title', 'category'], defaultSort: 'order' });
router.get('/gallery/manage', protect, galleryCrud.list);
router.post('/gallery', protect, galleryCrud.createOne);
router.put('/gallery/:id', protect, galleryCrud.updateOne);
router.delete('/gallery/:id', protect, galleryCrud.deleteOne);

const reviewCrud = createCrudRouter(Review, { defaultSort: '-createdAt' });
router.get('/reviews/manage', protect, reviewCrud.list);
router.put('/reviews/:id', protect, reviewCrud.updateOne);
router.delete('/reviews/:id', protect, reviewCrud.deleteOne);

const campaignCrud = createCrudRouter(Campaign, { searchable: ['name', 'channel'], defaultSort: '-createdAt' });
router.get('/campaigns', protect, campaignCrud.list);
router.post('/campaigns', protect, campaignCrud.createOne);
router.put('/campaigns/:id', protect, campaignCrud.updateOne);
router.delete('/campaigns/:id', protect, campaignCrud.deleteOne);

const planCrud = createCrudRouter(Plan, { searchable: ['name', 'code'], defaultSort: 'price' });
router.get('/plans/manage', protect, planCrud.list);
router.post('/plans', protect, adminOnly, planCrud.createOne);
router.put('/plans/:id', protect, adminOnly, planCrud.updateOne);
router.delete('/plans/:id', protect, adminOnly, planCrud.deleteOne);

const locationCrud = createCrudRouter(Location, { searchable: ['name', 'city', 'country'], defaultSort: 'name' });
router.get('/locations/manage', protect, locationCrud.list);
router.post('/locations', protect, adminOnly, locationCrud.createOne);
router.put('/locations/:id', protect, adminOnly, locationCrud.updateOne);
router.delete('/locations/:id', protect, adminOnly, locationCrud.deleteOne);

router.get('/notifications', protect, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Notification.find({ user: req.user._id }).sort('-createdAt').limit(30).lean() });
}));
router.post('/notifications/read', protect, asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true });
}));

export default router;
