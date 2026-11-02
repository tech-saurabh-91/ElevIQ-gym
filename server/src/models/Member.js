import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    billing: { type: String, enum: ['monthly', 'quarterly', 'yearly', 'drop-in'], default: 'monthly' },
    durationDays: { type: Number, default: 30 },
    features: { type: [String], default: [] },
    visitLimit: { type: Number, default: 0 },
    maxLocations: { type: Number, default: 1 },
    familySlots: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    color: { type: String, default: '#22d3ee' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const locationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    city: String,
    country: { type: String, default: 'US' },
    timezone: { type: String, default: 'UTC' },
    address: String,
    phone: String,
    email: String,
    capacity: { type: Number, default: 300 },
    sqft: { type: Number, default: 12000 },
    openHours: { type: String, default: '05:00 - 23:00' },
    facilities: { type: [String], default: [] },
    lat: Number,
    lng: Number,
    status: { type: String, enum: ['active', 'renovating', 'closed'], default: 'active' },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    memberId: { type: String, required: true, unique: true, index: true },
    firstName: String,
    lastName: String,
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not'], default: 'other' },
    dob: Date,
    photo: { type: String, default: '' },
    bloodGroup: String,
    address: { type: Object, default: {} },
    emergencyContact: { type: Object, default: {} },
    goals: { type: [String], default: [] },
    healthNotes: { type: String, default: '' },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: String,
    homeLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    status: { type: String, enum: ['active', 'expired', 'frozen', 'cancelled', 'pending'], default: 'active', index: true },
    joinedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    autoRenew: { type: Boolean, default: true },
    visitsThisMonth: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    lastVisitAt: Date,
    rfid: { type: String, default: '' },
    qrToken: { type: String, default: '' },
    familyGroup: String,
    company: String,
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: String,
    rating: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    notes: String,
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

memberSchema.index({ firstName: 'text', lastName: 'text', memberId: 'text' });

export const Plan = mongoose.model('Plan', planSchema);
export const Location = mongoose.model('Location', locationSchema);
export const Member = mongoose.model('Member', memberSchema);
