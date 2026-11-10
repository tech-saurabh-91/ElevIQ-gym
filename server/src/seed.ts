/**
 * Demo data + platform admin.
 *
 *   npm run seed                 -> (re)creates the "demo" gym only; other gyms are never touched
 *   npm run seed -- --legacy     -> ALSO deletes v1 documents that have no tenantId and drops their old
 *                                   global unique indexes (needed once when upgrading a v1 database)
 *
 * Passwords come from SEED_PASSWORD (default shown at the end of the run).
 */
import mongoose, { Types } from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './lib/db.js';
import { runAsPlatform, runInTenant } from './lib/tenantContext.js';
import { publishContent } from './services/site.js';
import { siteContentSchema } from './lib/siteContent.js';
import { PlatformUser, Tenant } from './models/platform.js';
import { User } from './models/user.js';
import { SiteRevision } from './models/site.js';
import { Offer, Plan } from './models/catalog.js';
import { Lead, Member, Membership } from './models/crm.js';
import { AuditLog, Counter, Expense, Invoice, Payment } from './models/billing.js';
import { Booking, CheckIn, ClassSession, ClassType, Equipment, Maintenance, Product, Shift } from './models/modules.js';
import { quote } from './lib/pricing.js';
import { addDays, randomToken } from './lib/util.js';

const TENANT_MODELS = [User, SiteRevision, Plan, Offer, Lead, Member, Membership, Invoice, Payment, Expense, Counter, AuditLog, ClassType, ClassSession, Booking, Equipment, Maintenance, CheckIn, Product, Shift];
const ALL_MODELS = [Tenant, PlatformUser, ...TENANT_MODELS];

