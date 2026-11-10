# White-label Gym Platform

One codebase, one database, any number of gyms. Each gym gets a public website and an admin panel. Its logo, colours, banners, offers, plans, prices, hours and contact details all come from its own settings. Onboarding a new gym needs no code change and no redeploy.

| Layer | Stack |
| --- | --- |
| API | Node 20, Express, TypeScript, MongoDB (Mongoose), Zod, JWT, Redis (optional cache) |
| Web | React 18, TypeScript, Vite, Tailwind (runtime CSS-variable theme), Recharts |
| Infra | Vercel (two projects), MongoDB Atlas, Upstash Redis (optional), Cloudinary (uploads), Docker Compose for local |

## Run it locally

**Fastest (no database needed).** This starts an in-memory MongoDB, seeds a demo gym and runs the API:

```bash
cd server && npm install && npm run dev:memory
```

```bash
cd client && npm install && npm run dev
```

Open http://localhost:5173. Every demo login uses the password `Demo@12345`:

| Role | Email | Sees |
| --- | --- | --- |
| Owner / Admin | `owner@demo.gym` | Everything |
| Manager | `manager@demo.gym` | Members, billing, reports, offers, operations |
| Front desk | `frontdesk@demo.gym` | Members, recording payments, check-in, leads (read) |
| Accountant | `accounts@demo.gym` | Read-only invoices, payments and reports |
| Content editor | `editor@demo.gym` | Website branding, banners, content and offers |
| Trainer | `trainer@demo.gym` | Classes, check-in, member lookup |
| Vendor super-admin | `vendor@example.com` at `/platform` | All gyms |

**Against your own MongoDB.** Copy `server/.env.example` to `server/.env`, fill in `MONGO_URI` and `JWT_SECRET`, then run `npm run seed` and `npm run dev`.

**Docker.** Run `docker compose up --build`, then `docker compose exec api npm run seed`.

## How it works

### Multi-tenancy (Gym A can never see Gym B)
- Every gym record carries a `tenantId`. A Mongoose plugin (`server/src/lib/tenantPlugin.ts`) adds a `tenantId` filter to every find, update, delete, count and aggregate. It **refuses to run** if a query has no tenant context, and it blocks any write that targets another gym.
- The API works out which gym a request is for from the browser's hostname, sent in the `X-Tenant-Host` header. That host can be `<slug>.ROOT_DOMAIN` or a custom domain assigned in the vendor console. Login tokens are bound to one gym, so a Gym A token is rejected on Gym B.
- In local development, `?gym=<slug>` or `VITE_DEV_TENANT` picks the gym.

### One login, server-side permissions
`server/src/auth/permissions.ts` maps roles to permissions. Every admin route declares the permission it needs. The client only uses the same list to decide which menus to show.

### Single source of truth for prices
`server/src/lib/pricing.ts` → `quote()` calculates the price for a plan and pricing category. It applies the best live offer (or a promo code), the joining fee and tax (inclusive or exclusive). The public plan cards, the Join page and the front desk's invoice all call it, so the price a visitor sees is the price that gets charged.

### Website: draft → preview → publish → rollback
Content is versioned in `SiteRevision` documents. Admins edit one draft and preview it at `/?preview=draft` (editors only). Publishing snapshots the draft as a new version. Rollback re-publishes an older version, and history is never rewritten.

### Theme from the logo
On upload, the browser reads the logo's pixels and picks primary, secondary and accent colours (`client/src/lib/theme.ts`). The server (`server/src/lib/theme.ts`) builds light and dark token sets and nudges colours until every text/background pair passes **WCAG AA (4.5:1)**. Tailwind reads those tokens as CSS variables, so the whole site re-skins at runtime.

### Leads, not members
The website's Join and Contact forms only create `Lead` records, with rate limiting and a honeypot field against spam. Staff convert a lead into a member, then sell a membership. That sale creates a numbered invoice and an optional payment.

### Security
The API validates every input with Zod and rejects Mongo `$`/`.` operator keys. Logins are rate-limited and compared in constant time. Tokens are revoked when a password, role or status changes. CORS allows only fixed origins plus gym domains. Image URLs must be https, and button links are restricted to safe schemes. CSV exports guard against formula injection. An audit log records logins, publishes, payments, refunds, role changes and vendor support sessions.

## Deploying on Vercel

You need two Vercel projects from this repo:

1. **API**: root directory `server`. `vercel.json` routes every request to `api/index.ts`. Set these env vars:
   - Required: `MONGO_URI`, `JWT_SECRET`, `ROOT_DOMAIN`
   - Optional: `DEFAULT_TENANT_SLUG`, `CLIENT_ORIGINS`, `REDIS_URL` (Upstash `rediss://…`), `CLOUDINARY_*`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`
2. **Web**: root directory `client`, framework Vite. Set `VITE_API_URL=https://<your-api>.vercel.app`.

Gym addresses:
- **Sub-domains.** Add `*.ROOT_DOMAIN` to the web project. Wildcards need Vercel nameservers.
- **Custom domains.** Add them in `/platform`. If `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are set, they are attached to the web project automatically. The gym then points a CNAME at `cname.vercel-dns.com`.
- **One `*.vercel.app` URL for a single gym.** Set `DEFAULT_TENANT_SLUG`.

### Upgrading a v1 database
v1 documents have no `tenantId`, and the v1 global unique indexes conflict with the new per-gym ones. Run `npm run seed -- --legacy` **once** against that database. It deletes the untenanted v1 demo documents, drops v1-only collections and rebuilds indexes. Back up first if any of that data is real.

## Scripts

| Where | Command | Purpose |
| --- | --- | --- |
| server | `npm run dev:memory` | API + in-memory MongoDB + demo data |
| server | `npm run dev` / `npm run build` / `npm start` | Develop / compile / run |
| server | `npm run seed` | Recreate the `demo` gym (other gyms untouched) |
| server | `npm test` | Isolation, permission, pricing, publish and booking tests (in-memory MongoDB) |
| client | `npm run dev` / `npm run build` | Develop / production build |

## Adding modules later
Classes, equipment, check-in, retail/POS, shifts and expenses already run on the same tenant plugin and permission system. To add a new module (payroll, mobile app API, …):
1. Create a schema with `schema.plugin(tenantPlugin)`.
2. Add permissions in `permissions.ts`.
3. Mount a router under `/api/admin`.
4. Add a nav item in `client/src/admin/AdminLayout.tsx`.
