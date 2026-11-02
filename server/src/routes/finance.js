import { Router } from 'express';
import { Payment, Invoice, Expense, Product, Sale } from '../models/Finance.js';
import { Member } from '../models/Member.js';
import { asyncHandler, ApiError, protect, authorize } from '../middleware/auth.js';
import { createCrudRouter } from '../utils/crud.js';

const router = Router();
router.use(protect);

const payCrud = createCrudRouter(Payment, {
  populate: [{ path: 'member', select: 'memberId firstName lastName' }],
  searchable: ['receiptNo', 'payerName', 'description'],
  defaultSort: '-paidAt',
  create: async (req) =>
    Payment.create({ ...req.body, receiptNo: `RCT-${Date.now().toString(36).toUpperCase()}`, createdBy: req.user._id }),
});
router.get('/payments', payCrud.list);
router.post('/payments', payCrud.createOne);
router.get(
  '/payments/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const match = (from) => ({ $match: { paidAt: { $gte: from }, status: 'paid' } });
    const [thisMonth, lastMonth, byMethod, byCategory, refunds] = await Promise.all([
      Payment.aggregate([match(monthStart), { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Payment.aggregate([match(lastMonthStart), { $match: { paidAt: { $lt: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([match(monthStart), { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Payment.aggregate([match(monthStart), { $group: { _id: '$category', total: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: { status: 'refunded' } }, { $group: { _id: null, total: { $sum: '$refundedAmount' } } }]),
    ]);
    res.json({
      success: true,
      data: {
        thisMonth: thisMonth[0] || { total: 0, count: 0 },
        lastMonth: lastMonth[0]?.total || 0,
        byMethod,
        byCategory,
        refunds: refunds[0]?.total || 0,
      },
    });
  })
);
router.post('/payments/:id/refund', asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status === 'refunded') throw new ApiError(400, 'Already refunded');
  payment.status = 'refunded';
  payment.refundedAmount = req.body.amount ?? payment.amount;
  payment.refundReason = req.body.reason || 'Customer request';
  await payment.save();
  res.json({ success: true, data: payment });
}));

const invCrud = createCrudRouter(Invoice, {
  populate: [{ path: 'member', select: 'memberId firstName lastName email' }],
  searchable: ['invoiceNo', 'email'],
  defaultSort: '-issuedAt',
  create: async (req) => {
    const body = req.body;
    const items = body.items || [];
    const subtotal = items.reduce((s, i) => s + (i.qty || 1) * (i.price || 0), 0);
    const tax = Math.round(subtotal * (body.taxRate || 0)) / 100;
    const total = Math.round((subtotal + tax - (body.discount || 0)) * 100) / 100;
    return Invoice.create({
      ...body,
      subtotal,
      tax,
      total,
      invoiceNo: `INV-${Date.now().toString(36).toUpperCase()}`,
      status: body.status || 'issued',
    });
  },
});
router.get('/invoices', invCrud.list);
router.post('/invoices', invCrud.createOne);
router.put('/invoices/:id', invCrud.updateOne);
router.delete('/invoices/:id', invCrud.deleteOne);

const expCrud = createCrudRouter(Expense, { searchable: ['title', 'vendor'], defaultSort: '-paidAt' });
router.get('/expenses', expCrud.list);
router.post('/expenses', expCrud.createOne);
router.delete('/expenses/:id', expCrud.deleteOne);

const prodCrud = createCrudRouter(Product, { searchable: ['name', 'sku', 'category'], defaultSort: '-createdAt' });
router.get('/products', prodCrud.list);
router.post('/products', prodCrud.createOne);
router.put('/products/:id', prodCrud.updateOne);
router.delete('/products/:id', prodCrud.deleteOne);

const saleCrud = createCrudRouter(Sale, {
  populate: [{ path: 'soldBy', select: 'name' }],
  searchable: ['saleNo', 'customer'],
  defaultSort: '-soldAt',
});
router.get('/sales', saleCrud.list);

router.post(
  '/sales',
  asyncHandler(async (req, res) => {
    const { items = [], paymentMethod = 'card', customer = '' } = req.body;
    if (!items.length) throw new ApiError(400, 'Cart is empty');
    let subtotal = 0;
    const lines = [];
    for (const line of items) {
      const product = await Product.findById(line.productId);
      if (!product) throw new ApiError(404, `Product ${line.productId} not found`);
      const qty = Math.max(1, parseInt(line.qty, 10) || 1);
      if (product.stock < qty) throw new ApiError(400, `Insufficient stock for ${product.name}`);
      product.stock -= qty;
      product.sold += qty;
      await product.save();
      const lineTotal = product.price * qty;
      subtotal += lineTotal;
      lines.push({ productId: product._id, name: product.name, sku: product.sku, qty, price: product.price, total: lineTotal });
    }
    const tax = 0;
    const total = subtotal;
    const sale = await Sale.create({
      saleNo: `SAL-${Date.now().toString(36).toUpperCase()}`,
      items: lines,
      subtotal,
      tax,
      total,
      paymentMethod,
      customer,
      soldBy: req.user._id,
      currency: req.body.currency || 'USD',
    });
    await Payment.create({
      receiptNo: sale.saleNo,
      payerName: customer || 'Walk-in',
      amount: total,
      category: 'retail',
      method: paymentMethod === 'cash' ? 'cash' : 'card',
      description: `POS sale ${sale.saleNo}`,
      receiptNo: sale.saleNo,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: sale });
  })
);

router.get(
  '/revenue-series',
  asyncHandler(async (req, res) => {
    const months = parseInt(req.query.months, 10) || 12;
    const start = new Date();
    start.setMonth(start.getMonth() - (months - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const [income, costs] = await Promise.all([
      Payment.aggregate([
        { $match: { paidAt: { $gte: start }, status: 'paid' } },
        { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: '$amount' } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
      Expense.aggregate([
        { $match: { paidAt: { $gte: start } } },
        { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: '$amount' } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]),
    ]);
    const labels = [];
    const cursor = new Date(start);
    const now = new Date();
    const lookup = (arr, y, m) => arr.find((x) => x._id.y === y && x._id.m === m)?.total || 0;
    while (cursor <= now) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      labels.push({
        key: `${y}-${String(m).padStart(2, '0')}`,
        label: cursor.toLocaleString('en-US', { month: 'short' }),
        income: lookup(income, y, m),
        cost: lookup(costs, y, m),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    res.json({ success: true, data: labels });
  })
);

export default router;
