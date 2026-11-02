import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import HeroScene from '../components/three/HeroScene';
import { Badge, CountUp, Reveal, SectionHeading, Tilt, useToast } from '../components/ui';
import { useLocale } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import api from '../lib/api';

const MODULES = [
  { icon: '👥', title: 'Member management', desc: 'Profiles, QR/RFID check-in, family & corporate groups, renewals, visit history.', accent: 'mint' },
  { icon: '🧑‍🏫', title: 'Staff & payroll', desc: 'Roles, certifications, shift rosters, KPIs and performance scoring.', accent: 'violet' },
  { icon: '🗓️', title: 'Classes & booking', desc: 'Recurring timetables, capacity, waitlists, PT sessions, attendance.', accent: 'coral' },
  { icon: '🏋️', title: 'Equipment', desc: 'Asset registry, maintenance tickets, safety inspections, depreciation.', accent: 'sky' },
  { icon: '💳', title: 'Financials', desc: 'Payments, invoices, expenses, refunds, tax-ready revenue reporting.', accent: 'amber' },
  { icon: '🏢', title: 'Multi-location', desc: 'Clubs across countries, room bookings, lockers, capacity monitoring.', accent: 'mint' },
  { icon: '🛒', title: 'Inventory & POS', desc: 'Product catalog, barcode sales, stock alerts, supplier tracking.', accent: 'violet' },
  { icon: '📊', title: 'Analytics', desc: 'Retention cohorts, class popularity, utilisation, custom report builder.', accent: 'coral' },
  { icon: '📣', title: 'Marketing', desc: 'Email/SMS campaigns, referrals, announcements, feedback loops.', accent: 'sky' },
  { icon: '📱', title: 'Member portal', desc: 'Booking, payments, progress and notifications on any device.', accent: 'amber' },
];

const ACCENT = {
  mint: 'from-mint/25 to-transparent border-mint/25',
  violet: 'from-violet/25 to-transparent border-violet/25',
  coral: 'from-coral/25 to-transparent border-coral/25',
  sky: 'from-sky/25 to-transparent border-sky/25',
  amber: 'from-amber/25 to-transparent border-amber/25',
};

