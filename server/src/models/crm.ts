import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

/** Website forms only ever create leads. Staff convert a lead into a member explicitly. */
const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, default: '', maxlength: 30 },
    email: { type: String, default: '', lowercase: true, trim: true, maxlength: 120 },
    message: { type: String, default: '', maxlength: 2000 },
    source: { type: String, enum: ['enquiry', 'join', 'walk-in', 'phone', 'referral', 'other'], default: 'enquiry' },
    planInterest: { type: Schema.Types.ObjectId, ref: 'Plan' },
    category: { type: String, default: '' },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    status: { type: String, enum: ['new', 'contacted', 'trial', 'converted', 'lost'], default: 'new', index: true },
    notes: { type: String, default: '' },
    followUpAt: Date,
    convertedMember: { type: Schema.Types.ObjectId, ref: 'Member' },
  },
  { timestamps: true }
);
leadSchema.plugin(tenantPlugin);

const memberSchema = new Schema(
  {
    memberNo: { type: String, required: true },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, default: '', trim: true, maxlength: 60 },
    gender: { type: String, enum: ['male', 'female', 'other', 'unspecified'], default: 'unspecified' },
    dob: Date,
    phone: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    address: { type: String, default: '' },
    category: { type: String, default: 'standard' },
    photoUrl: { type: String, default: '' },
    emergencyContact: { name: { type: String, default: '' }, phone: { type: String, default: '' } },
    healthNotes: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['active', 'expired', 'frozen', 'cancelled', 'inactive'], default: 'inactive', index: true },
    currentPlan: { type: Schema.Types.ObjectId, ref: 'Plan' },
    currentPlanName: { type: String, default: '' },
    startsAt: Date,
    expiresAt: { type: Date, index: true },
    joinedAt: { type: Date, default: Date.now },
    qrToken: { type: String, required: true },
    rfid: { type: String, default: '' },
    totalVisits: { type: Number, default: 0 },
    lastVisitAt: Date,
    lead: { type: Schema.Types.ObjectId, ref: 'Lead' },
  },
  { timestamps: true }
);
memberSchema.plugin(tenantPlugin);
memberSchema.index({ tenantId: 1, memberNo: 1 }, { unique: true });
memberSchema.index({ tenantId: 1, qrToken: 1 }, { unique: true });

/** One purchased period of a plan. */
const membershipSchema = new Schema(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    planName: String,
    category: String,
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);
membershipSchema.plugin(tenantPlugin);

export const Lead = mongoose.model('Lead', leadSchema);
export const Member = mongoose.model('Member', memberSchema);
export const Membership = mongoose.model('Membership', membershipSchema);