let s = 7;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
const img = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&fit=crop&auto=format`;

const FIRST_M = ['Aarav', 'Rahul', 'Kabir', 'Arjun', 'Vikram', 'Rohan', 'Liam', 'Noah', 'Omar', 'Diego', 'Kenji', 'Felix'];
const FIRST_F = ['Priya', 'Ananya', 'Meera', 'Sana', 'Aisha', 'Emma', 'Sofia', 'Maya', 'Nadia', 'Elena', 'Yuki', 'Ines'];
const LAST = ['Sharma', 'Patel', 'Verma', 'Nair', 'Iyer', 'Mehta', 'Reddy', 'Khan', 'Singh', 'Kapoor', 'Garcia', 'Silva', 'Tanaka', 'Haddad'];

async function legacyCleanup() {
  const db = mongoose.connection.db!;
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  for (const m of TENANT_MODELS) {
    const coll = m.collection.collectionName;
    if (!names.includes(coll)) continue;
    const r = await db.collection(coll).deleteMany({ tenantId: { $exists: false } });
    if (r.deletedCount) console.log(`  legacy: removed ${r.deletedCount} untenanted docs from ${coll}`);
  }
  // v1-only collections
  for (const c of ['locations', 'staffs', 'trainingrecords', 'personalsessions', 'sales', 'lockers', 'announcements', 'contactmessages', 'galleryitems', 'reviews', 'notifications', 'campaigns']) {
    if (names.includes(c)) { await db.collection(c).drop(); console.log(`  legacy: dropped ${c}`); }
  }
}

async function main() {
  await connectDB(env().MONGO_URI);
  const legacy = process.argv.includes('--legacy');
  const password = process.env.SEED_PASSWORD || 'Demo@12345';

  await runAsPlatform(async () => {
    if (legacy) await legacyCleanup();
    // Creates new indexes and removes ones no longer in the schemas (e.g. v1 global unique emails).
    for (const m of ALL_MODELS) await m.syncIndexes();

    const vendorEmail = (process.env.PLATFORM_ADMIN_EMAIL || 'vendor@example.com').toLowerCase();
    if (!(await PlatformUser.exists({ email: vendorEmail }))) {
      await PlatformUser.create({ name: 'Platform Admin', email: vendorEmail, password: await (await import('bcryptjs')).default.hash(process.env.PLATFORM_ADMIN_PASSWORD || password, 11) });
      console.log(`  platform admin created: ${vendorEmail}`);
    }

    const old = await Tenant.findOne({ slug: 'demo' });
    if (old) {
      for (const m of TENANT_MODELS) await (m as any).deleteMany({ tenantId: old._id });
      await old.deleteOne();
    }
  });

  const tenant = await runAsPlatform(() =>
    Tenant.create({
      slug: 'demo',
      name: 'Pulse Fitness Club',
      status: 'active',
      setupCompleted: true,
      domains: ['localhost', '127.0.0.1'],
      contactEmail: 'hello@pulse.example',
      settings: {
        legalName: 'Pulse Fitness Club Pvt Ltd',
        currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata',
        tax: { label: 'GST', rate: 18, inclusive: false, registrationNo: '29ABCDE1234F1Z5' },
        invoicePrefix: 'PFC', memberIdPrefix: 'PF',
      },
    })
  );
  const tid = tenant._id as Types.ObjectId;

  await runInTenant(tid, async () => {
    const staff = await User.create([
      { name: 'Olivia Owner', email: 'owner@demo.gym', password, role: 'owner' },
      { name: 'Manish Manager', email: 'manager@demo.gym', password, role: 'manager' },
      { name: 'Farah Frontdesk', email: 'frontdesk@demo.gym', password, role: 'frontdesk' },
      { name: 'Arun Accountant', email: 'accounts@demo.gym', password, role: 'accountant' },
      { name: 'Esha Editor', email: 'editor@demo.gym', password, role: 'editor' },
      { name: 'Tara Trainer', email: 'trainer@demo.gym', password, role: 'trainer' },
    ]);
    const owner = staff[0];

    const plans = await Plan.create([
      { name: 'Monthly', description: 'Full gym floor access, any time we are open.', durationDays: 30, billingLabel: 'month', sortOrder: 1, joiningFee: 500,
        features: ['Unlimited gym floor', 'Locker room & showers', 'Fitness assessment'],
        prices: [{ category: 'standard', amount: 2499 }, { category: 'student', amount: 1799 }, { category: 'couple', amount: 4499 }, { category: 'senior', amount: 1899 }] },
      { name: 'Quarterly', description: 'Three months with group classes included.', durationDays: 90, billingLabel: '3 months', sortOrder: 2, highlight: true, joiningFee: 0,
        features: ['Everything in Monthly', 'Unlimited group classes', '1 personal training session'],
        prices: [{ category: 'standard', amount: 6499 }, { category: 'student', amount: 4999 }, { category: 'couple', amount: 11999 }, { category: 'senior', amount: 5299 }] },
      { name: 'Annual', description: 'Best value for committed members.', durationDays: 365, billingLabel: 'year', sortOrder: 3, joiningFee: 0,
        features: ['Everything in Quarterly', '6 personal training sessions', 'Guest passes every month', 'Freeze up to 30 days'],
        prices: [{ category: 'standard', amount: 21999 }, { category: 'student', amount: 16999 }, { category: 'couple', amount: 39999 }, { category: 'senior', amount: 17999 }] },
    ]);

    const offers = await Offer.create([
      { title: 'New Year Kickstart - 20% off Quarterly', description: 'Start strong: 20% off the Quarterly plan for new and returning members.', discountType: 'percent', value: 20,
        planIds: [plans[1]._id], startsAt: addDays(new Date(), -5), endsAt: addDays(new Date(), 25), autoApply: true, badgeText: '20% OFF',
        display: { bar: true, popup: true, banner: true, badge: true }, priority: 10, imageUrl: img('1534438327276-14e5300c3a48', 1200) },
      { title: 'Students: extra 500 off', description: 'Show a valid student ID.', discountType: 'flat', value: 500, categories: ['student'],
        startsAt: addDays(new Date(), -30), endsAt: addDays(new Date(), 60), autoApply: true, badgeText: 'Student deal', display: { badge: true } },
      { title: 'FRIEND10 referral code', description: '10% off any plan with a friend\'s referral code.', discountType: 'percent', value: 10, code: 'FRIEND10', autoApply: false,
        startsAt: addDays(new Date(), -30), endsAt: addDays(new Date(), 120), display: { badge: false } },
    ]);

    const content = siteContentSchema.parse({
      brand: { name: 'Pulse Fitness Club', tagline: 'Train smarter. Live stronger.', seed: { primary: '#e11d48', secondary: '#0f766e', accent: '#f59e0b' }, mode: 'auto', font: 'bold' },
      banners: [
        { id: 'b1', title: 'Your strongest year starts here', subtitle: 'Modern equipment, certified coaches and 40+ weekly classes in the heart of the city.', imageUrl: img('1534438327276-14e5300c3a48'), ctaLabel: 'Join now', ctaHref: '/join' },
        { id: 'b2', title: 'Group classes that feel like a party', subtitle: 'HIIT, spin, yoga and strength - included with Quarterly and Annual plans.', imageUrl: img('1518611012118-696072aa579a'), ctaLabel: 'See plans', ctaHref: '/#plans' },
      ],
      about: {
        title: 'More than a gym',
        body: 'Pulse Fitness Club opened in 2016 with one goal: make great coaching available to everyone. Today we are a 12,000 sq ft training space with a team of certified trainers, a recovery zone and a community of over a thousand members who push each other every day.',
        imageUrl: img('1571902943202-507ec2618e8f', 1200),
        highlights: [{ id: 'h1', label: 'Members', value: '1,200+' }, { id: 'h2', label: 'Weekly classes', value: '40+' }, { id: 'h3', label: 'Certified coaches', value: '15' }, { id: 'h4', label: 'Years', value: '9' }],
      },
      testimonials: [
        { id: 't1', name: 'Ananya R.', role: 'Member since 2021', quote: 'The coaches actually know your name and your goals. I have never stuck with a gym this long.', rating: 5 },
        { id: 't2', name: 'Rohit S.', role: 'Annual member', quote: 'Clean, never too crowded, and the 6am HIIT class is the best start to my day.', rating: 5 },
        { id: 't3', name: 'Meera K.', role: 'Student plan', quote: 'Student pricing made it possible for me to train properly. Great value.', rating: 4 },
      ],
      faq: [
        { id: 'f1', q: 'Can I try before I join?', a: 'Yes - book a free trial session from the Join page and our team will call you to schedule it.' },
        { id: 'f2', q: 'Which ID do I need for the student price?', a: 'Any valid college or university ID card.' },
        { id: 'f3', q: 'Can I freeze my membership?', a: 'Annual members can freeze for up to 30 days per year.' },
      ],
      gallery: [
        '1550345332-09e3ac987658', '1558611848-73f7eb4001a1', '1517836357463-d25dfeac3438', '1526506118085-60ce8714f8c5',
        '1594381898411-846e7d193883', '1540497077202-7c8a3999166f', '1571019613454-1cb2f99b2d8b', '1534258936925-c58bed479fcb',
      ].map((id, i) => ({ id: `g${i}`, url: img(id, 900), caption: '', category: pick(['floor', 'classes', 'studio']) })),
      contact: { phone: '+91 98765 43210', whatsapp: '+91 98765 43210', email: 'hello@pulse.example', address: '12 MG Road, Bengaluru, Karnataka 560001', mapQuery: 'MG Road, Bengaluru' },
      social: { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', youtube: 'https://youtube.com/' },
      seo: { title: 'Pulse Fitness Club - Gym in Bengaluru', description: 'Modern gym with certified coaches, group classes and flexible plans for students, couples and seniors.' },
    });
    await publishContent(content, String(owner._id), 'Initial site');
    await SiteRevision.create({ status: 'draft', version: 2, content });

    // Members with real billing history (all priced by the same quote() as the website).
    const tax = { label: 'GST', rate: 18, inclusive: false };
    let inv = 0, rcp = 0, mem = 0;
    for (let i = 0; i < 60; i += 1) {
      const female = rnd() < 0.45;
      const category = pick(['standard', 'standard', 'standard', 'student', 'couple', 'senior']);
      const plan = pick(plans);
      const joined = addDays(new Date(), -int(5, 400));
      mem += 1;
      const first = pick(female ? FIRST_F : FIRST_M);
      const last = pick(LAST);
      const member = await Member.create({
        memberNo: `PF${String(mem).padStart(5, '0')}`, firstName: first, lastName: last, gender: female ? 'female' : 'male',
        dob: addDays(new Date(), -int(category === 'senior' ? 60 * 365 : category === 'student' ? 18 * 365 : 22 * 365, category === 'senior' ? 75 * 365 : category === 'student' ? 24 * 365 : 55 * 365)),
        phone: `+91 9${int(100000000, 999999999)}`, email: `${first}.${last}${i}@example.com`.toLowerCase(), category,
        qrToken: randomToken(9), joinedAt: joined, totalVisits: int(0, 120), status: 'inactive',
      });
      const startsAt = addDays(new Date(), -int(0, plan.durationDays + 20));
      const endsAt = addDays(startsAt, plan.durationDays);
      const q = quote({ plan: plan as any, category, offers: [], tax, currency: 'INR', includeJoiningFee: true });
      inv += 1;
      const paidAll = rnd() < 0.85;
      const invoice = await Invoice.create({
        number: `PFC-${new Date().getFullYear()}-${String(inv).padStart(5, '0')}`, member: member._id, kind: 'membership',
        billTo: { name: `${first} ${last}`, email: member.email, phone: member.phone },
        lines: [{ description: `${plan.name} (${category})`, qty: 1, unitPrice: q.base, amount: q.base }, ...(q.joiningFee ? [{ description: 'Joining fee', qty: 1, unitPrice: q.joiningFee, amount: q.joiningFee }] : [])],
        subtotal: q.subtotal, discount: 0, taxLabel: 'GST', taxRate: 18, tax: q.tax, total: q.total, currency: 'INR',
        paid: paidAll ? q.total : 0, status: paidAll ? 'paid' : 'unpaid', issuedAt: startsAt, createdBy: owner._id,
      });
      await Membership.create({ member: member._id, plan: plan._id, planName: plan.name, category, startsAt, endsAt, invoice: invoice._id });
      if (paidAll) {
        rcp += 1;
        await Payment.create({ receiptNo: `RCP-${String(rcp).padStart(6, '0')}`, invoice: invoice._id, member: member._id, amount: q.total, currency: 'INR', method: pick(['upi', 'upi', 'card', 'cash']), paidAt: startsAt, recordedBy: staff[2]._id });
      }
      member.currentPlan = plan._id;
      member.currentPlanName = plan.name;
      member.startsAt = startsAt;
      member.expiresAt = endsAt;
      member.status = endsAt > new Date() ? 'active' : 'expired';
      await member.save();
    }
    await Counter.create([{ key: 'member', seq: mem }, { key: `invoice-${new Date().getFullYear()}`, seq: inv }, { key: 'receipt', seq: rcp }]);

    await Lead.create([
      { name: 'Kiran Joshi', phone: '+91 90000 11111', source: 'join', planInterest: plans[1]._id, category: 'standard', message: 'Interested in the offer', offerId: offers[0]._id },
      { name: 'Sara Thomas', email: 'sara@example.com', source: 'enquiry', message: 'Do you have ladies-only batches?' },
      { name: 'Dev Malhotra', phone: '+91 90000 22222', source: 'walk-in', status: 'contacted', notes: 'Coming for trial on Saturday' },
    ]);

    const types = await ClassType.create([
      { name: 'HIIT Blast', category: 'cardio', durationMin: 45, color: '#e11d48' },
      { name: 'Power Yoga', category: 'mind-body', durationMin: 60, color: '#0f766e' },
      { name: 'Spin', category: 'cardio', durationMin: 45, color: '#f59e0b' },
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let d = 0; d < 10; d += 1) {
      for (const [t, start, end] of [[types[0], '06:00', '06:45'], [types[1], '08:00', '09:00'], [types[2], '19:00', '19:45']] as const) {
        await ClassSession.create({ classType: t._id, title: t.name, trainer: staff[5]._id, room: 'Studio A', date: addDays(today, d), start, end, capacity: 20 });
      }
    }
    await Equipment.create([
      { assetTag: 'TRD-01', name: 'Treadmill Pro 9', category: 'cardio', brand: 'Technogym', zone: 'Cardio deck' },
      { assetTag: 'RCK-01', name: 'Power rack', category: 'strength', brand: 'Rogue', zone: 'Strength' },
      { assetTag: 'BIK-03', name: 'Spin bike', category: 'cardio', status: 'maintenance', zone: 'Studio A' },
    ]);
    await Product.create([
      { sku: 'WHEY-1KG', name: 'Whey protein 1kg', price: 2999, cost: 2100, stock: 24 },
      { sku: 'SHAKER', name: 'Shaker bottle', price: 399, cost: 150, stock: 3 },
      { sku: 'TOWEL', name: 'Gym towel', price: 299, cost: 120, stock: 40 },
    ]);
    await Expense.create([
      { title: 'Rent', category: 'rent', amount: 180000, paidAt: addDays(new Date(), -3) },
      { title: 'Electricity', category: 'utilities', amount: 32000, paidAt: addDays(new Date(), -6) },
    ]);
  });

  console.log('\nDemo gym "Pulse Fitness Club" ready (slug: demo, domains: localhost).');
  console.log(`Sign in at /login with any of: owner@ manager@ frontdesk@ accounts@ editor@ trainer@ demo.gym  /  password: ${password}`);
  console.log(`Vendor console at /platform with ${process.env.PLATFORM_ADMIN_EMAIL || 'vendor@example.com'}`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
