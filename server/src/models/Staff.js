import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, index: true },
    jobTitle: { type: String, default: 'Trainer' },
    department: { type: String, enum: ['training', 'front-desk', 'operations', 'finance', 'marketing', 'management'], default: 'training' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    employmentType: { type: String, enum: ['full-time', 'part-time', 'contract', 'intern'], default: 'full-time' },
    hiredAt: { type: Date, default: Date.now },
    salary: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    shift: { type: String, default: 'Morning' },
    weeklyHours: { type: Number, default: 40 },
    certifications: { type: [Object], default: [] },
    specializations: { type: [String], default: [] },
    rating: { type: Number, default: 0 },
    kpis: {
      sessionsCompleted: { type: Number, default: 0 },
      membersCoached: { type: Number, default: 0 },
      attendanceRate: { type: Number, default: 0 },
      revenueGenerated: { type: Number, default: 0 },
      nps: { type: Number, default: 0 },
    },
    performanceScore: { type: Number, default: 0 },
    emergencyContact: { type: Object, default: {} },
    status: { type: String, enum: ['active', 'on-leave', 'terminated'], default: 'active', index: true },
    accessLevel: { type: [String], default: ['floor'] },
    notes: String,
  },
  { timestamps: true }
);

const shiftSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: Date, required: true },
    start: String,
    end: String,
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    role: String,
    status: { type: String, enum: ['scheduled', 'swapped', 'confirmed', 'absent'], default: 'scheduled' },
    notes: String,
  },
  { timestamps: true }
);

const trainingRecordSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    title: String,
    provider: String,
    completedAt: Date,
    expiresAt: Date,
    credentialId: String,
    documentUrl: String,
  },
  { timestamps: true }
);

export const Staff = mongoose.model('Staff', staffSchema);
export const Shift = mongoose.model('Shift', shiftSchema);
export const TrainingRecord = mongoose.model('TrainingRecord', trainingRecordSchema);
