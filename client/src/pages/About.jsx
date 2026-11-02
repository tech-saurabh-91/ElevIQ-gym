import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CountUp, Reveal, SectionHeading, Tilt } from '../components/ui';
import { useLocale } from '../lib/i18n';
import api from '../lib/api';

const TIMELINE = [
  { year: '2019', title: 'A spreadsheet that would not die', body: 'Two coaches in Bengaluru start tracking 500 members across four tabs. It breaks every Saturday.' },
  { year: '2021', title: 'First club on GymFlow', body: 'Member CRM, QR check-in and class booking go live. Front-desk time per visit drops by 71%.' },
  { year: '2023', title: 'Austin and Berlin', body: 'Multi-currency, multi-timezone and tax-ready invoicing ship as three clubs run on one console.' },
  { year: '2025', title: 'The full stack', body: 'POS, equipment maintenance, payroll signals and forecasting join the platform.' },
  { year: 'Today', title: '500+ members per club', body: 'Operators run entire facilities from a single command centre — on any device, in six languages.' },
];

const VALUES = [
  { icon: '⚡', title: 'Operator first', body: 'Every screen is designed for a busy Saturday shift, not a sales demo.' },
  { icon: '🔒', title: 'Trust by default', body: 'RBAC, encryption at rest and in transit, GDPR-ready export and erasure flows.' },
  { icon: '🌐', title: 'Borderless', body: 'Currencies, languages, tax rules and timezones are first-class, not plugins.' },
  { icon: '📈', title: 'Measured, not guessed', body: 'If it cannot be instrumented, it does not ship. Retention, fill rate, downtime.' },
  { icon: '🧩', title: 'Modular by design', body: 'Turn on POS today, payroll signals tomorrow. No rip-and-replace.' },
  { icon: '🤝', title: 'Humans on call', body: '24-hour human replies, migration included, no support maze.' },
];

const TEAM = [
  { name: 'Aria Kapoor', role: 'Founder & CEO', bio: 'Ran three clubs before writing a line of code.', accent: 'from-mint to-sky' },
  { name: 'Marcus Reed', role: 'Head of Coaching', bio: 'Ex-national weightlifting squad. Writes the class engine.', accent: 'from-coral to-amber' },
  { name: 'Lena Fischer', role: 'Head of Design', bio: 'Obsessed with interfaces that survive a 6am rush.', accent: 'from-violet to-coral' },
  { name: 'Tom Becker', role: 'VP Engineering', bio: 'Scaled two POS platforms to a million transactions.', accent: 'from-sky to-mint' },
  { name: 'Nadia Haddad', role: 'Head of Operations', bio: 'Member #1 of every club we have launched.', accent: 'from-amber to-violet' },
  { name: 'Yuki Tanaka', role: 'Data & Insights', bio: 'Turns visit logs into retention forecasts.', accent: 'from-mint to-violet' },
];

export default function About() {
  const { t } = useLocale();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/site-stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pb-20 pt-36">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-violet/20 blur-[140px]" />
        <div className="container-x relative">
          <Reveal>
            <span className="eyebrow">{t('nav.about')}</span>
            <h1 className="mt-6 max-w-4xl font-display text-[clamp(2.4rem,6.5vw,5rem)] font-black leading-[0.95] tracking-tight">
              {t('about.title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{t('about.sub')}</p>
          </Reveal>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: t('stats.members'), value: stats?.members ?? 640, suffix: '+' },
              { label: 'Clubs live', value: stats?.locations ?? 3, suffix: '' },
              { label: 'Sessions / week', value: stats?.sessionsThisWeek ?? 48, suffix: '' },
              { label: 'Countries', value: 3, suffix: '' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 0.07}>
                <div className="glass rounded-2xl p-5">
                  <p className="font-display text-3xl font-black">
                    <CountUp to={s.value} />
                    {s.suffix}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Story timeline */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow={t('about.story')} title="From four tabs to one console" sub="Every feature in GymFlow exists because a specific Saturday shift demanded it." align="left" />
          <div className="relative">
            <div className="absolute inset-y-0 start-[19px] w-px bg-gradient-to-b from-mint via-violet to-transparent md:start-1/2" />
            <div className="space-y-8">
              {TIMELINE.map((item, i) => (
                <Reveal key={item.year} delay={i * 0.06}>
                  <div className={`relative flex gap-6 md:gap-0 ${i % 2 ? 'md:flex-row-reverse' : ''}`}>
                    <div className="relative z-10 ms-0 md:w-1/2 md:px-10">
                      <Tilt max={6}>
                        <div className="glass rounded-3xl p-6">
                          <p className="font-mono text-xs font-semibold text-mint">{item.year}</p>
                          <h3 className="mt-2 font-display text-lg font-bold">{item.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                        </div>
                      </Tilt>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mission / vision */}
      <section className="relative py-16">
        <div className="container-x grid gap-5 md:grid-cols-2">
          {[
            { k: t('about.mission'), v: t('about.missionText'), tone: 'from-mint/20 to-transparent border-mint/25' },
            { k: t('about.vision'), v: t('about.visionText'), tone: 'from-violet/20 to-transparent border-violet/25' },
          ].map((x, i) => (
            <Reveal key={x.k} delay={i * 0.1}>
              <Tilt max={7} className="h-full">
                <div className={`h-full rounded-3xl border bg-gradient-to-br to-surface p-8 ${x.tone}`}>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">{x.k}</p>
                  <p className="mt-4 font-display text-2xl font-semibold leading-snug">{x.v}</p>
                </div>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow={t('about.values')} title="How we build" sub="Six principles that decide what makes it into the product." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.05}>
                <div className="group h-full rounded-3xl border border-white/10 bg-surface/60 p-6 transition hover:border-mint/40">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl transition group-hover:scale-110">
                    {v.icon}
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="relative py-24">
        <div className="container-x">
          <SectionHeading eyebrow={t('about.team')} title="Operators, coaches, engineers" sub="The people accountable for your Saturday shift going smoothly." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((m, i) => (
              <Reveal key={m.name} delay={i * 0.06}>
                <Tilt max={10}>
                  <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-surface/70 p-6">
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${m.accent}`} />
                    <div className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br ${m.accent} font-display text-lg font-black text-void`}>
                      {m.name.split(' ').map((w) => w[0]).join('')}
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold">{m.name}</h3>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mint">{m.role}</p>
                    <p className="mt-3 text-sm text-muted">{m.bio}</p>
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative pb-28 pt-8">
        <div className="container-x">
          <Reveal>
            <div className="glass relative overflow-hidden rounded-[36px] p-10 text-center">
              <motion.div
                className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(0,229,160,0.12),rgba(123,97,255,0.12),rgba(255,77,109,0.12),rgba(0,229,160,0.12))]"
                animate={{ rotate: 360 }}
                transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative">
                <h2 className="section-title mx-auto max-w-2xl">Come see it running on real data</h2>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Link to="/signin" className="btn-primary !px-7 !py-3.5">{t('cta.button')}</Link>
                  <Link to="/contact" className="btn-ghost !px-7 !py-3.5">Book a walkthrough</Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
