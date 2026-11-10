/**
 * Creates (or recreates) a FICTIONAL demo gym in Nairobi with realistic data, for demos.
 * Only the "nairobi-demo" gym's own records are touched. Every name, address and review is invented.
 *
 *   npx tsx scripts/demo-kenya.ts
 *
 * View it at https://<web-domain>/?gym=nairobi-demo
 * Staff passwords are random and appended to ../backups/credentials-nairobi-demo.txt (git-ignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/lib/db.js';
import { runAsPlatform, runInTenant } from '../src/lib/tenantContext.js';
import { siteContentSchema } from '../src/lib/siteContent.js';
import { publishContent } from '../src/services/site.js';
import { quote } from '../src/lib/pricing.js';
import { addDays, randomToken } from '../src/lib/util.js';
import { Tenant } from '../src/models/platform.js';
import { User } from '../src/models/user.js';
import { SiteRevision } from '../src/models/site.js';
import { Offer, Plan } from '../src/models/catalog.js';
import { Lead, Member, Membership } from '../src/models/crm.js';
import { AuditLog, Counter, Expense, Invoice, Payment } from '../src/models/billing.js';
import { Booking, CheckIn, ClassSession, ClassType, Equipment, Maintenance, Product, Shift } from '../src/models/modules.js';

const SLUG = 'nairobi-demo';
const NAME = 'Nairobi Peak Fitness (Demo)';
const MODELS = [User, SiteRevision, Plan, Offer, Lead, Member, Membership, Invoice, Payment, Expense, Counter, AuditLog, ClassType, ClassSession, Booking, Equipment, Maintenance, CheckIn, Product, Shift];

let s = 254;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => Math.floor(rnd() * (b - a + 1)) + a;
const img = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&fit=crop&auto=format`;
const pw = () => crypto.randomBytes(12).toString('base64url');

const FIRST_M = ['Brian', 'Kevin', 'Dennis', 'Collins', 'Victor', 'Felix', 'Kamau', 'Otieno', 'Kipchoge', 'Mwangi', 'Omondi', 'Juma', 'Baraka', 'Ian'];
const FIRST_F = ['Wanjiru', 'Akinyi', 'Njeri', 'Achieng', 'Faith', 'Mercy', 'Grace', 'Wairimu', 'Chebet', 'Nafula', 'Zawadi', 'Amani', 'Joy', 'Esther'];
const LAST = ['Kamau', 'Otieno', 'Mwangi', 'Wanjiku', 'Ochieng', 'Kiprotich', 'Njoroge', 'Mutua', 'Odhiambo', 'Kariuki', 'Chepkoech', 'Wekesa', 'Muthoni', 'Kimani'];

async function main() {
  await connectDB(env().MONGO_URI);
  const creds: string[] = [];

  await runAsPlatform(async () => {
    const old = await Tenant.findOne({ slug: SLUG });
    if (old) {
      for (const m of MODELS) await (m as any).deleteMany({ tenantId: old._id });
      await old.deleteOne();
      console.log('  removed previous demo gym');
    }
  });

  const tenant = await runAsPlatform(() =>
    Tenant.create({
      slug: SLUG, name: NAME, status: 'active', setupCompleted: true, contactEmail: 'hello@nairobipeak.example',
      notes: 'Fictional demo gym. Safe to delete.',
      settings: {
        legalName: 'Nairobi Peak Fitness Ltd (fictional)', currency: 'KES', locale: 'en-KE', timezone: 'Africa/Nairobi',
        tax: { label: 'VAT', rate: 16, inclusive: true, registrationNo: 'P000000000X' },
        hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: day === 0 ? '08:00' : day === 6 ? '07:00' : '05:00', close: day === 0 ? '14:00' : day === 6 ? '18:00' : '22:00', closed: false })),
        invoicePrefix: 'NPF', memberIdPrefix: 'NP', categories: ['standard', 'student', 'couple', 'corporate'],
      },
    })
  );

  await runInTenant(tenant._id as Types.ObjectId, async () => {
    const staffDefs = [
      ['Amina Owner', 'owner@nairobipeak.example', 'owner'], ['Peter Manager', 'manager@nairobipeak.example', 'manager'],
      ['Lucy Frontdesk', 'frontdesk@nairobipeak.example', 'frontdesk'], ['James Accounts', 'accounts@nairobipeak.example', 'accountant'],
      ['Sharon Editor', 'editor@nairobipeak.example', 'editor'], ['Coach Tony', 'trainer@nairobipeak.example', 'trainer'],
    ] as const;
    const staff = [];
    for (const [name, email, role] of staffDefs) {
      const p = pw();
      staff.push(await User.create({ name, email, password: p, role }));
      creds.push(`${role.padEnd(10)} ${email} / ${p}`);
    }
    const [owner, , desk, , , coach] = staff;

    const plans = await Plan.create([
      { name: 'Day Pass', description: 'One full day of gym floor access.', durationDays: 1, billingLabel: 'day', sortOrder: 0, isPublic: true,
        features: ['Gym floor access', 'Lockers & showers'], prices: [{ category: 'standard', amount: 800 }] },
      { name: 'Monthly', description: 'Unlimited gym floor and group classes.', durationDays: 30, billingLabel: 'month', sortOrder: 1, joiningFee: 1000,
        features: ['Unlimited gym floor', 'All group classes', 'Body composition check'],
        prices: [{ category: 'standard', amount: 5500 }, { category: 'student', amount: 3800 }, { category: 'couple', amount: 9900 }, { category: 'corporate', amount: 4800 }] },
      { name: 'Quarterly', description: 'Three months, best for building a habit.', durationDays: 90, billingLabel: '3 months', sortOrder: 2, highlight: true,
        features: ['Everything in Monthly', '2 personal training sessions', 'Nutrition consultation'],
        prices: [{ category: 'standard', amount: 15000 }, { category: 'student', amount: 10500 }, { category: 'couple', amount: 27000 }, { category: 'corporate', amount: 13200 }] },
      { name: 'Annual', description: 'Twelve months at our lowest monthly price.', durationDays: 365, billingLabel: 'year', sortOrder: 3,
        features: ['Everything in Quarterly', '6 personal training sessions', 'Membership freeze up to 30 days', 'Free guest pass every month'],
        prices: [{ category: 'standard', amount: 52000 }, { category: 'student', amount: 38000 }, { category: 'couple', amount: 95000 }, { category: 'corporate', amount: 46000 }] },
    ]);

    await Offer.create([
      { title: 'January Jumpstart - 20% off Quarterly', description: '20% off the Quarterly plan for new and returning members. Demo offer.', discountType: 'percent', value: 20,
        planIds: [plans[2]._id], startsAt: addDays(new Date(), -3), endsAt: addDays(new Date(), 30), badgeText: '20% OFF',
        display: { bar: true, popup: true, banner: true, badge: true }, priority: 10, imageUrl: img('1534438327276-14e5300c3a48', 1200) },
      { title: 'Students save KSh 500 on Monthly', description: 'Show a valid student ID.', discountType: 'flat', value: 500, planIds: [plans[1]._id], categories: ['student'],
        startsAt: addDays(new Date(), -10), endsAt: addDays(new Date(), 90), badgeText: 'Student deal', display: { badge: true } },
      { title: 'Corporate wellness code', description: '10% off any plan with your company code.', discountType: 'percent', value: 10, code: 'CORP10', autoApply: false,
        startsAt: addDays(new Date(), -30), endsAt: addDays(new Date(), 180), display: { badge: false } },
    ]);

    const content = siteContentSchema.parse({
      brand: { name: NAME, tagline: 'Train high. Live strong.', seed: { primary: '#16a34a', secondary: '#0f172a', accent: '#f59e0b' }, mode: 'auto', font: 'bold' },
      banners: [
        { id: 'b1', title: 'Reach your peak in Nairobi', subtitle: 'Modern equipment, certified coaches and 30+ classes a week. This is a fictional demo gym.', imageUrl: img('1534438327276-14e5300c3a48'), ctaLabel: 'Join now', ctaHref: '/join' },
        { id: 'b2', title: 'Classes for every level', subtitle: 'HIIT, spin, boxing, yoga and strength - included with Monthly and above.', imageUrl: img('1518611012118-696072aa579a'), ctaLabel: 'See plans', ctaHref: '/#plans' },
        { id: 'b3', title: 'Pay with M-Pesa, card or cash', subtitle: 'Simple plans, clear prices, VAT included.', imageUrl: img('1571019613454-1cb2f99b2d8b'), ctaLabel: 'Contact us', ctaHref: '/contact' },
      ],
      about: {
        title: 'Built for Nairobi',
        body: 'Nairobi Peak Fitness is a fictional gym used to demonstrate this platform. It shows how a gym can present its story, coaches, classes and plans - all edited from the admin panel without touching code.\n\nEvery name, number and review on this demo site is invented.',
        imageUrl: img('1571902943202-507ec2618e8f', 1200),
        highlights: [{ id: 'h1', label: 'Weekly classes', value: '30+' }, { id: 'h2', label: 'Coaches', value: '8' }, { id: 'h3', label: 'Open from', value: '5 am' }],
      },
      testimonials: [
        { id: 't1', name: 'Wanjiru K. (demo)', role: 'Member', quote: 'The 6 am HIIT class is the best way to beat Nairobi traffic. (Sample review for this demo.)', rating: 5 },
        { id: 't2', name: 'Brian O. (demo)', role: 'Corporate plan', quote: 'Our whole team joined on the corporate plan. (Sample review for this demo.)', rating: 5 },
        { id: 't3', name: 'Faith M. (demo)', role: 'Student', quote: 'Student pricing made it affordable. (Sample review for this demo.)', rating: 4 },
      ],
      faq: [
        { id: 'f1', q: 'Can I pay with M-Pesa?', a: 'Yes - M-Pesa, card and cash are all accepted at the front desk.' },
        { id: 'f2', q: 'Are prices inclusive of VAT?', a: 'Yes, all prices shown include 16% VAT.' },
        { id: 'f3', q: 'Do you have corporate plans?', a: 'Yes. Choose the Corporate category on the plans section, or ask for a company code.' },
        { id: 'f4', q: 'Is this a real gym?', a: 'No - Nairobi Peak Fitness is a fictional demo of the gym platform.' },
      ],
      gallery: ['1550345332-09e3ac987658', '1558611848-73f7eb4001a1', '1517836357463-d25dfeac3438', '1526506118085-60ce8714f8c5', '1594381898411-846e7d193883', '1540497077202-7c8a3999166f', '1534258936925-c58bed479fcb', '1583454110551-21f2fa2afe61'].map((p, k) => ({ id: `g${k}`, url: img(p, 900), caption: '', category: '' })),
      contact: { phone: '+254 700 000 000', whatsapp: '+254 700 000 000', email: 'hello@nairobipeak.example', address: 'Demo Plaza, Westlands, Nairobi (fictional address)', mapQuery: 'Westlands, Nairobi' },
      social: { instagram: 'https://instagram.com/', facebook: 'https://facebook.com/' },
      seo: { title: 'Nairobi Peak Fitness (Demo) - gym platform demo', description: 'A fictional Nairobi gym showing the white-label gym platform: plans in KSh, offers, classes and online enquiries.' },
    });
    await publishContent(content, String(owner._id), 'Demo content');
    await SiteRevision.create({ status: 'draft', version: 2, content });

    // Members with billing history, priced by the same quote() the website uses.
    const tax = { label: 'VAT', rate: 16, inclusive: true };
    const methods = ['wallet', 'wallet', 'wallet', 'card', 'cash'] as const; // wallet = M-Pesa
    let inv = 0, rcp = 0, mem = 0;
    const members = [];
    for (let i = 0; i < 64; i += 1) {
      const female = rnd() < 0.5;
      const category = pick(['standard', 'standard', 'standard', 'student', 'couple', 'corporate']);
      const plan = pick(plans.slice(1));
      const first = pick(female ? FIRST_F : FIRST_M);
      const last = pick(LAST);
      mem += 1;
      const ageYears = category === 'student' ? int(18, 24) : int(22, 58);
      const member = await Member.create({
        memberNo: `NP${String(mem).padStart(5, '0')}`, firstName: first, lastName: last, gender: female ? 'female' : 'male',
        dob: addDays(new Date(), -(ageYears * 365 + int(0, 300))), phone: `+254 7${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
        email: `${first}.${last}${i}@example.com`.toLowerCase(), category, qrToken: randomToken(9), joinedAt: addDays(new Date(), -int(5, 420)),
        totalVisits: int(0, 140), status: 'inactive', address: pick(['Westlands', 'Kilimani', 'Kileleshwa', 'Lavington', 'Parklands', 'South B', 'Karen']) + ', Nairobi',
      });
      const startsAt = addDays(new Date(), -int(0, plan.durationDays + 25));
      const endsAt = addDays(startsAt, plan.durationDays);
      const q = quote({ plan: plan as any, category, offers: [], tax, currency: 'KES', includeJoiningFee: true });
      inv += 1;
      const r = rnd();
      const paid = r < 0.8 ? q.total : r < 0.9 ? Math.round(q.total / 2) : 0;
      const invoice = await Invoice.create({
        number: `NPF-${new Date().getFullYear()}-${String(inv).padStart(5, '0')}`, member: member._id, kind: 'membership',
        billTo: { name: `${first} ${last}`, email: member.email, phone: member.phone },
        lines: [{ description: `${plan.name} (${category}) - ${plan.durationDays} days`, qty: 1, unitPrice: q.base, amount: q.base }, ...(q.joiningFee ? [{ description: 'Joining fee', qty: 1, unitPrice: q.joiningFee, amount: q.joiningFee }] : [])],
        subtotal: q.subtotal, discount: 0, taxLabel: 'VAT', taxRate: 16, taxInclusive: true, tax: q.tax, total: q.total, currency: 'KES',
        paid, status: paid >= q.total ? 'paid' : paid > 0 ? 'partial' : 'unpaid', issuedAt: startsAt, createdBy: desk._id,
      });
      await Membership.create({ member: member._id, plan: plan._id, planName: plan.name, category, startsAt, endsAt, invoice: invoice._id });
      if (paid > 0) {
        rcp += 1;
        const method = pick([...methods]);
        await Payment.create({
          receiptNo: `RCP-${String(rcp).padStart(6, '0')}`, invoice: invoice._id, member: member._id, amount: paid, currency: 'KES', method,
          reference: method === 'wallet' ? `M-PESA ${randomToken(6).toUpperCase()}` : '', paidAt: startsAt, recordedBy: desk._id,
        });
      }
      Object.assign(member, { currentPlan: plan._id, currentPlanName: plan.name, startsAt, expiresAt: endsAt, status: endsAt > new Date() ? 'active' : 'expired' });
      await member.save();
      members.push(member);
    }
    await Counter.create([{ key: 'member', seq: mem }, { key: `invoice-${new Date().getFullYear()}`, seq: inv }, { key: 'receipt', seq: rcp }]);

    await Lead.create([
      { name: 'Kevin Mutua', phone: '+254 711 000 111', source: 'join', planInterest: plans[2]._id, category: 'standard', message: 'Interested in the January offer' },
      { name: 'Grace Wekesa', email: 'grace@example.com', source: 'enquiry', message: 'Do you have ladies-only sessions?' },
      { name: 'Highland Logistics HR (demo)', phone: '+254 722 000 222', source: 'phone', status: 'contacted', notes: 'Wants corporate pricing for 25 staff', category: 'corporate' },
      { name: 'Dennis Kariuki', phone: '+254 733 000 333', source: 'walk-in', status: 'trial', notes: 'Trial session booked for Saturday' },
    ]);

    const types = await ClassType.create([
      { name: 'HIIT 45', category: 'cardio', durationMin: 45, color: '#16a34a' },
      { name: 'Spin', category: 'cardio', durationMin: 45, color: '#f59e0b' },
      { name: 'Boxing Fit', category: 'strength', durationMin: 60, color: '#dc2626' },
      { name: 'Yoga Flow', category: 'mind-body', durationMin: 60, color: '#0ea5e9' },
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const active = members.filter((m) => m.status === 'active');
    for (let d = -3; d < 10; d += 1) {
      for (const [t, start, end] of [[types[0], '06:00', '06:45'], [types[3], '07:30', '08:30'], [types[1], '18:00', '18:45'], [types[2], '19:00', '20:00']] as const) {
        const sess = await ClassSession.create({ classType: t._id, title: t.name, trainer: coach._id, room: 'Studio 1', date: addDays(today, d), start, end, capacity: 18, status: d < 0 ? 'completed' : 'scheduled' });
        const n = int(4, 16);
        const chosen = [...active].sort(() => rnd() - 0.5).slice(0, n);
        for (const m of chosen) await Booking.create({ session: sess._id, member: m._id, status: d < 0 ? pick(['attended', 'attended', 'no-show']) : 'booked' });
        sess.booked = chosen.length;
        await sess.save();
      }
    }
    for (let d = 0; d < 14; d += 1) {
      for (const m of [...active].sort(() => rnd() - 0.5).slice(0, int(15, 35))) {
        const inAt = addDays(today, -d); inAt.setHours(int(5, 20), int(0, 59));
        const dur = int(35, 110);
        if (d === 0 && inAt > new Date()) continue;
        const outAt = d === 0 && rnd() < 0.3 ? undefined : new Date(inAt.getTime() + dur * 60000);
        await CheckIn.create({ member: m._id, method: pick(['qr', 'qr', 'manual']), inAt, outAt, durationMin: outAt ? dur : undefined, verifiedBy: desk._id });
      }
    }

    const eq = await Equipment.create([
      { assetTag: 'TRD-01', name: 'Commercial treadmill', category: 'cardio', brand: 'Generic', zone: 'Cardio deck' },
      { assetTag: 'TRD-02', name: 'Commercial treadmill', category: 'cardio', brand: 'Generic', zone: 'Cardio deck' },
      { assetTag: 'BIK-04', name: 'Spin bike', category: 'cardio', zone: 'Studio 1', status: 'maintenance', nextServiceAt: addDays(new Date(), 3) },
      { assetTag: 'RCK-01', name: 'Power rack', category: 'strength', zone: 'Strength area' },
      { assetTag: 'DB-SET', name: 'Dumbbell set 2-40 kg', category: 'free-weights', zone: 'Free weights' },
      { assetTag: 'BAG-03', name: 'Heavy punch bag', category: 'functional', zone: 'Boxing corner', condition: 'fair' },
    ]);
    await Maintenance.create({ equipment: eq[2]._id, title: 'Resistance knob slipping', priority: 'high', status: 'in-progress', cost: 3500 });
    await Product.create([
      { sku: 'WHEY-2KG', name: 'Whey protein 2kg', price: 9500, cost: 7000, stock: 14 },
      { sku: 'WATER-500', name: 'Mineral water 500ml', price: 80, cost: 35, stock: 120 },
      { sku: 'SHAKER', name: 'Shaker bottle', price: 650, cost: 250, stock: 4 },
      { sku: 'TOWEL', name: 'Gym towel', price: 900, cost: 400, stock: 30 },
    ]);
    await Expense.create([
      { title: 'Rent - Demo Plaza', category: 'rent', amount: 350000, paidAt: addDays(new Date(), -4) },
      { title: 'Kenya Power electricity', category: 'utilities', amount: 68000, paidAt: addDays(new Date(), -7) },
      { title: 'Staff salaries', category: 'payroll', amount: 420000, paidAt: addDays(new Date(), -9) },
      { title: 'Social media ads', category: 'marketing', amount: 25000, paidAt: addDays(new Date(), -12) },
    ]);
    for (let d = 0; d < 7; d += 1) {
      await Shift.create({ staff: desk._id, date: addDays(today, d), start: '05:00', end: '13:00', role: 'Front desk' });
      await Shift.create({ staff: coach._id, date: addDays(today, d), start: '06:00', end: '14:00', role: 'Coach' });
    }
    console.log(`  ${mem} members, ${inv} invoices, ${rcp} payments, classes, check-ins, equipment, retail and expenses created`);
  });

  const dir = path.resolve('../backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `credentials-${SLUG}.txt`);
  fs.writeFileSync(file, `# ${NAME} - ${new Date().toISOString()}\n# Sign in at /login?gym=${SLUG}\n${creds.join('\n')}\n`);
  console.log(`  demo gym ready: ${NAME} (${SLUG}); logins saved to ${file}`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await mongoose.disconnect();
  process.exit(1);
});
