import mongoose from 'mongoose';

const checkInSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    method: { type: String, enum: ['qr', 'rfid', 'manual', 'mobile'], default: 'qr' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    inAt: { type: Date, default: Date.now, index: true },
    outAt: Date,
    durationMin: Number,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    device: String,
  },
  { timestamps: true }
);

const lockerSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    zone: String,
    size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    status: { type: String, enum: ['available', 'occupied', 'maintenance'], default: 'available', index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    assignedAt: Date,
    expiresAt: Date,
    fee: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: { type: String, enum: ['all', 'members', 'staff', 'admins'], default: 'all' },
    channel: { type: String, enum: ['in-app', 'email', 'sms', 'push'], default: 'in-app' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    publishedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    pinned: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    image: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: String,
    subject: { type: String, default: 'General enquiry' },
    message: { type: String, required: true },
    topic: { type: String, enum: ['membership', 'personal-training', 'corporate', 'feedback', 'support', 'other'], default: 'membership' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    status: { type: String, enum: ['new', 'in-progress', 'replied', 'closed'], default: 'new', index: true },
    source: { type: String, default: 'website' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reply: String,
    repliedAt: Date,
  },
  { timestamps: true }
);

const galleryItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, enum: ['facility', 'classes', 'trainers', 'events', 'members', 'equipment'], default: 'facility' },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    url: { type: String, required: true },
    thumbnail: String,
    description: String,
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    tags: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const reviewSchema = new mongoose.Schema(
  {
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    name: { type: String, required: true },
    role: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    title: String,
    comment: { type: String, required: true },
    category: { type: String, default: 'general' },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['pending', 'approved', 'hidden'], default: 'approved' },
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    body: String,
    type: { type: String, enum: ['booking', 'payment', 'class', 'announcement', 'system'], default: 'system' },
    read: { type: Boolean, default: false, index: true },
    link: String,
  },
  { timestamps: true }
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    channel: { type: String, enum: ['email', 'sms', 'push', 'social'], default: 'email' },
    subject: String,
    body: String,
    audience: { type: String, enum: ['all', 'lapsed', 'new', 'vip', 'prospects'], default: 'all' },
    status: { type: String, enum: ['draft', 'scheduled', 'sending', 'sent', 'paused'], default: 'draft' },
    scheduledFor: Date,
    sentAt: Date,
    stats: { type: Object, default: { sent: 0, opened: 0, clicked: 0, converted: 0 } },
    budget: Number,
    spend: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const CheckIn = mongoose.model('CheckIn', checkInSchema);
export const Locker = mongoose.model('Locker', lockerSchema);
export const Announcement = mongoose.model('Announcement', announcementSchema);
export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
export const GalleryItem = mongoose.model('GalleryItem', galleryItemSchema);
export const Review = mongoose.model('Review', reviewSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Campaign = mongoose.model('Campaign', campaignSchema);
