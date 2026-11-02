import { Router } from 'express';
import { Equipment, Maintenance } from '../models/Equipment.js';
import { Staff, Shift, TrainingRecord } from '../models/Staff.js';
import { asyncHandler, ApiError, protect } from '../middleware/auth.js';
import { createCrudRouter } from '../utils/crud.js';

const router = Router();
router.use(protect);

const eqCrud = createCrudRouter(Equipment, {
  populate: [{ path: 'location', select: 'name city' }],
  searchable: ['name', 'assetTag', 'brand', 'model'],
  defaultSort: '-createdAt',
});
router.get('/equipment', eqCrud.list);
router.get('/equipment/:id', eqCrud.getOne);
router.post('/equipment', eqCrud.createOne);
router.put('/equipment/:id', eqCrud.updateOne);
router.delete('/equipment/:id', eqCrud.deleteOne);

router.get(
  '/equipment/stats/summary',
  asyncHandler(async (req, res) => {
    const [byStatus, byCategory, total, downtime, safety] = await Promise.all([
      Equipment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Equipment.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, usage: { $sum: '$usageCount' } } }]),
      Equipment.countDocuments(),
      Maintenance.aggregate([
        { $match: { status: { $ne: 'done' } } },
        { $group: { _id: null, open: { $sum: 1 }, hours: { $sum: '$downtimeHours' } } },
      ]),
      Equipment.aggregate([{ $group: { _id: null, avg: { $avg: '$safetyScore' } } }]),
    ]);
    res.json({
      success: true,
      data: {
        byStatus,
        byCategory,
        total,
        openTickets: downtime[0]?.open || 0,
        downtimeHours: downtime[0]?.hours || 0,
        safetyScore: Math.round(safety[0]?.avg || 0),
      },
    });
  })
);

const mtCrud = createCrudRouter(Maintenance, {
  populate: [{ path: 'equipment', select: 'name assetTag category status' }, { path: 'assignedTo', select: 'jobTitle' }],
  searchable: ['title', 'description'],
  defaultSort: '-createdAt',
});
router.get('/maintenance', mtCrud.list);
router.post('/maintenance', mtCrud.createOne);
router.put('/maintenance/:id', mtCrud.updateOne);
router.delete('/maintenance/:id', mtCrud.deleteOne);

router.post(
  '/maintenance/:id/progress',
  asyncHandler(async (req, res) => {
    const doc = await Maintenance.findById(req.params.id);
    if (!doc) throw new ApiError(404, 'Ticket not found');
    const next = req.body.status;
    if (!['open', 'in-progress', 'done', 'deferred'].includes(next)) throw new ApiError(400, 'Invalid status');
    doc.status = next;
    if (next === 'in-progress' && !doc.startedAt) doc.startedAt = new Date();
    if (next === 'done') {
      doc.completedAt = new Date();
      const eq = await Equipment.findById(doc.equipment);
      if (eq) {
        eq.status = 'in-use';
        eq.lastServicedAt = new Date();
        eq.nextServiceAt = new Date(Date.now() + 90 * 864e5);
        eq.condition = req.body.condition || eq.condition;
        await eq.save();
      }
    }
    if (next === 'in-progress' || next === 'deferred') {
      const eq = await Equipment.findById(doc.equipment);
      if (eq) { eq.status = next === 'deferred' ? 'in-use' : 'maintenance'; await eq.save(); }
    }
    await doc.save();
    res.json({ success: true, data: doc });
  })
);

const staffCrud = createCrudRouter(Staff, {
  populate: [{ path: 'user', select: 'name email phone avatar status' }, { path: 'location', select: 'name city' }],
  searchable: ['employeeId', 'jobTitle', 'specializations'],
  defaultSort: '-createdAt',
  create: async (req) => Staff.create(req.body),
});
router.get('/staff', staffCrud.list);
router.get('/staff/:id', staffCrud.getOne);
router.post('/staff', staffCrud.createOne);
router.put('/staff/:id', staffCrud.updateOne);
router.delete('/staff/:id', staffCrud.deleteOne);

const shiftCrud = createCrudRouter(Shift, {
  populate: [{ path: 'staff', select: 'employeeId jobTitle' }, { path: 'location', select: 'name' }],
  defaultSort: 'date',
});
router.get('/shifts', shiftCrud.list);
router.post('/shifts', shiftCrud.createOne);
router.put('/shifts/:id', shiftCrud.updateOne);
router.delete('/shifts/:id', shiftCrud.deleteOne);

const trCrud = createCrudRouter(TrainingRecord, { populate: [{ path: 'staff', select: 'employeeId jobTitle' }], defaultSort: '-completedAt' });
router.get('/training', trCrud.list);
router.post('/training', trCrud.createOne);
router.delete('/training/:id', trCrud.deleteOne);

export default router;
