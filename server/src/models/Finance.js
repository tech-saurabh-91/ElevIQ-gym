import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, unique: true, sparse: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    payerName: String,
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    method: { type: String, enum: ['card', 'cash', 'bank-transfer', 'wallet', 'upi', 'qr'], default: 'card' },
    gateway: { type: String, enum: ['stripe', 'paypal', 'square', 'razorpay', 'manual'], default: 'manual' },
    status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded'], default: 'paid', index: true },
    category: { type: String, enum: ['membership', 'personal-training', 'retail', 'locker', 'other'], default: 'membership' },
    description: String,
    paidAt: { type: Date, default: Date.now, index: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    reference: String,
    refundedAmount: { type: Number, default: 0 },
    refundReason: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, unique: true, sparse: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    email: String,
    items: { type: [Object], default: [] },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['draft', 'issued', 'paid', 'overdue', 'void'], default: 'issued', index: true },
    dueAt: Date,
    issuedAt: { type: Date, default: Date.now },
    paidAt: Date,
    notes: String,
  },
  { timestamps: true }
);

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, enum: ['rent', 'utilities', 'payroll', 'equipment', 'marketing', 'supplies', 'maintenance', 'other'], default: 'other', index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    vendor: String,
    paidAt: { type: Date, default: Date.now, index: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    method: { type: String, default: 'bank-transfer' },
    notes: String,
    receiptUrl: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, default: 'supplements' },
    price: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    stock: { type: Number, default: 0 },
    lowStockAt: { type: Number, default: 10 },
    supplier: String,
    image: String,
    taxRate: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    sold: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const saleSchema = new mongoose.Schema(
  {
    saleNo: { type: String, unique: true, sparse: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    items: { type: [Object], default: [] },
    subtotal: Number,
    tax: Number,
    discount: Number,
    total: Number,
    currency: { type: String, default: 'USD' },
    paymentMethod: { type: String, default: 'card' },
    customer: String,
    soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    soldAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
export const Invoice = mongoose.model('Invoice', invoiceSchema);
export const Expense = mongoose.model('Expense', expenseSchema);
export const Product = mongoose.model('Product', productSchema);
export const Sale = mongoose.model('Sale', saleSchema);
