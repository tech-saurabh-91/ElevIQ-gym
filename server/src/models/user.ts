import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { tenantPlugin } from '../lib/tenantPlugin.js';
import { ROLES } from '../auth/permissions.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, default: '' },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    member: { type: Schema.Types.ObjectId, ref: 'Member' },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true }
);
userSchema.plugin(tenantPlugin);
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 11);
});

export const User = mongoose.model('User', userSchema);

export const safeUser = (u: any) => {
  const o = typeof u.toObject === 'function' ? u.toObject() : { ...u };
  delete o.password;
  delete o.tokenVersion;
  return o;
};
