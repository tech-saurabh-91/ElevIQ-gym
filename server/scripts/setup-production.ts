/**
 * One-time production setup for an existing v1 database.
 *
 *   npx tsx scripts/setup-production.ts --gym "ElevIQ Gym" --slug eleviq --owner owner@eleviq.gym \
 *     --domains eleviq-gym.vercel.app,other.domain [--legacy]
 *
 * --legacy  deletes v1 documents that have no tenantId (and v1-only collections). TAKE A BACKUP FIRST.
 * Then syncs indexes, creates the vendor admin (if missing) and the gym with an owner (if missing).
 * Generated passwords are written to ../backups/credentials-<slug>.txt (git-ignored), never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/lib/db.js';
import { runAsPlatform, runInTenant } from '../src/lib/tenantContext.js';
import { defaultSiteContent } from '../src/lib/siteContent.js';
import { PlatformUser, Tenant } from '../src/models/platform.js';
import { User } from '../src/models/user.js';
import { SiteRevision } from '../src/models/site.js';
import { Offer, Plan } from '../src/models/catalog.js';
import { Lead, Member, Membership } from '../src/models/crm.js';
import { AuditLog, Counter, Expense, Invoice, Payment } from '../src/models/billing.js';
import { Booking, CheckIn, ClassSession, ClassType, Equipment, Maintenance, Product, Shift } from '../src/models/modules.js';

const TENANT_MODELS = [User, SiteRevision, Plan, Offer, Lead, Member, Membership, Invoice, Payment, Expense, Counter, AuditLog, ClassType, ClassSession, Booking, Equipment, Maintenance, CheckIn, Product, Shift];
const V1_ONLY = ['locations', 'staffs', 'trainingrecords', 'personalsessions', 'sales', 'lockers', 'announcements', 'contactmessages', 'galleryitems', 'reviews', 'notifications', 'campaigns'];

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const password = () => crypto.randomBytes(12).toString('base64url');

async function main() {
  const gym = arg('gym') ?? 'My Gym';
  const slug = (arg('slug') ?? 'gym').toLowerCase();
  const ownerEmail = (arg('owner') ?? 'owner@example.com').toLowerCase();
  const domains = (arg('domains') ?? '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const vendorEmail = (process.env.PLATFORM_ADMIN_EMAIL || 'vendor@example.com').toLowerCase();

  await connectDB(env().MONGO_URI);
  const db = mongoose.connection.db!;
  console.log(`database: ${db.databaseName}`);
  const creds: string[] = [];

  await runAsPlatform(async () => {
    if (process.argv.includes('--legacy')) {
      const names = (await db.listCollections().toArray()).map((c) => c.name);
      for (const m of TENANT_MODELS) {
        const coll = m.collection.collectionName;
        if (!names.includes(coll)) continue;
        const r = await db.collection(coll).deleteMany({ tenantId: { $exists: false } });
        if (r.deletedCount) console.log(`  removed ${r.deletedCount} v1 docs from ${coll}`);
      }
      for (const c of V1_ONLY) if (names.includes(c)) { await db.collection(c).drop(); console.log(`  dropped ${c}`); }
    }
    for (const m of [Tenant, PlatformUser, ...TENANT_MODELS]) await m.syncIndexes();
    console.log('  indexes synced');

    if (!(await PlatformUser.exists({ email: vendorEmail }))) {
      const pw = password();
      await PlatformUser.create({ name: 'Platform Admin', email: vendorEmail, password: await bcrypt.hash(pw, 11) });
      creds.push(`Vendor console (/platform): ${vendorEmail} / ${pw}`);
      console.log(`  vendor admin created: ${vendorEmail}`);
    }
  });

  let tenant = await runAsPlatform(() => Tenant.findOne({ slug }));
  if (!tenant) {
    tenant = await runAsPlatform(() => Tenant.create({ slug, name: gym, status: 'active', domains, contactEmail: ownerEmail, settings: { legalName: gym } }));
    console.log(`  gym created: ${gym} (${slug})`);
  } else if (domains.length) {
    await runAsPlatform(() => Tenant.updateOne({ _id: tenant!._id }, { $addToSet: { domains: { $each: domains } } }));
  }
  await runInTenant(tenant._id as Types.ObjectId, async () => {
    if (!(await User.exists({ role: 'owner' }))) {
      const pw = password();
      await User.create({ name: `${gym} Owner`, email: ownerEmail, password: pw, role: 'owner' });
      creds.push(`Gym owner (/login): ${ownerEmail} / ${pw}`);
      console.log(`  owner created: ${ownerEmail}`);
    }
    if (!(await SiteRevision.exists({ status: 'draft' }))) await SiteRevision.create({ status: 'draft', version: 1, content: defaultSiteContent(gym) });
  });

  if (creds.length) {
    const dir = path.resolve('../backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `credentials-${slug}.txt`);
    fs.appendFileSync(file, `# ${new Date().toISOString()}\n${creds.join('\n')}\n`);
    console.log(`  new passwords saved to ${file}`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message);
  await mongoose.disconnect();
  process.exit(1);
});
