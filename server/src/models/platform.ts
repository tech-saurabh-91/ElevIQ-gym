import mongoose, { Schema } from 'mongoose';

/** Not tenant-scoped: these documents describe the tenants themselves. */
const hoursSchema = new Schema(
  { day: { type: Number, min: 0, max: 6 }, open: String, close: String, closed: { type: Boolean, default: false } },
  { _id: false }
);

export const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '06:00', close: '22:00', closed: day === 0 }));

const tenantSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/ },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial', index: true },
    domains: { type: [String], default: [] },
    contactEmail: { type: String, default: '' },
    setupCompleted: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    /** Business settings: the single source of truth used by billing AND the public site. */
    settings: {
      legalName: { type: String, default: '' },
      currency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
      locale: { type: String, default: 'en-IN' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      tax: {
        label: { type: String, default: 'GST' },
        rate: { type: Number, default: 0, min: 0, max: 100 },
        inclusive: { type: Boolean, default: false },
        registrationNo: { type: String, default: '' },
      },
      hours: { type: [hoursSchema], default: DEFAULT_HOURS },
      invoicePrefix: { type: String, default: 'INV' },
      memberIdPrefix: { type: String, default: 'M' },
      categories: { type: [String], default: ['standard', 'student', 'couple', 'senior'] },
    },
  },
  { timestamps: true }
);
// Multikey unique index: a domain can belong to only one gym.
// (empty arrays would otherwise collide as `undefined`, hence the partial filter)
tenantSchema.index({ domains: 1 }, { unique: true, partialFilterExpression: { 'domains.0': { $exists: true } } });

export const Tenant = mongoose.model('Tenant', tenantSchema);
export type TenantDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof tenantSchema>>;

const platformUserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);
export const PlatformUser = mongoose.model('PlatformUser', platformUserSchema);
