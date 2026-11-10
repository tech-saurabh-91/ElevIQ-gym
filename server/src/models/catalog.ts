import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

const priceSchema = new Schema(
  { category: { type: String, required: true }, amount: { type: Number, required: true, min: 0 } },
  { _id: false }
);

const planSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '' },
    features: { type: [String], default: [] },
    durationDays: { type: Number, required: true, min: 1, max: 3660 },
    billingLabel: { type: String, default: 'month' },
    prices: { type: [priceSchema], default: [] },
    joiningFee: { type: Number, default: 0, min: 0 },
    isPublic: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    highlight: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
planSchema.plugin(tenantPlugin);

const offerSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: '' },
    discountType: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true, min: 0 },
    planIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Plan' }], default: [] },
    categories: { type: [String], default: [] },
    code: { type: String, uppercase: true, trim: true, default: '' },
    autoApply: { type: Boolean, default: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    display: {
      bar: { type: Boolean, default: false },
      popup: { type: Boolean, default: false },
      banner: { type: Boolean, default: false },
      badge: { type: Boolean, default: true },
    },
    badgeText: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    maxRedemptions: { type: Number, default: 0 },
    redemptions: { type: Number, default: 0 },
  },
  { timestamps: true }
);
offerSchema.plugin(tenantPlugin);
offerSchema.index({ tenantId: 1, active: 1, startsAt: 1, endsAt: 1 });

export const Plan = mongoose.model('Plan', planSchema);
export const Offer = mongoose.model('Offer', offerSchema);