function Marquee({ items }) {
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-white/[0.02] py-4">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { t, money, date } = useLocale();
  const { isAuthenticated } = useAuth();
  const { push } = useToast();
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p, g, r, l] = await Promise.all([
          api.get('/site-stats'),
          api.get('/plans'),
          api.get('/gallery?limit=12'),
          api.get('/reviews?featured=true'),
          api.get('/locations'),
        ]);
        setStats(s.data);
        setPlans(p.data);
        setGallery(g.data);
        setReviews(r.data);
        setLocations(l.data);
      } catch {
        /* public stats optional */
      }
      try {
        const from = new Date().toISOString().slice(0, 10);
        const ses = await api.get(`/classes/sessions?from=${from}&limit=6`);
        setSessions(ses.data.filter((s) => s.status !== 'cancelled'));
      } catch {
        /* schedule optional */
      }
    };
    load();
  }, []);

  const heroStats = useMemo(
    () => [
      { label: t('stats.members'), value: stats?.members ?? 640, suffix: '+' },
      { label: t('stats.classes'), value: stats?.sessionsThisWeek ?? 48, suffix: '' },
      { label: t('stats.trainers'), value: stats?.trainers ?? 24, suffix: '+' },
      { label: t('stats.locations'), value: stats?.locations ?? 3, suffix: '' },
    ],
    [stats, t]
  );

  const handleBook = async (sessionId) => {
    if (!isAuthenticated) {
      push('Sign in to reserve a spot.', 'info');
      window.location.href = '/signin';
      return;
    }
    try {
      await api.post('/classes/book', { sessionId });
      push('Seat reserved — see you there.');
      setSessions((prev) => prev.map((s) => (s._id === sessionId ? { ...s, booked: s.booked + 1 } : s)));
    } catch (err) {
      push(err.message, 'error');
    }
  };

  return (
    <>
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative min-h-[100svh] overflow-hidden pt-28">
        <div className="absolute inset-0">
          <HeroScene className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_25%,rgba(5,5,10,0.85)_78%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-void via-void/80 to-transparent" />

        <div className="container-x relative z-10 flex min-h-[calc(100svh-7rem)] flex-col justify-center py-16">
          <motion.span
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
            className="eyebrow w-fit"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            {t('hero.badge')}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 40, rotateX: -20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.25, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 1400 }}
            className="mt-6 max-w-5xl font-display text-[clamp(2.6rem,8vw,6.4rem)] font-black leading-[0.92] tracking-tight"
          >
            {t('hero.title').split('.')[0]}.
            <br />
            <span className="text-gradient">{t('hero.title').split('.').slice(1).join('.').trim()}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.8 }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg"
          >
            {t('hero.sub')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.8 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link to="/register" className="btn-primary !px-7 !py-3.5 text-[15px]">
              {t('hero.cta1')}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <a href="#modules" className="btn-ghost !px-7 !py-3.5 text-[15px]">
              {t('hero.cta2')}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.9 }}
            className="mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {heroStats.map((s) => (
              <div key={s.label} className="glass rounded-2xl px-4 py-4">
                <p className="font-display text-2xl font-bold text-bone sm:text-3xl">
                  <CountUp to={s.value} />
                  {s.suffix}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted sm:flex">
          {t('hero.scroll')}
          <span className="h-10 w-px bg-gradient-to-b from-mint to-transparent" />
        </div>
      </section>

      <Marquee items={['Member CRM', 'QR & RFID check-in', 'Class waitlists', 'Trainer rosters', 'Asset maintenance', 'POS & inventory', 'Revenue forecasting', 'GDPR ready', 'Multi-currency', 'Realtime occupancy']} />

      {/* ------------------------------ MODULES ------------------------------ */}
      <section id="modules" className="relative py-24 sm:py-32">
        <div className="container-x">
          <SectionHeading eyebrow="Platform" title={t('modules.title')} sub={t('modules.sub')} />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m, i) => (
              <Reveal key={m.title} delay={i * 0.05}>
                <Tilt className="h-full">
                  <div className={`group relative h-full overflow-hidden rounded-3xl border bg-gradient-to-br from-surface to-ink p-6 transition ${ACCENT[m.accent]}`}>
                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-2xl transition group-hover:bg-white/10" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-xl">
                      {m.icon}
                    </div>
                    <h3 className="relative mt-5 font-display text-lg font-semibold">{m.title}</h3>
                    <p className="relative mt-2 text-sm leading-relaxed text-muted">{m.desc}</p>
                    <span className="relative mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35 transition group-hover:gap-3 group-hover:text-mint">
                      Explore
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- LIVE CONSOLE --------------------------- */}
      <section className="relative py-24">
        <div className="container-x grid items-center gap-12 lg:grid-cols-[1fr_1.15fr]">
          <Reveal>
            <div>
              <span className="eyebrow">Live operations</span>
              <h2 className="section-title mt-5">
                One console. <span className="text-gradient">Every club.</span>
              </h2>
              <p className="mt-5 max-w-lg leading-relaxed text-muted">
                Front desk, coaches and finance all read the same live numbers — occupancy, revenue, tickets and class fill rate, refreshed as it happens.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  'Role-based access for admin, trainer and member',
                  'Revenue, expense and cohort analytics out of the box',
                  'Equipment downtime and safety scoring tracked per asset',
                  'Works offline-first on the member mobile experience',
                ].map((li) => (
                  <li key={li} className="flex items-start gap-3 text-sm text-bone/85">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint/15 text-mint">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                    {li}
                  </li>
                ))}
              </ul>
              <Link to="/signin" className="btn-primary mt-8">
                {t('cta.button')}
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <Tilt max={7}>
              <div className="glass relative overflow-hidden rounded-[28px] p-5 shadow-card">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint to-transparent" />
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-coral/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-mint/80" />
                    <span className="ms-3 font-mono text-[11px] text-muted">gymflow.io/console</span>
                  </div>
                  <Badge tone="success">● live</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-5 sm:grid-cols-3">
                  {[
                    { k: 'Active members', v: stats?.members ?? 640, tone: 'text-mint' },
                    { k: 'Classes running', v: stats?.classes ?? 48, tone: 'text-violet' },
                    { k: 'Coaches', v: stats?.trainers ?? 24, tone: 'text-sky' },
                    { k: 'Clubs', v: stats?.locations ?? 3, tone: 'text-coral' },
                    { k: 'This week sessions', v: stats?.sessionsThisWeek ?? 96, tone: 'text-amber' },
                    { k: 'Uptime', v: '99.9%', tone: 'text-mint' },
                  ].map((s) => (
                    <div key={s.k} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                      <p className={`font-display text-xl font-bold ${s.tone}`}>{typeof s.v === 'number' ? s.v.toLocaleString() : s.v}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{s.k}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Member growth</p>
                    <span className="font-mono text-[11px] text-mint">+18.4% QoQ</span>
                  </div>
                  <div className="flex h-24 items-end gap-1.5">
                    {[34, 41, 38, 52, 48, 61, 58, 72, 68, 80, 76, 92].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        whileInView={{ height: `${h}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.05, duration: 0.7, ease: 'easeOut' }}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-mint/25 to-mint"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Tilt>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ CLASSES ------------------------------ */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Timetable" title={t('classes.title')} sub={t('classes.sub')} align="left" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.slice(0, 6).map((s, i) => {
              const left = Math.max(0, s.capacity - s.booked);
              const pct = Math.min(100, Math.round((s.booked / (s.capacity || 1)) * 100));
              return (
                <Reveal key={s._id} delay={i * 0.06}>
                  <Tilt max={8}>
                    <article className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-surface/60 p-5 transition hover:border-white/25">
                      <div className="absolute inset-x-0 top-0 h-1" style={{ background: s.classType?.color || '#00E5A0' }} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: s.classType?.color }}>
                            {s.classType?.category?.replace('-', ' ')}
                          </p>
                          <h3 className="mt-1.5 font-display text-lg font-bold">{s.title}</h3>
                        </div>
                        <span className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 font-mono text-[11px] text-bone">
                          {s.start}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                        <span className="chip">{date(s.date, { year: false })}</span>
                        <span className="chip">{s.trainer?.jobTitle || 'Coach'}</span>
                        <span className="chip">{s.classType?.durationMin || 45} min</span>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-muted">{left > 0 ? `${left} ${t('classes.seats')}` : 'Waitlist open'}</span>
                          <span className="font-mono text-bone/70">{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ background: left > 0 ? (s.classType?.color || '#00E5A0') : '#FF4D6D' }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => handleBook(s._id)}
                        className={`mt-5 w-full ${left > 0 ? 'btn-ghost group-hover:border-mint/60 group-hover:bg-mint/10' : 'btn bg-white/8 text-muted'}`}
                      >
                        {left > 0 ? t('classes.book') : t('classes.booked')}
                      </button>
                    </article>
                  </Tilt>
                </Reveal>
              );
            })}
          </div>
          {!sessions.length && (
            <div className="glass rounded-3xl p-10 text-center text-sm text-muted">Loading the timetable…</div>
          )}
        </div>
      </section>

      {/* ------------------------------ GALLERY ------------------------------ */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Facilities" title={t('gallery.title')} sub={t('gallery.sub')} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gallery.slice(0, 8).map((g, i) => (
              <Reveal key={g._id} delay={i * 0.05}>
                <Link
                  to="/gallery"
                  className={`group relative block overflow-hidden rounded-3xl border border-white/10 ${
                    i === 0 || i === 5 ? 'md:col-span-2 md:row-span-2 aspect-square' : 'aspect-[4/3]'
                  }`}
                >
                  <img
                    src={g.thumbnail || g.url}
                    alt={g.title}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent opacity-80" />
                  <div className="absolute inset-x-0 bottom-0 translate-y-2 p-4 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    <p className="font-display text-sm font-semibold">{g.title}</p>
                    <p className="text-[11px] uppercase tracking-widest text-mint">{g.category}</p>
                  </div>
                  <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-black/40 backdrop-blur">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/gallery" className="btn-ghost">
              {t('gallery.view')}
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------ PRICING ------------------------------ */}
      <section id="pricing" className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Membership" title={t('pricing.title')} sub={t('pricing.sub')} />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {plans.slice(0, 4).map((p, i) => (
              <Reveal key={p._id} delay={i * 0.07}>
                <Tilt max={9} className="h-full">
                  <div
                    className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 transition ${
                      p.popular ? 'border-mint/50 bg-gradient-to-b from-mint/10 to-surface shadow-glow' : 'border-white/10 bg-surface/70'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute end-4 top-4 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-void">
                        {t('pricing.popular')}
                      </span>
                    )}
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: p.color }}>
                      {p.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">{p.tagline}</p>
                    <div className="mt-5 flex items-end gap-1.5">
                      <span className="font-display text-4xl font-black tracking-tight">{money(p.price)}</span>
                      <span className="pb-1.5 text-xs text-muted">{t('pricing.month')}</span>
                    </div>
                    <ul className="mt-5 flex-1 space-y-2.5">
                      {(p.features || []).slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-2 text-[13px] text-bone/80">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.color }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={isAuthenticated ? '/app/membership' : '/register'}
                      className={`mt-6 w-full ${p.popular ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {t('pricing.choose')}
                    </Link>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- REVIEWS ----------------------------- */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Feedback" title={t('reviews.title')} sub={t('reviews.sub')} />
          <div className="grid gap-5 md:grid-cols-3">
            {reviews.slice(0, 6).map((r, i) => (
              <Reveal key={r._id} delay={i * 0.06}>
                <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-surface/60 p-6">
                  <div className="flex gap-1 text-amber">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={s < r.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  {r.title && <h4 className="mt-4 font-display font-semibold">{r.title}</h4>}
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">“{r.comment}”</p>
                  <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet to-mint font-display text-xs font-bold text-void">
                      {r.name?.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{r.name}</p>
                      <p className="text-[11px] text-muted">{r.role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- LOCATIONS ----------------------------- */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow="Locations" title="Three clubs, one platform" sub="Every location shares live capacity, stock, schedules and reporting." />
          <div className="grid gap-5 md:grid-cols-3">
            {locations.map((l, i) => (
              <Reveal key={l._id} delay={i * 0.08}>
                <Tilt max={8}>
                  <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-surface to-ink p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-[11px] text-mint">{l.code}</p>
                        <h3 className="mt-1 font-display text-xl font-bold">{l.name}</h3>
                        <p className="mt-1 text-sm text-muted">{l.city}, {l.country}</p>
                      </div>
                      <Badge tone={l.status === 'active' ? 'success' : 'warn'}>{l.status}</Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      {[
                        { k: 'Capacity', v: l.capacity },
                        { k: 'Sq ft', v: l.sqft?.toLocaleString() },
                        { k: 'Hours', v: l.openHours },
                      ].map((x) => (
                        <div key={x.k} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                          <p className="font-display text-sm font-bold">{x.v}</p>
                          <p className="text-[9px] uppercase tracking-widest text-muted">{x.k}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(l.facilities || []).slice(0, 4).map((f) => (
                        <span key={f} className="chip">{f}</span>
                      ))}
                    </div>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- CTA -------------------------------- */}
      <section className="relative py-24">
        <div className="container-x">
          <Reveal>
            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br from-violet/25 via-ink to-mint/15 p-10 text-center sm:p-16">
              <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mint/25 blur-[100px]" />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-coral/25 blur-[100px]" />
              <div className="relative">
                <h2 className="section-title mx-auto max-w-3xl">{t('cta.title')}</h2>
                <p className="mx-auto mt-5 max-w-xl text-muted">{t('cta.text')}</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/register" className="btn-primary !px-8 !py-4 text-[15px]">
                    {t('cta.button')}
                  </Link>
                  <Link to="/contact" className="btn-ghost !px-8 !py-4 text-[15px]">
                    Talk to sales
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
