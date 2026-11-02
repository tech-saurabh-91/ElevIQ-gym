import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'trainer', 'member'], default: 'member', index: true },
    status: { type: String, enum: ['active', 'suspended', 'invited'], default: 'active' },
    locale: { type: String, default: 'en' },
    country: { type: String, default: 'US' },
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    preferences: { type: Object, default: {} },
    lastLoginAt: { type: Date },
    resetToken: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetToken;
  return obj;
};

export default mongoose.model('User', userSchema);
