import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { audit } from '../lib/util.js';
import { siteContentSchema, withTheme } from '../lib/siteContent.js';
import { buildTheme, HEX_RX } from '../lib/theme.js';
import { cloudinarySignature } from '../lib/integrations.js';
import { requirePermission } from '../middleware/auth.js';
import { SiteRevision } from '../models/site.js';
import { getDraft, invalidateSite, publishContent } from '../services/site.js';

/** Website control: draft -> preview -> publish, with full revision history and rollback. */
const r = Router();
const canEdit = requirePermission('website.manage');

r.get(
  '/draft',
  canEdit,
  asyncHandler(async (req, res) => {
    const draft = await getDraft(req.tenant!.name, req.user!._id);
    const published = await SiteRevision.findOne({ status: 'published' }).select('version publishedAt content').lean();
    const content = siteContentSchema.parse(draft.content);
    const liveContent = published ? siteContentSchema.safeParse(published.content).data : null;
    res.json({
      success: true,
      data: {
        content: withTheme(content),
        updatedAt: draft.updatedAt,
        published: published ? { version: published.version, publishedAt: published.publishedAt } : null,
        hasUnpublishedChanges: !liveContent || JSON.stringify(liveContent) !== JSON.stringify(content),
      },
    });
  })
);

r.put(
  '/draft',
  canEdit,
  asyncHandler(async (req, res) => {
    const { content } = parse(z.object({ content: z.unknown() }), req.body);
    const clean = parse(siteContentSchema, content);
    const draft = await getDraft(req.tenant!.name, req.user!._id);
    draft.content = clean;
    draft.updatedBy = req.user!._id as any;
    draft.markModified('content');
    await draft.save();
    res.json({ success: true, data: { content: withTheme(clean), updatedAt: draft.updatedAt } });
  })
);

/** Throw away draft edits: reset the draft to the live version. */
r.post(
  '/draft/reset',
  canEdit,
  asyncHandler(async (req, res) => {
    const pub = await SiteRevision.findOne({ status: 'published' }).lean();
    if (!pub) throw new ApiError(400, 'Nothing has been published yet');
    await SiteRevision.updateOne({ status: 'draft' }, { $set: { content: pub.content, updatedBy: req.user!._id } });
    res.json({ success: true });
  })
);

r.post(
  '/publish',
  canEdit,
  asyncHandler(async (req, res) => {
    const { note } = parse(z.object({ note: z.string().max(200).default('') }), req.body ?? {});
    const draft = await getDraft(req.tenant!.name, req.user!._id);
    const content = parse(siteContentSchema, draft.content);
    const rev = await publishContent(content, req.user!._id, note);
    await invalidateSite(req.tenant!._id);
    await audit(req, 'site.publish', 'SiteRevision', rev._id, `v${rev.version} ${note}`.trim());
    res.json({ success: true, data: { version: rev.version, publishedAt: rev.publishedAt } });
  })
);

r.get(
  '/revisions',
  canEdit,
  asyncHandler(async (_req, res) => {
    const revs = await SiteRevision.find({ status: { $in: ['published', 'archived'] } })
      .sort('-version')
      .limit(50)
      .select('version status note publishedAt publishedBy')
      .populate('publishedBy', 'name')
      .lean();
    res.json({ success: true, data: revs });
  })
);

/** Rollback: re-publish an older revision as a new version (history is never rewritten). */
r.post(
  '/revisions/:id/rollback',
  canEdit,
  asyncHandler(async (req, res) => {
    const old = await SiteRevision.findById(req.params.id).lean();
    if (!old || old.status === 'draft') throw new ApiError(404, 'Revision not found');
    const content = siteContentSchema.parse(old.content);
    const rev = await publishContent(content, req.user!._id, `Rollback to v${old.version}`);
    await SiteRevision.updateOne({ status: 'draft' }, { $set: { content } });
    await invalidateSite(req.tenant!._id);
    await audit(req, 'site.rollback', 'SiteRevision', rev._id, `to v${old.version}`);
    res.json({ success: true, data: { version: rev.version } });
  })
);

/** Live theme preview from seed colours (the client extracts seeds from the uploaded logo). */
r.post(
  '/theme',
  canEdit,
  asyncHandler(async (req, res) => {
    const seed = parse(
      z.object({ primary: z.string().regex(HEX_RX), secondary: z.string().regex(HEX_RX).optional(), accent: z.string().regex(HEX_RX).optional() }),
      req.body
    );
    res.json({ success: true, data: buildTheme(seed) });
  })
);

r.post(
  '/uploads/sign',
  requirePermission('media.upload', 'website.manage', 'members.write'),
  asyncHandler(async (req, res) => {
    const { kind } = parse(z.object({ kind: z.enum(['logo', 'banner', 'gallery', 'about', 'testimonial', 'offer', 'member']) }), req.body);
    const sig = cloudinarySignature(req.tenant!._id, kind);
    if (!sig) throw new ApiError(501, 'Image uploads are not configured. Paste an image URL instead.');
    res.json({ success: true, data: sig });
  })
);

export default r;
