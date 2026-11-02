# GymFlow — Gym Management Platform

Full-stack gym operations system: 3D-style public marketing site + role-based operations console (admin / trainer / member).

| Layer | Stack |
| --- | --- |
| Backend | Node.js, Express, MongoDB (Mongoose), JWT |
| Frontend | React 18, Vite, Tailwind CSS, React Router 6, Framer Motion |
| 3D / Charts | Three.js via `@react-three/fiber` + `drei`, Recharts |

## Quick start

```bash
# 1. API (port 5000)
cd server
npm install
npm run seed        # creates demo data in the database from .env MONGO_URI
npm run dev

# 2. UI (port 5173, proxies /api -> :5000)
cd ../client
npm install
npm run dev
```

Open http://localhost:5173

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@gymflow.io` | `admin123` |
| Trainer | `marcus.reed@gymflow.io` | `trainer123` |
| Member | `aarav.sharma0@mail.com` (any seeded member email) | `member123` |

Member emails follow `<first>.<last><index>@mail.com`, e.g. `priya.nair1@mail.com`.

## Public site

`/` home · `/about` · `/gallery` · `/contact` · `/signin` · `/register`

Cinematic dark UI (`void` / `mint` / `violet` palette), a live R3F hero scene, scroll reveals, parallax and tilt interactions.

### Localization

- **6 languages**: English, Español, Français, Deutsch, हिन्दी, العربية (full RTL flip via `document.dir`).
- **12 currencies**: USD, EUR, GBP, INR, JPY, BRL, AED, AUD, CAD, SGD, ZAR, MXN.
- Prices are stored in USD and converted at display time; reporting always aggregates in the base currency.
- Switcher lives in the navbar, auth screens and the dashboard sidebar (also in **Settings → Region & language**).

## Operations console (`/app`)

| Module | Routes | Highlights |
| --- | --- | --- |
| Overview | `/app` | KPIs, revenue vs cost, member status mix, top classes, live activity feed, review queue |
| Members | `/app/members` | Table, filters, add/edit modal, check-in, renewal, visit history, member stats |
| Staff | `/app/staff` | Employees, departments, shifts, training records (admin) |
| Classes | `/app/classes` | Types, timetable, booking + automatic waitlist, personal sessions |
| Equipment | `/app/equipment` | Asset registry, utilisation, maintenance tickets with progress |
| Finance | `/app/finance` | Payments, invoices, expenses, POS sales, revenue analytics (admin) |
| Check-ins | `/app/checkins` | QR / RFID / member-ID toggle, live floor feed, occupancy |
| Reports | `/app/reports` | Retention, cohorts, class demand, asset utilisation, staff performance, CSV export |
| Inbox | `/app/inbox` | Contact enquiries, announcements, campaigns (admin) |
| Settings | `/app/settings` | Profile, locale/currency, password change |

Member portal: `/app/membership` (access pass + QR, plan, renew, payments) and `/app/my-classes` (bookings).

## API

Base URL `http://localhost:5000/api`. All protected routes require `Authorization: Bearer <token>`.

| Group | Endpoints |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/me`, `PUT /auth/password` |
| Dashboard | `/dashboard/overview`, `/dashboard/revenue`, `/dashboard/*-analytics`, `/dashboard/activity` |
| Members | `/members` CRUD, `/members/stats`, `/members/:id/{renew,checkin,history}`, `/members/me/profile` |
| Staff & ops | `/staff`, `/ops/{equipment,maintenance,shifts}`, `/ops/maintenance/:id/progress` |
| Classes | `/classes/types`, `/classes/sessions`, `/classes/book`, `/classes/bookings/:id/cancel`, `/classes/my-bookings` |
| Finance | `/finance/{payments,summary,invoices,expenses,products,sales}` |
| Front desk | `/checkins/live`, `/checkins/scan`, `/lockers` |
| Public | `/plans`, `/locations`, `/gallery`, `/reviews`, `/announcements`, `/contacts`, `/site-stats` |

Errors return `{ success: false, message }`; the client surfaces them as toasts.

## Project structure

```
GYM/
├── server/
│   ├── .env                  # MONGO_URI, JWT_SECRET, PORT
│   └── src/
│       ├── index.js          # express app + route mounting
│       ├── config/db.js
│       ├── middleware/auth.js
│       ├── models/           # users, members, classes, equipment, finance, ops
│       ├── routes/           # auth, dashboard, resources, ops, finance, classes, members, public
│       └── seed/seed.js      # drops + repopulates demo data
└── client/
    └── src/
        ├── lib/              # i18n (lang/currency), api client, auth context
        ├── components/       # ui primitives, DataTable, Navbar, Footer, AuthShell, three/
        ├── layouts/          # PublicLayout, DashboardLayout
        └── pages/            # public pages + app/ dashboard modules
```

## Scripts

| Where | Command | Purpose |
| --- | --- | --- |
| `server` | `npm run dev` | API with `--watch` on :5000 |
| `server` | `npm run seed` | **Drops** all collections and regenerates demo data |
| `server` | `npm start` | API, production |
| `client` | `npm run dev` | Vite dev server on :5173 |
| `client` | `npm run build` / `npm run preview` | Production build / serve `dist` |
