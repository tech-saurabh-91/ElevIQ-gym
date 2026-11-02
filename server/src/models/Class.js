import mongoose from 'mongoose';

const classTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    category: { type: String, enum: ['group-fitness', 'strength', 'cardio', 'mind-body', 'sports', 'personal-training'], default: 'group-fitness' },
    description: String,
    intensity: { type: Number, min: 1, max: 5, default: 3 },
    durationMin: { type: Number, default: 45 },
    defaultCapacity: { type: Number, default: 20 },
    color: { type: String, default: '#a78bfa' },
    icon: String,
    image: String,
    calories: { type: Number, default: 300 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const classSessionSchema = new mongoose.Schema(
  {
    classType: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassType', required: true },
    title: { type: String, required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    room: String,
    date: { type: Date, required: true, index: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    capacity: { type: Number, default: 20 },
    booked: { type: Number, default: 0 },
    waitlist: { type: Number, default: 0 },
    status: { type: String, enum: ['scheduled', 'full', 'cancelled', 'completed'], default: 'scheduled', index: true },
    isRecurring: { type: Boolean, default: false },
    recurrence: { type: String, default: '' },
    notes: String,
    rating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const bookingSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    status: {
      type: String,
      enum: ['booked', 'waitlist', 'checked-in', 'cancelled', 'no-show'],
      default: 'booked',
      index: true,
    },
    bookedAt: { type: Date, default: Date.now },
    checkedInAt: Date,
    cancelledAt: Date,
    source: { type: String, enum: ['web', 'mobile', 'front-desk'], default: 'web' },
    notes: String,
  },
  { timestamps: true }
);
bookingSchema.index({ session: 1, member: 1 }, { unique: true });

const personalSessionSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    date: { type: Date, required: true },
    start: String,
    durationMin: { type: Number, default: 60 },
    focus: String,
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'no-show'], default: 'scheduled' },
    price: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

export const ClassType = mongoose.model('ClassType', classTypeSchema);
export const ClassSession = mongoose.model('ClassSession', classSessionSchema);
export const Booking = mongoose.model('Booking', bookingSchema);
export const PersonalSession = mongoose.model('PersonalSession', personalSessionSchema);
