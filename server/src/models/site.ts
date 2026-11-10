import mongoose, { Schema } from 'mongoose';
import { tenantPlugin } from '../lib/tenantPlugin.js';

/**
 * Website content is versioned. Exactly one `draft` per gym is edited by admins;
 * publishing snapshots it into a new `published` revision (the previous one becomes `archived`),
 * so rollback is just re-publishing an archived revision.
 */
const revisionSchema = new Schema(
  {
    version: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], required: true, index: true },
    content: { type: Schema.Types.Mixed, required: true },
    note: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
  },
  { timestamps: true, minimize: false }
);
revisionSchema.plugin(tenantPlugin);
revisionSchema.index(
  { tenantId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['draft', 'published'] } } }
);
revisionSchema.index({ tenantId: 1, version: -1 });

export const SiteRevision = mongoose.model('SiteRevision', revisionSchema);
