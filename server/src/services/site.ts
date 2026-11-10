import type { Types } from 'mongoose';
import { cache, cacheKeys } from '../lib/cache.js';
import { quote } from '../lib/pricing.js';
import { defaultSiteContent, siteContentSchema, withTheme, type SiteContent } from '../lib/siteContent.js';
import { isOfferLive } from '../lib/pricing.js';
import { Offer, Plan } from '../models/catalog.js';
import { SiteRevision } from '../models/site.js';
import { Tenant } from '../models/platform.js';
import { runAsPlatform } from '../lib/tenantContext.js';

export async function getDraft(tenantName: string, userId?: string) {
  let draft = await SiteRevision.findOne({ status: 'draft' });
  if (!draft) {
    const published = await SiteRevision.findOne({ status: 'published' }).lean();
    const content = published?.content ?? defaultSiteContent(tenantName);
    const last = await SiteRevision.findOne().sort('-version').lean();
    draft = await SiteRevision.create({ status: 'draft', version: (last?.version ?? 0) + 1, content, updatedBy: userId });
  }
  return draft;
}

export async function getPublishedContent(): Promise<SiteContent | null> {
  const pub = await SiteRevision.findOne({ status: 'published' }).lean();
  return pub ? (siteContentSchema.safeParse(pub.content).data ?? (pub.content as SiteContent)) : null;
}

/** Publish the given content as a new revision; the previous published one is archived. */
export async function publishContent(content: SiteContent, userId: string | undefined, note: string) {
  const last = await SiteRevision.findOne().sort('-version').lean();
  const version = (last?.version ?? 0) + 1;
  await SiteRevision.updateMany({ status: 'published' }, { $set: { status: 'archived' } });
  const rev = await SiteRevision.create({
    status: 'published', version, content, note, publishedBy: userId, publishedAt: new Date(), updatedBy: userId,
  });
  return rev;
}

export async function invalidateSite(tenantId: string | Types.ObjectId) {
  await cache().del(cacheKeys.site(String(tenantId)));
}

/**
 * Everything the public site needs in one payload. Plans/prices/hours come from the same
 * records billing uses, and every price is computed by the same `quote()` function.
 */
export async function buildPublicPayload(tenantId: string, content: SiteContent | null) {
  const tenant = await runAsPlatform(() => Tenant.findById(tenantId).lean());
  if (!tenant) return null;
  const s = tenant.settings as any;
  const now = new Date();
  const [plans, offers] = await Promise.all([
    Plan.find({ active: true, isPublic: true }).sort('sortOrder name').lean(),
    Offer.find({ active: true, endsAt: { $gte: now } }).sort('-priority').lean(),
  ]);
  const live = offers.filter((o) => isOfferLive(o as any, now));
  const tax = { label: s.tax?.label, rate: s.tax?.rate ?? 0, inclusive: Boolean(s.tax?.inclusive) };
  const categories: string[] = s.categories?.length ? s.categories : ['standard'];

  const planPayload = plans.map((p) => {
    const quotes: Record<string, ReturnType<typeof quote>> = {};
    for (const c of categories) {
      if (!p.prices.some((x: any) => x.category === c)) continue;
      quotes[c] = quote({ plan: p as any, category: c, offers: live as any, tax, currency: s.currency });
    }
    return {
      _id: String(p._id), name: p.name, description: p.description, features: p.features, durationDays: p.durationDays,
      billingLabel: p.billingLabel, joiningFee: p.joiningFee, highlight: p.highlight, quotes,
    };
  });

  const site = content ?? defaultSiteContent(tenant.name);
  return {
    tenant: { name: tenant.name, slug: tenant.slug, setupCompleted: tenant.setupCompleted, status: tenant.status },
    settings: {
      currency: s.currency, locale: s.locale, timezone: s.timezone, hours: s.hours, categories,
      tax: { label: s.tax?.label, rate: s.tax?.rate, inclusive: s.tax?.inclusive },
    },
    site: withTheme(site),
    plans: planPayload,
    offers: live.map((o) => ({
      _id: String(o._id), title: o.title, description: o.description, discountType: o.discountType, value: o.value,
      code: o.code, autoApply: o.autoApply, endsAt: o.endsAt, display: o.display, badgeText: o.badgeText, imageUrl: o.imageUrl,
      planIds: (o.planIds ?? []).map(String), categories: o.categories,
    })),
    published: Boolean(content),
    generatedAt: now.toISOString(),
  };
}
