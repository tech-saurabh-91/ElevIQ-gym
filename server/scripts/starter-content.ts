/**
 * Give an empty gym a presentable starting website and sample plans, then publish it.
 *
 *   npx tsx scripts/starter-content.ts --slug eleviq
 *
 * Deliberately leaves out anything that must be true for the real gym: testimonials,
 * phone/address/email, member counts and offers. Sample plan prices must be edited.
 * Existing plans are kept; the website draft is replaced and published as a new version
 * (older versions stay available for rollback).
 */
import mongoose, { Types } from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/lib/db.js';
import { runAsPlatform, runInTenant } from '../src/lib/tenantContext.js';
import { siteContentSchema } from '../src/lib/siteContent.js';
import { publishContent } from '../src/services/site.js';
import { Tenant } from '../src/models/platform.js';
import { Plan } from '../src/models/catalog.js';
import { SiteRevision } from '../src/models/site.js';

const img = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&fit=crop&auto=format`;
const i = process.argv.indexOf('--slug');
const slug = i > -1 ? process.argv[i + 1] : '';

async function main() {
  if (!slug) throw new Error('Pass --slug <gym-slug>');
  await connectDB(env().MONGO_URI);
  const tenant = await runAsPlatform(() => Tenant.findOne({ slug }).lean());
  if (!tenant) throw new Error(`No gym with slug "${slug}"`);
  const name = tenant.name;

  await runInTenant(tenant._id as Types.ObjectId, async () => {
    const content = siteContentSchema.parse({
      brand: { name, tagline: 'Train smarter. Live stronger.', seed: { primary: '#e11d48', secondary: '#0f766e', accent: '#f59e0b' }, mode: 'auto', font: 'bold' },
      banners: [
        { id: 'b1', title: 'Your strongest year starts here', subtitle: `Modern equipment, expert coaching and a community that keeps you going - at ${name}.`, imageUrl: img('1534438327276-14e5300c3a48'), ctaLabel: 'Join now', ctaHref: '/join' },
        { id: 'b2', title: 'Group classes that feel like a party', subtitle: 'HIIT, spin, yoga and strength sessions for every level.', imageUrl: img('1518611012118-696072aa579a'), ctaLabel: 'See plans', ctaHref: '/#plans' },
      ],
      about: {
        title: `More than a gym`,
        body: `${name} is built for people who want real progress. Train on modern equipment, get guidance from certified coaches, and join classes that make every workout something to look forward to.\n\nWhether you are just starting out or chasing a new personal best, our team will help you build a plan that fits your goals and your schedule.`,
        imageUrl: img('1571902943202-507ec2618e8f', 1200),
        highlights: [],
      },
      testimonials: [],
      faq: [
        { id: 'f1', q: 'How do I join?', a: 'Choose a plan on the Join page and leave your details. Our team will call you to confirm your plan and book your first visit.' },
        { id: 'f2', q: 'Do I pay online?', a: 'No. You pay at the front desk when you start, and the price matches what you see on this website.' },
        { id: 'f3', q: 'Are there student, couple and senior prices?', a: 'Yes - use the category buttons above the plans to see the price for each category.' },
      ],
      gallery: ['1550345332-09e3ac987658', '1558611848-73f7eb4001a1', '1517836357463-d25dfeac3438', '1526506118085-60ce8714f8c5', '1594381898411-846e7d193883', '1540497077202-7c8a3999166f', '1571019613454-1cb2f99b2d8b', '1534258936925-c58bed479fcb'].map((p, k) => ({
        id: `g${k}`, url: img(p, 900), caption: '', category: '',
      })),
      contact: { phone: '', whatsapp: '', email: '', address: '', mapQuery: '' },
      social: {},
      sections: { offers: true, plans: true, about: true, gallery: true, testimonials: true, faq: true, hours: true, contact: false },
      seo: { title: `${name} - Gym & fitness classes`, description: `Join ${name}: modern equipment, expert coaches and group classes, with plans for students, couples and seniors.` },
    });

    if (!(await Plan.exists({}))) {
      await Plan.create([
        { name: 'Monthly', description: 'Full gym floor access, any time we are open.', durationDays: 30, billingLabel: 'month', sortOrder: 1,
          features: ['Unlimited gym floor', 'Locker room & showers', 'Fitness assessment'],
          prices: [{ category: 'standard', amount: 2499 }, { category: 'student', amount: 1799 }, { category: 'couple', amount: 4499 }, { category: 'senior', amount: 1899 }] },
        { name: 'Quarterly', description: 'Three months with group classes included.', durationDays: 90, billingLabel: '3 months', sortOrder: 2, highlight: true,
          features: ['Everything in Monthly', 'Unlimited group classes', '1 personal training session'],
          prices: [{ category: 'standard', amount: 6499 }, { category: 'student', amount: 4999 }, { category: 'couple', amount: 11999 }, { category: 'senior', amount: 5299 }] },
        { name: 'Annual', description: 'Best value for committed members.', durationDays: 365, billingLabel: 'year', sortOrder: 3,
          features: ['Everything in Quarterly', '6 personal training sessions', 'Membership freeze up to 30 days'],
          prices: [{ category: 'standard', amount: 21999 }, { category: 'student', amount: 16999 }, { category: 'couple', amount: 39999 }, { category: 'senior', amount: 17999 }] },
      ]);
      console.log('  3 sample plans created (edit the prices in Admin -> Plans & pricing)');
    } else console.log('  plans already exist - left unchanged');

    const rev = await publishContent(content, undefined, 'Starter content');
    await SiteRevision.updateOne({ status: 'draft' }, { $set: { content } }, { upsert: true, setDefaultsOnInsert: true }).catch(async () => {
      await SiteRevision.create({ status: 'draft', version: rev.version + 1, content });
    });
    console.log(`  website published as version ${rev.version}`);
  });
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await mongoose.disconnect();
  process.exit(1);
});
