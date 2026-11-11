import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { buildTheme } from '../src/lib/theme.js';

let mongo: MongoMemoryReplSet;
let app: any;
const PW = 'Password#123';

const A = { host: 'gym-a.test.local' };
const B = { host: 'gym-b.test.local' };
const tokens: Record<string, string> = {};

const call = (gym: { host: string }, token?: string) => {
  const wrap = (r: request.Test) => {
    r.set('X-Tenant-Host', gym.host);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return r;
  };
  return {
    get: (u: string) => wrap(request(app).get(u)),
    post: (u: string, b?: object) => wrap(request(app).post(u)).send(b ?? {}),
    put: (u: string, b?: object) => wrap(request(app).put(u)).send(b ?? {}),
    del: (u: string) => wrap(request(app).delete(u)),
  };
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = mongo.getUri('gymtest');
  process.env.JWT_SECRET = 'test-secret-test-secret-123456';
  process.env.ROOT_DOMAIN = 'test.local';
  process.env.DEFAULT_TENANT_SLUG = '';
  app = (await import('../src/app.js')).default;
  const { connectDB } = await import('../src/lib/db.js');
  await connectDB(process.env.MONGO_URI);
  const { PlatformUser } = await import('../src/models/platform.js');
  await PlatformUser.create({ name: 'Vendor', email: 'vendor@test.local', password: await bcrypt.hash(PW, 4) });

  const login = await request(app).post('/api/platform/login').send({ email: 'vendor@test.local', password: PW });
  tokens.vendor = login.body.token;
  for (const [slug, name] of [['gym-a', 'Gym A'], ['gym-b', 'Gym B']]) {
    const r = await request(app)
      .post('/api/platform/tenants')
      .set('Authorization', `Bearer ${tokens.vendor}`)
      .send({ name, slug, ownerName: `${name} Owner`, ownerEmail: `owner@${slug}.com`, ownerPassword: PW, currency: 'INR' });
    expect(r.status).toBe(201);
  }
  for (const [key, gym, email] of [['a', A, 'owner@gym-a.com'], ['b', B, 'owner@gym-b.com']] as const) {
    const r = await call(gym).post('/api/auth/login', { email, password: PW });
    expect(r.status).toBe(200);
    tokens[key] = r.body.token;
  }
  // Staff with limited roles in gym A
  for (const role of ['frontdesk', 'accountant', 'editor', 'manager']) {
    const r = await call(A, tokens.a).post('/api/admin/staff', { name: `${role} user`, email: `${role}@gym-a.com`, role, password: PW });
    expect(r.status).toBe(201);
    tokens[role] = (await call(A).post('/api/auth/login', { email: `${role}@gym-a.com`, password: PW })).body.token;
  }
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

let planA = '';
let memberA = '';

describe('tenant isolation', () => {
  it('keeps each gym\'s members separate and blocks id guessing', async () => {
    const plan = await call(A, tokens.a).post('/api/admin/plans', { name: 'Monthly', durationDays: 30, prices: [{ category: 'standard', amount: 1000 }, { category: 'student', amount: 800 }] });
    expect(plan.status).toBe(201);
    planA = plan.body.data._id;
    const m = await call(A, tokens.a).post('/api/admin/members', { firstName: 'Alice', gender: 'female' });
    expect(m.status).toBe(201);
    memberA = m.body.data._id;

    const listB = await call(B, tokens.b).get('/api/admin/members');
    expect(listB.body.data).toHaveLength(0);
    expect((await call(B, tokens.b).get(`/api/admin/members/${memberA}`)).status).toBe(404);
    expect((await call(B, tokens.b).put(`/api/admin/members/${memberA}`, { firstName: 'Hacked' })).status).toBe(404);
    expect((await call(B, tokens.b).del(`/api/admin/plans/${planA}`)).status).toBe(404);
    expect((await call(B).get('/api/public/site')).body.data.plans).toHaveLength(0);
  });

  it('rejects a token from gym A on gym B\'s address', async () => {
    const r = await call(B, tokens.a).get('/api/admin/members');
    expect(r.status).toBe(401);
  });

  it('refuses queries with no tenant context at the data layer', async () => {
    const { Member } = await import('../src/models/crm.js');
    await expect(Member.find().lean()).rejects.toThrow(/Tenant context missing/);
  });
});

describe('server-side permissions', () => {
  it('front desk: members + payments only', async () => {
    expect((await call(A, tokens.frontdesk).get('/api/admin/members')).status).toBe(200);
    expect((await call(A, tokens.frontdesk).post('/api/admin/members', { firstName: 'Bob' })).status).toBe(201);
    expect((await call(A, tokens.frontdesk).put(`/api/admin/plans/${planA}`, { name: 'Cheap' })).status).toBe(403);
    expect((await call(A, tokens.frontdesk).get('/api/admin/website/draft')).status).toBe(403);
    expect((await call(A, tokens.frontdesk).get('/api/admin/reports/collections')).status).toBe(403);
    expect((await call(A, tokens.frontdesk).post('/api/admin/staff', { name: 'x', email: 'x@x.com', role: 'owner', password: PW })).status).toBe(403);
  });

  it('accountant: read-only financials', async () => {
    expect((await call(A, tokens.accountant).get('/api/admin/billing/invoices')).status).toBe(200);
    expect((await call(A, tokens.accountant).get('/api/admin/reports/collections')).status).toBe(200);
    expect((await call(A, tokens.accountant).post('/api/admin/billing/memberships', { memberId: memberA, planId: planA })).status).toBe(403);
    expect((await call(A, tokens.accountant).post('/api/admin/members', { firstName: 'X' })).status).toBe(403);
  });

  it('content editor: website and offers only', async () => {
    expect((await call(A, tokens.editor).get('/api/admin/website/draft')).status).toBe(200);
    expect((await call(A, tokens.editor).get('/api/admin/members')).status).toBe(403);
    expect((await call(A, tokens.editor).get('/api/admin/billing/invoices')).status).toBe(403);
  });

  it('manager cannot change business settings or staff', async () => {
    expect((await call(A, tokens.manager).put('/api/admin/settings', {})).status).toBe(403);
    expect((await call(A, tokens.manager).post('/api/admin/staff', { name: 'x', email: 'y@y.com', role: 'frontdesk', password: PW })).status).toBe(403);
    const list = (await call(A, tokens.manager).get('/api/admin/staff')).body.data;
    expect(list[0].email).toBeUndefined();
  });

  it('rejects Mongo operator injection', async () => {
    const r = await call(A, tokens.a).get('/api/admin/members?status[$ne]=x');
    expect(r.status).toBe(400);
    const l = await call(A).post('/api/auth/login', { email: { $gt: '' }, password: PW });
    expect(l.status).toBe(400);
  });
});

describe('website forms create leads only', () => {
  it('join form never creates a member', async () => {
    const before = (await call(A, tokens.a).get('/api/admin/members')).body.pagination.total;
    const r = await call(A).post('/api/public/leads', { name: 'Walk In', phone: '9999999999', source: 'join', planId: planA });
    expect(r.status).toBe(201);
    const after = (await call(A, tokens.a).get('/api/admin/members')).body.pagination.total;
    expect(after).toBe(before);
    const leads = await call(A, tokens.a).get('/api/admin/leads');
    expect(leads.body.data.some((l: any) => l.name === 'Walk In')).toBe(true);
  });

  it('"converted" always means a real member exists', async () => {
    const lead = (await call(A, tokens.manager).post('/api/admin/leads', { name: 'Ravi Kumar', phone: '9000000000' })).body.data;
    // Setting the label alone is refused...
    expect((await call(A, tokens.manager).put(`/api/admin/leads/${lead._id}`, { status: 'converted' })).status).toBe(400);
    // ...converting creates the member and links it.
    const conv = await call(A, tokens.manager).post(`/api/admin/leads/${lead._id}/convert`);
    expect(conv.status).toBe(201);
    expect(conv.body.data.firstName).toBe('Ravi');
    const after = (await call(A, tokens.manager).get(`/api/admin/leads/${lead._id}`)).body.data;
    expect(after.status).toBe('converted');
    expect(after.convertedMember).toBe(conv.body.data._id);
    expect((await call(A, tokens.manager).post(`/api/admin/leads/${lead._id}/convert`)).status).toBe(409);
  });

  it('honeypot blocks bots', async () => {
    const r = await call(A).post('/api/public/leads', { name: 'Bot', phone: '1', website: 'spam' });
    expect(r.status).toBe(400);
  });
});

describe('pricing is one source of truth', () => {
  it('the website quote equals the invoice the front desk creates', async () => {
    const tenantSettings = (await call(A, tokens.a).get('/api/admin/settings')).body.data;
    const put = await call(A, tokens.a).put('/api/admin/settings', { ...tenantSettings, name: 'Gym A', tax: { label: 'GST', rate: 18, inclusive: false, registrationNo: '' } });
    expect(put.status).toBe(200);
    const now = Date.now();
    const offer = await call(A, tokens.editor).post('/api/admin/offers', {
      title: 'Launch 10%', discountType: 'percent', value: 10, startsAt: new Date(now - 864e5), endsAt: new Date(now + 10 * 864e5), display: { bar: true, badge: true },
    });
    expect(offer.status).toBe(201);
    const site = (await call(A).get('/api/public/site')).body.data;
    const webQuote = site.plans[0].quotes.student;
    expect(webQuote.discount).toBe(80);
    expect(webQuote.total).toBe(Math.round((800 - 80) * 1.18 * 100) / 100);
    expect(site.offers[0].display.bar).toBe(true);

    await call(A, tokens.a).put(`/api/admin/members/${memberA}`, { category: 'student' });
    const sale = await call(A, tokens.frontdesk).post('/api/admin/billing/memberships', { memberId: memberA, planId: planA, payment: { amount: 100, method: 'cash' } });
    expect(sale.status).toBe(201);
    const inv = sale.body.data.invoice;
    // Same as the website price + one-off joining fee (0 here).
    expect(inv.total).toBe(webQuote.total);
    expect(inv.status).toBe('partial');
    expect(inv.number).toMatch(/^INV-\d{4}-00001$/);

    const over = await call(A, tokens.frontdesk).post(`/api/admin/billing/invoices/${inv._id}/payments`, { amount: 99999, method: 'cash' });
    expect(over.status).toBe(400);
    const rest = await call(A, tokens.frontdesk).post(`/api/admin/billing/invoices/${inv._id}/payments`, { amount: inv.total - 100, method: 'upi' });
    expect(rest.status).toBe(201);
    expect(rest.body.data.invoice.status).toBe('paid');
  });
});

describe('draft -> publish -> rollback', () => {
  it('only publishes when asked and can roll back', async () => {
    const editor = call(A, tokens.editor);
    const draft = (await editor.get('/api/admin/website/draft')).body.data.content;
    draft.brand.tagline = 'Version one';
    expect((await editor.put('/api/admin/website/draft', { content: draft })).status).toBe(200);
    expect((await call(A).get('/api/public/site')).body.data.published).toBe(false);
    expect((await editor.post('/api/admin/website/publish', { note: 'v1' })).status).toBe(200);

    draft.brand.tagline = 'Version two';
    await editor.put('/api/admin/website/draft', { content: draft });
    // Public still shows v1 until publish (cache cleared by publish only)
    await editor.post('/api/admin/website/publish', { note: 'v2' });
    let pub = (await call(A).get('/api/public/site')).body.data;
    expect(pub.site.brand.tagline).toBe('Version two');

    const revs = (await editor.get('/api/admin/website/revisions')).body.data;
    const v1 = revs.find((r: any) => r.note === 'v1');
    expect((await editor.post(`/api/admin/website/revisions/${v1._id}/rollback`)).status).toBe(200);
    pub = (await call(A).get('/api/public/site')).body.data;
    expect(pub.site.brand.tagline).toBe('Version one');

    // Preview of draft needs an editor token
    expect((await call(A).get('/api/public/site?preview=draft')).status).toBe(403);
    expect((await call(A, tokens.editor).get('/api/public/site?preview=draft')).status).toBe(200);
  });

  it('rejects unsafe content', async () => {
    const editor = call(A, tokens.editor);
    const draft = (await editor.get('/api/admin/website/draft')).body.data.content;
    draft.banners = [{ id: 'x', title: 't', imageUrl: 'javascript:alert(1)' }];
    expect((await editor.put('/api/admin/website/draft', { content: draft })).status).toBe(400);
  });
});

describe('class booking', () => {
  it('fills seats atomically, waitlists, and promotes on cancel', async () => {
    const t = await call(A, tokens.manager).post('/api/admin/ops/class-types', { name: 'HIIT' });
    const s = await call(A, tokens.manager).post('/api/admin/ops/sessions', { classType: t.body.data._id, title: 'HIIT', date: new Date(Date.now() + 864e5), start: '06:00', end: '06:45', capacity: 1 });
    const sid = s.body.data[0]._id;
    const m2 = (await call(A, tokens.a).post('/api/admin/members', { firstName: 'Second' })).body.data;
    await call(A, tokens.a).post('/api/admin/billing/memberships', { memberId: m2._id, planId: planA });
    const b1 = await call(A, tokens.manager).post(`/api/admin/ops/sessions/${sid}/bookings`, { memberId: memberA });
    const b2 = await call(A, tokens.manager).post(`/api/admin/ops/sessions/${sid}/bookings`, { memberId: m2._id });
    expect(b1.body.data.status).toBe('booked');
    expect(b2.body.data.status).toBe('waitlist');
    expect((await call(A, tokens.manager).post(`/api/admin/ops/sessions/${sid}/bookings`, { memberId: memberA })).status).toBe(409);
    await call(A, tokens.manager).post(`/api/admin/ops/bookings/${b1.body.data._id}/cancel`);
    const list = (await call(A, tokens.manager).get(`/api/admin/ops/sessions/${sid}/bookings`)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('booked');
    // Cancelled member can re-book (goes to waitlist now)
    const again = await call(A, tokens.manager).post(`/api/admin/ops/sessions/${sid}/bookings`, { memberId: memberA });
    expect(again.status).toBe(201);
  });
});

describe('vendor console', () => {
  it('assigns domains and resolves the gym from them', async () => {
    const tenants = (await request(app).get('/api/platform/tenants').set('Authorization', `Bearer ${tokens.vendor}`)).body.data;
    const b = tenants.find((t: any) => t.slug === 'gym-b');
    const r = await request(app).post(`/api/platform/tenants/${b._id}/domains`).set('Authorization', `Bearer ${tokens.vendor}`).send({ domain: 'https://www.GymB.com/' });
    expect(r.status).toBe(200);
    expect(r.body.data.domains).toContain('www.gymb.com');
    const site = await call({ host: 'www.gymb.com' }).get('/api/public/site');
    expect(site.body.data.tenant.slug).toBe('gym-b');
    const dup = await request(app).post(`/api/platform/tenants/${tenants.find((t: any) => t.slug === 'gym-a')._id}/domains`).set('Authorization', `Bearer ${tokens.vendor}`).send({ domain: 'www.gymb.com' });
    expect(dup.status).toBe(409);
  });

  it('tenant tokens cannot use the vendor console', async () => {
    expect((await request(app).get('/api/platform/tenants').set('Authorization', `Bearer ${tokens.a}`)).status).toBe(401);
  });

  it('unknown hosts get 404', async () => {
    expect((await call({ host: 'nobody.example.com' }).get('/api/public/site')).status).toBe(404);
  });
});

describe('reports and Excel export', () => {
  const bin = (r: request.Test) => r.buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });

  it('exports a styled .xlsx with title, filters, headers and totals that match the JSON report', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const json = (await call(A, tokens.accountant).get('/api/admin/reports/collections?groupBy=month')).body.data;
    const res = await bin(call(A, tokens.accountant).get('/api/admin/reports/collections/export?groupBy=month'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=".*collections.*\.xlsx"/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet('By month')!;
    expect(String(ws.getCell('A1').value)).toContain('Collections');
    expect(String(ws.getCell('A3').value)).toContain('Grouped by month');
    expect(ws.getCell('C5').value).toBe('Net collected');
    const totalRow = ws.getRow(6 + json.series.length);
    expect(totalRow.getCell(1).value).toBe('Total');
    expect((totalRow.getCell(3).value as any).result).toBe(json.net);
    expect(ws.getCell('C6').numFmt).toContain('#,##0');
    const payments = wb.getWorksheet('Payments')!;
    expect(payments.getCell('A6').numFmt).toBe('dd-mmm-yyyy hh:mm');
  });

  it('only roles that can see a report can export it', async () => {
    expect((await call(A, tokens.frontdesk).get('/api/admin/reports/collections/export')).status).toBe(403);
    expect((await call(A, tokens.editor).get('/api/admin/reports/demographics/export')).status).toBe(403);
    expect((await call(A, tokens.frontdesk).get('/api/admin/reports/expiring/export')).status).toBe(200);
    expect((await call(A).get('/api/admin/reports/expiring/export')).status).toBe(401);
  });

  it('movement and expiry-window reports work, and filters are validated', async () => {
    const mv = (await call(A, tokens.manager).get('/api/admin/reports/movement?months=3')).body.data;
    expect(mv).toHaveLength(3);
    expect(mv[2].joined).toBeGreaterThanOrEqual(2);
    expect((await call(A, tokens.manager).get('/api/admin/reports/expiring?fromDays=10&days=40')).status).toBe(200);
    expect((await call(A, tokens.manager).get('/api/admin/reports/collections?from=bad')).status).toBe(400);
    const dash = (await call(A, tokens.a).get('/api/admin/reports/dashboard')).body.data;
    expect(dash.trends.collected.value).toBeGreaterThan(0);
  });

  it('gym time-zone helpers', async () => {
    const { zonedTime, startOfMonthTz } = await import('../src/lib/time.js');
    expect(zonedTime('Asia/Kolkata', 2026, 1, 1).toISOString()).toBe('2025-12-31T18:30:00.000Z');
    expect(zonedTime('Africa/Nairobi', 2026, 3, 1).toISOString()).toBe('2026-02-28T21:00:00.000Z');
    expect(startOfMonthTz('UTC', new Date('2026-05-17T10:00:00Z'), -1).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('theme generator', () => {
  it('passes WCAG AA for awkward brand colours', () => {
    for (const primary of ['#ffff00', '#00ff00', '#1a1a1a', '#ff69b4', '#808080', '#0000ff', '#ffffff']) {
      const t = buildTheme({ primary });
      const fails = t.checks.filter((c) => !c.pass);
      expect(fails, `${primary}: ${JSON.stringify(fails)}`).toHaveLength(0);
    }
  });
});

void Types;
