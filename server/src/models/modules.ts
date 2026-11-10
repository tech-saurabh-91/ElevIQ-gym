import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

/* Operational modules carried over from v1, now tenant-scoped. */

const classTypeSchema = new Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: 'group-fitness' },
    description: { type: String, default: '' },
    durationMin: { type: Number, default: 45 },
    defaultCapacity: { type: Number, default: 20 },
    color: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
classTypeSchema.plugin(tenantPlugin);
classTypeSchema.index({ tenantId: 1, name: 1 }, { unique: true });

const classSessionSchema = new Schema(
  {
    classType: { type: Schema.Types.ObjectId, ref: 'ClassType', required: true },
    title: { type: String, required: true },
    trainer: { type: Schema.Types.ObjectId, ref: 'User' },
    room: { type: String, default: '' },
    date: { type: Date, required: true, index: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    capacity: { type: Number, default: 20, min: 1 },
    booked: { type: Number, default: 0, min: 0 },
    waitlist: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
  },
  { timestamps: true }
);
classSessionSchema.plugin(tenantPlugin);

const bookingSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    status: { type: String, enum: ['booked', 'waitlist', 'attended', 'cancelled', 'no-show'], default: 'booked' },
    cancelledAt: Date,
  },
  { timestamps: true }
);
bookingSchema.plugin(tenantPlugin);
// Only one live booking per member per session; cancelled ones never block re-booking.
bookingSchema.index(
  { tenantId: 1, session: 1, member: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['booked', 'waitlist', 'attended'] } } }
);

const equipmentSchema = new Schema(
  {
    assetTag: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: 'cardio' },
    brand: { type: String, default: '' },
    zone: { type: String, default: '' },
    purchasedAt: Date,
    cost: { type: Number, default: 0 },
    condition: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' },
    status: { type: String, enum: ['in-use', 'maintenance', 'out-of-order', 'retired'], default: 'in-use' },
    nextServiceAt: Date,
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);
equipmentSchema.plugin(tenantPlugin);
equipmentSchema.index({ tenantId: 1, assetTag: 1 }, { unique: true });

const maintenanceSchema = new Schema(
  {
    equipment: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
    title: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['open', 'in-progress', 'done'], default: 'open' },
    cost: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    completedAt: Date,
  },
  { timestamps: true }
);
maintenanceSchema.plugin(tenantPlugin);

const checkInSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    method: { type: String, enum: ['qr', 'rfid', 'manual'], default: 'manual' },
    inAt: { type: Date, default: Date.now, index: true },
    outAt: Date,
    durationMin: Number,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);
checkInSchema.plugin(tenantPlugin);

const productSchema = new Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: 'supplements' },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
productSchema.plugin(tenantPlugin);
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true });

const shiftSchema = new Schema(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    role: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);
shiftSchema.plugin(tenantPlugin);

export const ClassType = mongoose.model('ClassType', classTypeSchema);
export const ClassSession = mongoose.model('ClassSession', classSessionSchema);
export const Booking = mongoose.model('Booking', bookingSchema);
export const Equipment = mongoose.model('Equipment', equipmentSchema);
export const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
export const CheckIn = mongoose.model('CheckIn', checkInSchema);
export const Product = mongoose.model('Product', productSchema);
export const Shift = mongoose.model('Shift', shiftSchema);
