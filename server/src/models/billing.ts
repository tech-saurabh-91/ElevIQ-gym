import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const lineSchema = new Schema(
  { description: String, qty: { type: Number, default: 1 }, unitPrice: Number, amount: Number },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    number: { type: String, required: true },
    member: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    billTo: { name: String, email: String, phone: String },
    lines: { type: [lineSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    offer: { id: { type: Schema.Types.ObjectId, ref: 'Offer' }, title: String, code: String },
    taxLabel: String,
    taxRate: { type: Number, default: 0 },
    taxInclusive: { type: Boolean, default: false },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    currency: { type: String, required: true },
    status: { type: String, enum: ['unpaid', 'partial', 'paid', 'void'], default: 'unpaid', index: true },
    issuedAt: { type: Date, default: Date.now, index: true },
    dueAt: Date,
    kind: { type: String, enum: ['membership', 'retail', 'pt', 'other'], default: 'membership' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidReason: String,
  },
  { timestamps: true }
);
invoiceSchema.plugin(tenantPlugin);
invoiceSchema.index({ tenantId: 1, number: 1 }, { unique: true });
invoiceSchema.index({ tenantId: 1, status: 1 });
invoiceSchema.index({ tenantId: 1, issuedAt: -1 });

const paymentSchema = new Schema(
  {
    receiptNo: { type: String, required: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', index: true },
    member: { type: Schema.Types.ObjectId, ref: 'Member', index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, required: true },
    method: { type: String, enum: ['cash', 'card', 'upi', 'bank-transfer', 'wallet', 'other'], default: 'cash' },
    reference: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ['completed', 'refunded'], default: 'completed' },
    refundedAmount: { type: Number, default: 0 },
    refundReason: String,
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
paymentSchema.plugin(tenantPlugin);
paymentSchema.index({ tenantId: 1, receiptNo: 1 }, { unique: true });
paymentSchema.index({ tenantId: 1, paidAt: 1 });

const expenseSchema = new Schema(
  {
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ['rent', 'utilities', 'payroll', 'equipment', 'marketing', 'supplies', 'maintenance', 'other'],
      default: 'other',
    },
    amount: { type: Number, required: true, min: 0 },
    vendor: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now, index: true },
    notes: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
expenseSchema.plugin(tenantPlugin);
expenseSchema.index({ tenantId: 1, paidAt: 1 });

/** Per-tenant atomic sequences (member numbers, invoice numbers, receipts). */
const counterSchema = new Schema({ key: { type: String, required: true }, seq: { type: Number, default: 0 } });
counterSchema.plugin(tenantPlugin);
counterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    impersonatedBy: String,
    action: { type: String, required: true },
    entity: String,
    entityId: String,
    summary: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.plugin(tenantPlugin);
auditSchema.index({ tenantId: 1, createdAt: -1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const Expense = mongoose.model('Expense', expenseSchema);
export const Counter = mongoose.model('Counter', counterSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);
