import mongoose from 'mongoose';

const equipmentSchema = new mongoose.Schema(
  {
    assetTag: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['cardio', 'strength', 'free-weights', 'functional', 'studio', 'recovery'],
      default: 'cardio',
      index: true,
    },
    brand: String,
    model: String,
    serialNumber: String,
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    zone: String,
    purchasedAt: Date,
    cost: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    warrantyExpiresAt: Date,
    condition: { type: String, enum: ['excellent', 'good', 'fair', 'poor'], default: 'good' },
    status: { type: String, enum: ['in-use', 'maintenance', 'out-of-order', 'retired'], default: 'in-use', index: true },
    usageCount: { type: Number, default: 0 },
    usageMinutes: { type: Number, default: 0 },
    lastServicedAt: Date,
    nextServiceAt: Date,
    vendor: String,
    safetyScore: { type: Number, default: 100 },
    image: String,
    notes: String,
  },
  { timestamps: true }
);

const maintenanceSchema = new mongoose.Schema(
  {
    equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true, index: true },
    type: { type: String, enum: ['preventive', 'corrective', 'inspection', 'safety'], default: 'preventive' },
    title: { type: String, required: true },
    description: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['open', 'in-progress', 'done', 'deferred'], default: 'open', index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    vendor: String,
    scheduledFor: Date,
    startedAt: Date,
    completedAt: Date,
    cost: { type: Number, default: 0 },
    downtimeHours: { type: Number, default: 0 },
    parts: { type: [Object], default: [] },
    checklist: { type: [Object], default: [] },
    notes: String,
  },
  { timestamps: true }
);

export const Equipment = mongoose.model('Equipment', equipmentSchema);
export const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
